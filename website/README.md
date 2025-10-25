# Hired Always Website

This is the promotional website for the Hired Always Chrome extension.

## Local Development

Simply open `index.html` in your web browser to view the site locally.

## Docker Deployment

### Prerequisites

- Docker installed on your system
- Docker Compose (optional, but recommended)

### Option 1: Using Docker Compose (Recommended)

Build and run the website using Docker Compose:

```bash
docker-compose up -d
```

The website will be available at `http://localhost:8080`

To stop the container:

```bash
docker-compose down
```

To rebuild after changes:

```bash
docker-compose up -d --build
```

### Option 2: Using Docker CLI

Build the Docker image:

```bash
docker build -t hired-always-website .
```

Run the container:

```bash
docker run -d -p 8080:80 --name hired-always-website hired-always-website
```

The website will be available at `http://localhost:8080`

To stop and remove the container:

```bash
docker stop hired-always-website
docker rm hired-always-website
```

### Docker Commands

View logs:
```bash
docker logs hired-always-website
```

Access container shell:
```bash
docker exec -it hired-always-website sh
```

Check container health:
```bash
docker ps
```

## Deployment to Production

### Deploy to Cloud Platforms

**AWS ECS / Google Cloud Run / Azure Container Instances:**

1. Build and push the image to a container registry:
```bash
docker build -t your-registry/hired-always-website:latest .
docker push your-registry/hired-always-website:latest
```

2. Deploy using your cloud provider's container service

**Deploy to DigitalOcean App Platform:**

1. Connect your GitHub repository
2. Select the `website` directory
3. Set the Dockerfile path to `website/Dockerfile`
4. Deploy

**Deploy to Heroku:**

```bash
heroku container:push web -a your-app-name
heroku container:release web -a your-app-name
```

## Technology Stack

- **Web Server**: Nginx Alpine (lightweight, ~5MB)
- **Frontend**: HTML5, CSS3
- **Icons**: SVG (inline)
- **Containerization**: Docker

## Features

- Lightweight container (~10MB)
- Gzip compression enabled
- Security headers configured
- Static asset caching (7 days)
- Health checks included
- Production-ready nginx configuration

## Custom Configuration

To modify nginx settings, edit `nginx.conf` and rebuild the container.

## Port Configuration

By default, the website runs on port 8080. The container is configured to use the `PORT` environment variable, making it compatible with Google Cloud Run and other cloud platforms.

To change the port for local development:

```bash
docker run -d -p 3000:3000 -e PORT=3000 --name hired-always-website hired-always-website
```

Or in `docker-compose.yml`:
```yaml
ports:
  - "3000:3000"
environment:
  - PORT=3000
```

## Google Cloud Run Deployment

The container is pre-configured to work with Google Cloud Run, which automatically sets the `PORT` environment variable.

Deploy using gcloud CLI:
```bash
gcloud run deploy hiredalways \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

Or use Cloud Build with a cloudbuild.yaml file in your project.

## License

MIT License - See parent directory LICENSE file
