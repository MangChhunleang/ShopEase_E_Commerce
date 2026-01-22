# Rate Limiting Testing Guide

The backend is running on `http://localhost:4000`. Here's how to test each rate limiter:

---

## 1. Test Order Creation Rate Limiter (5/min)

**Limit**: 5 requests per minute

**Command**: Run this PowerShell script to spam the order endpoint:

```powershell
# Save as: test-order-limiter.ps1
$url = "http://localhost:4000/orders"
$headers = @{"Content-Type" = "application/json"}

$payload = @{
    userId = 1
    items = @(@{productId = 1; quantity = 1})
    totalAmount = 100
    deliveryAddress = "Test Address"
    phoneNumber = "+855123456789"
} | ConvertTo-Json

for ($i = 1; $i -le 10; $i++) {
    Write-Host "Request #$i..."
    $response = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $payload -ErrorAction SilentlyContinue
    
    if ($response.StatusCode -eq 429) {
        Write-Host "❌ Rate limited! (HTTP 429)" -ForegroundColor Red
    } elseif ($response.StatusCode -eq 201 -or $response.StatusCode -eq 200) {
        Write-Host "✅ Success (HTTP $($response.StatusCode))" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Response: HTTP $($response.StatusCode)" -ForegroundColor Yellow
    }
    
    Start-Sleep -Milliseconds 200
}
```

**Expected Output**:
- ✅ Requests 1-5: Success (HTTP 200/201)
- ❌ Requests 6-10: Rate limited (HTTP 429)

---

## 2. Test Payment Status Rate Limiter (20/min)

**Limit**: 20 requests per minute

**Command**: 

```powershell
# Save as: test-payment-limiter.ps1
$orderId = 1  # Use a real order ID from your database
$url = "http://localhost:4000/orders/$orderId/bakong-status"

for ($i = 1; $i -le 25; $i++) {
    Write-Host "Request #$i..."
    
    $response = Invoke-WebRequest -Uri $url -Method GET -ErrorAction SilentlyContinue
    
    if ($response.StatusCode -eq 429) {
        Write-Host "❌ Rate limited! (HTTP 429)" -ForegroundColor Red
    } elseif ($response.StatusCode -eq 200) {
        Write-Host "✅ Success (HTTP 200)" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Response: HTTP $($response.StatusCode)" -ForegroundColor Yellow
    }
    
    Start-Sleep -Milliseconds 100
}
```

**Expected Output**:
- ✅ Requests 1-20: Success (HTTP 200)
- ❌ Requests 21-25: Rate limited (HTTP 429)

---

## 3. Test Auth Rate Limiter (10/15 min)

**Limit**: 10 requests per 15 minutes

**Command**:

```powershell
# Save as: test-auth-limiter.ps1
$url = "http://localhost:4000/auth/login"
$headers = @{"Content-Type" = "application/json"}

# Use invalid credentials to test auth endpoint without actually logging in
$payload = @{
    email = "test@example.com"
    password = "wrongpassword"
} | ConvertTo-Json

for ($i = 1; $i -le 15; $i++) {
    Write-Host "Request #$i..."
    
    try {
        $response = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $payload -ErrorAction SilentlyContinue
    } catch {
        $response = $_.Exception.Response
    }
    
    if ($response.StatusCode -eq 429) {
        Write-Host "❌ Rate limited! (HTTP 429)" -ForegroundColor Red
    } else {
        Write-Host "✅ Passed through (HTTP $($response.StatusCode))" -ForegroundColor Green
    }
    
    Start-Sleep -Milliseconds 100
}
```

**Expected Output**:
- ✅ Requests 1-10: Allowed (various HTTP codes)
- ❌ Requests 11-15: Rate limited (HTTP 429)

---

## 4. Test General API Rate Limiter (100/min)

**Limit**: 100 requests per minute

**Command**:

```powershell
# Save as: test-general-limiter.ps1
$url = "http://localhost:4000/products"

for ($i = 1; $i -le 105; $i++) {
    Write-Host "Request #$i..."
    
    $response = Invoke-WebRequest -Uri $url -Method GET -ErrorAction SilentlyContinue
    
    if ($response.StatusCode -eq 429) {
        Write-Host "❌ Rate limited! (HTTP 429)" -ForegroundColor Red
    } elseif ($response.StatusCode -eq 200) {
        Write-Host "✅ Success (HTTP 200)" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Response: HTTP $($response.StatusCode)" -ForegroundColor Yellow
    }
    
    Start-Sleep -Milliseconds 50
}
```

**Expected Output**:
- ✅ Requests 1-100: Success (HTTP 200)
- ❌ Requests 101-105: Rate limited (HTTP 429)

---

## Quick Manual Testing with Curl

### Test Order Limiter (fastest):
```bash
for i in {1..10}; do
  curl -X POST http://localhost:4000/orders \
    -H "Content-Type: application/json" \
    -d '{"userId":1,"items":[{"productId":1,"quantity":1}],"totalAmount":100,"deliveryAddress":"Test","phoneNumber":"+855123456789"}' \
    -w "\nStatus: %{http_code}\n\n" \
    -s
  sleep 0.1
done
```

### Test Payment Status Limiter:
```bash
# Replace 1 with a real order ID
for i in {1..25}; do
  curl -X GET http://localhost:4000/orders/1/bakong-status \
    -w "\nStatus: %{http_code}\n\n" \
    -s
  sleep 0.1
done
```

### Test Auth Limiter:
```bash
for i in {1..15}; do
  curl -X POST http://localhost:4000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}' \
    -w "\nStatus: %{http_code}\n\n" \
    -s
  sleep 0.1
done
```

---

## What to Look For

✅ **Success**: HTTP 200 or 201
❌ **Rate Limited**: HTTP 429 with message like:
```json
{
  "message": "Too many requests, please try again later"
}
```

⚠️ **Important Notes**:
- Each rate limiter resets after its time window (1 min or 15 min)
- Wait for the window to pass and try again
- IPs are tracked separately, so different clients get different limits
- Check server logs for confirmation

---

## Running Full Test Suite

Save this as `test-rate-limiters.ps1`:

```powershell
param(
    [string]$Backend = "http://localhost:4000"
)

Write-Host "🧪 Rate Limiter Test Suite" -ForegroundColor Cyan
Write-Host "Backend: $Backend`n" -ForegroundColor Cyan

# Test 1: Orders
Write-Host "Test 1: Order Creation (5/min)" -ForegroundColor Yellow
$headers = @{"Content-Type" = "application/json"}
$payload = @{userId=1;items=@(@{productId=1;quantity=1});totalAmount=100;deliveryAddress="Test";phoneNumber="+855123456789"} | ConvertTo-Json
$passed = 0
$limited = 0

for ($i = 1; $i -le 8; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "$Backend/orders" -Method POST -Headers $headers -Body $payload -EA SilentlyContinue
        if ($r.StatusCode -eq 429) { $limited++ } else { $passed++ }
    } catch {
        if ($_.Exception.Response.StatusCode -eq 429) { $limited++ } else { $passed++ }
    }
    Start-Sleep -Milliseconds 200
}
Write-Host "  ✅ Passed: $passed | ❌ Limited: $limited (expected: 5 passed, 3 limited)`n"

# Test 2: Payment Status
Write-Host "Test 2: Payment Status (20/min)" -ForegroundColor Yellow
$passed = 0
$limited = 0

for ($i = 1; $i -le 25; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "$Backend/orders/1/bakong-status" -Method GET -EA SilentlyContinue
        if ($r.StatusCode -eq 429) { $limited++ } else { $passed++ }
    } catch {
        if ($_.Exception.Response.StatusCode -eq 429) { $limited++ } else { $passed++ }
    }
    Start-Sleep -Milliseconds 100
}
Write-Host "  ✅ Passed: $passed | ❌ Limited: $limited (expected: 20 passed, 5 limited)`n"

# Test 3: Auth
Write-Host "Test 3: Auth Endpoint (10/15min)" -ForegroundColor Yellow
$passed = 0
$limited = 0
$payload = @{email="test@test.com";password="wrong"} | ConvertTo-Json

for ($i = 1; $i -le 15; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "$Backend/auth/login" -Method POST -Headers $headers -Body $payload -EA SilentlyContinue
        if ($r.StatusCode -eq 429) { $limited++ } else { $passed++ }
    } catch {
        if ($_.Exception.Response.StatusCode -eq 429) { $limited++ } else { $passed++ }
    }
    Start-Sleep -Milliseconds 100
}
Write-Host "  ✅ Passed: $passed | ❌ Limited: $limited (expected: 10 passed, 5 limited)`n"

Write-Host "✅ Testing complete!" -ForegroundColor Green
```

Run it:
```powershell
.\test-rate-limiters.ps1
```

---

## Monitoring in Real-Time

Open a second terminal and watch the server logs while running tests:
```bash
# Terminal 1: Run test
.\test-order-limiter.ps1

# Terminal 2: Watch logs (if running)
# You should see requests being processed and rate limited
```

The rate limiter will show in logs as requests are blocked with HTTP 429 responses.
