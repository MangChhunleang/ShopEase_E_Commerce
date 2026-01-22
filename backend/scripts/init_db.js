import 'dotenv/config';
import bcrypt from 'bcrypt';
import { getConnection } from '../src/config/database.js';

const email = 'admin@example.com';
const password = 'Admin123!';
const hash = await bcrypt.hash(password, 10);

const conn = await getConnection();
try {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS User (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(191) NOT NULL UNIQUE,
      passwordHash VARCHAR(255) NOT NULL,
      phoneNumber VARCHAR(20) UNIQUE,
      isPhoneVerified BOOLEAN NOT NULL DEFAULT FALSE,
      role ENUM('USER','ADMIN') NOT NULL DEFAULT 'USER',
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Add phoneNumber and isPhoneVerified columns if they don't exist (for existing databases)
  try {
    await conn.query(`ALTER TABLE User ADD COLUMN phoneNumber VARCHAR(20) UNIQUE`);
    console.log('✅ Added phoneNumber column to User table');
  } catch (err) {
    if (!err.message.includes('Duplicate column name')) throw err;
  }
  try {
    await conn.query(`ALTER TABLE User ADD COLUMN isPhoneVerified BOOLEAN NOT NULL DEFAULT FALSE`);
    console.log('✅ Added isPhoneVerified column to User table');
  } catch (err) {
    if (!err.message.includes('Duplicate column name')) throw err;
  }
  try {
    await conn.query(`ALTER TABLE User ADD COLUMN isActive BOOLEAN NOT NULL DEFAULT TRUE`);
    console.log('✅ Added isActive column to User table');
  } catch (err) {
    if (!err.message.includes('Duplicate column name')) throw err;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS Product (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL,
      stock INT NOT NULL DEFAULT 0,
      status ENUM('ACTIVE','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
      images JSON NULL,
      category VARCHAR(50) NULL,
      offer TEXT NULL,
      color VARCHAR(50) NULL,
      updatedById INT NULL,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_product_user FOREIGN KEY (updatedById) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  // Add new columns if they don't exist (for existing databases)
  try {
    await conn.query(`ALTER TABLE Product ADD COLUMN category VARCHAR(50) NULL`);
  } catch (err) {
    if (!err.message.includes('Duplicate column name')) throw err;
  }
  try {
    await conn.query(`ALTER TABLE Product ADD COLUMN offer TEXT NULL`);
  } catch (err) {
    if (!err.message.includes('Duplicate column name')) throw err;
  }
  try {
    await conn.query(`ALTER TABLE Product ADD COLUMN color VARCHAR(50) NULL`);
  } catch (err) {
    if (!err.message.includes('Duplicate column name')) throw err;
  }

  // Create Order table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`Order\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      orderNumber VARCHAR(50) NOT NULL UNIQUE,
      customerName VARCHAR(255) NOT NULL,
      customerPhone VARCHAR(20) NOT NULL,
      customerAddress TEXT NOT NULL,
      customerCity VARCHAR(100) NOT NULL,
      customerDistrict VARCHAR(100) NOT NULL,
      paymentMethod ENUM('Cash on Delivery', 'ABA Pay', 'Bakong') NOT NULL,
      status ENUM('pending', 'processing', 'delivered', 'expired', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
      subtotal DECIMAL(10,2) NOT NULL,
      shipping DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      total DECIMAL(10,2) NOT NULL,
      userId INT NULL,
      bakongTransactionId VARCHAR(255) NULL,
      orderDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_order_user FOREIGN KEY (userId) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  // Add Bakong to paymentMethod ENUM if it doesn't exist (for existing databases)
  try {
    await conn.query(`ALTER TABLE \`Order\` MODIFY COLUMN paymentMethod ENUM('Cash on Delivery', 'ABA Pay', 'Bakong') NOT NULL`);
    console.log('✅ Added Bakong to paymentMethod ENUM');
  } catch (err) {
    if (!err.message.includes('Duplicate column name') && !err.message.includes('Unknown column')) {
      console.log('Note: paymentMethod ENUM may already include Bakong or table may not exist yet');
    }
  }

  // Add new statuses to status ENUM if they don't exist
  try {
    await conn.query(`ALTER TABLE \`Order\` MODIFY COLUMN status ENUM('pending', 'processing', 'delivered', 'expired', 'failed', 'cancelled') NOT NULL DEFAULT 'pending'`);
    console.log('✅ Updated Order status ENUM with expired/failed/cancelled');
  } catch (err) {
    console.log('Note: Order status ENUM update failed (might be same)', err.message);
  }

  // Add bakongTransactionId column if it doesn't exist
  try {
    await conn.query(`ALTER TABLE \`Order\` ADD COLUMN bakongTransactionId VARCHAR(255) NULL`);
    console.log('✅ Added bakongTransactionId column to Order table');
  } catch (err) {
    if (err.message.includes('Duplicate column')) {
      console.log('Note: bakongTransactionId column already exists');
    } else {
      console.log('Note: Error adding bakongTransactionId column:', err.message);
    }
  }

  // Create OrderItem table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS OrderItem (
      id INT AUTO_INCREMENT PRIMARY KEY,
      orderId INT NOT NULL,
      productId INT NULL,
      productName VARCHAR(255) NOT NULL,
      productImage TEXT,
      price DECIMAL(10,2) NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      color VARCHAR(50) NULL,
      offer TEXT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_orderitem_order FOREIGN KEY (orderId) REFERENCES \`Order\`(id) ON DELETE CASCADE,
      CONSTRAINT fk_orderitem_product FOREIGN KEY (productId) REFERENCES Product(id) ON DELETE SET NULL
    )
  `);

  // Create Category table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS Category (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      icon VARCHAR(255) NULL,
      color VARCHAR(50) NULL,
      logoUrl VARCHAR(500) NULL,
      parentCategoryId INT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_category_parent FOREIGN KEY (parentCategoryId) REFERENCES Category(id) ON DELETE CASCADE,
      UNIQUE KEY unique_category_name_parent (name, parentCategoryId)
    )
  `);

  // Add parentCategoryId column if it doesn't exist (for existing databases)
  try {
    await conn.query(`ALTER TABLE Category ADD COLUMN parentCategoryId INT NULL`);
    await conn.query(`ALTER TABLE Category ADD CONSTRAINT fk_category_parent FOREIGN KEY (parentCategoryId) REFERENCES Category(id) ON DELETE CASCADE`);
    await conn.query(`ALTER TABLE Category ADD UNIQUE KEY unique_category_name_parent (name, parentCategoryId)`);
    console.log('✅ Added parentCategoryId column to Category table');
  } catch (err) {
    if (!err.message.includes('Duplicate column name') && !err.message.includes('Duplicate key name')) {
      console.log('Note: parentCategoryId column may already exist or constraint already exists');
    }
  }

  // Add logoUrl column if it doesn't exist (for existing databases)
  try {
    await conn.query(`ALTER TABLE Category ADD COLUMN logoUrl VARCHAR(500) NULL`);
    console.log('✅ Added logoUrl column to Category table');
  } catch (err) {
    if (!err.message.includes('Duplicate column name')) {
      console.log('Note: logoUrl column may already exist');
    }
  }

  // Create Review table for product reviews/ratings
  await conn.query(`
    CREATE TABLE IF NOT EXISTS Review (
      id INT AUTO_INCREMENT PRIMARY KEY,
      productId INT NOT NULL,
      userId INT NULL,
      userName VARCHAR(255) NULL,
      rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT NULL,
      isApproved BOOLEAN NOT NULL DEFAULT TRUE,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_review_product FOREIGN KEY (productId) REFERENCES Product(id) ON DELETE CASCADE,
      CONSTRAINT fk_review_user FOREIGN KEY (userId) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  // Create Wishlist table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS Wishlist (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      productId INT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_product (userId, productId),
      CONSTRAINT fk_wishlist_user FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
      CONSTRAINT fk_wishlist_product FOREIGN KEY (productId) REFERENCES Product(id) ON DELETE CASCADE
    )
  `);

  // Create OrderStatusHistory table for order tracking
  await conn.query(`
    CREATE TABLE IF NOT EXISTS OrderStatusHistory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      orderId INT NOT NULL,
      status ENUM('pending', 'processing', 'delivered', 'expired', 'failed') NOT NULL,
      note TEXT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_order_history FOREIGN KEY (orderId) REFERENCES \`Order\`(id) ON DELETE CASCADE
    )
  `);

  // Update OrderStatusHistory status ENUM
  try {
    await conn.query(`ALTER TABLE OrderStatusHistory MODIFY COLUMN status ENUM('pending', 'processing', 'delivered', 'expired', 'failed') NOT NULL`);
    console.log('✅ Updated OrderStatusHistory status ENUM');
  } catch (err) {
    console.log('Note: OrderStatusHistory status ENUM update failed', err.message);
  }

  // Seed default categories if table is empty
  const existingCategories = await conn.query('SELECT COUNT(*) as count FROM Category');
  if (existingCategories[0]?.count === 0) {
    await conn.query(`
      INSERT INTO Category (name, description, color, createdAt, updatedAt) VALUES
      ('Football', 'Football and soccer equipment', '#2E7D32', NOW(), NOW()),
      ('Basketball', 'Basketball equipment and accessories', '#F57C00', NOW(), NOW()),
      ('Volleyball', 'Volleyball equipment', '#1976D2', NOW(), NOW()),
      ('Other Sports', 'Other sports equipment', '#757575', NOW(), NOW())
    `);
    console.log('✅ Seeded default categories');
  }

  // Create Banner table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS Banner (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      imageUrl VARCHAR(500) NOT NULL,
      linkType ENUM('none', 'product', 'category', 'url') NOT NULL DEFAULT 'none',
      linkValue VARCHAR(500) NULL,
      displayOrder INT NOT NULL DEFAULT 0,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      displayOnHome BOOLEAN NOT NULL DEFAULT TRUE,
      startDate DATETIME NULL,
      endDate DATETIME NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Add displayOnHome column if upgrading an existing database
  try {
    await conn.query(`ALTER TABLE Banner ADD COLUMN displayOnHome BOOLEAN NOT NULL DEFAULT TRUE`);
    console.log('✅ Added displayOnHome column to Banner table');
  } catch (err) {
    if (!err.message.includes('Duplicate column name')) {
      console.log('Note: displayOnHome column may already exist');
    }
  }

  await conn.query(
    `INSERT INTO User (email, passwordHash, role, createdAt, updatedAt)
     VALUES (?, ?, 'ADMIN', NOW(), NOW())
     ON DUPLICATE KEY UPDATE passwordHash = VALUES(passwordHash), role = 'ADMIN', updatedAt = NOW()`,
    [email, hash],
  );

  console.log('Seeded admin:', email, password);
  console.log('Database tables initialized: User, Product, Order, OrderItem, Category, Banner, Review, Wishlist, OrderStatusHistory');
} finally {
  conn.release();
}
