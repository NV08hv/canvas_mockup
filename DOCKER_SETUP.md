# Docker Setup Guide

This guide explains how to run the Mockup Canvas application with Docker and MySQL database.

## Prerequisites

- Docker installed (https://www.docker.com/get-started)
- Docker Compose installed (usually comes with Docker Desktop)

## Quick Start

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd canvas_mockup
```

### 2. Create environment file
```bash
cp .env.example .env
```

Edit `.env` file if you want to change default passwords:
```env
MYSQL_ROOT_PASSWORD=your_secure_root_password
MYSQL_DATABASE=mockup_canvas
MYSQL_USER=mockupuser
MYSQL_PASSWORD=your_secure_password
```

### 3. Build and start all services
```bash
docker-compose up --build
```

This will start:
- **MySQL Database** on port 3306
- **Backend API** on port 3001
- **Frontend** on port 80

### 4. Access the application
- Frontend: http://localhost
- Backend API: http://localhost:3001/api
- Health check: http://localhost:3001/api/health

## Services

### MySQL Database (db)
- Port: 3306
- Database: mockup_canvas
- Tables:
  - `projects` - User projects
  - `mockup_images` - Mockup image URLs
  - `designs` - Design image URLs and transforms
  - `text_layers` - Text layer properties

### Backend API (backend)
- Port: 3001
- Endpoints:
  - `GET /api/health` - Health check
  - `POST /api/projects` - Save project
  - `GET /api/projects/:userId` - Get user projects
  - `GET /api/projects/detail/:projectId` - Get project details
  - `DELETE /api/projects/:projectId` - Delete project

### Frontend (frontend)
- Port: 80
- React application with nginx

## Docker Commands

### Start services
```bash
# Start in foreground
docker-compose up

# Start in background
docker-compose up -d

# Rebuild and start
docker-compose up --build
```

### Stop services
```bash
docker-compose down

# Stop and remove volumes (WARNING: deletes all data)
docker-compose down -v
```

### View logs
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs backend
docker-compose logs db
docker-compose logs frontend

# Follow logs
docker-compose logs -f
```

### Execute commands in containers
```bash
# Access MySQL
docker-compose exec db mysql -u mockupuser -p mockup_canvas

# Access backend shell
docker-compose exec backend sh

# Run backend commands
docker-compose exec backend npm install <package>
```

## Database Schema

### projects table
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| user_id | VARCHAR(255) | User identifier |
| project_name | VARCHAR(255) | Project name |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |

### mockup_images table
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| project_id | INT | Foreign key to projects |
| image_url | TEXT | Image URL or data URI |
| image_order | INT | Display order |
| created_at | TIMESTAMP | Creation time |

### designs table
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| project_id | INT | Foreign key to projects |
| design_name | VARCHAR(255) | Design name |
| image_url | TEXT | Image URL or data URI |
| transform_data | JSON | Transform properties |
| created_at | TIMESTAMP | Creation time |

### text_layers table
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| project_id | INT | Foreign key to projects |
| text_content | TEXT | Text content |
| properties | JSON | Text layer properties |
| created_at | TIMESTAMP | Creation time |

## API Usage Examples

### Save a project
```bash
curl -X POST http://localhost:3001/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "projectName": "My Mockup Project",
    "mockupImages": [
      {"url": "https://example.com/mockup1.jpg", "order": 0}
    ],
    "designs": [
      {
        "name": "Logo",
        "url": "https://example.com/logo.png",
        "transform": {"x": 400, "y": 400, "scale": 1.0, "rotation": 0, "opacity": 100}
      }
    ],
    "textLayers": [
      {
        "text": "Sample Text",
        "x": 400,
        "y": 500,
        "fontSize": 48,
        "fontFamily": "Arial",
        "color": "#000000"
      }
    ]
  }'
```

### Get user projects
```bash
curl http://localhost:3001/api/projects/user123
```

### Get project details
```bash
curl http://localhost:3001/api/projects/detail/1
```

### Delete project
```bash
curl -X DELETE http://localhost:3001/api/projects/1
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs

# Remove old volumes
docker-compose down -v

# Rebuild
docker-compose up --build
```

### Database connection errors
```bash
# Check if MySQL is ready
docker-compose exec db mysqladmin ping -h localhost

# Check database
docker-compose exec db mysql -u root -p -e "SHOW DATABASES;"
```

### Reset everything
```bash
# Stop and remove all containers, networks, and volumes
docker-compose down -v

# Remove images
docker-compose down --rmi all -v

# Start fresh
docker-compose up --build
```

## Development

### Run backend in development mode
```bash
cd backend
npm install
npm run dev
```

### Run frontend in development mode
```bash
npm install
npm run dev
```

## Production Deployment

1. Update `.env` with secure passwords
2. Configure reverse proxy (nginx/Apache) in front of containers
3. Enable SSL/TLS
4. Set up regular database backups
5. Configure monitoring and logging

## Data Persistence

MySQL data is persisted in a Docker volume named `mysql_data`. This ensures your data survives container restarts.

To backup:
```bash
docker-compose exec db mysqldump -u mockupuser -p mockup_canvas > backup.sql
```

To restore:
```bash
docker-compose exec -T db mysql -u mockupuser -p mockup_canvas < backup.sql
```
