# Use nginx alpine image for a lightweight container
FROM nginx:alpine

# Install envsubst (part of gettext package)
RUN apk add --no-cache gettext

# Set working directory
WORKDIR /usr/share/nginx/html

# Remove default nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy website files to nginx html directory
COPY index.html /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/

# Copy nginx configuration template
COPY nginx.conf.template /etc/nginx/conf.d/default.conf.template

# Copy and set permissions for entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Default PORT for local development (Cloud Run will override this)
ENV PORT=8080

# Expose port (will be set dynamically)
EXPOSE 8080

# Add healthcheck (using PORT variable)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:${PORT}/ || exit 1

# Use custom entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]
