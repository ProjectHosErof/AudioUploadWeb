#!/usr/bin/env bash
# Check that every completed recording's audio is in the backup bucket, at the
# size the DB recorded (ADR-012 §5). A backup nobody checks is usually a
# backup that has been failing quietly.
#
#   scripts/backup/verify.sh [CUTOFF_ISO8601]
#
# Only rows created before CUTOFF are checked (default: one hour ago), so an
# upload that completed while the copy was running isn't reported as missing.
#
# stdout: one JSON summary line. stderr: progress, plus up to 10 problem keys
# (keys are raw/YYYY/MM/<uuid>.<ext> — no personal data).
# Exit 1 if anything is missing or the wrong size.
#
# Env: BACKUP_DB_URL, DST_R2_ACCOUNT_ID, DST_R2_ACCESS_KEY_ID,
#      DST_R2_SECRET_ACCESS_KEY, optional DST_BUCKET.

source "$(dirname "$0")/lib.sh"
require_cmd rclone psql awk
require_env BACKUP_DB_URL
configure_dst

iso_from_epoch() {
  date -u -d "@$1" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -r "$1" +%Y-%m-%dT%H:%M:%SZ
}
cutoff="${1:-$(iso_from_epoch $(($(date +%s) - 3600)))}"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

db -F $'\t' -v cutoff="$cutoff" >"$work/expected.tsv" <<'SQL'
SELECT r2_key, coalesce(file_size_bytes::text, '')
FROM public.recordings
WHERE upload_status = 'completed' AND created_at < :'cutoff'::timestamptz
ORDER BY 1;
SQL

rclone lsf -R --files-only --format ps --separator $'\t' "${RCLONE_FLAGS[@]}" \
  "dst:$DST_BUCKET/raw" | sed 's#^#raw/#' >"$work/actual.tsv"

# expected: key<TAB>size-or-empty   actual: key<TAB>size
awk -F'\t' -v report="$work/problems.txt" '
  FILENAME ~ /actual\.tsv$/ { size[$1] = $2; listed++; next }
  {
    checked++
    if (!($1 in size)) { missing++; print "missing  " $1 > report }
    else if ($2 != "" && size[$1] != $2) { mismatched++; print "size     " $1 > report }
  }
  END {
    printf "{\"cutoff\":\"%s\",\"checked\":%d,\"missing\":%d,\"size_mismatches\":%d,\"backup_objects\":%d}\n",
      cutoff, checked, missing, mismatched, listed
  }
' cutoff="$cutoff" "$work/actual.tsv" "$work/expected.tsv" >"$work/summary.json"

cat "$work/summary.json"
if [[ -s "$work/problems.txt" ]]; then
  echo "verify FAILED — first problems:" >&2
  head -10 "$work/problems.txt" >&2
  exit 1
fi
echo "verify ok" >&2
