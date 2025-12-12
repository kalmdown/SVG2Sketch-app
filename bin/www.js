#!/usr/bin/env node

// Import dotenv for environment variables
import dotenv from 'dotenv';
dotenv.config();

// Import core modules
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES module equivalent for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import application modules
import app from '../app.js';
import { port, httpsOptions } from '../config.js';
import { debugLog } from '../utils/debug.js';

// Use port from config or default to 3000
const serverPort = port || 3000;

// Determine if we should use HTTPS
const useHttps = process.env.USE_HTTPS !== 'false'; // Default to HTTPS for OAuth

let server;

if (useHttps && httpsOptions) {
    // Create HTTPS server with certificates
    server = https.createServer(httpsOptions, app)
        .listen(serverPort, () => {
            debugLog('env', 'Starting HTTPS server');
            console.log(`Server running on https://localhost:${serverPort}`);
            console.log('Note: You may need to accept a self-signed certificate warning');
        });
} else if (useHttps) {
    // Try to load default certificate paths
    const certPath = path.join(__dirname, '..', 'certificates');
    const keyPath = path.join(certPath, 'private.key');
    const certFilePath = path.join(certPath, 'certificate.pem');
    
    if (fs.existsSync(keyPath) && fs.existsSync(certFilePath)) {
        const options = {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certFilePath)
        };
        server = https.createServer(options, app)
            .listen(serverPort, () => {
                debugLog('env', 'Starting HTTPS server with default certificates');
                console.log(`Server running on https://localhost:${serverPort}`);
                console.log('Note: You may need to accept a self-signed certificate warning');
            });
    } else {
        // Fall back to HTTP if no certificates found
        console.warn('⚠️  HTTPS certificates not found. Falling back to HTTP.');
        console.warn('⚠️  Note: Onshape OAuth requires HTTPS. Use ngrok or configure certificates.');
        server = http.createServer(app)
            .listen(serverPort, () => {
                debugLog('env', 'Starting HTTP server (HTTPS not available)');
                console.log(`Server running on http://localhost:${serverPort}`);
            });
    }
} else {
    // Use HTTP explicitly
    server = http.createServer(app)
        .listen(serverPort, () => {
            debugLog('env', 'Starting HTTP server');
            console.log(`Server running on http://localhost:${serverPort}`);
            console.warn('⚠️  Note: Onshape OAuth requires HTTPS. OAuth will not work with HTTP.');
        });
}

// Add graceful shutdown handler
process.on('SIGTERM', () => {
    debugLog('env', 'SIGTERM signal received: closing HTTP server');
    server.close(() => {
        debugLog('env', 'HTTP server closed');
        process.exit(0);
    });
});





