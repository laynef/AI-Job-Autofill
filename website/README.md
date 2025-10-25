# AI Job Copilot Website

This is the promotional website for the AI Job Application Copilot Chrome extension.

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
docker build -t ai-job-copilot-website .
```

Run the container:

```bash
docker run -d -p 8080:80 --name ai-job-copilot-website ai-job-copilot-website
```

The website will be available at `http://localhost:8080`

To stop and remove the container:

```bash
docker stop ai-job-copilot-website
docker rm ai-job-copilot-website
```

### Docker Commands

View logs:
```bash
docker logs ai-job-copilot-website
```

Access container shell:
```bash
docker exec -it ai-job-copilot-website sh
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
docker build -t your-registry/ai-job-copilot-website:latest .
docker push your-registry/ai-job-copilot-website:latest
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

By default, the website runs on port 8080 (mapped to container port 80). To change this, modify the port mapping:

```bash
docker run -d -p 3000:80 --name ai-job-copilot-website ai-job-copilot-website
```

Or in `docker-compose.yml`:
```yaml
ports:
  - "3000:80"
```

## License

MIT License - See parent directory LICENSE file
