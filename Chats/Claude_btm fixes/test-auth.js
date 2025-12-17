#!/usr/bin/env node
/**
 * Test API Key Authentication
 * 
 * This script tests that API key authentication is working correctly
 * Run this FIRST before testing anything else
 * 
 * Usage:
 *   node test-auth.js
 * 
 * Environment variables required:
 *   ONSHAPE_ACCESS_KEY - Your Onshape API access key
 *   ONSHAPE_SECRET_KEY - Your Onshape API secret key
 */

import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import fetch from 'node-fetch';

/**
 * Test basic authentication with API keys
 */
async function testApiKeyAuth() {
    console.log('🔐 Testing API Key Authentication\n');
    console.log('================================\n');
    
    const accessKey = process.env.ONSHAPE_ACCESS_KEY;
    const secretKey = process.env.ONSHAPE_SECRET_KEY;
    
    if (!accessKey || !secretKey) {
        console.error('❌ Missing environment variables:');
        console.error('   - ONSHAPE_ACCESS_KEY');
        console.error('   - ONSHAPE_SECRET_KEY');
        console.error('\nPlease set these in your .env file');
        return false;
    }
    
    console.log('✓ API keys loaded from environment');
    console.log(`  Access Key: ${accessKey.substring(0, 10)}...`);
    console.log('');
    
    // Test endpoint
    const method = 'GET';
    const path = '/api/users/sessioninfo';
    const nonce = crypto.randomBytes(16).toString('hex');
    const date = new Date().toUTCString();
    
    console.log('Creating signature:');
    console.log(`  Method: ${method}`);
    console.log(`  Path: ${path}`);
    console.log(`  Date: ${date}`);
    console.log(`  Nonce: ${nonce.substring(0, 16)}...`);
    console.log('');
    
    // Create signature string - ALL LOWERCASE with trailing newline
    const signatureString = [
        method.toLowerCase(),
        nonce.toLowerCase(),
        date.toLowerCase(),
        'application/json',
        path.toLowerCase(),
        ''
    ].join('\n') + '\n';
    
    console.log('Signature string (with escapes visible):');
    console.log(JSON.stringify(signatureString));
    console.log('');
    
    // Create signature
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(signatureString, 'utf8');
    const signature = hmac.digest('base64');
    
    const authString = `On ${accessKey}:HmacSHA256:${signature}`;
    
    console.log('Authorization header:');
    console.log(`  ${authString.substring(0, 50)}...`);
    console.log('');
    
    // Make request
    const url = `https://cad.onshape.com${path}`;
    console.log(`Making request to: ${url}`);
    console.log('');
    
    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': authString,
                'Date': date,
                'On-Nonce': nonce,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        console.log(`Response status: ${response.status} ${response.statusText}`);
        console.log('');
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Authentication successful!');
            console.log('');
            console.log('User information:');
            console.log(`  Name: ${data.name || 'N/A'}`);
            console.log(`  Email: ${data.email || 'N/A'}`);
            console.log(`  Company: ${data.company?.name || 'N/A'}`);
            console.log('');
            console.log('================================');
            console.log('✅ API Key Authentication Working!');
            console.log('================================');
            return true;
        } else {
            const errorText = await response.text();
            console.error('❌ Authentication failed');
            console.error('');
            console.error('Response body:');
            console.error(errorText);
            console.error('');
            console.error('Common issues:');
            console.error('  1. Check API keys are correct');
            console.error('  2. Check API keys have required permissions');
            console.error('  3. Check signature format (must be lowercase with trailing \\n)');
            console.error('  4. Check HMAC is using UTF-8 encoding');
            return false;
        }
    } catch (error) {
        console.error('❌ Request failed');
        console.error('');
        console.error('Error:', error.message);
        console.error('');
        if (error.code === 'ENOTFOUND') {
            console.error('Network error - check your internet connection');
        }
        return false;
    }
}

/**
 * Test authentication with OAuth token (if available)
 */
async function testOAuthToken() {
    const token = process.env.ONSHAPE_ACCESS_TOKEN;
    
    if (!token) {
        console.log('\nℹ️  No OAuth token found (ONSHAPE_ACCESS_TOKEN not set)');
        console.log('   Skipping OAuth token test');
        return null;
    }
    
    console.log('\n🔐 Testing OAuth Token Authentication\n');
    console.log('================================\n');
    
    const path = '/api/users/sessioninfo';
    const url = `https://cad.onshape.com${path}`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        console.log(`Response status: ${response.status} ${response.statusText}`);
        console.log('');
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ OAuth token valid!');
            console.log(`  User: ${data.name || data.email}`);
            return true;
        } else {
            console.error('❌ OAuth token invalid or expired');
            return false;
        }
    } catch (error) {
        console.error('❌ OAuth token test failed:', error.message);
        return false;
    }
}

// Run tests
async function runTests() {
    const apiKeySuccess = await testApiKeyAuth();
    await testOAuthToken();
    
    console.log('\n');
    console.log('Test Summary:');
    console.log('=============');
    console.log(`API Key Authentication: ${apiKeySuccess ? '✅ PASS' : '❌ FAIL'}`);
    
    if (apiKeySuccess) {
        console.log('\n✅ You can proceed with BTM sketch creation tests');
    } else {
        console.log('\n❌ Fix authentication before proceeding');
        console.log('   Review the error messages above');
    }
    
    return apiKeySuccess ? 0 : 1;
}

// Execute
runTests().then(exitCode => {
    process.exit(exitCode);
}).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
