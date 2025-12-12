import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import flash from 'connect-flash';
import passport from 'passport';
import OnshapeStrategy from 'passport-onshape';
import { OAuth2 } from 'oauth';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import compression from 'compression';
import helmet from 'helmet';

// ES module equivalent for __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import configuration
import { validateConfiguration } from './config.js';
import { debugLog } from './utils/debug.js';

// Validate configuration
try {
    validateConfiguration();
} catch (error) {
    console.error('Configuration validation failed:', error.message);
    process.exit(1);
}

// Configuration from environment variables
const config = {
    port: process.env.PORT,
    apiUrl: process.env.API_URL || 'https://cad.onshape.com',
    oauthCallbackUrl: process.env.OAUTH_CALLBACK_URL,
    oauthClientId: process.env.OAUTH_CLIENT_ID,
    oauthClientSecret: process.env.OAUTH_CLIENT_SECRET,
    oauthUrl: process.env.OAUTH_URL || 'https://oauth.onshape.com',
    sessionSecret: process.env.SESSION_SECRET
};

// Log configuration (with sensitive info redacted)
debugLog('env', 'Configuration:', {
    port: config.port,
    apiUrl: config.apiUrl,
    oauthCallbackUrl: config.oauthCallbackUrl,
    oauthClientId: config.oauthClientId ? '***REDACTED***' : 'not set',
    oauthClientSecret: config.oauthClientSecret ? '***REDACTED***' : 'not set',
    oauthUrl: config.oauthUrl
});

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// General middleware
app.use(compression());
app.use(logger('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.set('trust proxy', 1); // To allow to run correctly behind Heroku

// CORS configuration
app.use((req, res, next) => {
    res.set({
        'Access-Control-Allow-Origin': req.headers.origin || 'https://cad.onshape.com',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
        'Access-Control-Expose-Headers': 'Set-Cookie'
    });

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

app.use(cors({
    origin: ['https://cad.onshape.com', 'https://oauth.onshape.com'],
    credentials: true
}));

// Session middleware (must be before passport)
app.use(cookieParser(config.sessionSecret));
app.use(session({
    secret: config.sessionSecret,
    resave: true,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(flash());

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Passport strategy configuration
passport.use(new OnshapeStrategy({
    clientID: config.oauthClientId,
    clientSecret: config.oauthClientSecret,
    callbackURL: config.oauthCallbackUrl,
    authorizationURL: `${config.oauthUrl}/oauth/authorize`,
    tokenURL: `${config.oauthUrl}/oauth/token`,
    userProfileURL: 'https://cad.onshape.com/api/users/sessioninfo',
    passReqToCallback: true,
    proxy: true,
    state: false,
    scope: 'OAuth2ReadPII OAuth2Read OAuth2Write',
    customHeaders: {
        'User-Agent': 'svg2sketch-app'
    },
    _oauth2: {
        ...OAuth2.prototype,
        _request: function(method, url, headers, post_body, access_token, callback) {
            OAuth2.prototype._request.call(this, method, url, headers, post_body, access_token, callback);
        }
    }
},
async (req, accessToken, refreshToken, params, profile, done) => {
    try {
        const response = await fetch('https://cad.onshape.com/api/users/sessioninfo', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            return done(new Error('Profile fetch failed'));
        }

        const userProfile = await response.json();
        profile = userProfile;
        profile.accessToken = accessToken;
        profile.refreshToken = refreshToken;
        profile.extraData = req.session?.extraData;

        return done(null, profile);
    } catch (error) {
        return done(error);
    }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// OAuth routes
app.get('/oauthSignin', (req, res, next) => {
    const state = uuidv4();
    const params = {
        documentId: req.query.documentId,
        workspaceId: req.query.workspaceId,
        elementId: req.query.elementId,
        state: state
    };
    
    req.session.extraData = params;
    req.session.oauthState = state;

    req.session.save(() => {
        passport.authenticate('onshape', {
            scope: 'OAuth2ReadPII OAuth2Read OAuth2Write',
            state: state
        })(req, res, next);
    });
});

app.get('/oauthRedirect', (req, res, next) => {
    const _savedState = req.session.oauthState;
    const savedParams = req.session.extraData;

    passport.authenticate('onshape', (err, user) => {
        if (err || !user) {
            return res.redirect('/?error=auth_failed');
        }

        req.logIn(user, (loginErr) => {
            if (loginErr) {
                return res.redirect('/?error=login_failed');
            }

            const redirectUrl = `/?documentId=${savedParams.documentId}&workspaceId=${savedParams.workspaceId}&elementId=${savedParams.elementId}`;
            res.redirect(redirectUrl);
        });
    })(req, res, next);
});

app.get('/grantDenied', (req, res) => {
    const errors = req.flash('error');
    const errorMessage = errors.length ? errors[0] : 'Access denied';
    res.status(403).send(`Authentication failed: ${errorMessage}`);
});

// Refresh access token helper
const refreshAccessToken = async (user) => {
    const body = `grant_type=refresh_token&refresh_token=${user.refreshToken}&client_id=${config.oauthClientId}&client_secret=${config.oauthClientSecret}`;
    const res = await fetch(`${config.oauthUrl}/oauth/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body
    });
       
    if (res.ok) {
        return await res.json();
    } else {
        throw new Error("Could not refresh access token, please sign in again.");
    }
};

// Main route - check authentication and serve app
app.get('/', (req, res) => {
    if (!req.user) {
        return res.redirect(`/oauthSignin${req._parsedUrl.search ? req._parsedUrl.search : ""}`);
    } else {
        refreshAccessToken(req.user).then((tokenJson) => {
            let usrObj = JSON.parse(JSON.stringify(req.user));
            usrObj.accessToken = tokenJson.access_token;
            usrObj.refreshToken = tokenJson.refresh_token;
            req.login(usrObj, () => {
                return res.sendFile(path.join(__dirname, 'public', 'html', 'index.html'));
            });
        }).catch(() => {
            return res.redirect(`/oauthSignin${req._parsedUrl.search ? req._parsedUrl.search : ""}`);
        });
    }
});

// API routes
import apiRouter from './api/apiRouter.js';
app.use('/api', apiRouter);

// Error handling middleware
app.use((err, req, res, _next) => {
    console.error('Application error:', err);
    res.status(500).json({
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Catch-all route for SPA (but not for static files or API routes)
app.get('*', (req, res, next) => {
  // Don't catch static file requests or API routes
  if (req.path.startsWith('/api/') || 
      req.path.startsWith('/css/') || 
      req.path.startsWith('/js/') || 
      req.path.startsWith('/html/') ||
      req.path.startsWith('/favicon.ico') ||
      req.path.match(/\.(css|js|ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/)) {
    return next(); // Let Express handle 404 for these
  }
  res.sendFile(path.join(__dirname, 'public', 'html', 'index.html'));
});

export default app;

