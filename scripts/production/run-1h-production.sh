#!/usr/bin/env bash
set -euo pipefail

STALE_LOCK_SECONDS=5400
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "${SCRIPT_DIR}/../.." && pwd)}"
LOG_DIR=".data/logs"
LOCK_DIR=".data/locks"
LOCK_FILE="${LOCK_DIR}/run-1h-production.lock"
LOCK_ACQUIRED=0

timestamp() {
  date -u "+%Y-%m-%dT%H:%M:%SZ"
}

log() {
  printf '[%s] %s\n' "$(timestamp)" "$*"
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
    printf 'pid=%s\nstarted_at=%s\nproject_dir=%s\n' \
      "$$" \
      "$(timestamp)" \
      "$PROJECT_DIR" > "$LOCK_FILE"
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

  log "Skipping run because another 1h production job is active (lock age ${age}s, stale threshold ${STALE_LOCK_SECONDS}s)."
  exit 0
}

cleanup() {
  local status
  status=$?

  if [[ "$LOCK_ACQUIRED" == "1" ]]; then
    rm -f "$LOCK_FILE"
    log "Released lock: $LOCK_FILE"
  fi

  if [[ "$status" -eq 0 ]]; then
    log "1h production job finished successfully."
  else
    log "1h production job failed with exit status $status."
  fi
}

main() {
  cd "$PROJECT_DIR"
  mkdir -p "$LOG_DIR" "$LOCK_DIR"

  log "Starting 1h production job."
  log "Project directory: $PROJECT_DIR"
  acquire_lock
  trap cleanup EXIT

  log "Running 1h market backfill."
  pnpm market:backfill:pg -- --timeframe 1h --all-symbols --asset-class crypto --target-count 5000 --limit 1000 --confirm-large-sync
  log "1h market backfill completed."

  log "Running 1h scanner."
  pnpm scanner:run:pg -- --timeframe 1h --all-symbols --asset-class crypto --limit 1000 --confirm-large-sync
  log "1h scanner completed."
}

main "$@"
