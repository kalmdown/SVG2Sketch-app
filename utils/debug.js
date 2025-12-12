/**
 * Server-side debug logging utility
 * Controls console output based on environment configuration
 * 
 * @version 1.0.0
 * @environment Node.js
 */

// Module-level constants
const VERSION = '1.0.0';
const ENVIRONMENT = 'server';

/**
 * Conditional debug logger for server-side logging
 * @param {string} component - Component name or type ('api', 'planes', 'error', etc.)
 * @param {string} message - Debug message
 * @param {...any} args - Additional arguments to log
 */
export function debugLog(component, message, ...args) {
    try {
        // Check environment variables for debug settings
        const isDebugEnabled = process.env.DEBUG === 'true';
        const isVerbose = process.env.DEBUG_VERBOSE === 'true';
        
        // Determine if we should log based on component type
        let shouldLog = false;
        
        switch(component.toLowerCase()) {
            case 'api':
                shouldLog = process.env.DEBUG_API_CALLS === 'true' || isDebugEnabled;
                break;
            case 'planes':
                shouldLog = process.env.DEBUG_PLANES === 'true' || isDebugEnabled;
                break;
            case 'error':
                // Always log errors
                shouldLog = true;
                break;
            default:
                // For any other type, check general debug flag
                shouldLog = isDebugEnabled;
                break;
        }
        
        if (shouldLog) {
            const timestamp = new Date().toISOString();
            const debugMessage = args.length > 0 ? 
                `[${timestamp}] [${component}] ${message} ${JSON.stringify(args)}` : 
                `[${timestamp}] [${component}] ${message}`;

            if (component.toLowerCase() === 'error') {
                console.error(debugMessage);
            } else {
                console.log(debugMessage);
            }
        }
    } catch (error) {
        // If logging fails, log the error but don't interrupt the app
        console.error('[DEBUG:ERROR]', 'Error in debug logger:', error);
    }
}

// Add version and environment info for debugging
debugLog.version = VERSION;
debugLog.environment = ENVIRONMENT;

// Legacy debug function for backward compatibility
export function legacyDebug(component, message, data) {
    debugLog(component, message, data);
}

export default debugLog;





