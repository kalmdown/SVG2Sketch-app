# Setting Up SSL Certificates

## Can You Reuse Certificates?

**Yes!** SSL certificates can be reused across projects. They're just files that enable HTTPS.

However, I checked your `svg2onshape-app/certificates/` directory and it's **empty**. So you'll need to generate new ones.

## Option 1: Generate New Certificates (Recommended)

### Using OpenSSL (if installed)

1. **Create certificates directory:**
   ```bash
   mkdir certificates
   ```

2. **Generate self-signed certificate:**
   ```bash
   openssl req -x509 -newkey rsa:4096 -nodes -keyout certificates/private.key -out certificates/certificate.pem -days 365 -subj "/CN=localhost"
   ```

   This creates:
   - `certificates/private.key` - Private key
   - `certificates/certificate.pem` - Certificate file

3. **Copy to SVG2Sketch-app:**
   ```bash
   # Windows PowerShell
   Copy-Item certificates\private.key ..\SVG2Sketch-app\certificates\private.key
   Copy-Item certificates\certificate.pem ..\SVG2Sketch-app\certificates\certificate.pem
   ```

### Using mkcert (Easier - Trusted by Browsers)

1. **Install mkcert:**
   ```bash
   # Windows (using Chocolatey)
   choco install mkcert
   
   # Or download from: https://github.com/FiloSottile/mkcert/releases
   ```

2. **Install local CA:**
   ```bash
   mkcert -install
   ```

3. **Generate certificate:**
   ```bash
   mkdir certificates
   cd certificates
   mkcert localhost
   ```

4. **Rename files to match expected names:**
   ```bash
   # Windows PowerShell
   Move-Item localhost-key.pem private.key
   Move-Item localhost.pem certificate.pem
   ```

5. **Copy to SVG2Sketch-app:**
   ```bash
   Copy-Item private.key ..\..\SVG2Sketch-app\certificates\private.key
   Copy-Item certificate.pem ..\..\SVG2Sketch-app\certificates\certificate.pem
   ```

## Option 2: Copy from Another Project

If you have certificates in another project:

1. **Find the certificates:**
   - Look for `private.key` and `certificate.pem` files
   - Common locations: `certificates/`, `ssl/`, `certs/`

2. **Copy them:**
   ```bash
   # Windows PowerShell
   # From svg2onshape-app (if they exist elsewhere)
   Copy-Item path\to\private.key SVG2Sketch-app\certificates\private.key
   Copy-Item path\to\certificate.pem SVG2Sketch-app\certificates\certificate.pem
   ```

## Option 3: Use Environment Variables

You can also set certificates via environment variables in `.env`:

```env
HTTPS_KEY=path/to/private.key
HTTPS_CERT=path/to/certificate.pem
```

The server will use these if set.

## Verify Certificates Work

After setting up certificates:

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Check the output:**
   - Should say: `Server running on https://localhost:3000`
   - NOT: `HTTPS certificates not found`

3. **Test in browser:**
   - Go to `https://localhost:3000`
   - You'll see a security warning (normal for self-signed)
   - Click "Advanced" → "Proceed to localhost"

## Certificate Security Note

⚠️ **Self-signed certificates are for development only!**

- They're not trusted by browsers (you'll see warnings)
- They're fine for local development
- For production, use proper SSL certificates from a CA (Let's Encrypt, etc.)

## Quick Setup Script

Create a file `setup-certs.ps1` (PowerShell):

```powershell
# Create certificates directory
New-Item -ItemType Directory -Force -Path certificates

# Check if OpenSSL is available
$openssl = Get-Command openssl -ErrorAction SilentlyContinue

if ($openssl) {
    Write-Host "Generating certificates with OpenSSL..."
    openssl req -x509 -newkey rsa:4096 -nodes -keyout certificates/private.key -out certificates/certificate.pem -days 365 -subj "/CN=localhost"
    Write-Host "Certificates created successfully!"
} else {
    Write-Host "OpenSSL not found. Please install it or use mkcert."
    Write-Host "Or manually create certificates in the certificates/ directory"
}
```

Run it:
```powershell
.\setup-certs.ps1
```

## After Setup

Once certificates are in place:

1. **Restart the server:**
   ```bash
   npm start
   ```

2. **Access with HTTPS:**
   ```
   https://localhost:3000/?documentId=cb1e9acdd17540e4f4a4d45b&workspaceId=425a72a0620d341664869beb&elementId=e3e5ef7c62cd21704be0c100
   ```

3. **Accept the certificate warning** in your browser.

---

**Note:** The certificates directory in `svg2onshape-app` is empty, so you'll need to generate new ones. They can be shared between projects once created!

