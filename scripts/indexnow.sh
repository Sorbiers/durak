#!/usr/bin/env bash
# Tell IndexNow (Bing, Yandex, Seznam, …) that the site's pages changed, so they recrawl soon.
# The key is also hosted at https://podkidnoy.online/<key>.txt (public/<key>.txt) so the search
# engines can verify ownership — keep the two in sync. Run by deploy.sh after each publish, or
# by hand:  bash scripts/indexnow.sh
set -euo pipefail

HOST="podkidnoy.online"
KEY="468b9f4ed74c92e318085838fcdb05ff"   # keep in sync with public/<KEY>.txt
URLS=(
  "https://$HOST/"
  "https://$HOST/ru/"
  "https://$HOST/en/"
  "https://$HOST/fr/"
  "https://$HOST/fortune/"
  "https://$HOST/fortune/ru/"
  "https://$HOST/fortune/en/"
  "https://$HOST/fortune/fr/"
  "https://$HOST/sitemap.xml"
)

list=$(printf '"%s",' "${URLS[@]}"); list="[${list%,}]"
body="{\"host\":\"$HOST\",\"key\":\"$KEY\",\"keyLocation\":\"https://$HOST/$KEY.txt\",\"urlList\":$list}"

code=$(curl -s -X POST "https://api.indexnow.org/indexnow" \
  -H "Content-Type: application/json" -d "$body" -o /dev/null -w '%{http_code}') || code="000"
echo "IndexNow: HTTP $code"
case "$code" in
  200|202) echo "IndexNow accepted the submission." ;;
  *) echo "IndexNow did not accept it (non-fatal)." ;;
esac
