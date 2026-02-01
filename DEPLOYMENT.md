# ShopEase Production Deployment Guide

## Quick Start with Docker

### Prerequisites
- Docker and Docker Compose installed
- At least 2GB RAM available
- Ports 3306, 4000, 5173 available

### Step 1: Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env and set your values
nano .env
```

**Critical settings to change:**
- `JWT_SECRET` - Generate with: `openssl rand -base64 32`
- `DB_ROOT_PASSWORD` - Strong database root password
- `DB_PASSWORD` - Strong database user password
- `ALLOWED_ORIGINS` - Your production domain(s)

### Step 2: Start All Services

```bash
# Build and start all containers
docker-compose up -d

# Watch logs
docker-compose logs -f backend
```

### Step 3: Initialize Database

```bash
# Run database initialization script
docker-compose exec backend npm run init-db

# Verify database
docker-compose exec database mysql -u shopease_user -p shopease
```

### Step 4: Verify Health

```bash
# Check backend health
curl http://localhost:4000/health

# Check readiness
curl http://localhost:4000/ready
```

## Production Checklist

### Security
- [ ] Strong `JWT_SECRET` (32+ characters)
- [ ] Strong database passwords
- [ ] `ALLOWED_ORIGINS` restricted to production domains
- [ ] `NODE_ENV=production` set
- [ ] HTTPS configured (use reverse proxy like Nginx/Traefik)
- [ ] Firewall rules configured

### Database
- [ ] Regular backups scheduled
- [ ] Backup restoration tested
- [ ] Database user has minimum required permissions
- [ ] Connection pooling configured

### Monitoring
- [ ] Health checks working (`/health`, `/ready`)
- [ ] Log aggregation set up
- [ ] Disk space monitoring
- [ ] Memory/CPU monitoring
- [ ] Error alerting configured

### Performance
- [ ] Database indexes created
- [ ] Image optimization enabled
- [ ] Gzip compression enabled (Nginx)
- [ ] CDN configured for static assets
- [ ] Rate limiting tested

## Common Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f [service_name]

# Restart specific service
docker-compose restart backend

# Database backup
docker-compose exec database mysqldump -u root -p shopease > backup_$(date +%Y%m%d).sql

# Database restore
docker-compose exec -T database mysql -u root -p shopease < backup.sql

# Update code (zero-downtime)
git pull
docker-compose build backend
docker-compose up -d --no-deps backend

# Scale backend (if using load balancer)
docker-compose up -d --scale backend=3
```

## Troubleshooting

### Backend won't start
1. Check environment variables: `docker-compose exec backend printenv`
2. Check database connection: `docker-compose logs database`
3. Validate .env file exists and has correct values

### Database connection refused
1. Wait for database to be healthy: `docker-compose ps`
2. Check credentials match .env file
3. Check network: `docker network inspect shopease_shopease_network`

### Cannot access from outside
1. Check port bindings: `docker-compose ps`
2. Check firewall rules
3. Verify ALLOWED_ORIGINS includes your domain

### Out of disk space
1. Clean old images: `docker system prune -a`
2. Check upload folder: `du -sh backend/uploads`
3. Implement upload limits and cleanup jobs

## Production Architecture

```
Internet
    ↓
[Load Balancer / Reverse Proxy]
    ↓
[ShopEase Backend (Node.js)]
    ↓
[MySQL Database]
```

**Recommended additions:**
- Nginx/Traefik reverse proxy for HTTPS
- Redis for session storage and caching
- S3/CDN for uploaded images
- Log aggregation (ELK stack, Loki)
- Monitoring (Prometheus + Grafana)
- Error tracking (Sentry)

## Backup Strategy

### Automated Backups

Add to crontab:
```bash
# Daily database backup at 2 AM
0 2 * * * cd /path/to/shopease && docker-compose exec -T database mysqldump -u root -p$DB_ROOT_PASSWORD shopease | gzip > backups/db_$(date +\%Y\%m\%d_\%H\%M\%S).sql.gz

# Weekly backup of uploads
0 3 * * 0 tar -czf backups/uploads_$(date +\%Y\%m\%d).tar.gz backend/uploads/
```

### Backup Retention
- Daily backups: Keep 7 days
- Weekly backups: Keep 4 weeks  
- Monthly backups: Keep 12 months

### Test Restoration Monthly
```bash
# Create test database
docker-compose exec database mysql -u root -p -e "CREATE DATABASE shopease_test;"

# Restore to test database
gunzip -c backups/db_latest.sql.gz | docker-compose exec -T database mysql -u root -p shopease_test

# Verify data
docker-compose exec database mysql -u root -p shopease_test -e "SELECT COUNT(*) FROM Product;"
```

## Security Hardening

1. **Database**
   - Use strong passwords (16+ characters)
   - Grant minimal permissions to app user
   - Disable remote root login
   - Enable SSL connections

2. **Application**
   - Keep dependencies updated
   - Run vulnerability scans: `npm audit`
   - Use security headers
   - Implement rate limiting

3. **Infrastructure**
   - Use firewall (UFW, iptables)
   - Enable fail2ban
   - Regular security updates
   - Monitor failed login attempts

4. **Secrets Management**
   - Never commit .env files
   - Use secrets manager (Vault, AWS Secrets)
   - Rotate credentials regularly
   - Audit access logs

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f backend`
2. Review documentation in `/docs`
3. Contact development team
