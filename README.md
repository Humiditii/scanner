# DataUlinzi Vulnerability Scanner

A robust NestJS application for scanning Git repositories for vulnerabilities using TruffleHog. Features Redis caching, PostgreSQL persistence, comprehensive API documentation with Swagger, and complete Docker orchestration.

## 🚀 Features

- **Vulnerability Scanning**: Automated secret and vulnerability detection using TruffleHog
- **Smart Caching**: Redis-powered caching for improved performance
- **Data Persistence**: PostgreSQL database for historical scan data
- **RESTful API**: Well-documented endpoints with comprehensive validation
- **Interactive Documentation**: Auto-generated Swagger API documentation
- **Health Monitoring**: Built-in health checks for all components
- **Docker Ready**: Complete containerization with Docker Compose
- **Enterprise-Grade**: Production-ready with proper error handling, logging, and monitoring

## 📋 Requirements

- **Node.js** 18+ (for local development)
- **Docker** 20.0+ and **Docker Compose** v2.0+
- **Git** (for repository cloning)

## 🛠️ Quick Start with Docker

### 1. Clone the Repository

```bash
git clone <repository-url>
cd dataulinzi-vulnerability-scanner
```

### 2. Environment Setup

Create a `.env` file from the template:

```bash
cp .env.example .env
```

Update the `.env` file with your preferred settings:

```env
# Application Configuration
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=vulnerability_scanner
DB_SYNCHRONIZE=true
DB_LOGGING=false

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
CACHE_TTL=3600

# TruffleHog Configuration
TRUFFLE_HOG_IMAGE=trufflesecurity/trufflehog:latest

# Security Configuration
THROTTLE_TTL=60
THROTTLE_LIMIT=10

# Swagger Configuration
SWAGGER_ENABLED=true
SWAGGER_TITLE=DataUlinzi Vulnerability Scanner API
SWAGGER_DESCRIPTION=API for scanning Git repositories for vulnerabilities
SWAGGER_VERSION=1.0.0
```

### 3. Start the Application

```bash
# Start all services (PostgreSQL, Redis, and the application)
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

### 4. Verify Installation

Once all services are running:

- **API Base URL**: http://localhost:3000/api/v1
- **Health Check**: http://localhost:3000/api/v1/health
- **API Documentation**: http://localhost:3000/docs
- **Application Info**: http://localhost:3000/api/v1

## 🔧 Local Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Infrastructure Services

```bash
# Start only PostgreSQL and Redis
docker-compose up postgres redis -d
```

### 3. Environment Variables

Create `.env` file with local development settings:

```env
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Use localhost for local development
DB_HOST=localhost
REDIS_HOST=localhost

# ... other settings
```

### 4. Run Database Migrations (if needed)

```bash
npm run migration:run
```

### 5. Start the Application

```bash
# Development mode with hot reload
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

## 📚 API Usage

### Scan a Repository

```bash
curl -X POST http://localhost:3000/api/v1/scan \
  -H "Content-Type: application/json" \
  -d '{
    "repoUrl": "https://github.com/octocat/Hello-World",
    "provider": "github",
    "forceRescan": false,
    "verifiedOnly": false
  }'
```

### Get Scan History

```bash
curl "http://localhost:3000/api/v1/scan/history?page=1&limit=10&provider=github"
```

### Get Specific Scan Result

```bash
curl "http://localhost:3000/api/v1/scan/{scanId}"
```

### Get Scan Statistics

```bash
curl "http://localhost:3000/api/v1/scan/statistics"
```

## 🏗️ Architecture

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │───▶│   NestJS API    │───▶│   TruffleHog    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ├─────────┐
                              ▼         ▼
                       ┌──────────┐ ┌───────────┐
                       │PostgreSQL│ │   Redis   │
                       │Database  │ │   Cache   │
                       └──────────┘ └───────────┘
```

### Directory Structure

```
src/
├── config/                 # Configuration files
│   ├── database.config.ts   # Database configuration
│   ├── cache.config.ts      # Cache configuration
│   └── throttle.config.ts   # Rate limiting configuration
├── common/                 # Shared utilities
│   ├── filters/            # Exception filters
│   ├── interceptors/       # Request/response interceptors
│   └── guards/             # Authentication guards
├── modules/                # Feature modules
│   ├── scan/               # Vulnerability scanning module
│   │   ├── dto/            # Data transfer objects
│   │   ├── entities/       # Database entities
│   │   ├── services/       # Business logic services
│   │   └── scan.controller.ts
│   ├── cache/              # Redis caching module
│   └── health/             # Health check module
├── app.module.ts           # Root application module
└── main.ts                 # Application entry point
```

## 🔒 Security Features

### Rate Limiting
- **Default**: 10 requests per 60 seconds per IP
- **Configurable**: Via `THROTTLE_TTL` and `THROTTLE_LIMIT` environment variables

### Data Validation
- **Input Validation**: All endpoints use DTOs with class-validator
- **URL Validation**: Repository URLs are validated for proper format
- **Parameter Sanitization**: Automatic sanitization of sensitive data in logs

### Security Headers
- **Helmet**: Automatically sets security headers
- **CORS**: Configurable CORS policies
- **Error Handling**: Sensitive information filtering in production

## 📊 Monitoring & Observability

### Health Checks

The application provides comprehensive health monitoring:

- **`/api/v1/health`**: Complete system health check
- **`/api/v1/health/ready`**: Readiness probe for Kubernetes
- **`/api/v1/health/live`**: Liveness probe for Kubernetes

### Logging

Structured logging with:
- **Request/Response Logging**: All HTTP interactions
- **Error Tracking**: Comprehensive error logging with context
- **Performance Metrics**: Response times and resource usage
- **Security Events**: Authentication and authorization events

### Metrics

Available statistics through `/api/v1/scan/statistics`:
- Total number of scans performed
- Success/failure rates
- Average vulnerabilities per scan
- Most common vulnerability detector types
- Performance metrics

## 🚀 Production Deployment

### Using Docker Compose (Recommended)

```bash
# Use production compose file
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3000

# Use strong passwords in production
DB_PASSWORD=your-secure-database-password
REDIS_PASSWORD=your-secure-redis-password

# Disable Swagger in production
SWAGGER_ENABLED=false

# Reduce logging verbosity
LOG_LEVEL=warn

# Disable database synchronization
DB_SYNCHRONIZE=false
DB_LOGGING=false
```

## 🧪 Testing

### Running Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

### Test Database Setup

For integration tests, set up a separate test database:

```bash
# Start test database
docker run -d --name test-postgres \
  -e POSTGRES_DB=vulnerability_scanner_test \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5433:5432 postgres:15-alpine
```

## 🛠️ Development Tools

### Available Scripts

```bash
# Development
npm run start:dev          # Start with hot reload
npm run start:debug        # Start in debug mode

# Building
npm run build             # Build for production
npm run start:prod        # Start production build

# Code Quality
npm run lint              # Run ESLint
npm run format            # Format with Prettier

# Database
npm run migration:generate # Generate new migration
npm run migration:run      # Run migrations
npm run migration:revert   # Revert last migration

# Docker
npm run docker:build      # Build Docker image
npm run docker:up          # Start Docker services
npm run docker:down        # Stop Docker services
```

### Database Management

```bash
# Generate a new migration after entity changes
npm run migration:generate -- src/migrations/AddNewColumn

# Run pending migrations
npm run migration:run

# Revert the last migration
npm run migration:revert
```

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Code Standards

- **TypeScript**: Strict type checking enabled
- **ESLint**: Code linting with recommended rules
- **Prettier**: Code formatting
- **Conventional Commits**: Standardized commit messages

## 📋 Troubleshooting

### Common Issues

#### Docker Services Won't Start

```bash
# Check service logs
docker-compose logs [service-name]

# Reset Docker environment
docker-compose down -v
docker-compose up -d
```

#### Database Connection Issues

```bash
# Verify database is running
docker-compose ps

# Check database logs
docker-compose logs postgres

# Connect to database manually
docker-compose exec postgres psql -U postgres -d vulnerability_scanner
```

#### TruffleHog Scan Failures

```bash
# Check if Docker socket is properly mounted
ls -la /var/run/docker.sock

# Verify TruffleHog image is available
docker pull trufflesecurity/trufflehog:latest

# Check application logs for specific errors
docker-compose logs app
```

#### Redis Connection Issues

```bash
# Test Redis connectivity
docker-compose exec redis redis-cli ping

# Check Redis logs
docker-compose logs redis
```

### Performance Optimization

#### Database Performance
- Ensure proper indexing on frequently queried columns
- Consider connection pooling for high-traffic scenarios
- Monitor query performance with `DB_LOGGING=true`

#### Cache Optimization
- Adjust `CACHE_TTL` based on your scanning frequency
- Monitor Redis memory usage
- Consider Redis clustering for high availability

#### Resource Limits
```yaml
# In docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
```

## 📞 Support

- **Documentation**: Available at `/docs` endpoint
- **Issues**: Create issues in the repository
- **Health Checks**: Monitor application status at `/health`

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.


Built with ❤️ using [NestJS](https://nestjs.com/), [TruffleHog](https://github.com/trufflesecurity/trufflehog), and modern DevOps practices.
