#!/usr/bin/env node
/**
 * Standalone test script for BTM sketch creation
 * Can be run without the web UI
 * 
 * Usage:
 *   node test-btm-sketch.js --token <access_token> --documentId <did> --workspaceId <wid> --elementId <eid> --planeId <planeId> [--svg <svg_file>]
 * 
 * Or set environment variables:
 *   ONSHAPE_ACCESS_TOKEN=...
 *   ONSHAPE_DOCUMENT_ID=...
 *   ONSHAPE_WORKSPACE_ID=...
 *   ONSHAPE_ELEMENT_ID=...
 *   ONSHAPE_PLANE_ID=...
 *   SVG_FILE=...
 */

import dotenv from 'dotenv';
dotenv.config();

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import OnshapeApiService from './services/onshape-api.js';
import { buildSketchFeature } from './services/sketch-builder.js';
import { parseSVGElements } from './services/svg/svg-parser.js';
import { parseTextElements } from './services/svg/text-processor.js';
import { parseTextPathElements } from './services/svg/text-path-processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const config = {};
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const key = arg.substring(2);
            const value = args[i + 1];
            if (value && !value.startsWith('--')) {
                config[key] = value;
                i++;
            } else {
                config[key] = true;
            }
        }
    }
    
    return config;
}

// Get config from args or environment
const args = parseArgs();

// Helper function to test API key authentication
async function testApiKeyAuth(onshapeApi, accessKey, secretKey) {
    try {
        const userInfo = await onshapeApi.getUserInfo({ apiKey: { accessKey, secretKey } });
        console.log('   ✓ API key authentication successful');
        return true;
    } catch (error) {
        console.error(`   ❌ API key authentication failed: ${error.message}`);
        return false;
    }
}

// Helper function to refresh OAuth token
async function refreshOAuthToken(refreshToken, clientId, clientSecret, oauthUrl) {
    const body = `grant_type=refresh_token&refresh_token=${refreshToken}&client_id=${clientId}&client_secret=${clientSecret}`;
    const response = await fetch(`${oauthUrl}/oauth/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body
    });
    
    if (!response.ok) {
        throw new Error(`OAuth token refresh failed: ${response.status} ${response.statusText}`);
    }
    
    const tokenData = await response.json();
    return tokenData.access_token;
}

const config = {
    // Authentication - try multiple methods
    accessToken: args.token || process.env.ONSHAPE_ACCESS_TOKEN,
    accessKey: process.env.ONSHAPE_ACCESS_KEY,
    secretKey: process.env.ONSHAPE_SECRET_KEY,
    refreshToken: process.env.ONSHAPE_REFRESH_TOKEN,
    oauthClientId: process.env.OAUTH_CLIENT_ID,
    oauthClientSecret: process.env.OAUTH_CLIENT_SECRET,
    oauthUrl: process.env.OAUTH_URL || 'https://oauth.onshape.com',
    
    // Document/workspace/element IDs
    documentId: args.documentId || process.env.ONSHAPE_DOCUMENT_ID || 'cb1e9acdd17540e4f4a4d45b',
    workspaceId: args.workspaceId || process.env.ONSHAPE_WORKSPACE_ID || '425a72a0620d341664869beb',
    elementId: args.elementId || process.env.ONSHAPE_ELEMENT_ID || 'e3e5ef7c62cd21704be0c100',
    planeId: args.planeId || process.env.ONSHAPE_PLANE_ID || 'F4NrQBXyYct6nDV_1',
    
    // Test configuration
    svgFile: args.svg || process.env.SVG_FILE || join(__dirname, 'test-svgs', 'test-mixed.svg'),
    apiUrl: process.env.API_URL || 'https://cad.onshape.com',
    testMode: args.testMode || process.env.TEST_MODE || 'full' // 'full', 'simple-circle', 'golden-record'
};

// Determine authentication method and get token (async)
async function setupAuth() {
    if (config.accessToken) {
        console.log('🔑 Using provided access token');
        return { token: config.accessToken, type: 'oauth' };
    } else if (config.accessKey && config.secretKey) {
        console.log('🔑 Using API keys for authentication');
        return { accessKey: config.accessKey, secretKey: config.secretKey, type: 'apikey' };
    } else if (config.refreshToken && config.oauthClientId && config.oauthClientSecret) {
        console.log('🔑 Refreshing OAuth token...');
        try {
            const token = await refreshOAuthToken(
                config.refreshToken,
                config.oauthClientId,
                config.oauthClientSecret,
                config.oauthUrl
            );
            console.log('   ✓ Token refreshed successfully');
            return { token, type: 'oauth' };
        } catch (err) {
            console.error(`   ❌ Failed to refresh token: ${err.message}`);
            throw err;
        }
    } else {
        console.error('❌ Error: No authentication method available');
        console.error('   Provide one of:');
        console.error('   - ONSHAPE_ACCESS_TOKEN (OAuth token)');
        console.error('   - ONSHAPE_ACCESS_KEY + ONSHAPE_SECRET_KEY (API keys)');
        console.error('   - ONSHAPE_REFRESH_TOKEN + OAUTH_CLIENT_ID + OAUTH_CLIENT_SECRET (OAuth refresh)');
        throw new Error('No authentication method available');
    }
}

// REMOVED: Python API debugger subprocess call - now using OnshapeApiService directly

// Helper function to create sketch using API keys (via OnshapeApiService with proper HMAC)
async function createSketchWithApiKey(onshapeApi, accessKey, secretKey, documentId, workspaceId, elementId, planeId, entities, options) {
    // Use the OnshapeApiService directly - it has the correct HMAC signature implementation
    console.log(`   Making API request to Onshape...`);
    
    try {
        const result = await onshapeApi.createSketchFromBTM({
            documentId,
            workspaceId,
            elementId,
            planeId,
            entities,
            apiKey: { accessKey, secretKey },
            options: options || {}
        });
        
        return result;
    } catch (error) {
        throw new Error(`API Error: ${error.message}`);
    }
}

// REMOVED: Old Python debugger code below
async function callApiDebugger_OLD(endpoint, method, body) {
    return new Promise((resolve, reject) => {
        const debuggerPath = 'C:\\Dev\\Onshape Projects\\onshape-api-debugger\\onshape_debugger.py';
        
        // Write body to temp file if provided
        let tempFile = null;
        if (body) {
            tempFile = join(process.cwd(), 'test-svgs', 'temp-payload.json');
            writeFileSync(tempFile, body, 'utf8');
        }
        
        // Build command - use PowerShell to handle JSON properly
        // Escape paths with spaces - use single quotes and escape single quotes by doubling them
        const escapedDebuggerPath = debuggerPath.replace(/'/g, "''");
        const escapedTempFile = tempFile ? tempFile.replace(/'/g, "''").replace(/\\/g, '/') : null;
        
        let command;
        if (body && tempFile) {
            // Read from file to avoid JSON escaping issues - use -Raw to get content as single string
            command = `$body = Get-Content -Path '${escapedTempFile}' -Raw; python '${escapedDebuggerPath}' --endpoint '${endpoint}' --method ${method} --body $body`;
        } else {
            command = `python '${escapedDebuggerPath}' --endpoint '${endpoint}' --method ${method}`;
        }
        
        const child = spawn('powershell', ['-NoProfile', '-Command', command], {
            shell: false,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        child.on('close', (code) => {
            // Clean up temp file
            if (tempFile) {
                try {
                    unlinkSync(tempFile);
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
            
            // Try to parse output regardless of exit code (API errors are still valid JSON responses)
            try {
                const result = JSON.parse(stdout);
                
                // If we got a valid JSON response, check the status code
                if (result.status_code) {
                    if (result.status_code >= 200 && result.status_code < 300) {
                        // Success - return the data
                        resolve(result.data || result);
                    } else {
                        // API error (400, 401, etc.) - extract error message
                        let errorMsg = `HTTP ${result.status_code}`;
                        if (result.data) {
                            if (typeof result.data === 'string') {
                                errorMsg = result.data;
                            } else if (result.data.message) {
                                errorMsg = result.data.message;
                            } else {
                                // Try to get full error details
                                const errorStr = JSON.stringify(result.data, null, 2);
                                errorMsg = errorStr.length > 500 ? errorStr.substring(0, 500) + '...' : errorStr;
                            }
                        } else if (result.message) {
                            errorMsg = result.message;
                        }
                        // Log full response for debugging
                        console.error('   Full API response:', JSON.stringify(result, null, 2).substring(0, 1000));
                        throw new Error(`API Error (${result.status_code}): ${errorMsg}`);
                    }
                } else if (result.data) {
                    // Response has data field
                    resolve(result.data);
                } else {
                    // Unknown format, return as-is
                    resolve(result);
                }
            } catch (parseError) {
                // If parsing failed, it's a real error
                if (code !== 0) {
                    reject(new Error(`API debugger failed with code ${code}\nStderr: ${stderr}\nStdout: ${stdout.substring(0, 500)}`));
                } else {
                    reject(new Error(`Failed to parse API debugger output: ${parseError.message}\nOutput: ${stdout.substring(0, 500)}`));
                }
            }
        });
    });
}

// Duplicate function removed - using the one above that calls OnshapeApiService directly

// Initialize API service
const onshapeApi = new OnshapeApiService(config.apiUrl);

async function runTest() {
    // Setup authentication
    let authInfo;
    try {
        authInfo = await setupAuth();
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
    
    console.log('🧪 BTM Sketch Creation Test');
    console.log('==========================');
    console.log(`Document ID: ${config.documentId}`);
    console.log(`Workspace ID: ${config.workspaceId}`);
    console.log(`Element ID: ${config.elementId}`);
    console.log(`Plane ID: ${config.planeId}`);
    if (config.testMode === 'full') {
        console.log(`SVG File: ${config.svgFile}`);
    } else {
        console.log(`Test Mode: ${config.testMode} (using hardcoded test entities)`);
    }
    console.log('');
    try {
        let sketchData;
        
        // Handle test modes
        if (config.testMode === 'simple-circle' || config.testMode === 'golden-record') {
            console.log(`🧪 Using test mode: ${config.testMode}`);
            // Set environment variable to trigger debug mode in sketch-builder
            process.env.DEBUG_SKETCH_MODE = config.testMode;
        }
        
        if (config.testMode === 'full') {
            // Read SVG file
            console.log('📖 Reading SVG file...');
            let svgContent;
            try {
                svgContent = readFileSync(config.svgFile, 'utf8');
                console.log(`   ✓ Read ${svgContent.length} characters from ${config.svgFile}`);
            } catch (err) {
                console.error(`   ❌ Failed to read SVG file: ${err.message}`);
                process.exit(1);
            }
            
            // Parse SVG
            console.log('🔍 Parsing SVG...');
            const elements = parseSVGElements(svgContent);
            const textElements = parseTextElements(svgContent);
            const textPathElements = parseTextPathElements(svgContent);
            console.log(`   ✓ Found ${elements.length} elements`);
            console.log(`   ✓ Found ${textElements.length} text nodes`);
            console.log(`   ✓ Found ${textPathElements.length} text path nodes`);
            
            // Build BTM entities
            console.log('🏗️  Building BTM entities...');
            sketchData = await buildSketchFeature(
                elements,
                textElements,
                textPathElements,
                [],
                { scale: 0.001 } // 1px = 1mm
            );
        } else {
            // Test mode - buildSketchFeature will return hardcoded entities
            console.log('🏗️  Building BTM entities (test mode)...');
            sketchData = await buildSketchFeature([], [], [], [], { scale: 0.001 });
        }
        
        console.log(`   ✓ Generated ${sketchData.entities.length} BTM entities`);
        
        // Create sketch via API
        console.log('🚀 Creating sketch in Onshape...');
        
        // Test authentication first if using API keys
        if (authInfo.type === 'apikey') {
            console.log('🔐 Testing API key authentication...');
            const authTest = await testApiKeyAuth(onshapeApi, authInfo.accessKey, authInfo.secretKey);
            if (!authTest) {
                console.error('❌ Authentication test failed - cannot proceed');
                process.exit(1);
            }
        }
        
        // Create sketch via API
        console.log('🚀 Creating sketch in Onshape...');
        let result;
        if (authInfo.type === 'apikey') {
            result = await createSketchWithApiKey(
                onshapeApi,
                authInfo.accessKey,
                authInfo.secretKey,
                config.documentId,
                config.workspaceId,
                config.elementId,
                config.planeId,
                sketchData.entities,
                { sketchName: `Test Sketch ${new Date().toISOString()}` }
            );
        } else {
            result = await onshapeApi.createSketchFromBTM({
                documentId: config.documentId,
                workspaceId: config.workspaceId,
                elementId: config.elementId,
                planeId: config.planeId,
                entities: sketchData.entities,
                accessToken: authInfo.token,
                options: {
                    sketchName: `Test Sketch ${new Date().toISOString()}`
                }
            });
        }
        
        // Check result
        if (result.featureState && result.featureState.featureStatus === 'OK') {
            console.log('✅ SUCCESS! Sketch created successfully');
            console.log(`   Feature ID: ${result.feature?.featureId || 'N/A'}`);
        } else if (result.featureState && result.featureState.featureStatus === 'ERROR') {
            console.error('❌ Sketch creation failed with ERROR status');
            console.error('   Full response:', JSON.stringify(result, null, 2).substring(0, 1000));
            console.log(`   Feature Name: ${result.feature?.name || 'N/A'}`);
            console.log(`   Entity Count: ${result.feature?.entities?.length || 0}`);
            return 0;
        } else {
            console.error('⚠️  Sketch created but status is not OK');
            console.error(`   Status: ${result.featureState?.featureStatus || 'unknown'}`);
            return 1;
        }
        
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
        return 1;
    }
}

// Run the test
runTest().then(exitCode => {
    process.exit(exitCode);
}).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

