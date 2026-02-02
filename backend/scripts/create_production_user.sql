-- ============================================
-- ShopEase Production Database Security Setup
-- ============================================
-- Run this script to create a dedicated database user
-- instead of using the root account
--
-- IMPORTANT: Replace 'YOUR_STRONG_PASSWORD_HERE' with 
-- the password from your .env file
-- ============================================

-- Step 1: Create dedicated application user
-- Password in .env: Kh9mP2vL8nR5tQ3wX7sF1yJ4aB6cD0eG9hN2iM5kU8oZ
CREATE USER IF NOT EXISTS 'shopease_app'@'%' IDENTIFIED BY 'Kh9mP2vL8nR5tQ3wX7sF1yJ4aB6cD0eG9hN2iM5kU8oZ';
CREATE USER IF NOT EXISTS 'shopease_app'@'localhost' IDENTIFIED BY 'Kh9mP2vL8nR5tQ3wX7sF1yJ4aB6cD0eG9hN2iM5kU8oZ';

-- Step 2: Grant necessary permissions (NOT full root access)
GRANT SELECT, INSERT, UPDATE, DELETE ON shopease.* TO 'shopease_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON shopease.* TO 'shopease_app'@'localhost';

-- Step 3: Grant schema management for migrations
GRANT CREATE, ALTER, DROP, INDEX ON shopease.* TO 'shopease_app'@'%';
GRANT CREATE, ALTER, DROP, INDEX ON shopease.* TO 'shopease_app'@'localhost';

-- Step 4: Apply changes
FLUSH PRIVILEGES;

-- Step 5: Verify user was created
SELECT User, Host FROM mysql.user WHERE User = 'shopease_app';

-- ============================================
-- Testing the new user
-- ============================================
-- After running this script, test the connection:
-- mysql -u shopease_app -p shopease
-- Password: Kh9mP2vL8nR5tQ3wX7sF1yJ4aB6cD0eG9hN2iM5kU8oZ
-- 
-- Then try: SELECT * FROM User LIMIT 1;
-- Should work!
-- ============================================

-- ============================================
-- SECURITY NOTES
-- ============================================
-- 1. The new user CANNOT:
--    - Access other databases
--    - Create new databases
--    - Manage users
--    - Perform admin operations
--    - Access MySQL system tables
--
-- 2. The new user CAN:
--    - Read/Write data in shopease database
--    - Run migrations (CREATE/ALTER tables)
--    - Perform normal application operations
--
-- 3. Benefits:
--    - Follows principle of least privilege
--    - Limits damage if credentials compromised
--    - Production security best practice
-- ============================================
