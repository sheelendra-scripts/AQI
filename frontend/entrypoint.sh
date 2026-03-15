#!/bin/sh

: ${BACKEND_HOST:=localhost}
: ${BACKEND_PORT:=8000}

cat << EOF > /usr/share/nginx/html/config.js

window.__BACKEND_URL__ = "https://${BACKEND_HOST}:${BACKEND_PORT}";
EOF

exec "$@"
