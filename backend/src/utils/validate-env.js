/**
 * Environment Variable Validation
 * Validates that all required environment variables are set before starting the server
 */

/**
 * Required environment variables that MUST be set
 */
const REQUIRED_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
];

/**
 * Optional environment variables with warnings if not set
 */
const RECOMMENDED_VARS = {
  'ALLOWED_ORIGINS': 'CORS will allow all origins (insecure for production)',
  'BAKONG_ACCESS_TOKEN': 'Bakong payments will not work',
  'BAKONG_MERCHANT_ID': 'Bakong payments will not work',
  'NODE_ENV': 'Running in development mode',
};

/**
 * Validates environment variables
 * Exits process if required variables are missing
 */
export function validateEnv() {
  console.log('[ENV] Validating environment variables...');
  
  const missing = [];
  const warnings = [];

  // Check required variables
  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    } else {
      console.log(`[ENV] ✓ ${varName} is set`);
    }
  }

  // Check recommended variables
  for (const [varName, warning] of Object.entries(RECOMMENDED_VARS)) {
    if (!process.env[varName]) {
      warnings.push({ name: varName, warning });
    } else {
      console.log(`[ENV] ✓ ${varName} is set`);
    }
  }

  // Report missing required variables
  if (missing.length > 0) {
    console.error('\n❌ CRITICAL: Missing required environment variables:');
    for (const varName of missing) {
      console.error(`   - ${varName}`);
    }
    console.error('\nPlease set these variables in your .env file.');
    console.error('See .env.example for template.\n');
    process.exit(1);
  }

  // Report warnings for recommended variables
  if (warnings.length > 0) {
    console.warn('\n⚠️  WARNING: Missing recommended environment variables:');
    for (const { name, warning } of warnings) {
      console.warn(`   - ${name}: ${warning}`);
    }
    console.warn('');
  }

  // Validate JWT_SECRET strength in production
  if (process.env.NODE_ENV === 'production') {
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret.length < 32) {
      console.error('\n❌ CRITICAL: JWT_SECRET is too short for production.');
      console.error('   JWT_SECRET must be at least 32 characters long.');
      console.error('   Generate a strong secret with: openssl rand -base64 32\n');
      process.exit(1);
    }
    
    // Check for common weak secrets
    const weakSecrets = ['secret', 'password', 'changeme', 'your-super-secret'];
    if (weakSecrets.some(weak => jwtSecret.toLowerCase().includes(weak))) {
      console.error('\n❌ CRITICAL: JWT_SECRET appears to be a default/weak value.');
      console.error('   Generate a strong secret with: openssl rand -base64 32\n');
      process.exit(1);
    }
  }

  // Validate DATABASE_URL format
  if (process.env.DATABASE_URL) {
    if (!process.env.DATABASE_URL.startsWith('mysql://')) {
      console.error('\n❌ CRITICAL: DATABASE_URL must start with "mysql://"');
      console.error('   Example: mysql://user:password@host:port/database\n');
      process.exit(1);
    }
  }

  console.log('[ENV] ✅ Environment validation passed\n');
}

/**
 * Get environment variable with fallback
 */
export function getEnv(key, defaultValue = '') {
  return process.env[key] || defaultValue;
}

/**
 * Check if running in production mode
 */
export function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Get numeric environment variable
 */
export function getEnvNumber(key, defaultValue = 0) {
  const value = process.env[key];
  if (!value) return defaultValue;
  const num = parseInt(value, 10);
  return isNaN(num) ? defaultValue : num;
}
