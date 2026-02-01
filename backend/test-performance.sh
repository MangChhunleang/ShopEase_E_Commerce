#!/bin/bash

# ShopEase Performance Testing Script
# This script runs comprehensive performance tests

echo "🚀 ShopEase Performance Testing Suite"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backend is running
check_backend() {
    echo -e "${BLUE}🔍 Checking backend health...${NC}"
    
    if ! curl -s http://localhost:4000/api/health > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Backend is not running on port 4000${NC}"
        echo "Start it with: npm run dev (in backend directory)"
        return 1
    fi
    
    echo -e "${GREEN}✅ Backend is healthy${NC}"
    return 0
}

# Run basic performance test
run_basic_test() {
    echo ""
    echo -e "${BLUE}📊 Running basic performance test...${NC}"
    echo "Testing endpoint: GET /api/products"
    echo ""
    
    # Single request
    echo -e "${YELLOW}Single request timing:${NC}"
    time curl -s http://localhost:4000/api/products > /dev/null
    
    echo ""
    echo -e "${YELLOW}Average of 10 requests:${NC}"
    
    total_time=0
    for i in {1..10}; do
        start=$(date +%s%N)
        curl -s http://localhost:4000/api/products > /dev/null
        end=$(date +%s%N)
        elapsed=$((($end - $start) / 1000000))
        total_time=$(($total_time + $elapsed))
        echo "  Request $i: ${elapsed}ms"
    done
    
    avg_time=$(($total_time / 10))
    echo ""
    echo -e "${GREEN}Average response time: ${avg_time}ms${NC}"
}

# Run concurrent test with wrk (if available)
run_concurrent_test() {
    echo ""
    echo -e "${BLUE}🔄 Running concurrent load test...${NC}"
    
    if command -v wrk &> /dev/null; then
        echo "Using 'wrk' for load testing (10 seconds, 4 threads, 10 connections)"
        wrk -t4 -c10 -d10s http://localhost:4000/api/products
    else
        echo -e "${YELLOW}⚠️  'wrk' not found. Performing basic concurrent test...${NC}"
        
        echo "Running 50 parallel requests..."
        for i in {1..50}; do
            curl -s http://localhost:4000/api/products > /dev/null &
        done
        wait
        echo -e "${GREEN}✅ 50 concurrent requests completed${NC}"
    fi
}

# Analyze database indexes
analyze_indexes() {
    echo ""
    echo -e "${BLUE}📈 Analyzing database indexes...${NC}"
    echo ""
    echo "To view index performance:"
    echo "1. Connect to database: mysql -u root -p shopease"
    echo "2. Run: EXPLAIN SELECT * FROM user WHERE role = 'seller';"
    echo "3. Check 'rows' column - should be small number"
    echo ""
    echo "Current indexes should be:"
    echo "  ✓ user(role)"
    echo "  ✓ user(createdAt)"
    echo "  ✓ product(status)"
    echo "  ✓ product(category)"
    echo "  ✓ product(createdAt)"
    echo "  ✓ product(updatedAt)"
    echo "  ✓ product(updatedById)"
}

# Main execution
main() {
    check_backend
    if [ $? -eq 0 ]; then
        run_basic_test
        run_concurrent_test
        analyze_indexes
        
        echo ""
        echo -e "${GREEN}✅ Performance testing complete!${NC}"
        echo ""
        echo "Next steps:"
        echo "1. Compare results with PERFORMANCE_OPTIMIZATION.md targets"
        echo "2. Implement N+1 query fixes (see guide for details)"
        echo "3. Set up Redis caching for frequently accessed data"
        echo "4. Monitor query performance with database slow log"
        
    else
        exit 1
    fi
}

main
