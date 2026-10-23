#!/bin/sh
# Runtime configuration of the SPA, written at container start into
# /tmp/runtime (the root filesystem stays read-only; in Kubernetes /tmp is an
# emptyDir):
#   env-config.js           the VITE_* settings the app reads at start
#   listen.conf             8080 on IPv4, and on IPv6 where the kernel has it
#   security-headers.conf   Content-Security-Policy and framing
#   silent-refresh-headers.conf   the same for silent-refresh.html, which the app itself frames
#   api-gateway.conf        the API under /api (only with API_UPSTREAM)
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
# renew. Styles allow inline attributes (React style props), images also
# data:/blob: (app logos, previews) and https: (pictures in app READMEs).
CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:"
CSP="$CSP; connect-src 'self'${API_ORIGIN:+ $API_ORIGIN}${KEYCLOAK_ORIGIN:+ $KEYCLOAK_ORIGIN}"
CSP="$CSP; frame-src 'self'${KEYCLOAK_ORIGIN:+ $KEYCLOAK_ORIGIN}"
CSP="$CSP; object-src 'none'; base-uri 'self'; form-action 'self'"
CSP_PAGE="$CSP; frame-ancestors $FRAME_ANCESTORS"

{
  printf 'add_header Content-Security-Policy "%s" always;\n' "$CSP_PAGE"
  # Browsers without CSP frame-ancestors only know X-Frame-Options.
  if [ "$FRAME_ANCESTORS" = "'none'" ]; then
    printf 'add_header X-Frame-Options "DENY" always;\n'
  fi
} > "$RUNTIME_DIR/security-headers.conf"

# The callback page of the silent token renew runs in a hidden iframe of the
# app itself, so the app's own origin must be allowed to frame it (everyone
# else still may not). With frame-ancestors 'none' the browser refuses the
# iframe and a reload always ends at the login page.
{
  printf 'add_header Content-Security-Policy "%s; frame-ancestors '"'"'self'"'"'" always;\n' "$CSP"
  printf 'add_header X-Frame-Options "SAMEORIGIN" always;\n'
} > "$RUNTIME_DIR/silent-refresh-headers.conf"

# The API under /api, where nothing else routes it (Kubernetes: the one
# Ingress of the host points here). API_UPSTREAM is host:port of the API's
# Service. As Caddy does on the VMs, the prefix is stripped; OpenTofu's state
# backend under /api/internal/ is never routed (nginx matches the normalised
# URI, so encoded or doubled slashes and dot segments end up here too).
# Without API_UPSTREAM (Compose: Caddy routes /api) the file stays empty.
API_UPSTREAM="${API_UPSTREAM:-}"
if [ -n "$API_UPSTREAM" ]; then
  case "$API_UPSTREAM" in
    *[!A-Za-z0-9.:_-]*)
      echo "env-config: API_UPSTREAM must be host:port" >&2
      exit 1
      ;;
  esac
  cat > "$RUNTIME_DIR/api-gateway.conf" <<EOF
location = /api { return 404; }
location = /api/internal { return 404; }
location ^~ /api/internal/ { return 404; }
location /api/ {
  proxy_pass http://$API_UPSTREAM/;
  proxy_http_version 1.1;
  proxy_set_header Connection "";
  proxy_set_header Host \$host;
  proxy_set_header X-Real-IP \$remote_addr;
  proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto \$appstore_forwarded_proto;
  proxy_set_header X-Forwarded-Host \$host;
  # Uploads stream through instead of being written to /tmp first.
  client_max_body_size 50m;
  proxy_request_buffering off;
  # The live stream (SSE) of a deployment runs as long as its job.
  proxy_buffering off;
  proxy_read_timeout 1h;
  proxy_send_timeout 1h;
  # API responses get their own headers, not the SPA's (its CSP would block
  # the inline script of the LTI launch page): no sniffing, no caching, no
  # referrer, framing only where the SPA may be framed.
  proxy_hide_header Cache-Control;
  add_header Cache-Control "no-store" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "no-referrer" always;
  add_header Content-Security-Policy "frame-ancestors $FRAME_ANCESTORS" always;
  add_header Strict-Transport-Security \$appstore_hsts always;
}
EOF
else
  : > "$RUNTIME_DIR/api-gateway.conf"
fi
