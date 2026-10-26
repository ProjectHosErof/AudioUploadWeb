#!/usr/bin/env bash
# Quarterly restore drill (ADR-012 §5). Proves the newest backup can actually
# be restored — until someone has done it, a backup is an assumption.
#
#   scripts/backup/restore-drill.sh --identity ~/path/to/phe-backup.key [--run runs/<stamp>.json]
#
# Touches nothing live. It downloads the dump named by the newest run record
# (or --run), checks its sha256, decrypts it with the OFFLINE age key into a
# private temp dir, restores it into a throwaway local Postgres started just
# for this, and compares row counts with the run record. Everything is
# deleted on exit.
#
# The restore follows the same order as a real one (DEPLOY.md → Restore
# runbook): pre-data, data, null identity links whose auth user doesn't exist,
# then post-data (where the foreign keys to auth.users are created).
#
# Env: DST_R2_ACCOUNT_ID, DST_R2_ACCESS_KEY_ID, DST_R2_SECRET_ACCESS_KEY,
#      optional DST_BUCKET, DRILL_PORT (default 54329).
# Needs Postgres 17 client+server binaries on PATH (initdb, pg_ctl, pg_restore,
# psql) — on macOS: brew install postgresql@17 and add $(brew --prefix postgresql@17)/bin.

source "$(dirname "$0")/lib.sh"
require_cmd rclone age jq initdb pg_ctl pg_restore psql
configure_dst

identity=""
run_key=""
while (($#)); do
  case "$1" in
    --identity) identity="$2"; shift 2 ;;
    --run) run_key="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ -r "$identity" ]] || { echo "--identity <age key file> is required and must be readable" >&2; exit 2; }

port="${DRILL_PORT:-54329}"
work="$(mktemp -d)"
chmod 700 "$work"
cleanup() {
  pg_ctl -D "$work/pg" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

sha256() { { sha256sum "$1" 2>/dev/null || shasum -a 256 "$1"; } | awk '{print $1}'; }

# --- Fetch and decrypt ------------------------------------------------------
if [[ -z "$run_key" ]]; then
  run_key="runs/$(rclone lsf --files-only "dst:$DST_BUCKET/runs" "${RCLONE_FLAGS[@]}" | sort | tail -1)"
fi
rclone copyto "dst:$DST_BUCKET/$run_key" "$work/run.json" "${RCLONE_FLAGS[@]}"
log "drilling $run_key (run status: $(jq -r .status "$work/run.json"))"

dump_key="$(jq -r .dump.key "$work/run.json")"
rclone copyto "dst:$DST_BUCKET/$dump_key" "$work/db.dump.age" "${RCLONE_FLAGS[@]}"
[[ "$(sha256 "$work/db.dump.age")" == "$(jq -r .dump.sha256 "$work/run.json")" ]] \
  || { echo "checksum mismatch: $dump_key is not the file the run recorded" >&2; exit 1; }
age --decrypt --identity "$identity" --output "$work/db.dump" "$work/db.dump.age"
log "decrypted $dump_key"

# --- Throwaway Postgres -----------------------------------------------------
initdb -D "$work/pg" -U postgres --auth=trust -E UTF8 >/dev/null
pg_ctl -D "$work/pg" -l "$work/pg.log" -w \
  -o "-p $port -k $work -c listen_addresses=''" start >/dev/null
pg() { psql -h "$work" -p "$port" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }
# --no-owner --no-privileges: a real Supabase dump carries ownership and
# default privileges for Supabase's internal roles (supabase_admin, …) that a
# throwaway Postgres doesn't have. The drill proves the DATA restores; a real
# restore into a Supabase project keeps them (DEPLOY.md → Restore runbook).
restore() {
  pg_restore -h "$work" -p "$port" -U postgres -d postgres --exit-on-error \
    --no-owner --no-privileges "$@" "$work/db.dump"
}

# What a Supabase project provides that a `public`-only dump assumes: the API
# roles named in grants and policies, and the slice of the auth schema the
# migrations reference (auth.users for foreign keys, auth.uid() in policies).
pg <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE ROLE backup_reader NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid';
DROP SCHEMA public CASCADE;
SQL

restore --section=pre-data
restore --section=data

# Identity links can only survive if their auth user did. Here auth.users is
# empty, so all of them are cleared — exactly the no-auth-restore case.
# Contributors re-link by verified email on next sign-in (/me/link).
pg <<'SQL'
UPDATE public.contributors SET auth_user_id = NULL
  WHERE auth_user_id IS NOT NULL AND auth_user_id NOT IN (SELECT id FROM auth.users);
UPDATE public.admins SET auth_user_id = NULL
  WHERE auth_user_id IS NOT NULL AND auth_user_id NOT IN (SELECT id FROM auth.users);
UPDATE public.recordings SET reviewed_by = NULL
  WHERE reviewed_by IS NOT NULL AND reviewed_by NOT IN (SELECT id FROM auth.users);
SQL

restore --section=post-data
log "restore complete"

# --- Compare ----------------------------------------------------------------
restored="$(pg -At <<'SQL'
SELECT coalesce(json_object_agg(t.table_name, (xpath('/row/n/text()',
         query_to_xml(format('SELECT count(*) AS n FROM public.%I', t.table_name), false, true, '')))[1]::text::bigint
       ORDER BY t.table_name), '{}')
FROM information_schema.tables t
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE';
SQL
)"

# Counts are taken a moment after pg_dump's snapshot, so an upload landing in
# between shows as a difference of one or two in `recordings`. Rerun the drill
# before treating that as a failure; anything larger is real.
jq -n --argjson want "$(jq .table_counts "$work/run.json")" --argjson got "$restored" -r '
  ($want + $got | keys) as $tables
  | ($tables | map({t: ., want: $want[.], got: $got[.]}) | map(select(.want != .got))) as $diff
  | if ($diff | length) == 0
    then "drill ok — \($tables | length) tables match the run record"
    else "MISMATCH:\n" + ($diff | map("  \(.t): recorded \(.want), restored \(.got)") | join("\n"))
    end
' | tee "$work/result.txt"
grep -q '^drill ok' "$work/result.txt"
