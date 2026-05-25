#!/bin/sh
# Extract hostname from BACKEND_URL (e.g., https://host.run.app -> host.run.app)
export BACKEND_HOST=$(echo "$BACKEND_URL" | sed -e 's|^[^/]*//||' -e 's|/.*||')

# Replace env vars in nginx configuration template
envsubst '${PORT} ${BACKEND_URL} ${BACKEND_HOST}' < /etc/nginx/templates/nginx.conf.template > /etc/nginx/conf.d/default.conf

# Start Nginx in the foreground
exec nginx -g "daemon off;"
