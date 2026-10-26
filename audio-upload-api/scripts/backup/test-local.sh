#!/usr/bin/env bash
# End-to-end test of the backup scripts with no cloud access at all: a local
# Postgres 17 built from the real migrations stands in for Supabase, and local
# directories stand in for the two R2 buckets. Exercises the copy, the
# encrypted dump, verify (including a deliberately missing object), the
# missing-policy refusal, and a full restore drill.
#
#   scripts/backup/test-local.sh        # needs: postgresql@17, rclone, age, jq
set -euo pipefail
command -v brew >/dev/null && PATH="$(brew --prefix postgresql@17)/bin:$PATH"
API="$(cd "$(dirname "$0")/../.." && pwd)"
T="$(mktemp -d)"; S="$(mktemp -d)"  # S: short path for the Postgres socket (macOS caps it at 103 bytes)
trap 'pg_ctl -D "$T/srcpg" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$T" "$S"' EXIT
PORT=54330

initdb -D "$T/srcpg" -U postgres --auth=trust -E UTF8 >/dev/null
pg_ctl -D "$T/srcpg" -l "$T/srcpg.log" -w -o "-p $PORT -k $S -c listen_addresses=''" start >/dev/null
P() { psql -h "$S" -p $PORT -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

P <<'SQL'
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid';
SQL
for f in "$API"/drizzle/migrations/0*.sql; do P -f "$f" >/dev/null; echo "applied $(basename "$f")"; done

AUTH=11111111-1111-1111-1111-111111111111
P <<SQL
INSERT INTO auth.users VALUES ('$AUTH', 'a@example.com');
INSERT INTO services VALUES ('liturgy','Liturgy'); INSERT INTO seasons VALUES ('annual','Annual');
INSERT INTO hymns VALUES ('intro-to-doxologies','Intro to Doxologies',NULL); INSERT INTO languages VALUES ('lang-coptic','Coptic');
INSERT INTO hymn_types VALUES ('doxology','Doxology'); INSERT INTO tunes VALUES ('adam','Adam');
INSERT INTO hymn_type_links VALUES ('intro-to-doxologies','doxology'); INSERT INTO hymn_tunes VALUES ('intro-to-doxologies','adam');
INSERT INTO hymn_placements VALUES ('intro-to-doxologies','annual','liturgy',1);
INSERT INTO contributors (id, auth_user_id, email) VALUES ('22222222-2222-2222-2222-222222222222','$AUTH','a@example.com');
INSERT INTO contributors (email) VALUES ('b@example.com');
INSERT INTO admins (email, auth_user_id) VALUES ('a@example.com','$AUTH');
INSERT INTO subscribers (email) VALUES ('c@example.com');
INSERT INTO recordings (id, r2_key, content_type, file_size_bytes, service_slug, season_slug, hymn_slug, hymn_label, languages, upload_status, review_status, reviewed_by, created_at)
VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001','raw/2026/10/aaaaaaaa-0000-0000-0000-000000000001.mp3','audio/mpeg',1000,'liturgy','annual','intro-to-doxologies','Intro',' ["lang-coptic"]','completed','ready','$AUTH', now() - interval '2 days'),
 ('aaaaaaaa-0000-0000-0000-000000000002','raw/2026/10/aaaaaaaa-0000-0000-0000-000000000002.mp3','audio/mpeg',2000,'liturgy','annual','intro-to-doxologies','Intro','["lang-coptic"]','completed','processing',NULL, now() - interval '2 days'),
 ('aaaaaaaa-0000-0000-0000-000000000003','raw/2026/10/aaaaaaaa-0000-0000-0000-000000000003.m4a','audio/mp4',NULL,'liturgy','annual','intro-to-doxologies','Intro','["lang-coptic"]','completed','processing',NULL, now() - interval '2 days'),
 ('aaaaaaaa-0000-0000-0000-000000000004','raw/2026/10/aaaaaaaa-0000-0000-0000-000000000004.mp3','audio/mpeg',NULL,'liturgy','annual','intro-to-doxologies','Intro','["lang-coptic"]','pending','processing',NULL, now());
SQL
echo "seeded"

mkdir -p "$T/src/raw/2026/10" "$T/src/datasets/20261001T000000Z" "$T/dst"
head -c 1000 /dev/urandom >"$T/src/raw/2026/10/aaaaaaaa-0000-0000-0000-000000000001.mp3"
head -c 2000 /dev/urandom >"$T/src/raw/2026/10/aaaaaaaa-0000-0000-0000-000000000002.mp3"
head -c 3000 /dev/urandom >"$T/src/raw/2026/10/aaaaaaaa-0000-0000-0000-000000000003.m4a"
echo "id,label" >"$T/src/datasets/20261001T000000Z/manifest.csv"
echo '{"latest":"20261001T000000Z"}' >"$T/src/datasets/latest.json"

age-keygen -o "$T/test.key" 2>/dev/null
AGE_RECIPIENT="$(age-keygen -y "$T/test.key")"; export AGE_RECIPIENT
export RCLONE_CONFIG_SRC_TYPE=local RCLONE_CONFIG_DST_TYPE=local
export SRC_BUCKET="$T/src" DST_BUCKET="$T/dst"
export BACKUP_DB_URL="postgresql://backup_reader@/postgres?host=$S&port=$PORT"
export GIT_SHA=test

echo "=== run 1"; bash "$API/scripts/backup/run-backup.sh"
sleep 1
echo "=== run 2 (incremental, latest.json changed)"; echo '{"latest":"x"}' >"$T/src/datasets/latest.json"
bash "$API/scripts/backup/run-backup.sh"
echo "=== backup tree"; (cd "$T/dst" && find . -type f | sort)
echo "=== datasets/latest.json excluded?"; test ! -e "$T/dst/datasets/latest.json" && echo yes

echo "=== tamper: drop one backed-up object -> verify must fail"
mv "$T/dst/raw/2026/10/aaaaaaaa-0000-0000-0000-000000000002.mp3" "$T/held"
if bash "$API/scripts/backup/verify.sh"; then echo "UNEXPECTED PASS"; exit 1; else echo "verify failed as expected"; fi
mv "$T/held" "$T/dst/raw/2026/10/aaaaaaaa-0000-0000-0000-000000000002.mp3"

echo "=== RLS table without a backup_reader policy -> run must refuse"
P -c "CREATE TABLE public.new_thing (id int); ALTER TABLE public.new_thing ENABLE ROW LEVEL SECURITY; GRANT SELECT ON public.new_thing TO backup_reader;"
if bash "$API/scripts/backup/run-backup.sh" 2>"$T/err.txt"; then echo "UNEXPECTED PASS"; exit 1; else cat "$T/err.txt"; fi
P -c "DROP TABLE public.new_thing;"

echo "=== restore drill"
DRILL_PORT=54331 bash "$API/scripts/backup/restore-drill.sh" --identity "$T/test.key"

echo "=== plaintext check: no unencrypted dump left in backup"
if grep -rlq "PGDMP" "$T/dst"; then echo "PLAINTEXT DUMP FOUND IN BACKUP"; exit 1; fi; echo "none"
echo ALL_OK
