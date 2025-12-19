# Anti-Adblock Setup Guide

This guide explains how to deploy the Hired Always website with integrated Adcash anti-adblock functionality.

## Overview

The anti-adblock setup allows your website to display ads even when visitors have ad blockers enabled. This is achieved through:

- **Dynamic Anti-Adblock Library**: Automatically downloads and updates the Adcash anti-adblock JavaScript library
- **Randomized Filenames**: Uses randomly generated filenames to avoid detection by ad blockers
- **Automatic Updates**: Cron job updates the library every 5 minutes to stay ahead of ad blocker updates
- **Multi-Zone Support**: Supports different ad zones for different domains

## Files Added/Modified

### New Files
- `Dockerfile.adblock` - Docker configuration with anti-adblock setup
- `docker-compose.adblock.yml` - Docker Compose for anti-adblock version
- `adcash-config.py` - Configuration for Adcash zones and settings
- `README-ADBLOCK.md` - This documentation

### Modified Files
- `main.py` - Added anti-adblock library path detection and zone ID management
- `templates/index.html` - Added anti-adblock script loading and initialization

## Configuration

### Zone IDs

Edit `adcash-config.py` to configure your Adcash zone IDs:

```python
ADCASH_ZONES = {
    'hiredalways.com': 'hkqscsmnjy',
    'yourdomain.com': 'your-zone-id',
    # Add more domains and their zone IDs
}
```

To get zone IDs:
1. Log into your Adcash publisher account
2. Go to the Zones section
3. Copy the zone IDs for your domains

### Anti-Adblock Settings

Modify settings in `adcash-config.py`:

```python
ANTI_ADBLOCK_CONFIG = {
    'update_frequency_minutes': 5,  # How often to update the library
    'library_filename_prefix': 'lib-',  # Filename prefix
    'library_path': '/static/js/',  # Path where library is served
    'enabled': True  # Enable/disable anti-adblock functionality
}
```

## Deployment

### Option 1: Docker Compose (Recommended)

```bash
# Build and run with anti-adblock
docker-compose -f docker-compose.adblock.yml up --build -d

# View logs
docker-compose -f docker-compose.adblock.yml logs -f

# Stop
docker-compose -f docker-compose.adblock.yml down
```

### Option 2: Docker Only

```bash
# Build the image
docker build -f Dockerfile.adblock -t hired-always-adblock .

# Run the container
docker run -d \
  --name hired-always-adblock \
  -p 8080:8080 \
  -e PORT=8080 \
  hired-always-adblock
```

## How It Works

1. **Build Time**: The Dockerfile downloads the Adcash installer script and sets up the anti-adblock library with a random filename

2. **Runtime**:
   - A cron job runs every 5 minutes to update the anti-adblock library
   - The web application detects the library filename dynamically
   - Zone IDs are selected based on the request domain

3. **Frontend**:
   - The anti-adblock library is loaded in the HTML head
   - The library is initialized with the appropriate zone ID
   - Ads will display even with ad blockers enabled

## Troubleshooting

### Check if Anti-Adblock is Working

1. Open your website in a browser with an ad blocker installed
2. Open Developer Tools (F12) → Network tab
3. Refresh the page
4. Look for:
   - The anti-adblock library loading (`lib-[random].js`)
   - No errors in the console
   - Ad content appearing on the page

### Common Issues

**Library Not Loading**
- Check if the file exists: `docker exec -it hired-always-website-adblock ls -la /app/static/js/`
- Verify cron is running: `docker exec -it hired-always-website-adblock ps aux | grep cron`

**Zone ID Not Found**
- Verify your domain is configured in `adcash-config.py`
- Check the logs: `docker logs hired-always-website-adblock`

**CSP Violations**
- Content Security Policy has been updated to allow Adcash domains
- If you see CSP errors, ensure `https://cdn.adcash.com` and `https://*.adcash.com` are allowed

## Security Considerations

- The anti-adblock library is automatically updated to prevent detection
- Filenames are randomized on each build/update
- CSP headers have been modified to allow necessary Adcash domains
- Supervisor is used to manage both the web app and cron processes securely

## Production Deployment

For production:

1. Set up SSL/TLS certificates
2. Use the nginx reverse proxy configuration in the docker-compose file
3. Configure proper monitoring and logging
4. Set up automated backups for any persistent data

## Support

- Adcash Support: Contact your Adcash account manager
- Technical Issues: Check the container logs and verify configuration files