# Testing Guide - ShopEase Backend

## Overview

This project uses **Jest** for unit and integration testing, with **Supertest** for HTTP API testing.

## Setup

Testing dependencies are already installed:
- `jest` - Testing framework
- `supertest` - HTTP assertion library
- `@testing-library/jest-dom` - DOM matchers

## Test Files Location

Tests are located in `src/__tests__/` directory:
```
src/__tests__/
├── health.test.js       # Health check endpoints
├── auth.test.js         # Authentication & JWT
└── products.test.js     # Product CRUD operations
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage report
```bash
npm run test:coverage
```

### Debug tests
```bash
npm run test:debug
```

## Test Categories

### 1. **Health Check Tests** (`health.test.js`)
- ✅ GET /health - Server health status
- ✅ GET /ready - Database readiness check

### 2. **Authentication Tests** (`auth.test.js`)
- ✅ User registration with validation
- ✅ Duplicate email prevention
- ✅ Invalid email format rejection
- ✅ Weak password rejection
- ✅ Login with correct credentials
- ✅ Invalid password rejection
- ✅ JWT token validation
- ✅ Missing token handling
- ✅ Invalid token rejection

### 3. **Product Tests** (`products.test.js`)
- ✅ Create product
- ✅ Required field validation
- ✅ Duplicate product prevention
- ✅ Retrieve all products with pagination
- ✅ Filter products by category
- ✅ Get product by ID
- ✅ Update product
- ✅ Delete product

## Test Database

Tests use a separate test database: `shopease_test`

**Important:** Ensure the test database doesn't contain production data.

Configure test database in `.env.test`:
```
DATABASE_URL=mysql://shopease_user:shopease_password123@localhost:3306/shopease_test
```

## Writing New Tests

### Example: Testing an endpoint

```javascript
import request from 'supertest';
import { createServer } from '../../server.js';

describe('My Feature', () => {
  let app;

  beforeAll(async () => {
    app = await createServer();
  });

  describe('POST /api/my-endpoint', () => {
    it('should do something', async () => {
      const response = await request(app)
        .post('/api/my-endpoint')
        .send({ data: 'test' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should handle errors', async () => {
      const response = await request(app)
        .post('/api/my-endpoint')
        .send({}) // Missing required data
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});
```

## Test Naming Conventions

- Test file: `featureName.test.js`
- Test suite: `describe('Feature Name', ...)`
- Test case: `it('should do something specific', ...)`

## Coverage Thresholds

Current coverage requirements (in `jest.config.js`):
- **Branches:** 50%
- **Functions:** 50%
- **Lines:** 50%
- **Statements:** 50%

View coverage report:
```bash
npm run test:coverage
```

## Common Test Patterns

### Testing with Authentication
```javascript
const response = await request(app)
  .post('/api/protected-route')
  .set('Authorization', `Bearer ${token}`)
  .send(data)
  .expect(200);
```

### Testing Error Responses
```javascript
const response = await request(app)
  .post('/api/route')
  .send(invalidData)
  .expect(400); // Expected status code

expect(response.body).toHaveProperty('success', false);
expect(response.body.message).toMatch(/specific error message/i);
```

### Testing Database Operations
```javascript
beforeEach(async () => {
  // Setup: Create test data
  await request(app).post('/api/users').send(userData);
});

afterEach(async () => {
  // Cleanup: Remove test data
  // Use prisma directly for cleanup if needed
});
```

## CI/CD Integration

These tests will be run automatically in GitHub Actions:
```bash
npm test -- --coverage
```

## Troubleshooting

### "ECONNREFUSED" errors
- Ensure MySQL is running on localhost:3306
- Check DATABASE_URL in `.env.test`
- Create test database: `mysql -u root -p -e "CREATE DATABASE shopease_test;"`

### Tests hang or timeout
- Increase jest timeout: `jest.setTimeout(30000)` in test file
- Check if database connections are properly closed
- Look for unresolved promises

### Test database not clean
Reset test database:
```bash
npx prisma migrate reset --force
```

## Next Steps

After tests are working:
1. ✅ Integrate with GitHub Actions CI/CD
2. ✅ Increase coverage thresholds gradually
3. ✅ Add E2E tests for critical user flows
4. ✅ Set up test reports/badges
