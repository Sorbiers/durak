#!/usr/bin/env bash
# Build the game and publish it to the VPS as a static site under nginx.
#
# First run creates /opt/podkidnoy/web and installs the nginx site for podkidnoy.online; later runs
# just replace the files. The nginx conf is installed only while the live copy has no TLS,
# so certbot's edits are never overwritten. For HTTPS, once DNS points at the server:
#   sudo certbot --nginx -d podkidnoy.online -d www.podkidnoy.online
#
# Shared tables (the game with invited people) go by network.env: with NETWORK=on the table server
# is uploaded too, Node is unpacked into $REMOTE/node on the first run, and the podkidnoy-net
# service is installed and started; with NETWORK=off, or no network.env, the service is stopped.
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
REMOTE="${DURAK_REMOTE:-/opt/podkidnoy}"
SSH="ssh -p $PORT -i $KEY -o StrictHostKeyChecking=accept-new"
SCP="scp -P $PORT -i $KEY -o StrictHostKeyChecking=accept-new"

case "$REMOTE" in
  ""|"/"|*" "*) echo "refusing: unsafe DURAK_REMOTE='$REMOTE'"; exit 1 ;;
  /*) ;;
  *) echo "refusing: DURAK_REMOTE must be an absolute path: '$REMOTE'"; exit 1 ;;
esac
[ -f "$KEY" ] || { echo "missing SSH key: $KEY (set DURAK_KEY)"; exit 1; }

NETWORK=off
NETWORK_PORT=8083
if [ -f network.env ]; then
  set -a
  . ./network.env
  set +a
fi
case "$NETWORK_PORT" in ''|*[!0-9]*) echo "NETWORK_PORT must be a number: '$NETWORK_PORT'"; exit 1 ;; esac
echo "Shared tables: $NETWORK"

echo "Building ..."
[ -d node_modules ] || npm install
npm run build
[ -f dist/index.html ] || { echo "build produced no dist/index.html"; exit 1; }

# What the table server needs goes up in a folder of its own, net/, beside the site's files.
NET="$(mktemp -d)"
mkdir "$NET/net"
sed "s/@PORT@/$NETWORK_PORT/" deploy/network-nginx.conf > "$NET/net/network-nginx.conf"
cp deploy/podkidnoy-net.service "$NET/net/"
if [ "$NETWORK" = on ]; then
  [ -f dist-net/server.mjs ] || { echo "build produced no dist-net/server.mjs"; exit 1; }
  cp dist-net/server.mjs network.env "$NET/net/"
fi

TAR="$(mktemp).tgz"
trap 'rm -rf "$TAR" "$NET"' EXIT
tar czf "$TAR" -C dist . -C ../deploy podkidnoy.conf -C "$NET" net
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
  sudo mv $REMOTE/web.new/podkidnoy.conf $REMOTE/podkidnoy.conf
  sudo rm -rf $REMOTE/net
  sudo mv $REMOTE/web.new/net $REMOTE/net
  sudo mv $REMOTE/net/network-nginx.conf $REMOTE/network-nginx.conf
  sudo chown -R root:root $REMOTE
  sudo chmod -R a+rX $REMOTE
  sudo rm -rf $REMOTE/web.old
  if [ -d $REMOTE/web ]; then sudo mv $REMOTE/web $REMOTE/web.old; fi
  sudo mv $REMOTE/web.new $REMOTE/web
  sudo rm -rf $REMOTE/web.old

  # the request limit for the table server lives at nginx's top level, in a file of its own
  echo 'limit_req_zone \$binary_remote_addr zone=podkidnoynet:1m rate=10r/s;' | sudo tee /etc/nginx/conf.d/podkidnoy-net-limits.conf >/dev/null

  # install the site conf, but never clobber certbot's TLS edits once present
  LIVE=/etc/nginx/conf.d/podkidnoy.conf
  if ! grep -q letsencrypt \$LIVE 2>/dev/null; then
    sudo cp $REMOTE/podkidnoy.conf \$LIVE
  else
    echo 'nginx conf has TLS - leaving it as-is'
    # ... but for one line, added once: the include that brings in the table server's section.
    # It goes after each line that names the site's root; if nginx does not like the result, the
    # conf is put back as it was.
    if ! grep -q network-nginx.conf \$LIVE; then
      sudo cp \$LIVE $REMOTE/podkidnoy.conf.before-network
      sudo sed -i 's|^\\( *\\)root $REMOTE/web;|&\\n\\1include $REMOTE/network-nginx.conf;|' \$LIVE
      if grep -q network-nginx.conf \$LIVE && sudo nginx -t 2>/dev/null; then
        echo 'nginx conf: added the include for the table server'
      else
        sudo cp $REMOTE/podkidnoy.conf.before-network \$LIVE
        echo \"nginx conf: could not add 'include $REMOTE/network-nginx.conf;' - add it by hand inside the server block\"
      fi
    fi
  fi

  # the table server
  if [ $NETWORK = on ]; then
    if [ ! -x $REMOTE/node/bin/node ]; then
      # Node, from nodejs.org, unpacked here and nowhere else on the system
      case \$(uname -m) in aarch64) ARCH=arm64 ;; *) ARCH=x64 ;; esac
      BASE=https://nodejs.org/dist/latest-v22.x
      FILE=\$(curl -fsSL \$BASE/SHASUMS256.txt | grep -oE \"node-v[0-9.]+-linux-\$ARCH\\.tar\\.xz\" | head -1)
      echo \"installing \$FILE into $REMOTE/node\"
      (cd /tmp && curl -fsSLO \$BASE/\$FILE && curl -fsSL \$BASE/SHASUMS256.txt | grep \" \$FILE\\$\" | sha256sum -c - >/dev/null)
      sudo mkdir -p $REMOTE/node
      sudo tar xJf /tmp/\$FILE -C $REMOTE/node --strip-components=1
      rm -f /tmp/\$FILE
      sudo chown -R root:root $REMOTE/node
    fi
    sudo cp $REMOTE/net/podkidnoy-net.service /etc/systemd/system/podkidnoy-net.service
    sudo systemctl daemon-reload
    sudo systemctl enable podkidnoy-net >/dev/null 2>&1
    sudo systemctl restart podkidnoy-net
  elif [ -f /etc/systemd/system/podkidnoy-net.service ]; then
    sudo systemctl disable --now podkidnoy-net >/dev/null 2>&1 || true
  fi

  sudo nginx -t
  sudo systemctl reload nginx
  sleep 2   # the reload is not instant; checking at once would hit the old workers
  echo -n 'nginx: '; systemctl is-active nginx
  if [ $NETWORK = on ]; then
    echo -n 'tables: '; curl -fsS -m 3 http://127.0.0.1:$NETWORK_PORT/network/api/status || echo FAILED
    echo
  else
    echo 'tables: off'
  fi
  # ask this server itself for the site, following the redirect to HTTPS when there is one
  echo -n 'site:  '; curl -fsSL -o /dev/null -w '%{http_code}\n' --resolve podkidnoy.online:80:127.0.0.1 --resolve podkidnoy.online:443:127.0.0.1 http://podkidnoy.online/ || echo FAILED"

echo
echo "Pinging IndexNow ..."
bash scripts/indexnow.sh || echo "IndexNow ping failed (non-fatal)"

echo
echo "Done: https://podkidnoy.online/"
