# CI/CD Status Badges

Add these to your README.md:

## GitHub Actions Status

```markdown
## CI/CD Pipeline

![Tests](https://github.com/MangChhunleang/ShopEase_E_Commerce/actions/workflows/test.yml/badge.svg?branch=main)
![Build](https://github.com/MangChhunleang/ShopEase_E_Commerce/actions/workflows/build.yml/badge.svg?branch=main)
![Code Quality](https://github.com/MangChhunleang/ShopEase_E_Commerce/actions/workflows/code-quality.yml/badge.svg?branch=main)
```

## Codecov Status

After first successful test run, add:

```markdown
[![codecov](https://codecov.io/gh/MangChhunleang/ShopEase_E_Commerce/branch/main/graph/badge.svg)](https://codecov.io/gh/MangChhunleang/ShopEase_E_Commerce)
```

## Docker Hub Status (Optional)

If pushing to Docker Hub:

```markdown
![Docker Image](https://img.shields.io/docker/v/yourusername/shopease-backend?sort=semver)
```
