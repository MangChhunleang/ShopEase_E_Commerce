import 'dotenv/config';
import mysql from 'mysql2/promise';

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL is not set in .env file');
  console.error('Please create a .env file in the backend directory with:');
  console.error('DATABASE_URL=mysql://username:password@localhost:3306/database_name');
  process.exit(1);
}

let pool;
try {
  pool = mysql.createPool(process.env.DATABASE_URL, {
    connectionLimit: 10,
    waitForConnections: true,
    decimalNumbers: true,
  });
} catch (error) {
  console.error('❌ ERROR: Failed to create database connection pool');
  console.error('Check your DATABASE_URL format in .env file');
  console.error('Expected format: mysql://username:password@host:port/database');
  process.exit(1);
}

// Test connection on startup
(async () => {
  try {
    const testConn = await pool.getConnection();
    await testConn.ping();
    testConn.release();
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ ERROR: Cannot connect to database');
    console.error('Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure MySQL is running');
    console.error('2. Check DATABASE_URL in .env file');
    console.error('3. Verify database exists');
    console.error('4. Check username/password are correct');
    console.error('5. Ensure MySQL is accessible on the specified host/port');
    console.error('\nExample DATABASE_URL:');
    console.error('DATABASE_URL=mysql://root:password@localhost:3306/shopease');
    // Don't exit here - let the server start but queries will fail with better errors
  }
})();

export async function query(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Database connection refused. Is MySQL running?');
      throw new Error('Database connection failed. Please check your MySQL server is running and DATABASE_URL is correct.');
    }
    throw error;
  }
}

export async function getConnection() {
  try {
    return await pool.getConnection();
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Database connection refused. Is MySQL running?');
      throw new Error('Database connection failed. Please check your MySQL server is running and DATABASE_URL is correct.');
    }
    throw error;
  }
}

export default pool;
