/**
 * Fixed OAuth routes for node.js server
 * Properly handles parameter preservation through OAuth flow
 * 
 * Replace your existing OAuth routes in node.js with this code
 */

import { v4 as uuidv4 } from 'uuid';
import passport from 'passport';

/**
 * Helper function to sanitize and validate parameters
 * Filters out undefined, null, and the literal string "undefined"
 */
function sanitizeParams(params) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(params)) {
        // Skip if value is falsy or the literal string "undefined" or "null"
        if (!value || value === 'undefined' || value === 'null') {
            continue;
        }
        sanitized[key] = value;
    }
    
    return sanitized;
}

/**
 * Build URL with parameters, filtering out invalid values
 */
function buildUrlWithParams(baseUrl, params) {
    const sanitized = sanitizeParams(params);
    const paramEntries = Object.entries(sanitized);
    
    if (paramEntries.length === 0) {
        return baseUrl;
    }
    
    const queryString = paramEntries
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
    
    return `${baseUrl}?${queryString}`;
}

/**
 * OAuth signin route
 * Initiates OAuth flow and preserves context parameters
 */
export function setupOAuthSignin(app) {
    app.get('/oauthSignin', (req, res, next) => {
        console.log('=== OAuth Signin Started ===');
        console.log('Incoming query params:', req.query);
        
        // Generate state for CSRF protection
        const state = uuidv4();
        
        // Extract and sanitize parameters
        const params = sanitizeParams({
            documentId: req.query.documentId,
            workspaceId: req.query.workspaceId,
            elementId: req.query.elementId,
            state: state
        });
        
        console.log('Sanitized params to save:', params);
        
        // Save to session
        req.session.extraData = params;
        req.session.oauthState = state;

        // CRITICAL: Wait for session to save before redirecting
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.redirect('/?error=session_error');
            }
            
            console.log('Session saved successfully');
            console.log('Session ID:', req.sessionID);
            console.log('Session data:', req.session.extraData);
            
            // Proceed with OAuth
            passport.authenticate('onshape', {
                scope: 'OAuth2ReadPII OAuth2Read OAuth2Write',
                state: state
            })(req, res, next);
        });
    });
}

/**
 * OAuth redirect route
 * Handles callback from OAuth provider and restores context
 */
export function setupOAuthRedirect(app) {
    app.get('/oauthRedirect', (req, res, next) => {
        console.log('=== OAuth Redirect Received ===');
        console.log('Session ID:', req.sessionID);
        console.log('Session data:', req.session);
        
        const savedState = req.session.oauthState;
        const savedParams = req.session.extraData || {};
        
        console.log('Retrieved saved params:', savedParams);

        passport.authenticate('onshape', (err, user) => {
            if (err) {
                console.error('OAuth authentication error:', err);
                return res.redirect('/?error=auth_failed');
            }
            
            if (!user) {
                console.error('No user returned from OAuth');
                return res.redirect('/?error=no_user');
            }

            req.logIn(user, (loginErr) => {
                if (loginErr) {
                    console.error('Login error:', loginErr);
                    return res.redirect('/?error=login_failed');
                }

                console.log('Login successful for user:', user.email || user.id);

                // Build redirect URL with preserved parameters
                const redirectUrl = buildUrlWithParams('/', savedParams);
                
                console.log('Redirecting to:', redirectUrl);
                console.log('=== OAuth Flow Complete ===\n');
                
                res.redirect(redirectUrl);
            });
        })(req, res, next);
    });
}

/**
 * Auth status endpoint
 * Check if user is authenticated
 */
export function setupAuthStatus(app) {
    app.get('/api/auth/status', (req, res) => {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ 
                authenticated: false,
                message: 'Not authenticated'
            });
        }
        
        res.json({
            authenticated: true,
            user: {
                id: req.user.id,
                email: req.user.email,
                name: req.user.name
            }
        });
    });
}

/**
 * Logout endpoint
 */
export function setupLogout(app) {
    app.get('/logout', (req, res) => {
        req.logout((err) => {
            if (err) {
                console.error('Logout error:', err);
                return res.redirect('/?error=logout_failed');
            }
            
            req.session.destroy((destroyErr) => {
                if (destroyErr) {
                    console.error('Session destroy error:', destroyErr);
                }
                res.redirect('/?message=logged_out');
            });
        });
    });
}

/**
 * Setup all OAuth routes
 * Call this in your main server file
 */
export function setupOAuthRoutes(app) {
    setupOAuthSignin(app);
    setupOAuthRedirect(app);
    setupAuthStatus(app);
    setupLogout(app);
    
    console.log('OAuth routes configured');
}

// Default export
export default setupOAuthRoutes;
