# CI/CD Pipeline Guide - ShopEase

## Overview

This project uses **GitHub Actions** for continuous integration and continuous deployment (CI/CD). The pipeline automatically:

1. ✅ Runs tests on every push and pull request
2. 🐳 Builds Docker images for backend and frontend
3. 📊 Generates code coverage reports
4. 🔍 Performs code quality checks

## Workflows

### 1. **Tests Workflow** (`.github/workflows/test.yml`)

**Triggers:**
- On every push to `main` or `develop` branch
- On every pull request to `main` or `develop`
- Only when backend files change

**What it does:**
- Sets up Node.js 20
- Installs dependencies
- Creates test MySQL database
- Runs Prisma migrations
- Executes Jest test suite
- Uploads coverage to Codecov
- Comments PR with coverage report

**Status badge:**
```markdown
![Tests](https://github.com/MangChhunleang/ShopEase_E_Commerce/actions/workflows/test.yml/badge.svg)
```

### 2. **Build Workflow** (`.github/workflows/build.yml`)

**Triggers:**
- On push to `main` or `develop` (Dockerfile changes)
- On pull request to `main` (Dockerfile changes)

**What it does:**
- Builds backend Docker image
- Builds frontend Docker image
- Validates Docker Compose configuration
- Caches layers for faster builds

**Status badge:**
```markdown
![Build](https://github.com/MangChhunleang/ShopEase_E_Commerce/actions/workflows/build.yml/badge.svg)
```

### 3. **Code Quality Workflow** (`.github/workflows/code-quality.yml`)

**Triggers:**
- On push to `main` or `develop` (source code changes)
- On pull request to `main` or `develop`

**What it does:**
- Checks for console.log/warn/error calls (use logger instead)
- Validates .env.example files exist
- Checks .gitignore for sensitive files
- Runs ESLint on frontend (non-blocking)

## How to Use

### View Workflow Status

1. Go to **GitHub Repository**
2. Click **Actions** tab
3. Select a workflow to see details
4. Click on a run to see logs

### Adding Status Badges

Add to your README.md:

```markdown
## CI/CD Status

![Tests](https://github.com/YOUR-USERNAME/ShopEase_E_Commerce/actions/workflows/test.yml/badge.svg)
![Build](https://github.com/YOUR-USERNAME/ShopEase_E_Commerce/actions/workflows/build.yml/badge.svg)
![Code Quality](https://github.com/YOUR-USERNAME/ShopEase_E_Commerce/actions/workflows/code-quality.yml/badge.svg)
```

## Test Database

Tests use a separate MySQL database created by the workflow:
- **Database:** `shopease_test`
- **User:** `shopease_user`
- **Password:** `shopease_password`
- **Service:** Temporary container during CI run

## Environment Variables in CI

The test workflow sets:
```
DATABASE_URL=mysql://shopease_user:shopease_password@localhost:3306/shopease_test
JWT_SECRET=test-secret-key
NODE_ENV=test
```

These are **CI-only** and don't affect production.

## Protecting Secrets

**GitHub Secrets are NOT stored in this repo.** For production deployment, add secrets to GitHub:

1. Go to **Settings → Secrets and variables → Actions**
2. Add secrets:
   - `DOCKERHUB_USERNAME` - Docker Hub username
   - `DOCKERHUB_TOKEN` - Docker Hub access token
   - `PROD_DATABASE_URL` - Production database URL
   - `PROD_JWT_SECRET` - Production JWT secret
   - `DEPLOY_KEY` - SSH key for production server

## Pull Request Workflow

When you create a PR:

1. ✅ Tests run automatically
2. ✅ Docker images build
3. ✅ Code quality checks run
4. 📊 Coverage report posted as comment
5. ✅ Status appears on PR

**Merge blocked if:**
- Tests fail
- Coverage drops significantly
- Required checks don't pass

## Debugging Failed Workflows

### Test Failures
1. Click **Actions** → select failed run
2. Expand **Run tests** step
3. Check error messages
4. Common causes:
   - Database connection issues
   - Missing environment variables
   - Test database not initialized

### Docker Build Failures
1. Check **Build** step logs
2. Verify Dockerfile syntax
3. Ensure all dependencies are installed

### Code Quality Issues
1. Check specific step that failed
2. Fix the issue locally
3. Push to trigger workflow again

## Local Testing Before Push

Before pushing to GitHub, test locally:

```bash
# Run tests locally
cd backend
npm test

# Build Docker images locally
docker compose build

# Check code quality
npm run lint  # frontend
```

## Performance Tips

**Workflows run faster with:**
- Smaller commits (fewer files changed)
- Caching (GitHub Actions uses action/cache@v3)
- Parallel jobs (backend and frontend build simultaneously)

**Current timings:**
- Tests: ~2-3 minutes
- Docker build: ~3-5 minutes
- Code quality: ~1-2 minutes
- **Total:** ~5-10 minutes per push

## Customizing Workflows

To modify workflows:

1. Edit `.github/workflows/*.yml`
2. Push changes
3. New workflow runs with updated config

**Example: Change test timeout**
```yaml
env:
  TEST_TIMEOUT: 30000  # 30 seconds
```

## GitHub Actions Pricing

- **Free tier:** 2,000 minutes/month
- **ShopEase usage:** ~10 minutes per push
- **Estimate:** 200 pushes/month = plenty of free minutes

## Next Steps

After CI/CD is working:

1. ✅ Add status badges to README
2. ✅ Require passing checks before merge
3. ✅ Enable branch protection rules
4. ✅ Set up automatic deployment (optional)

## Useful Links

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax Reference](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Codecov Integration](https://codecov.io)
- [Docker Build Action](https://github.com/docker/build-push-action)

## Troubleshooting

### Workflow not triggering
- Check branch name matches trigger condition
- Verify file paths in `paths:` section
- Push to correct branch

### Cache not working
- Check `cache-dependency-path` is correct
- Clear cache in Actions settings if needed

### Timeout issues
- Increase `timeout-minutes` in job config
- Optimize slow tests
- Check database connection

## Questions?

Check workflow files in `.github/workflows/` for detailed configuration.
