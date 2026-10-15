#!/bin/sh
# Runtime configuration of the SPA, written at container start into
# /tmp/runtime (the root filesystem stays read-only; in Kubernetes /tmp is an
# emptyDir):
#   env-config.js           the VITE_* settings the app reads at start
#   listen.conf             8080 on IPv4, and on IPv6 where the kernel has it
#   security-headers.conf   Content-Security-Policy and framing
# Runs from /docker-entrypoint.d/ before nginx starts; any error stops the
# container instead of serving with a broken or missing configuration.
set -eu

RUNTIME_DIR=/tmp/runtime
mkdir -p "$RUNTIME_DIR"

nl='
'

# The settings are URLs and names. They end up in JavaScript string literals
# and in a response header, so a character that could break out of either is
# refused rather than escaped.
for name in VITE_KEYCLOAK_URL VITE_KEYCLOAK_REALM VITE_KEYCLOAK_CLIENT_ID VITE_APP_URL VITE_API_URL VITE_THEME; do
  eval "value=\${$name:-}"
  case "$value" in
    *"$nl"*|*"'"*|*'"'*|*'\'*|*'`'*|*'$'*|*'<'*|*'>'*|*';'*)
      echo "env-config: $name contains a character that is not allowed" >&2
      exit 1
      ;;
  esac
done

# Who may frame the app (CSP frame-ancestors), e.g. "https://moodle.example.org"
# when Moodle shows it in an iframe. Default: nobody.
FRAME_ANCESTORS="${FRAME_ANCESTORS:-}"
[ -n "$FRAME_ANCESTORS" ] || FRAME_ANCESTORS="'none'"
case "$FRAME_ANCESTORS" in
  *"$nl"*|*'"'*|*'\'*|*'`'*|*'$'*|*'<'*|*'>'*|*';'*|*','*)
    echo "env-config: FRAME_ANCESTORS contains a character that is not allowed" >&2
    exit 1
    ;;
esac

envsubst '${VITE_KEYCLOAK_URL} ${VITE_KEYCLOAK_REALM} ${VITE_KEYCLOAK_CLIENT_ID} ${VITE_APP_URL} ${VITE_API_URL} ${VITE_THEME}' \
  < /usr/share/nginx/html/env-config.js \
  > "$RUNTIME_DIR/env-config.js"

{
  echo 'listen 8080;'
  if [ -f /proc/net/if_inet6 ]; then
    echo 'listen [::]:8080;'
  fi
} > "$RUNTIME_DIR/listen.conf"

# scheme://host[:port] of an absolute URL; nothing for a relative one, which
# is the app's own origin ('self').
origin() {
  case "$1" in
    http://*|https://*) printf '%s' "$1" | sed -E 's|^(https?://[^/?#]+).*|\1|' ;;
  esac
}
KEYCLOAK_ORIGIN=$(origin "${VITE_KEYCLOAK_URL:-}")
API_ORIGIN=$(origin "${VITE_API_URL:-}")

# Scripts only from the app itself (no inline script, no eval); the API and
# Keycloak for requests; Keycloak in the hidden iframe of the silent token
# renew. Styles allow inline attributes (Vue style bindings), images also
# data:/blob: (app logos, previews) and https: (pictures in app READMEs).
CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:"
CSP="$CSP; connect-src 'self'${API_ORIGIN:+ $API_ORIGIN}${KEYCLOAK_ORIGIN:+ $KEYCLOAK_ORIGIN}"
CSP="$CSP; frame-src 'self'${KEYCLOAK_ORIGIN:+ $KEYCLOAK_ORIGIN}"
CSP="$CSP; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors $FRAME_ANCESTORS"

{
  printf 'add_header Content-Security-Policy "%s" always;\n' "$CSP"
  # Browsers without CSP frame-ancestors only know X-Frame-Options.
  if [ "$FRAME_ANCESTORS" = "'none'" ]; then
    printf 'add_header X-Frame-Options "DENY" always;\n'
  fi
} > "$RUNTIME_DIR/security-headers.conf"
