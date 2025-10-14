# Docker Deployment Guide

This guide explains how to deploy the session-based file editor using Docker.

## Architecture

The application consists of two services:

1. **Backend** (Express API server on port 3001)
   - Handles session management
   - Stores files in `tmp/<sellerId>/<sessionId>/`
   - Automatic session cleanup after 5 minutes of inactivity

2. **Frontend** (React + Vite on port 5173)
   - User interface for file editing
   - Communicates with backend API

## Quick Start

### Build and Start All Services

```bash
docker-compose up --build
```

This will:
- Build both frontend and backend images
- Start both containers
- Create a shared network for communication
- Mount `./tmp` directory for persistent session storage

### Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **With Seller ID**: http://localhost:5173/?sellerId=your_seller_id

### Stop Services

```bash
docker-compose down
```

## Individual Service Management

### Build Backend Only

```bash
docker build -f Dockerfile.backend -t mockup-backend .
```

### Build Frontend Only

```bash
docker build -f Dockerfile -t mockup-frontend .
```

### Run Backend Standalone

```bash
docker run -d \
  -p 3001:3001 \
  -v $(pwd)/tmp:/app/tmp \
  --name mockup-backend \
  mockup-backend
```

### Run Frontend Standalone

```bash
docker run -d \
  -p 5173:5173 \
  --name mockup-frontend \
  mockup-frontend
```

## Environment Variables

### Backend

- `NODE_ENV`: Set to `production` (default)
- `PORT`: Server port (default: 3001)

### Frontend

- `VITE_API_URL`: Backend API URL (default: http://backend:3001)

## Volume Mounts

### Session Data

The backend mounts `./tmp` directory to persist session files:

```yaml
volumes:
  - ./tmp:/app/tmp
```

This ensures:
- Sessions survive container restarts
- Files are accessible from host machine
- Easy backup and monitoring

## Healthcheck

The backend includes a healthcheck that:
- Tests endpoint: `http://localhost:3001/api/session/create`
- Interval: Every 30 seconds
- Timeout: 10 seconds
- Retries: 3 attempts
- Start period: 40 seconds

Check health status:

```bash
docker ps
# Look for "healthy" in STATUS column
```

## Production Deployment

### Using Docker Compose

1. Update environment variables in `docker-compose.yml`:

```yaml
services:
  backend:
    environment:
      - NODE_ENV=production
      - PORT=3001
```

2. Add reverse proxy (nginx/traefik) for SSL:

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend
```

3. Update frontend API URL:

```yaml
services:
  frontend:
    environment:
      - VITE_API_URL=https://api.yourdomain.com
```

### Scaling

Run multiple frontend instances:

```bash
docker-compose up --scale frontend=3
```

**Note**: Backend should NOT be scaled as it uses in-memory session storage. For multi-instance backend, implement Redis for session storage.

## Troubleshooting

### Backend Won't Start

Check logs:
```bash
docker logs mockup_backend
```

Common issues:
- Port 3001 already in use
- Missing dependencies in package.json
- Permissions on tmp directory

### Frontend Can't Connect to Backend

1. Check if backend is running:
```bash
docker ps | grep mockup_backend
```

2. Test backend API:
```bash
curl http://localhost:3001/api/session/create \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"sellerId":"test"}'
```

3. Check network connectivity:
```bash
docker exec mockup_frontend ping backend
```

### Sessions Not Persisting

Check volume mount:
```bash
docker inspect mockup_backend | grep -A 5 Mounts
```

Verify tmp directory:
```bash
ls -la tmp/
```

### Files Not Being Cleaned Up

Check cleanup logs:
```bash
docker logs mockup_backend | grep "Cleaned up session"
```

Sessions are cleaned up 5 minutes after last activity.

## Monitoring

### View Backend Logs

```bash
docker logs -f mockup_backend
```

Look for:
- `Created new session: <sessionId> for seller: <sellerId>`
- `Session restored`
- `Cleaned up session: <sessionId>`

### View Frontend Logs

```bash
docker logs -f mockup_frontend
```

### Check Resource Usage

```bash
docker stats
```

### Inspect Session Files

```bash
# List all sessions
ls -la tmp/

# List files for a specific session
ls -la tmp/<sellerId>/<sessionId>/
```

## Backup and Restore

### Backup Session Data

```bash
# Backup all sessions
tar -czf sessions-backup-$(date +%Y%m%d).tar.gz tmp/

# Backup specific seller
tar -czf seller-backup-$(date +%Y%m%d).tar.gz tmp/<sellerId>/
```

### Restore Session Data

```bash
# Extract backup
tar -xzf sessions-backup-20251014.tar.gz

# Restart backend to load sessions
docker-compose restart backend
```

## Security Considerations

1. **File Upload Limits**: Set to 10MB per file
2. **Session Timeout**: 5 minutes of inactivity
3. **CORS**: Configured to allow all origins (update for production)
4. **Volume Permissions**: Ensure proper permissions on tmp directory

### Production Security Checklist

- [ ] Update CORS to specific origins
- [ ] Enable HTTPS with SSL certificates
- [ ] Set up firewall rules
- [ ] Implement rate limiting
- [ ] Add authentication/authorization
- [ ] Set up log aggregation
- [ ] Configure automated backups
- [ ] Implement monitoring and alerts

## Maintenance

### Update Application

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose up --build -d
```

### Clear All Session Data

```bash
# Stop containers
docker-compose down

# Remove session files
rm -rf tmp/*

# Start containers
docker-compose up -d
```

### View All Active Sessions

```bash
cat tmp/sessions.json | jq
```

## Support

For issues or questions, check:
- Server logs: `docker logs mockup_backend`
- Frontend logs: `docker logs mockup_frontend`
- SESSION_MANAGEMENT.md for API documentation
- README.md for general usage
