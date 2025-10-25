#!/bin/sh
set -e

# Use PORT environment variable or default to 8080
export PORT=${PORT:-8080}

# Substitute environment variables in nginx config template
envsubst '${PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Start nginx
exec nginx -g 'daemon off;'
