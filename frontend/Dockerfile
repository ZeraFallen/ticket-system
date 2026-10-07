FROM nginx:1.27-alpine
ARG BUILD_NUMBER=dev
LABEL org.opencontainers.image.title="ticket-app-frontend" \
      org.opencontainers.image.version="${BUILD_NUMBER}"
COPY index.html /usr/share/nginx/html/index.html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
