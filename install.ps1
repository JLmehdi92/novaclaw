# NovaClaw Installation Script for Windows
# Usage: powershell -ExecutionPolicy Bypass -File install.ps1

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "   NovaClaw Installation Script" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "[1/5] Checking Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "ERROR: Node.js not found. Install it from https://nodejs.org" -ForegroundColor Red
    exit 1
}
Write-Host "  Node.js $nodeVersion OK" -ForegroundColor Green

# Check Git
Write-Host "[2/5] Checking Git..." -ForegroundColor Yellow
$gitVersion = git --version 2>$null
if (-not $gitVersion) {
    Write-Host "ERROR: Git not found. Install it from https://git-scm.com" -ForegroundColor Red
    exit 1
}
Write-Host "  Git OK" -ForegroundColor Green

# Install dependencies
Write-Host "[3/5] Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: npm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "  Dependencies installed" -ForegroundColor Green

# Link CLI globally
Write-Host "[4/5] Linking CLI globally..." -ForegroundColor Yellow
npm link
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: npm link failed" -ForegroundColor Red
    exit 1
}
Write-Host "  CLI linked" -ForegroundColor Green

# Create directories
Write-Host "[5/5] Creating directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "data", "data/workspaces", "logs" | Out-Null
Write-Host "  Directories created" -ForegroundColor Green

Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host "   Installation Complete!" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Run: novaclaw setup" -ForegroundColor Cyan
Write-Host "  2. Run: novaclaw start" -ForegroundColor Cyan
Write-Host ""
