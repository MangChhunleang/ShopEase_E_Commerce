// Validate .env file
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

console.log('=== .env File Validation ===\n');

// Check if .env file exists
const envPath = path.join(process.cwd(), '.env');
console.log('Looking for .env at:', envPath);

if (!fs.existsSync(envPath)) {
    console.error('❌ .env file does NOT exist!');
    process.exit(1);
}

console.log('✅ .env file exists\n');

// Read .env file content
const envContent = fs.readFileSync(envPath, 'utf-8');
const lines = envContent.split('\n');

console.log('=== .env File Contents ===');
console.log(`Total lines: ${lines.length}\n`);

// Show each line (masking secrets)
lines.forEach((line, index) => {
    const lineNum = (index + 1).toString().padStart(3, ' ');
    if (line.trim().startsWith('#') || line.trim() === '') {
        console.log(`${lineNum}: ${line}`);
    } else if (line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=');
        const maskedValue = value.length > 10 ? value.substring(0, 10) + '...' : value;
        console.log(`${lineNum}: ${key}=${maskedValue}`);
    } else {
        console.log(`${lineNum}: ${line}`);
    }
});

console.log('\n=== Loading with dotenv ===');
const result = dotenv.config();

if (result.error) {
    console.error('❌ Error loading .env:', result.error);
    process.exit(1);
}

console.log('✅ dotenv loaded successfully\n');

console.log('=== Environment Variables Loaded ===');
const vonageKeys = ['VONAGE_API_KEY', 'VONAGE_API_SECRET', 'VONAGE_BRAND_NAME'];
vonageKeys.forEach(key => {
    const value = process.env[key];
    if (value) {
        const masked = value.length > 10 ? value.substring(0, 10) + '...' : value;
        console.log(`✅ ${key}: ${masked}`);
    } else {
        console.log(`❌ ${key}: NOT SET`);
    }
});

console.log('\n=== Summary ===');
const allSet = vonageKeys.every(key => process.env[key]);
if (allSet) {
    console.log('✅ All Vonage credentials are set!');
} else {
    console.log('❌ Some Vonage credentials are missing!');
    console.log('\nPlease add these lines to your .env file:');
    console.log('VONAGE_API_KEY=05d308d3');
    console.log('VONAGE_API_SECRET=48AJ0ME02DW3h6ZFfz9EyZZxlBHRzNYDYTihsNvoqPnMJlSQFl');
    console.log('VONAGE_BRAND_NAME=ShopEase');
}
