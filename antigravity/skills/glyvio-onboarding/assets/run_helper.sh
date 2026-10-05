#!/bin/sh
# Generates the plugin types (@types) with glyvio-dev-helper, using the .env next to this script.
# The .env is parsed, never executed. Values are passed to the helper as environment variables, so
# this works with every helper version (older builds do not read .env themselves).
set -eu
cd "$(dirname "$0")"

[ -f .env ] || { echo "ERROR: .env not found in $(pwd) (see .env.example)"; exit 1; }
[ -f manifest.json ] && [ -f package.json ] || { echo "ERROR: run it in the plugin root (manifest.json + package.json)"; exit 1; }

env_get() {
  awk -v k="$1" -v q="'" '
    { line = $0; sub(/\r$/, "", line); sub(/^[ \t]*export[ \t]+/, "", line)
      if (line ~ /^[ \t]*#/) next
      i = index(line, "="); if (i == 0) next
      key = substr(line, 1, i - 1); gsub(/^[ \t]+|[ \t]+$/, "", key); if (key != k) next
      v = substr(line, i + 1); gsub(/^[ \t]+|[ \t]+$/, "", v)
      if (length(v) >= 2 && ((substr(v, 1, 1) == "\"" && substr(v, length(v), 1) == "\"") || (substr(v, 1, 1) == q && substr(v, length(v), 1) == q)))
        v = substr(v, 2, length(v) - 2)
      val = v }
    END { printf "%s", val }' .env
}
strip_slash() { printf "%s" "$1" | sed 's:/*$::'; }

case "$(uname -s)" in
  Darwin) BIN=glyvio-dev-helper-mac ;;
  *) BIN=glyvio-dev-helper-linux ;;
esac
HELPER="${GLYVIO_DEV_HELPER:-./tools/$BIN}"
[ -x "$HELPER" ] || { echo "ERROR: helper not found or not executable: $HELPER (see the glyvio-onboarding skill)"; exit 1; }

USERNAME_V="$(env_get G_USERNAME)"; PASSWORD_V="$(env_get G_PASSWORD)"
[ -n "$USERNAME_V" ] && [ -n "$PASSWORD_V" ] || { echo "ERROR: fill G_USERNAME and G_PASSWORD in .env"; exit 1; }
export GLYVIO_USER="$USERNAME_V" GLYVIO_PASSWORD="$PASSWORD_V"

COMPANY_V="$(env_get G_COMPANY_ID)"; [ -z "$COMPANY_V" ] || export GLYVIO_COMPANY_ID="$COMPANY_V"
AUTH_V="$(strip_slash "$(env_get G_AUTH_URL)")"; [ -z "$AUTH_V" ] || export GLYVIO_URL_AUTH="$AUTH_V"
# G_APP_URL is the web app (browser) address and is NOT the API. Only an explicit G_API_URL overrides the API.
API_V="$(strip_slash "$(env_get G_API_URL)")"; [ -z "$API_V" ] || export GLYVIO_URL_APP="$API_V"

exec "$HELPER" "$@"
