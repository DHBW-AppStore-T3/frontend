# ===============================
# Build Stage
# ===============================
FROM node:20-alpine AS build

WORKDIR /app

# Nur Abhängigkeiten für sauberes Caching
COPY package*.json ./
RUN npm install

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
RUN apk upgrade --no-cache && \
    apk add --no-cache "libcrypto3>=3.5.7-r0" "libssl3>=3.5.7-r0" "libexpat>=2.8.5-r0" || \
    apk upgrade --no-cache libcrypto3 libssl3 libexpat

# Default Nginx Config entfernen
RUN rm /etc/nginx/conf.d/default.conf

# Eigene SPA-Config kopieren
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Gebautes Frontend übernehmen. ``--chown`` is required because the
# entrypoint script rewrites env-config.js at container start, and that
# only works if the runtime user (UID 101, nginx) can write to the
# HTML directory. We also chown the directory itself (-R covers it)
# plus the base-image 50x.html stub so the nginx user can create
# new files alongside them.
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html
RUN chown -R nginx:nginx /usr/share/nginx/html

# Entrypoint: ersetzt Platzhalter in env-config.js mit echten Env-Vars
COPY docker-entrypoint.sh /docker-entrypoint.d/00-env-config.sh
RUN chmod +x /docker-entrypoint.d/00-env-config.sh

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