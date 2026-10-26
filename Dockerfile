# ===============================
# Build Stage
# ===============================
FROM node:24-alpine AS build

WORKDIR /app

# Nur Abhängigkeiten für sauberes Caching; exakt die Versionen aus package-lock.json
COPY package*.json ./
RUN npm ci

# Restlichen Code kopieren
COPY . .

# Production Build erzeugen
RUN npm run build


# ===============================
# Runtime Stage (Nginx)
# ===============================
# `nginx-unprivileged` is the official non-root variant from the same
# maintainer as `nginx:alpine`. It runs as UID 101 (`nginx`) and listens
# on 8080 instead of 80, which removes the need for root privileges to
# bind a privileged port. Trivy's DS-0002 (no USER instruction) is
# satisfied because the base image already sets USER nginx.
FROM nginxinc/nginx-unprivileged:alpine

# Run apk operations as root, then drop back to nginx for the runtime.
USER root

# Apply outstanding base-image security patches that the upstream tag
# hasn't picked up yet (Trivy scans the runtime image — anything
# HIGH/CRITICAL here blocks the push).
# SECURITY_REFRESH changes in every CI build (ci.yml passes the run id), so this
# layer never comes from the build cache: a cached one kept the package state of
# its first build, and every fix needed a pin here (libssl3, curl, ...).
ARG SECURITY_REFRESH
RUN apk upgrade --no-cache

# Default Nginx Config entfernen
RUN rm /etc/nginx/conf.d/default.conf

# Eigene SPA-Config kopieren
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Gebautes Frontend übernehmen. It stays owned by root: the nginx user
# serves it but cannot change it. Everything written at runtime goes to
# /tmp (see nginx.conf), so the root filesystem can be read-only.
COPY --from=build /app/dist /usr/share/nginx/html

# Entrypoint: writes env-config.js, the listen and the security-header
# snippets into /tmp/runtime before nginx starts.
COPY docker-entrypoint.sh /docker-entrypoint.d/00-env-config.sh
RUN chmod 0755 /docker-entrypoint.d/00-env-config.sh

# Drop privileges for runtime — nginx will bind to the unprivileged
# 8080 port and serve as the `nginx` user (UID 101).
USER nginx

EXPOSE 8080

# Healthcheck for the SPA — hit the entrypoint of the bundled SPA so a
# misconfigured nginx (e.g. wrong root, missing index.html) fails the
# probe instead of staying "healthy" while serving 404s. Satisfies
# Trivy DS-0026 (alert #3).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]