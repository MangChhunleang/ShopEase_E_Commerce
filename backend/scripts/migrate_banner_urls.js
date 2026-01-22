/**
 * Migration script to convert banner URLs from full URLs to relative paths
 * Run with: node scripts/migrate_banner_urls.js
 */

import { query } from '../src/config/database.js';
import dotenv from 'dotenv';

dotenv.config({ debug: false });

async function migrateBannerUrls() {
  console.log('Starting banner URL migration...');
  
  try {
    // Get all banners
    const banners = await query('SELECT id, imageUrl FROM Banner');
    
    if (!banners || banners.length === 0) {
      console.log('No banners found to migrate.');
      return;
    }

    console.log(`Found ${banners.length} banners to process.`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const banner of banners) {
      const { id, imageUrl } = banner;
      
      // Skip if already a relative path
      if (imageUrl.startsWith('/uploads/')) {
        console.log(`[SKIP] Banner ${id}: Already a relative path - ${imageUrl}`);
        skippedCount++;
        continue;
      }

      // Try to extract relative path from full URL
      const match = imageUrl.match(/\/uploads\/(banners|products)\/([^\/\?]+)/);
      
      if (match) {
        const relativePath = `/uploads/${match[1]}/${match[2]}`;
        
        // Update the banner
        await query(
          'UPDATE Banner SET imageUrl = ?, updatedAt = NOW() WHERE id = ?',
          [relativePath, id]
        );
        
        console.log(`[MIGRATE] Banner ${id}: ${imageUrl} -> ${relativePath}`);
        migratedCount++;
      } else {
        console.log(`[ERROR] Banner ${id}: Could not extract relative path from ${imageUrl}`);
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total banners: ${banners.length}`);
    console.log(`Migrated: ${migratedCount}`);
    console.log(`Skipped (already relative): ${skippedCount}`);
    console.log(`Failed: ${banners.length - migratedCount - skippedCount}`);
    console.log('\nMigration complete!');
    
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrateBannerUrls();
