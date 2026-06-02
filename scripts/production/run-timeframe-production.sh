#!/usr/bin/env bash
set -euo pipefail

TIMEFRAME="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "${SCRIPT_DIR}/../.." && pwd)}"
LOG_DIR=".data/logs"
LOCK_DIR=".data/locks"
LOCK_ACQUIRED=0

usage() {
  printf 'Usage: %s <1h|4h|1d|1w>\n' "$0" >&2
}

configure_timeframe() {
  case "$TIMEFRAME" in
    1h)
      STALE_LOCK_SECONDS=5400
      TARGET_COUNT=5000
      SYNC_LIMIT=500
      ;;
    4h)
      STALE_LOCK_SECONDS=14400
      TARGET_COUNT=5000
      SYNC_LIMIT=500
      ;;
    1d)
      STALE_LOCK_SECONDS=43200
      TARGET_COUNT=3000
      SYNC_LIMIT=200
      ;;
    1w)
      STALE_LOCK_SECONDS=86400
      TARGET_COUNT=1000
      SYNC_LIMIT=100
      ;;
    *)
      usage
      exit 1
      ;;
  esac

  LOCK_FILE="${LOCK_DIR}/run-${TIMEFRAME}-production.lock"
}

timestamp() {
  date -u "+%Y-%m-%dT%H:%M:%SZ"
}

log() {
  printf '[%s] %s\n' "$(timestamp)" "$*"
}

load_env() {
  if [[ -f ".env" ]]; then
    log "Loading environment from .env."
    set -a
    # shellcheck disable=SC1091
    source ".env"
    set +a
    return
  fi

  log ".env not found; using existing environment."
}

validate_required_env() {
  local missing=()
  local name

  for name in DATABASE_URL REDIS_URL; do
    if [[ -z "${!name:-}" ]]; then
      missing+=("$name")
    fi
  done

  if (( ${#missing[@]} > 0 )); then
    log "Missing required environment variables: ${missing[*]}"
    exit 1
  fi

  log "Required environment variables are present."
}

lock_mtime() {
  stat -c %Y "$LOCK_FILE" 2>/dev/null ||
    stat -f %m "$LOCK_FILE" 2>/dev/null ||
    date +%s
}

lock_age_seconds() {
  local now
  local mtime

  now="$(date +%s)"
  mtime="$(lock_mtime)"

  if [[ ! "$mtime" =~ ^[0-9]+$ ]]; then
    mtime="$now"
  fi

  printf '%s' "$((now - mtime))"
}

write_lock() {
  (
    set -o noclobber
    printf 'pid=%s\nstarted_at=%s\nproject_dir=%s\ntimeframe=%s\n' \
      "$$" \
      "$(timestamp)" \
      "$PROJECT_DIR" \
      "$TIMEFRAME" > "$LOCK_FILE"
  ) 2>/dev/null
}

acquire_lock() {
  if write_lock; then
    LOCK_ACQUIRED=1
    log "Acquired lock: $LOCK_FILE"
    return
  fi

  local age
  age="$(lock_age_seconds)"

  if (( age >= STALE_LOCK_SECONDS )); then
    log "Removing stale lock (${age}s old): $LOCK_FILE"
    rm -f "$LOCK_FILE"

    if write_lock; then
      LOCK_ACQUIRED=1
      log "Acquired lock after stale cleanup: $LOCK_FILE"
      return
    fi

    log "Failed to acquire lock after stale cleanup: $LOCK_FILE"
    exit 1
  fi

  log "Skipping run because another ${TIMEFRAME} production job is active (lock age ${age}s, stale threshold ${STALE_LOCK_SECONDS}s)."
  exit 0
}

cleanup() {
  local status=$?

  if [[ "$LOCK_ACQUIRED" == "1" ]]; then
    if rm -f "$LOCK_FILE"; then
      log "Released lock: $LOCK_FILE"
    else
      log "Failed to release lock: $LOCK_FILE"
    fi
  fi

  if [[ "$status" -eq 0 ]]; then
    log "${TIMEFRAME} production job finished successfully."
  else
    log "${TIMEFRAME} production job failed with exit code $status."
  fi

  exit "$status"
}

main() {
  configure_timeframe
  cd "$PROJECT_DIR"
  mkdir -p "$LOG_DIR" "$LOCK_DIR"

  log "Starting ${TIMEFRAME} production job."
  log "Project directory: $PROJECT_DIR"
  load_env
  validate_required_env
  acquire_lock
  trap cleanup EXIT

  log "Running ${TIMEFRAME} market latest sync with sync limit ${SYNC_LIMIT}."
  pnpm market:sync:pg -- --timeframe "$TIMEFRAME" --all-symbols --asset-class crypto --limit "$SYNC_LIMIT" --confirm-large-sync
  log "${TIMEFRAME} market latest sync completed."

  log "Running ${TIMEFRAME} market backfill with target count ${TARGET_COUNT}."
  pnpm market:backfill:pg -- --timeframe "$TIMEFRAME" --all-symbols --asset-class crypto --target-count "$TARGET_COUNT" --limit 1000 --confirm-large-sync
  log "${TIMEFRAME} market backfill completed."

  log "Running ${TIMEFRAME} scanner."
  pnpm scanner:run:pg -- --timeframe "$TIMEFRAME" --all-symbols --asset-class crypto --limit 1000 --confirm-large-sync
  log "${TIMEFRAME} scanner completed."
}

main "$@"
