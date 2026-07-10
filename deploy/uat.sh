#!/usr/bin/env bash
# Start/stop the UAT copy of the site (dev server with hot reload).
#
#   bash deploy/uat.sh          start on http://157.173.123.91:3001
#   bash deploy/uat.sh stop     stop it
#   bash deploy/uat.sh status   is it running?
#
# UAT lives in /home/hal/UAT/farah-nuxt with its own DB and uploads;
# nginx/farahali.org only ever talks to the production build on port 3000.

set -euo pipefail

UAT_DIR="/home/hal/UAT/farah-nuxt"
PORT=3001
HOST=157.173.123.91
LOG="$UAT_DIR/uat-dev.log"
PIDFILE="$UAT_DIR/.uat-dev.pid"

running() {
  [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null
}

case "${1:-start}" in
  start)
    if running; then
      echo "already running (pid $(cat "$PIDFILE")) — http://$HOST:$PORT"
      exit 0
    fi
    cd "$UAT_DIR"
    NUXT_IGNORE_LOCK=1 nohup node node_modules/nuxt/bin/nuxt.mjs dev --host "$HOST" --port "$PORT" > "$LOG" 2>&1 &
    echo $! > "$PIDFILE"
    # Wait until it answers; a detached launch dies if we exit too early.
    for i in $(seq 1 60); do
      if curl -sf -o /dev/null "http://$HOST:$PORT/"; then
        echo "UAT up: http://$HOST:$PORT (pid $(cat "$PIDFILE"), log: $LOG)"
        exit 0
      fi
      sleep 1
    done
    echo "did not come up after 60s — check $LOG" >&2
    exit 1
    ;;
  stop)
    if running; then
      pkill -P "$(cat "$PIDFILE")" 2>/dev/null || true
      kill "$(cat "$PIDFILE")" 2>/dev/null || true
      rm -f "$PIDFILE"
      echo "UAT stopped"
    else
      rm -f "$PIDFILE"
      echo "UAT not running"
    fi
    ;;
  status)
    if running; then
      echo "running (pid $(cat "$PIDFILE")) — http://$HOST:$PORT"
    else
      echo "not running"
    fi
    ;;
  *)
    echo "usage: $0 [start|stop|status]" >&2
    exit 1
    ;;
esac
