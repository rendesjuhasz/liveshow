#!/bin/bash
set -u
HEALTH_URL="${LIVESHOW_HEALTH_URL:-http://127.0.0.1:3200/health}"
STATE_DIR="${LIVESHOW_WATCHDOG_DIR:-/var/lib/liveshow}"
FAIL_FILE="$STATE_DIR/health-fails"
RESTART_FILE="$STATE_DIR/restarts"
LOG_TAG="liveshow-api-watchdog"
MAX_FAILS=3
MAX_RESTARTS=5
WINDOW_SEC=600
UNIT="liveshow-api.service"

mkdir -p "$STATE_DIR"
fails=0
if [[ -f "$FAIL_FILE" ]]; then
    fails=$(cat "$FAIL_FILE" 2>/dev/null || echo 0)
fi
[[ "$fails" =~ ^[0-9]+$ ]] || fails=0

log() {
    logger -t "$LOG_TAG" -- "$*"
    echo "$LOG_TAG: $*"
}

snapshot() {
    local now rtmp ss_listen ss_states
    now=$(date -Iseconds)
    rtmp="unset"
    if grep -q '^RTMP_DISABLED=' /var/www/liveshow/backend/.env 2>/dev/null; then
        rtmp=$(grep '^RTMP_DISABLED=' /var/www/liveshow/backend/.env | tail -1)
    fi
    ss_listen=$(ss -lntp 2>/dev/null | grep -E ':3200\b' || echo "no-listen-3200")
    ss_states=$(ss -ant 2>/dev/null | awk 'NR>1 {c[$1]++} END {for (s in c) printf "%s=%s ", s, c[s]}')
    log "freeze snapshot at=$now $rtmp listen=[$ss_listen] tcp=[$ss_states]"
}

health_ok() {
    curl -sf --max-time 3 "$HEALTH_URL" | grep -q '"status":"ok"'
}

if health_ok; then
    echo 0 > "$FAIL_FILE"
    exit 0
fi

fails=$((fails + 1))
echo "$fails" > "$FAIL_FILE"
log "health fail count=$fails/$MAX_FAILS url=$HEALTH_URL"
snapshot

if (( fails < MAX_FAILS )); then
    exit 0
fi

now_ts=$(date +%s)
kept=""
count=0
if [[ -f "$RESTART_FILE" ]]; then
    while read -r ts; do
        [[ "$ts" =~ ^[0-9]+$ ]] || continue
        if (( now_ts - ts < WINDOW_SEC )); then
            kept="$kept$ts"$'\n'
            count=$((count + 1))
        fi
    done < "$RESTART_FILE"
fi

if (( count >= MAX_RESTARTS )); then
    log "restart skipped: already $count in last ${WINDOW_SEC}s (limit $MAX_RESTARTS)"
    exit 0
fi

if ! systemctl is-enabled --quiet "$UNIT" 2>/dev/null; then
    log "restart skipped: $UNIT is not enabled"
    exit 0
fi

log "restarting $UNIT after $fails consecutive health failures"
echo 0 > "$FAIL_FILE"
printf '%s%s\n' "$kept" "$now_ts" > "$RESTART_FILE"
systemctl restart "$UNIT"
log "restart issued for $UNIT"
