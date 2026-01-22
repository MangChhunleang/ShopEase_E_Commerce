# Backend Scripts

This directory contains utility scripts for database management, testing, and debugging.

## Database Management

### Core Scripts
- **`init_db.js`** - Initialize database with baseline tables and seed data
- **`reset_db.js`** - Drop and recreate database schema (⚠️ DESTRUCTIVE)

### Migration Scripts
- **`migrate_add_bakong_column.js`** - Add Bakong payment column
- **`migrate_add_bakong_payment.js`** - Add Bakong payment support
- **`migrate_add_phone_columns.js`** - Add phone number columns
- **`migrate_banner_urls.js`** - Migrate banner URLs
- **`migrate_category_logo.js`** - Migrate category logos

## Data Management

- **`delete_orders_by_user.js`** - Delete orders for specific user
- **`update_orders_status.js`** - Update order statuses
- **`list_users.js`** - List all users in database

## Testing & Debug

- **`check_status.js`** - Check order status (hardcoded user ID 7)
- **`debug-login.js`** - Debug login configuration and user authentication
- **`simulate_webhook.js`** - Simulate webhook callbacks for testing

## Usage

Run scripts from the project root:

```bash
cd backend
node scripts/<script-name>.js
```

Or use npm scripts where available:

```bash
npm run init-db
npm run reset-db
```

## Notes

- All scripts use ES modules (`import`/`export`)
- Scripts require `.env` file configuration
- Migration scripts should be run once per environment
- Reset and delete scripts are destructive - use with caution
