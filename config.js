/**
 * Application configuration file
 * Provides centralized configuration for server-side components
 */
import dotenv from 'dotenv';
dotenv.config();

// Helper functions for validation
const isValidUrl = function(stringToTest, protocols) {
    try {
        const url = new URL(stringToTest);
        if (!protocols) {
            return true;
        }
        if (typeof protocols === 'string' || protocols instanceof String) {
            protocols = [ protocols ];
        }
        return !protocols || protocols.includes(url.protocol);
    } catch {
        return false;
    }
}

const isValidHttpUrl = function(stringToTest) {
    return isValidUrl(stringToTest, [ 'http:', 'https:' ]);
};

const isValidString = function(stringToTest) {
    if (!stringToTest) return false;
    if (!(stringToTest.trim())) return false;
    return true;
}

// Server configuration
export const port = process.env.PORT || 3000;

// Onshape API configuration
export const onshapeApiUrl = process.env.API_URL || 'https://cad.onshape.com';
export const oauthUrl = process.env.OAUTH_URL || 'https://oauth.onshape.com';
export const oauthCallbackUrl = process.env.OAUTH_CALLBACK_URL;
export const oauthClientId = process.env.OAUTH_CLIENT_ID;
export const oauthClientSecret = process.env.OAUTH_CLIENT_SECRET;

// Session configuration
export const sessionSecret = process.env.SESSION_SECRET || 'svg2sketch-default-secret';

// Debug configuration
export const debug = {
  enabled: process.env.DEBUG === 'true',
  apiCalls: process.env.DEBUG_API_CALLS === 'true',
  planes: process.env.DEBUG_PLANES === 'true',
  verbose: process.env.DEBUG_VERBOSE === 'true'
};

// HTTPS options - used if provided
export const httpsOptions = process.env.HTTPS_KEY && process.env.HTTPS_CERT ? {
  key: process.env.HTTPS_KEY,
  cert: process.env.HTTPS_CERT
} : null;

// Webhook configuration (optional)
export const webhookCallbackUrl = process.env.WEBHOOK_CALLBACK_ROOT_URL;

// Validate configuration in a function that doesn't block exports
function validateConfig() {
    const errors = [];

    if (port && !isValidString(port.toString()))                           errors.push('PORT must have content');
    if (!isValidHttpUrl(onshapeApiUrl))                         errors.push('API_URL is not a valid HTTP(S) URL');
    if (!isValidHttpUrl(oauthCallbackUrl))                      errors.push('OAUTH_CALLBACK_URL is not a valid HTTP(S) URL');
    if (!isValidString(oauthClientId))                          errors.push('OAUTH_CLIENT_ID must have content');
    if (!isValidString(oauthClientSecret))                      errors.push('OAUTH_CLIENT_SECRET must have content');
    if (!isValidHttpUrl(oauthUrl))                              errors.push('OAUTH_URL is not a valid HTTP(S) URL');
    if (!isValidString(sessionSecret))                          errors.push('SESSION_SECRET must have content');

    // Halt execution if the app isn't correctly configured.
    if (errors.length !== 0) {
        throw new Error('Invalid configuration: ' + errors.join(', '));
    }
}

// Export validation function so it can be called after the app imports config
export const validateConfiguration = validateConfig;

// Run validation if this module is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    validateConfig();
}





