# shellcheck shell=bash
# Shared setup for the corpus backup scripts (ADR-012). Sourced, not run.
#
# Everything is configured from environment variables so the same scripts run
# in GitHub Actions and on a laptop, with no rclone config file on disk.
#
# The repository is public, so Actions logs are public: these scripts print
# counts and byte totals only — never connection strings, emails or rows.

set -euo pipefail

require_env() {
  local missing=()
  for name in "$@"; do
    [[ -n "${!name:-}" ]] || missing+=("$name")
  done
  if ((${#missing[@]})); then
    echo "missing required environment: ${missing[*]}" >&2
    exit 2
  fi
}

require_cmd() {
  for cmd in "$@"; do
    command -v "$cmd" >/dev/null || { echo "missing required command: $cmd" >&2; exit 2; }
  done
}

SRC_BUCKET="${SRC_BUCKET:-audio-uploads-dev}"
DST_BUCKET="${DST_BUCKET:-phe-corpus-backup}"

# Two rclone remotes, defined entirely by env:
#   src: — the main Cloudflare account, read-only token on the live bucket
#   dst: — the separate backup account, token scoped to the backup bucket
# NO_CHECK_BUCKET: the tokens are bucket-scoped and can't create buckets, so
# rclone must not try.
configure_remote() {
  local name="$1" account="$2" key="$3" secret="$4"
  local upper
  upper="$(echo "$name" | tr '[:lower:]' '[:upper:]')"
  export "RCLONE_CONFIG_${upper}_TYPE=s3"
  export "RCLONE_CONFIG_${upper}_PROVIDER=Cloudflare"
  export "RCLONE_CONFIG_${upper}_ACCESS_KEY_ID=${key}"
  export "RCLONE_CONFIG_${upper}_SECRET_ACCESS_KEY=${secret}"
  export "RCLONE_CONFIG_${upper}_ENDPOINT=https://${account}.r2.cloudflarestorage.com"
  export "RCLONE_CONFIG_${upper}_NO_CHECK_BUCKET=true"
}

# A remote already defined in the environment wins, so the scripts can be
# exercised against local directories (RCLONE_CONFIG_SRC_TYPE=local).
configure_src() {
  [[ -n "${RCLONE_CONFIG_SRC_TYPE:-}" ]] && return
  require_env SRC_R2_ACCOUNT_ID SRC_R2_ACCESS_KEY_ID SRC_R2_SECRET_ACCESS_KEY
  configure_remote src "$SRC_R2_ACCOUNT_ID" "$SRC_R2_ACCESS_KEY_ID" "$SRC_R2_SECRET_ACCESS_KEY"
}

configure_dst() {
  [[ -n "${RCLONE_CONFIG_DST_TYPE:-}" ]] && return
  require_env DST_R2_ACCOUNT_ID DST_R2_ACCESS_KEY_ID DST_R2_SECRET_ACCESS_KEY
  configure_remote dst "$DST_R2_ACCOUNT_ID" "$DST_R2_ACCESS_KEY_ID" "$DST_R2_SECRET_ACCESS_KEY"
}

# Quiet by default: one stats line at the end, no per-file output.
# shellcheck disable=SC2034  # used by the scripts that source this file
RCLONE_FLAGS=(--stats-one-line --stats=0 --log-level=ERROR)

# psql against the corpus DB as backup_reader. -X ignores any ~/.psqlrc.
# shellcheck disable=SC2120  # args are optional; most callers pass SQL on stdin
db() {
  psql "$BACKUP_DB_URL" -X -v ON_ERROR_STOP=1 -At "$@"
}

log() {
  echo "[$(date -u +%H:%M:%S)] $*"
}
