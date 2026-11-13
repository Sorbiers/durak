#!/usr/bin/env bash
# Stops and starts the table server on the VPS, without a deploy.
#
#   ./network.sh            status: running or not, and the tables in use now
#   ./network.sh stop       stop it, and keep it stopped after a reboot
#   ./network.sh start      start it, and have it start after a reboot
#   ./network.sh restart    stop and start: every table is closed
#   ./network.sh log        its last 50 log lines
#
# While it is stopped the game says that playing with guests is switched off. To take the Invite
# tab out of the game altogether, set NETWORK=off in network.env and deploy.
#
# The server, key and port come from deploy.env, as for deploy.sh.
set -euo pipefail
cd "$(dirname "$0")"

if [ -f deploy.env ]; then
  set -a
  . ./deploy.env
  set +a
fi
: "${DURAK_HOST:?set DURAK_HOST (user@server) in deploy.env}"
: "${DURAK_KEY:?set DURAK_KEY (path to the SSH private key) in deploy.env}"
SSH="ssh -p ${DURAK_PORT:-22} -i $DURAK_KEY -o StrictHostKeyChecking=accept-new"
[ -f "$DURAK_KEY" ] || { echo "missing SSH key: $DURAK_KEY (set DURAK_KEY)"; exit 1; }

UNIT=podkidnoy-net
# What the service itself says: asked on the server, where it listens.
STATUS="
  if [ ! -f /etc/systemd/system/$UNIT.service ]; then
    echo 'not installed: set NETWORK=on in network.env and deploy'
  else
    echo -n 'service: '; systemctl is-active $UNIT || true
    echo -n 'after a reboot: '; systemctl is-enabled $UNIT 2>/dev/null || true
    PORT=\$(sudo sed -n 's/^NETWORK_PORT=//p' /opt/podkidnoy/net/network.env)
    echo -n 'tables: '; curl -fsS -m 3 http://127.0.0.1:\${PORT:-8083}/network/api/status || echo 'no answer'
    echo
  fi"

case "${1:-status}" in
  status) $SSH "$DURAK_HOST" "$STATUS" ;;
  stop) $SSH "$DURAK_HOST" "sudo systemctl disable --now $UNIT; $STATUS" ;;
  start) $SSH "$DURAK_HOST" "sudo systemctl enable --now $UNIT; sleep 1; $STATUS" ;;
  restart) $SSH "$DURAK_HOST" "sudo systemctl enable $UNIT; sudo systemctl restart $UNIT; sleep 1; $STATUS" ;;
  log) $SSH "$DURAK_HOST" "sudo journalctl -u $UNIT -n 50 --no-pager" ;;
  *) echo "Usage: ./network.sh [status|stop|start|restart|log]"; exit 1 ;;
esac
