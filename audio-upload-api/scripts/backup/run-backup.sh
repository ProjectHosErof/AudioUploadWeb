#!/usr/bin/env bash
# Nightly corpus backup (ADR-012). Run by .github/workflows/corpus-backup.yml;
# also runnable locally with the same environment.
#
#   1. Audio: copy raw/ and datasets/ from the live bucket to the backup bucket
#      in the separate Cloudflare account. COPY, never sync — a deletion in the
#      live bucket must never delete the backup. --immutable makes an attempt
#      to change an existing object fail loudly instead of overwriting it.
#   2. Database: pg_dump of `public` as backup_reader, encrypted with age
#      before it is written anywhere. Only the age PUBLIC key is here; the
#      private key is held offline.
#   3. Verify that every completed recording is in the backup (verify.sh).
#   4. Write runs/<timestamp>.json — counts, sizes, the dump's checksum — so
#      the history is auditable without decrypting anything, and the restore
#      drill has something to compare against.
#
# Env: SRC_R2_ACCOUNT_ID, SRC_R2_ACCESS_KEY_ID, SRC_R2_SECRET_ACCESS_KEY,
#      DST_R2_ACCOUNT_ID, DST_R2_ACCESS_KEY_ID, DST_R2_SECRET_ACCESS_KEY,
#      BACKUP_DB_URL, AGE_RECIPIENT; optional SRC_BUCKET, DST_BUCKET, GIT_SHA.

here="$(cd "$(dirname "$0")" && pwd)"
source "$here/lib.sh"
require_cmd rclone age pg_dump psql jq
require_env BACKUP_DB_URL AGE_RECIPIENT
configure_src
configure_dst

started_epoch="$(date +%s)"
started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

sha256() { { sha256sum "$1" 2>/dev/null || shasum -a 256 "$1"; } | awk '{print $1}'; }

# --- 0. Every RLS table must be readable by backup_reader -------------------
# Without a policy, pg_dump --enable-row-security would back the table up
# EMPTY and nothing would look wrong. See migration 0008.
uncovered="$(db <<'SQL'
SELECT string_agg(c.relname, ', ')
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = c.relname
      AND 'backup_reader' = ANY (p.roles) AND p.cmd IN ('SELECT', 'ALL')
  );
SQL
)"
if [[ -n "$uncovered" ]]; then
  echo "RLS tables with no backup_reader policy (would back up empty): $uncovered" >&2
  echo "Add: CREATE POLICY backup_reader_read_all ON public.<t> FOR SELECT TO backup_reader USING (true);" >&2
  exit 1
fi

# --- 1. Audio ---------------------------------------------------------------
log "copying raw/"
rclone copy "src:$SRC_BUCKET/raw" "dst:$DST_BUCKET/raw" \
  --immutable --checksum "${RCLONE_FLAGS[@]}"

# datasets/latest.json is a pointer the export rewrites each time; the
# versioned directories it points into are what matter, and they never change.
log "copying datasets/"
rclone copy "src:$SRC_BUCKET/datasets" "dst:$DST_BUCKET/datasets" \
  --immutable --checksum --exclude /latest.json "${RCLONE_FLAGS[@]}"

# --- 2. Database ------------------------------------------------------------
dump_key="db/$stamp.dump.age"
log "dumping database"
pg_dump "$BACKUP_DB_URL" --format=custom --schema=public --enable-row-security \
  | age --encrypt --recipient "$AGE_RECIPIENT" --output "$work/db.dump.age"
dump_bytes="$(wc -c <"$work/db.dump.age" | tr -d ' ')"
dump_sha="$(sha256 "$work/db.dump.age")"
rclone copyto "$work/db.dump.age" "dst:$DST_BUCKET/$dump_key" --immutable "${RCLONE_FLAGS[@]}"
log "dump uploaded ($dump_bytes bytes)"

# Row counts per table, recorded alongside the dump for the restore drill.
table_counts="$(db <<'SQL'
SELECT coalesce(json_object_agg(t.table_name, (xpath('/row/n/text()',
         query_to_xml(format('SELECT count(*) AS n FROM public.%I', t.table_name), false, true, '')))[1]::text::bigint
       ORDER BY t.table_name), '{}')
FROM information_schema.tables t
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE';
SQL
)"

# --- 3. Verify --------------------------------------------------------------
# Only rows older than an hour before the run started: their objects were in
# R2 before the copy began (presigned URLs live 15 minutes).
cutoff_epoch=$((started_epoch - 3600))
cutoff="$(date -u -d "@$cutoff_epoch" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -r "$cutoff_epoch" +%Y-%m-%dT%H:%M:%SZ)"
status=ok
verify_json="$("$here/verify.sh" "$cutoff")" || status=failed

# --- 4. Run record ----------------------------------------------------------
raw_size="$(rclone size --json "dst:$DST_BUCKET/raw" "${RCLONE_FLAGS[@]}")"
jq -n \
  --arg started "$started" \
  --arg finished "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg status "$status" \
  --arg git_sha "${GIT_SHA:-unknown}" \
  --arg dump_key "$dump_key" \
  --arg dump_sha "$dump_sha" \
  --argjson dump_bytes "$dump_bytes" \
  --argjson raw "$raw_size" \
  --argjson verify "${verify_json:-null}" \
  --argjson tables "$table_counts" \
  '{started: $started, finished: $finished, status: $status, git_sha: $git_sha,
    raw: {objects: $raw.count, bytes: $raw.bytes},
    dump: {key: $dump_key, bytes: $dump_bytes, sha256: $dump_sha},
    verify: $verify, table_counts: $tables}' >"$work/run.json"
rclone copyto "$work/run.json" "dst:$DST_BUCKET/runs/$stamp.json" --immutable "${RCLONE_FLAGS[@]}"

jq -c '{status, raw, dump: {bytes: .dump.bytes}, verify}' "$work/run.json"
[[ "$status" == ok ]] || { echo "backup verification failed — see above" >&2; exit 1; }
log "backup complete"
