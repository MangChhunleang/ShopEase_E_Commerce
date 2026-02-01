/**
 * Products Service Optimization Test
 * Tests the new Prisma-based products service
 * 
 * Run with: npm test -- src/__tests__/products-optimized.test.js
 */

import { PrismaClient } from '@prisma/client';
import {
  getProductsList,
  searchProducts,
  getProductById,
  getProductSuggestions,
  getCategories
} from '../services/products.service.js';

const prisma = new PrismaClient();

describe('Products Service - Optimization Tests', () => {
  
  beforeAll(async () => {
    // Ensure test database is set up
    console.log('Setting up test database...');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('getProductsList', () => {
    test('should fetch products with pagination', async () => {
      const result = await getProductsList({
        page: 1,
        limit: 10,
        category: null
      });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.pagination).toHaveProperty('page', 1);
      expect(result.pagination).toHaveProperty('limit', 10);
      expect(result.pagination).toHaveProperty('total');
    });

    test('should filter products by category', async () => {
      // First get a category
      const result = await getProductsList({
        page: 1,
        limit: 100,
        category: null
      });

      if (result.data.length > 0) {
        const category = result.data[0].category;
        
        const filtered = await getProductsList({
          page: 1,
          limit: 10,
          category
        });

        expect(Array.isArray(filtered.data)).toBe(true);
        if (filtered.data.length > 0) {
          expect(filtered.data[0].category).toBe(category);
        }
      }
    });

    test('should handle pagination correctly', async () => {
      const page1 = await getProductsList({ page: 1, limit: 5 });
      const page2 = await getProductsList({ page: 2, limit: 5 });

      if (page1.data.length > 0 && page2.data.length > 0) {
        // Products should be different
        const ids1 = page1.data.map(p => p.id);
        const ids2 = page2.data.map(p => p.id);
        const common = ids1.filter(id => ids2.includes(id));
        
        expect(common.length).toBe(0);
      }
    });
  });

  describe('searchProducts', () => {
    test('should search products by query', async () => {
      const result = await searchProducts({
        query: 'test',
        page: 1,
        limit: 10
      });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.data)).toBe(true);
    });

    test('should apply price filters', async () => {
      const result = await searchProducts({
        query: '',
        minPrice: 10,
        maxPrice: 100,
        page: 1,
        limit: 20
      });

      expect(Array.isArray(result.data)).toBe(true);
      if (result.data.length > 0) {
        result.data.forEach(product => {
          expect(product.price).toBeGreaterThanOrEqual(10);
          expect(product.price).toBeLessThanOrEqual(100);
        });
      }
    });

    test('should sort results correctly', async () => {
      const byPrice = await searchProducts({
        sort: 'price_asc',
        page: 1,
        limit: 10
      });

      if (byPrice.data.length > 1) {
        for (let i = 1; i < byPrice.data.length; i++) {
          expect(parseFloat(byPrice.data[i].price))
            .toBeGreaterThanOrEqual(parseFloat(byPrice.data[i - 1].price));
        }
      }
    });
  });

  describe('getProductById', () => {
    test('should fetch product by id', async () => {
      const list = await getProductsList({ page: 1, limit: 1 });
      
      if (list.data.length > 0) {
        const productId = list.data[0].id;
        const product = await getProductById(productId);

        expect(product).toHaveProperty('id', productId);
        expect(product).toHaveProperty('name');
        expect(product).toHaveProperty('price');
      }
    });

    test('should throw error for non-existent product', async () => {
      await expect(getProductById(999999)).rejects.toThrow();
    });
  });

  describe('getProductSuggestions', () => {
    test('should return suggestions', async () => {
      const suggestions = await getProductSuggestions('test', 10);
      
      expect(Array.isArray(suggestions)).toBe(true);
    });

    test('should limit results', async () => {
      const suggestions = await getProductSuggestions('', 5);
      
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getCategories', () => {
    test('should fetch categories with counts', async () => {
      const categories = await getCategories();
      
      expect(Array.isArray(categories)).toBe(true);
      categories.forEach(cat => {
        expect(cat).toHaveProperty('name');
        expect(cat).toHaveProperty('count');
        expect(typeof cat.count).toBe('number');
      });
    });
  });
});
