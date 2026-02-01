#!/usr/bin/env node

/**
 * ShopEase Performance Load Test
 * Tests API endpoints under load to measure:
 * - Requests per second (RPS)
 * - Average response time
 * - P95/P99 latency
 * - Error rate
 * 
 * Usage: node test-performance.js
 */

import http from 'http';
import { performance } from 'perf_hooks';

const BASE_URL = 'http://localhost:4000';
const DURATION_SECONDS = 10;
const CONCURRENT_REQUESTS = 10;

// Test results
let results = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  responseTimes: [],
  errors: []
};

// Helper to make HTTP request
function makeRequest(path) {
  return new Promise((resolve) => {
    const startTime = performance.now();
    
    const req = http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = performance.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          duration,
          success: res.statusCode === 200
        });
      });
    });

    req.on('error', (err) => {
      const duration = performance.now() - startTime;
      resolve({
        statusCode: 0,
        duration,
        success: false,
        error: err.message
      });
    });

    req.setTimeout(5000);
  });
}

// Run load test
async function runLoadTest() {
  console.log('🚀 Starting ShopEase Performance Load Test');
  console.log(`📊 Duration: ${DURATION_SECONDS} seconds`);
  console.log(`🔄 Concurrent requests: ${CONCURRENT_REQUESTS}`);
  console.log('---');
  
  const testEndpoint = '/api/products';
  const startTime = Date.now();
  const endTime = startTime + (DURATION_SECONDS * 1000);
  
  let activeRequests = 0;
  let testRunning = true;
  
  // Function to send requests continuously
  async function sendRequests() {
    while (testRunning) {
      if (activeRequests < CONCURRENT_REQUESTS) {
        activeRequests++;
        results.totalRequests++;
        
        const response = await makeRequest(testEndpoint);
        activeRequests--;
        
        if (response.success) {
          results.successfulRequests++;
          results.responseTimes.push(response.duration);
        } else {
          results.failedRequests++;
          if (response.error) {
            results.errors.push(response.error);
          }
        }
        
        // Show progress every 100 requests
        if (results.totalRequests % 100 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          process.stdout.write(`\r✓ ${results.totalRequests} requests sent (${elapsed}s)`);
        }
      }
      
      // Check if test time has expired
      if (Date.now() >= endTime) {
        testRunning = false;
      }
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  
  // Run test
  await sendRequests();
  
  // Wait for all pending requests to complete
  while (activeRequests > 0) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n\n📊 PERFORMANCE TEST RESULTS');
  console.log('═══════════════════════════════════════');
  
  // Calculate statistics
  const avgResponseTime = results.responseTimes.length > 0
    ? (results.responseTimes.reduce((a, b) => a + b) / results.responseTimes.length).toFixed(2)
    : 0;
  
  const sortedTimes = results.responseTimes.sort((a, b) => a - b);
  const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
  const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
  
  const testDuration = (Date.now() - startTime) / 1000;
  const rps = (results.totalRequests / testDuration).toFixed(2);
  
  const successRate = ((results.successfulRequests / results.totalRequests) * 100).toFixed(1);
  
  console.log(`\n📈 Throughput:`);
  console.log(`   Requests per second (RPS): ${rps}`);
  console.log(`   Total requests sent: ${results.totalRequests}`);
  console.log(`   Test duration: ${testDuration.toFixed(2)}s`);
  
  console.log(`\n⏱️  Response Times:`);
  console.log(`   Average: ${avgResponseTime}ms`);
  console.log(`   Min: ${sortedTimes[0].toFixed(2)}ms`);
  console.log(`   Max: ${sortedTimes[sortedTimes.length - 1].toFixed(2)}ms`);
  console.log(`   P95: ${p95 ? p95.toFixed(2) : 'N/A'}ms`);
  console.log(`   P99: ${p99 ? p99.toFixed(2) : 'N/A'}ms`);
  
  console.log(`\n✅ Success Rate:`);
  console.log(`   Successful: ${results.successfulRequests} (${successRate}%)`);
  console.log(`   Failed: ${results.failedRequests}`);
  
  if (results.errors.length > 0) {
    console.log(`\n⚠️  Errors:`);
    const errorCounts = {};
    results.errors.forEach(err => {
      errorCounts[err] = (errorCounts[err] || 0) + 1;
    });
    Object.entries(errorCounts).forEach(([err, count]) => {
      console.log(`   ${err}: ${count}`);
    });
  }
  
  console.log('\n═══════════════════════════════════════');
  
  // Performance assessment
  console.log('\n🎯 Assessment:\n');
  
  if (rps > 100) {
    console.log('✅ EXCELLENT - RPS > 100 (Enterprise-grade)');
  } else if (rps > 50) {
    console.log('✅ GOOD - RPS 50-100 (Production-ready)');
  } else if (rps > 10) {
    console.log('⚠️  ACCEPTABLE - RPS 10-50 (Room for optimization)');
  } else {
    console.log('❌ POOR - RPS < 10 (Needs optimization)');
  }
  
  if (avgResponseTime < 100) {
    console.log('✅ EXCELLENT - Response time < 100ms');
  } else if (avgResponseTime < 500) {
    console.log('✅ GOOD - Response time < 500ms');
  } else if (avgResponseTime < 1000) {
    console.log('⚠️  ACCEPTABLE - Response time < 1000ms');
  } else {
    console.log('❌ POOR - Response time > 1000ms');
  }
  
  if (successRate >= 99) {
    console.log('✅ EXCELLENT - Success rate > 99%');
  } else if (successRate >= 95) {
    console.log('✅ GOOD - Success rate > 95%');
  } else if (successRate >= 90) {
    console.log('⚠️  ACCEPTABLE - Success rate > 90%');
  } else {
    console.log('❌ POOR - Success rate < 90%');
  }
}

// Run the test
runLoadTest().catch(console.error);
