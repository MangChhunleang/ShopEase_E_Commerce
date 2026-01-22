$url = "http://localhost:4000/orders"
$headers = @{"Content-Type" = "application/json"}

# Add more complete customer info
$payload = @{
    userId = 1
    items = @(@{productId = 1; quantity = 1})
    totalAmount = 100
    deliveryAddress = "Test Address, Phnom Penh"
    phoneNumber = "+855987654321"
    customerName = "Test Customer"
} | ConvertTo-Json

Write-Host "Testing Order Rate Limiter (5 requests/minute)..." -ForegroundColor Cyan
Write-Host ""

for ($i = 1; $i -le 10; $i++) {
    Write-Host "Request #$i... " -NoNewline
    
    try {
        $response = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $payload -ErrorAction Stop
        Write-Host "✅ Success (HTTP 200)" -ForegroundColor Green
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.Value
        $errorMsg = $_.Exception.Response.StatusDescription
        
        if ($statusCode -eq 429) {
            Write-Host "❌ RATE LIMITED (HTTP 429)" -ForegroundColor Red
            try {
                $errorBody = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($errorBody)
                $body = $reader.ReadToEnd()
                Write-Host "   Message: $body" -ForegroundColor Yellow
            } catch {}
        } else {
            Write-Host "⚠️ HTTP $statusCode - $errorMsg" -ForegroundColor Yellow
        }
    }
    
    Start-Sleep -Milliseconds 200
}

Write-Host ""
Write-Host "Expected: Requests 1-5 passed/failed, Requests 6-10 rate limited (429)" -ForegroundColor Cyan
