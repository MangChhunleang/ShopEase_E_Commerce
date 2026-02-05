// Seed sample products and orders for dashboard demo
// Run with: node scripts/seed_sample_data.js

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { getConnection } from '../src/config/database.js';

async function seed() {
  const conn = await getConnection();

  try {
    // Ensure sample customer exists
    const customerEmail = 'customer@example.com';
    const customerPassword = 'Customer123!';
    const [customerRows] = await conn.query(
      'SELECT id FROM User WHERE email = ? LIMIT 1',
      [customerEmail]
    );

    const existingCustomer = customerRows[0];
    let customerId = existingCustomer?.id;
    if (!customerId) {
      const hash = await bcrypt.hash(customerPassword, 10);
      const [result] = await conn.query(
        `INSERT INTO User (email, passwordHash, role, isActive, createdAt, updatedAt)
         VALUES (?, ?, 'USER', TRUE, NOW(), NOW())`,
        [customerEmail, hash]
      );
      customerId = result.insertId;
      console.log('✅ Seeded sample customer:', customerEmail, customerPassword);
    }

    // Seed products if empty
    const [productCountRows] = await conn.query('SELECT COUNT(*) as count FROM Product');
    const productCountRow = productCountRows[0];
    if ((productCountRow?.count || 0) === 0) {
      const sampleProducts = [
        {
          name: 'Pro Football',
          description: 'FIFA-approved match ball with premium grip.',
          price: 39.99,
          stock: 50,
          category: 'Football',
          color: 'White/Black',
          images: JSON.stringify(['/uploads/products/football.jpg'])
        },
        {
          name: 'Elite Basketball',
          description: 'Indoor/outdoor composite leather basketball.',
          price: 29.99,
          stock: 40,
          category: 'Basketball',
          color: 'Orange',
          images: JSON.stringify(['/uploads/products/basketball.jpg'])
        },
        {
          name: 'Training Volleyball',
          description: 'Lightweight volleyball perfect for training.',
          price: 24.99,
          stock: 60,
          category: 'Volleyball',
          color: 'Blue/White',
          images: JSON.stringify(['/uploads/products/volleyball.jpg'])
        },
        {
          name: 'Fitness Mat',
          description: 'Non-slip yoga/fitness mat for home workouts.',
          price: 19.99,
          stock: 80,
          category: 'Other Sports',
          color: 'Purple',
          images: JSON.stringify(['/uploads/products/mat.jpg'])
        }
      ];

      for (const product of sampleProducts) {
        await conn.query(
          `INSERT INTO Product (name, description, price, stock, status, images, category, color, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, NOW(), NOW())`,
          [
            product.name,
            product.description,
            product.price,
            product.stock,
            product.images,
            product.category,
            product.color
          ]
        );
      }

      console.log('✅ Seeded sample products');
    }

    // Seed a sample order if empty
    const [orderCountRows] = await conn.query('SELECT COUNT(*) as count FROM `Order`');
    const orderCountRow = orderCountRows[0];
    if ((orderCountRow?.count || 0) === 0) {
      const [productRows] = await conn.query('SELECT * FROM Product ORDER BY id ASC LIMIT 1');
      const firstProduct = productRows[0];
      if (!firstProduct) {
        console.log('⚠️ No products found to create sample order');
        return;
      }

      const quantity = 2;
      const price = Number.parseFloat(firstProduct.price);
      const subtotal = Number.isFinite(price) ? price * quantity : 0;
      const shipping = 2.5;
      const total = subtotal + shipping;
      const orderNumber = `ORD-${Date.now()}`;

      const [orderResult] = await conn.query(
        `INSERT INTO \`Order\`
         (orderNumber, customerName, customerPhone, customerAddress, customerCity, customerDistrict, paymentMethod, status, subtotal, shipping, total, userId, orderDate, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
        [
          orderNumber,
          'Sample Customer',
          '+85512345678',
          '123 Sample Street',
          'Phnom Penh',
          'Chamkarmon',
          'Cash on Delivery',
          'pending',
          subtotal,
          shipping,
          total,
          customerId
        ]
      );

      const orderId = orderResult.insertId;

      let productImage = null;
      if (firstProduct.images) {
        if (typeof firstProduct.images === 'string') {
          try {
            const parsed = JSON.parse(firstProduct.images);
            productImage = Array.isArray(parsed) ? parsed[0] : null;
          } catch (err) {
            productImage = firstProduct.images;
          }
        } else if (Array.isArray(firstProduct.images)) {
          productImage = firstProduct.images[0];
        }
      }

      await conn.query(
        `INSERT INTO OrderItem
         (orderId, productId, productName, productImage, price, quantity, color, offer, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          orderId,
          firstProduct.id,
          firstProduct.name,
          productImage,
          price,
          quantity,
          firstProduct.color || null,
          firstProduct.offer || null
        ]
      );

      console.log('✅ Seeded sample order:', orderNumber);
    }

    console.log('🎉 Sample data seeding complete');
  } catch (error) {
    console.error('❌ Sample data seeding failed:', error.message);
    throw error;
  } finally {
    conn.release();
  }
}

seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));