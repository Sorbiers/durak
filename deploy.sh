#!/usr/bin/env bash
# Build the game and publish it to the VPS as a static site under nginx.
#
# First run creates /opt/durak/web and installs the nginx site for synarteum.com; later runs
# just replace the files. The nginx conf is installed only while the live copy has no TLS,
# so certbot's edits are never overwritten. For HTTPS, once DNS points at the server:
#   sudo certbot --nginx -d synarteum.com -d www.synarteum.com
#
# Usage (from the repo root, e.g. Git Bash on Windows):  ./deploy.sh
# Where to deploy is read from deploy.env beside this script (not committed; copy
# deploy.env.example) or from the environment: DURAK_HOST, DURAK_KEY, DURAK_PORT, DURAK_REMOTE.
set -euo pipefail
cd "$(dirname "$0")"

if [ -f deploy.env ]; then
  set -a
  . ./deploy.env
  set +a
fi
: "${DURAK_HOST:?set DURAK_HOST (user@server) in deploy.env}"
: "${DURAK_KEY:?set DURAK_KEY (path to the SSH private key) in deploy.env}"
HOST="$DURAK_HOST"
KEY="$DURAK_KEY"
PORT="${DURAK_PORT:-22}"
REMOTE="${DURAK_REMOTE:-/opt/durak}"
SSH="ssh -p $PORT -i $KEY -o StrictHostKeyChecking=accept-new"
SCP="scp -P $PORT -i $KEY -o StrictHostKeyChecking=accept-new"

case "$REMOTE" in
  ""|"/"|*" "*) echo "refusing: unsafe DURAK_REMOTE='$REMOTE'"; exit 1 ;;
  /*) ;;
  *) echo "refusing: DURAK_REMOTE must be an absolute path: '$REMOTE'"; exit 1 ;;
esac
[ -f "$KEY" ] || { echo "missing SSH key: $KEY (set DURAK_KEY)"; exit 1; }

echo "Building ..."
[ -d node_modules ] || npm install
npm run build
[ -f dist/index.html ] || { echo "build produced no dist/index.html"; exit 1; }

TAR="$(mktemp).tgz"
trap 'rm -f "$TAR"' EXIT
tar czf "$TAR" -C dist . -C ../deploy synarteum.conf
echo "Size: $(du -h "$TAR" | cut -f1)"

echo "Uploading to $HOST ..."
$SCP "$TAR" "$HOST:/tmp/durak_web.tgz"

echo "Publishing ..."
$SSH "$HOST" "set -e
  # unpack beside the live copy, then swap, so the site is never half-updated
  sudo rm -rf $REMOTE/web.new
  sudo mkdir -p $REMOTE/web.new
  sudo tar xzf /tmp/durak_web.tgz -C $REMOTE/web.new
  rm -f /tmp/durak_web.tgz
  sudo mv $REMOTE/web.new/synarteum.conf $REMOTE/synarteum.conf
  sudo chown -R root:root $REMOTE
  sudo chmod -R a+rX $REMOTE
  sudo rm -rf $REMOTE/web.old
  if [ -d $REMOTE/web ]; then sudo mv $REMOTE/web $REMOTE/web.old; fi
  sudo mv $REMOTE/web.new $REMOTE/web
  sudo rm -rf $REMOTE/web.old

  # install the site conf, but never clobber certbot's TLS edits once present
  if ! grep -q letsencrypt /etc/nginx/conf.d/synarteum.conf 2>/dev/null; then
    sudo cp $REMOTE/synarteum.conf /etc/nginx/conf.d/synarteum.conf
  else
    echo 'nginx conf has TLS - leaving it as-is'
  fi

  sudo nginx -t
  sudo systemctl reload nginx
  sleep 2   # the reload is not instant; checking at once would hit the old workers
  echo -n 'nginx: '; systemctl is-active nginx
  # ask this server itself for the site, following the redirect to HTTPS when there is one
  echo -n 'site:  '; curl -fsSL -o /dev/null -w '%{http_code}\n' --resolve synarteum.com:80:127.0.0.1 --resolve synarteum.com:443:127.0.0.1 http://synarteum.com/ || echo FAILED"

echo
echo "Done: https://synarteum.com/"
