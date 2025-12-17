/**
 * Onshape API Service with proper authentication
 * Supports both OAuth tokens and API keys
 */

import crypto from 'crypto';
import fetch from 'node-fetch';

class OnshapeApiService {
    constructor(baseUrl = 'https://cad.onshape.com') {
        this.baseUrl = baseUrl;
    }

    /**
     * Create HMAC signature for API key authentication
     * CRITICAL: All components must be lowercase, string must end with \n
     */
    _createApiKeyHeaders(method, path, body, accessKey, secretKey) {
        // Generate nonce and date
        const nonce = crypto.randomBytes(16).toString('hex');
        const date = new Date().toUTCString(); // RFC 2822 format
        
        // CRITICAL: All components must be lowercase
        // Format: METHOD\nNONCE\nDATE\nCONTENT-TYPE\nPATH\nQUERY\n
        const signatureString = [
            method.toLowerCase(),           // "post" or "get"
            nonce.toLowerCase(),            // "abc123..."
            date.toLowerCase(),             // "mon, 16 dec 2024..."
            'application/json',             // Already lowercase
            path.toLowerCase(),             // "/api/v6/partstudios/d/..."
            ''                              // Empty query string
        ].join('\n') + '\n';                // MUST end with newline
        
        // Debug logging (can be removed in production)
        if (process.env.DEBUG_AUTH) {
            console.log('Signature string:', JSON.stringify(signatureString));
        }
        
        // Create HMAC signature using UTF-8 encoding
        const hmac = crypto.createHmac('sha256', secretKey);
        hmac.update(signatureString, 'utf8');
        const signature = hmac.digest('base64');
        
        // Create authorization header
        const authString = `On ${accessKey}:HmacSHA256:${signature}`;
        
        return {
            'Authorization': authString,
            'Date': date,                    // Original case for Date header
            'On-Nonce': nonce,              // Original case for nonce
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    /**
     * Convert plane reference to deterministic ID
     */
    _getPlaneId(planeId) {
        // Standard planes
        if (planeId.includes('_XY') || planeId === 'TOP' || planeId === 'Front') return 'JDC';
        if (planeId.includes('_YZ') || planeId === 'FRONT') return 'JCC';
        if (planeId.includes('_XZ') || planeId === 'RIGHT' || planeId === 'Right') return 'JGC';
        
        // For custom planes, assume planeId is already a deterministic ID
        // or extract it from a format like "F4NrQBXyYct6nDV_Plane1"
        if (planeId.includes('_')) {
            return planeId.split('_')[0];
        }
        
        return planeId;
    }

    /**
     * Make an authenticated API request
     * Supports both OAuth tokens and API keys
     */
    async _makeRequest(method, path, body = null, auth = null) {
        let headers;
        
        if (auth?.apiKey) {
            // API Key authentication
            headers = this._createApiKeyHeaders(
                method, 
                path, 
                body, 
                auth.apiKey.accessKey, 
                auth.apiKey.secretKey
            );
        } else if (auth?.accessToken) {
            // OAuth token authentication
            headers = {
                'Authorization': `Bearer ${auth.accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };
        } else {
            throw new Error('No authentication provided (need accessToken or apiKey)');
        }

        const url = `${this.baseUrl}${path}`;
        const options = {
            method: method,
            headers: headers
        };

        if (body) {
            options.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            const errorText = await response.text();
            let errorDetail;
            try {
                errorDetail = JSON.parse(errorText);
            } catch (e) {
                errorDetail = errorText;
            }
            
            const error = new Error(`Onshape API Error ${response.status}: ${JSON.stringify(errorDetail)}`);
            error.status = response.status;
            error.detail = errorDetail;
            throw error;
        }

        // Handle empty responses
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        } else {
            return await response.text();
        }
    }

    /**
     * Get user session info (useful for testing authentication)
     */
    async getUserInfo(auth) {
        return await this._makeRequest('GET', '/api/users/sessioninfo', null, auth);
    }

    /**
     * Get documents accessible to the user
     */
    async getDocuments(auth) {
        return await this._makeRequest('GET', '/api/documents', null, auth);
    }

    /**
     * Get document details
     */
    async getDocument(documentId, auth) {
        return await this._makeRequest('GET', `/api/documents/${documentId}`, null, auth);
    }

    /**
     * Get workspaces for a document
     */
    async getWorkspaces(documentId, auth) {
        const doc = await this.getDocument(documentId, auth);
        return doc.defaultWorkspace ? [doc.defaultWorkspace] : [];
    }

    /**
     * Get elements (Part Studios, Assemblies) in a workspace
     */
    async getElements(documentId, workspaceId, auth) {
        const path = `/api/documents/d/${documentId}/w/${workspaceId}/elements`;
        return await this._makeRequest('GET', path, null, auth);
    }

    /**
     * Get features (planes, sketches, etc.) from a Part Studio
     */
    async getFeatures(documentId, workspaceId, elementId, auth) {
        const path = `/api/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
        return await this._makeRequest('GET', path, null, auth);
    }

    /**
     * Create a sketch from BTM entities
     * Main method for SVG to Sketch functionality
     */
    async createSketchFromBTM({ documentId, workspaceId, elementId, planeId, entities, accessToken, apiKey, options = {} }) {
        try {
            // Build the BTM sketch feature
            const sketchFeature = {
                btType: "BTMSketch-151",
                featureType: "newSketch",
                name: options.sketchName || `SVG Sketch ${new Date().toISOString()}`,
                parameters: [{
                    btType: "BTMParameterQueryList-148",
                    parameterId: "sketchPlane",
                    queries: [{
                        btType: "BTMIndividualQuery-138",
                        deterministicIds: [this._getPlaneId(planeId)]
                    }]
                }],
                entities: entities,
                constraints: []
            };

            const featurePayload = {
                btType: "BTFeatureDefinitionCall-1406",
                feature: sketchFeature
            };

            // Use v6 API endpoint
            const path = `/api/v6/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
            
            // Determine auth method
            const auth = apiKey ? { apiKey } : { accessToken };
            
            // Make the request
            const result = await this._makeRequest('POST', path, featurePayload, auth);
            
            return result;

        } catch (error) {
            console.error('Create sketch error:', error);
            throw error;
        }
    }

    /**
     * Upload file to document (for SVG files)
     */
    async uploadFile(documentId, workspaceId, file, auth) {
        // Note: File upload requires multipart/form-data
        // This would need a different implementation
        throw new Error('File upload not yet implemented');
    }
}

export default OnshapeApiService;
