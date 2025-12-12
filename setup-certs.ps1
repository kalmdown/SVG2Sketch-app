# PowerShell script to set up SSL certificates for local development
# This script helps generate self-signed certificates for HTTPS

Write-Host "Setting up SSL certificates for SVG2Sketch-app..." -ForegroundColor Cyan

# Create certificates directory
$certDir = "certificates"
if (-not (Test-Path $certDir)) {
    New-Item -ItemType Directory -Force -Path $certDir | Out-Null
    Write-Host "Created certificates directory" -ForegroundColor Green
}

# Check if certificates already exist
$keyPath = Join-Path $certDir "private.key"
$certPath = Join-Path $certDir "certificate.pem"

if ((Test-Path $keyPath) -and (Test-Path $certPath)) {
    Write-Host "Certificates already exist!" -ForegroundColor Yellow
    Write-Host "  Key: $keyPath" -ForegroundColor Gray
    Write-Host "  Cert: $certPath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To regenerate, delete these files and run this script again." -ForegroundColor Yellow
    exit 0
}

# Check for OpenSSL
$openssl = Get-Command openssl -ErrorAction SilentlyContinue

if ($openssl) {
    Write-Host "Found OpenSSL, generating certificates..." -ForegroundColor Green
    Write-Host ""
    
    try {
        & openssl req -x509 -newkey rsa:4096 -nodes `
            -keyout $keyPath `
            -out $certPath `
            -days 365 `
            -subj "/CN=localhost" `
            2>&1 | Out-Null
        
        if ((Test-Path $keyPath) -and (Test-Path $certPath)) {
            Write-Host "✓ Certificates generated successfully!" -ForegroundColor Green
            Write-Host "  Key: $keyPath" -ForegroundColor Gray
            Write-Host "  Cert: $certPath" -ForegroundColor Gray
            Write-Host ""
            Write-Host "You can now start the server with: npm start" -ForegroundColor Cyan
        } else {
            throw "Certificate files were not created"
        }
    } catch {
        Write-Host "Error generating certificates: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Manual setup:" -ForegroundColor Yellow
        Write-Host "1. Install OpenSSL or use mkcert" -ForegroundColor Gray
        Write-Host "2. Run: openssl req -x509 -newkey rsa:4096 -nodes -keyout certificates/private.key -out certificates/certificate.pem -days 365 -subj `/CN=localhost`" -ForegroundColor Gray
    }
} else {
    Write-Host "OpenSSL not found in PATH" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Cyan
    Write-Host "1. Install OpenSSL:" -ForegroundColor Gray
    Write-Host "   - Download from: https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor Gray
    Write-Host "   - Or use Chocolatey: choco install openssl" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Use mkcert (recommended for easier browser trust):" -ForegroundColor Gray
    Write-Host "   - Install: choco install mkcert" -ForegroundColor Gray
    Write-Host "   - Run: mkcert -install" -ForegroundColor Gray
    Write-Host "   - Then: mkcert localhost" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Copy certificates from another project:" -ForegroundColor Gray
    Write-Host "   - Copy private.key and certificate.pem to the certificates/ directory" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. Use ngrok for HTTPS (no certificates needed):" -ForegroundColor Gray
    Write-Host "   - npm install -g ngrok" -ForegroundColor Gray
    Write-Host "   - ngrok http 3000" -ForegroundColor Gray
}
}

