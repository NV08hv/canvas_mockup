# Docker Deployment Guide

This guide explains how to deploy the database-backed file editor using Docker.

## Architecture

The application consists of two services:

1. **Backend** (Express API server on port 3001)
   - Handles file management with SQLite database
   - Stores files in `uploads/<userId>/`
   - Uses SQLite database for image metadata tracking

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
- Mount `./uploads` directory for persistent file storage

### Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **With User ID**: http://localhost:5173/?user_id=your_user_id

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
  -v $(pwd)/uploads:/app/uploads \
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

### File Data

The backend mounts `./uploads` directory to persist files and the SQLite database:

```yaml
volumes:
  - ./uploads:/app/uploads
```

This ensures:
- Files and database survive container restarts
- Files are accessible from host machine
- Easy backup and monitoring

## Healthcheck

The backend includes a healthcheck that:
- Tests endpoint: `http://localhost:3001/api/health`
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

**Note**: Backend uses SQLite which does not scale horizontally. For multi-instance backend, migrate to PostgreSQL or MySQL.

## Troubleshooting

### Backend Won't Start

Check logs:
```bash
docker logs mockup_backend
```

Common issues:
- Port 3001 already in use
- Missing dependencies in package.json
- Permissions on uploads directory

### Frontend Can't Connect to Backend

1. Check if backend is running:
```bash
docker ps | grep mockup_backend
```

2. Test backend API:
```bash
curl http://localhost:3001/api/health
```

3. Check network connectivity:
```bash
docker exec mockup_frontend ping backend
```

### Files Not Persisting

Check volume mount:
```bash
docker inspect mockup_backend | grep -A 5 Mounts
```

Verify uploads directory and database:
```bash
ls -la uploads/
ls -la uploads/database.sqlite
```

## Monitoring

### View Backend Logs

```bash
docker logs -f mockup_backend
```

Look for:
- `Server running on http://localhost:3001`
- `Database initialized successfully`
- File upload/deletion messages

### View Frontend Logs

```bash
docker logs -f mockup_frontend
```

### Check Resource Usage

```bash
docker stats
```

### Inspect Files

```bash
# List all user directories
ls -la uploads/

# List files for a specific user
ls -la uploads/<userId>/

# View database
sqlite3 uploads/database.sqlite "SELECT * FROM images;"
```

## Backup and Restore

### Backup Data

```bash
# Backup all files and database
tar -czf backup-$(date +%Y%m%d).tar.gz uploads/

# Backup specific user
tar -czf user-backup-$(date +%Y%m%d).tar.gz uploads/<userId>/

# Backup database only
cp uploads/database.sqlite uploads/database-backup-$(date +%Y%m%d).sqlite
```

### Restore Data

```bash
# Extract backup
tar -xzf backup-20251014.tar.gz

# Restart backend
docker-compose restart backend
```

## Security Considerations

1. **File Upload Limits**: Set to 10MB per file
2. **Database Security**: SQLite file should have proper permissions
3. **CORS**: Configured to allow all origins (update for production)
4. **Volume Permissions**: Ensure proper permissions on uploads directory

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

### Clear All Data

```bash
# Stop containers
docker-compose down

# Remove all files and database
rm -rf uploads/*

# Start containers
docker-compose up -d
```

### View Database Contents

```bash
sqlite3 uploads/database.sqlite "SELECT * FROM images;"
```

## Support

For issues or questions, check:
- Server logs: `docker logs mockup_backend`
- Frontend logs: `docker logs mockup_frontend`
- README.md for general usage
