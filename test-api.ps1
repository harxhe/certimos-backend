Write-Host "🧪 Testing Certificate API Routes" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

$BaseUrl = "http://localhost:5000"
$TestWallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

Write-Host ""
Write-Host "1️⃣ Testing Health Check..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "2️⃣ Testing Wallet Balance..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/wallet/$TestWallet/balance" -Method Get
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "❌ Wallet balance failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "3️⃣ Testing Certificate Retrieval..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/certificates/wallet/$TestWallet" -Method Get
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "❌ Certificate retrieval failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "4️⃣ Testing Certificate Verification..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/verify/0" -Method Get
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "❌ Certificate verification failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "5️⃣ Testing 404 Route..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/nonexistent" -Method Get
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Expected 404 - Route not found: $($_.Exception.Message)" -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ API Route Testing Complete!" -ForegroundColor Green
