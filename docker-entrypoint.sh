#!/bin/sh
set -e

envsubst '${VITE_KEYCLOAK_URL} ${VITE_KEYCLOAK_REALM} ${VITE_KEYCLOAK_CLIENT_ID} ${VITE_APP_URL} ${VITE_API_URL} ${VITE_THEME}' \
  < /usr/share/nginx/html/env-config.js \
  > /usr/share/nginx/html/env-config.js.tmp

mv /usr/share/nginx/html/env-config.js.tmp /usr/share/nginx/html/env-config.js
