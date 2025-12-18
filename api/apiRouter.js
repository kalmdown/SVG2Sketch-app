/**
 * API routes for SVG2Sketch app
 * Handles API endpoints including planes fetching and SVG conversion
 */
import express from 'express';
import fileUpload from 'express-fileupload';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';

// Import services
import OnshapeApiService from '../services/onshape-api.js';
import { debugLog } from '../utils/debug.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create router
const router = express.Router();

// Initialize services
const onshapeApi = new OnshapeApiService(process.env.API_URL || 'https://cad.onshape.com');

// Add middleware for file uploads
router.use(fileUpload({
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    abortOnLimit: true,
    responseOnLimit: 'File size limit exceeded (10MB maximum)',
    useTempFiles: true, // Use temp files for large files
    tempFileDir: path.join(__dirname, '../tmp'),
    createParentPath: true
}));

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        apiAvailable: !!onshapeApi,
        environment: {
            node: process.version
        }
    });
});

// Route to fetch all documents
router.get('/documents', async (req, res) => {
    try {
        // Determine authentication - prefer OAuth token, fallback to API keys
        let auth = null;
        if (req.user?.accessToken) {
            auth = { accessToken: req.user.accessToken };
        } else if (process.env.ONSHAPE_ACCESS_KEY && process.env.ONSHAPE_SECRET_KEY) {
            auth = { 
                apiKey: { 
                    accessKey: process.env.ONSHAPE_ACCESS_KEY, 
                    secretKey: process.env.ONSHAPE_SECRET_KEY 
                } 
            };
        } else {
            return res.status(401).json({ 
                error: 'Authentication required. Please log in or configure API keys.' 
            });
        }

        debugLog('api', 'Fetching all documents');
        
        try {
            // Use OnshapeApiService which supports both auth types
            const data = await onshapeApi.getDocuments(auth);
            const documents = data.items || [];
            debugLog('api', `Found ${documents.length} documents`);
            res.json(documents.map(doc => ({
                id: doc.id,
                name: doc.name,
                owner: doc.owner?.name,
                createdAt: doc.createdAt,
                modifiedAt: doc.modifiedAt
            })));
        } catch (apiError) {
            debugLog('error', 'Error fetching documents:', apiError);
            res.status(500).json({ error: apiError.message });
        }
    } catch (error) {
        debugLog('error', 'Error in /documents endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route to fetch all elements (part studios) in a document
router.get('/elements', async (req, res) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apiRouter.js:95',message:'/elements endpoint entry',data:{query:req.query,hasUser:!!req.user,hasAccessToken:!!req.user?.accessToken},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    try {
        const { documentId, workspaceId } = req.query;
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apiRouter.js:101',message:'Parameter validation',data:{documentId,workspaceId,hasDocumentId:!!documentId,hasWorkspaceId:!!workspaceId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        // Validate required parameters
        if (!documentId || !workspaceId) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apiRouter.js:107',message:'Missing parameters error',data:{documentId,workspaceId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            return res.status(400).json({ 
                error: 'Missing required parameters: documentId, workspaceId' 
            });
        }

        // Determine authentication - prefer OAuth token, fallback to API keys
        let auth = null;
        if (req.user?.accessToken) {
            auth = { accessToken: req.user.accessToken };
        } else if (process.env.ONSHAPE_ACCESS_KEY && process.env.ONSHAPE_SECRET_KEY) {
            auth = { 
                apiKey: { 
                    accessKey: process.env.ONSHAPE_ACCESS_KEY, 
                    secretKey: process.env.ONSHAPE_SECRET_KEY 
                } 
            };
        } else {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apiRouter.js:115',message:'Authentication error',data:{hasUser:!!req.user},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            return res.status(401).json({ 
                error: 'Authentication required. Please log in or configure API keys.' 
            });
        }

        debugLog('api', `Fetching elements for document: ${documentId}`);
        
        try {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apiRouter.js:125',message:'Calling getElements',data:{documentId,workspaceId,hasOnshapeApi:!!onshapeApi,hasMethod:typeof onshapeApi.getElements},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            
            const data = await onshapeApi.getElements(documentId, workspaceId, auth);
            
            // Handle response format - could be array or object with items
            const elementsArray = Array.isArray(data) ? data : (data.items || []);
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apiRouter.js:133',message:'Elements received',data:{elementsCount:elementsArray.length,elementTypes:elementsArray.map(e=>e.elementType)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            
            // Filter to only part studios
            const partStudios = elementsArray
                .filter(elem => elem.elementType === 'PARTSTUDIO')
                .map(elem => ({
                    id: elem.id,
                    name: (elem.name || `Part Studio ${elem.id}`).replace(/\s*\([^)]*\)$/, ''),
                    elementType: elem.elementType
                }));
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apiRouter.js:142',message:'Part studios filtered',data:{partStudiosCount:partStudios.length,partStudios:partStudios.map(ps=>({id:ps.id,name:ps.name}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            
            debugLog('api', `Found ${partStudios.length} part studios`);
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apiRouter.js:157',message:'About to send response',data:{partStudiosCount:partStudios.length,canStringify:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            
            try {
                res.json(partStudios);
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apiRouter.js:163',message:'Response sent successfully',data:{partStudiosCount:partStudios.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
            } catch (jsonError) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apiRouter.js:167',message:'Error sending JSON response',data:{error:jsonError.message,stack:jsonError.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                // #endregion
                throw jsonError;
            }
        } catch (apiError) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apiRouter.js:149',message:'API error in fetchAllElementsInDocument',data:{error:apiError.message,stack:apiError.stack,errorType:apiError.constructor.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            debugLog('error', 'Error fetching elements:', apiError);
            res.status(500).json({ error: apiError.message });
        }
    } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apiRouter.js:155',message:'Top-level error in /elements',data:{error:error.message,stack:error.stack,errorType:error.constructor.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        debugLog('error', 'Error in /elements endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route to fetch document and element info
router.get('/context', async (req, res) => {
    try {
        const { documentId, workspaceId, elementId } = req.query;
        
        // Validate required parameters
        if (!documentId || !workspaceId || !elementId) {
            return res.status(400).json({ 
                error: 'Missing required parameters' 
            });
        }

        // Validate authentication
        if (!req.user?.accessToken) {
            return res.status(401).json({ 
                error: 'Authentication required' 
            });
        }

        debugLog('api', `Fetching context for element: ${elementId}`);
        
        try {
            debugLog('api', `Fetching document info: ${documentId}`);
            // Fetch document info using fetch directly (since _callApi is private)
            const apiUrl = process.env.API_URL || 'https://cad.onshape.com';
            const docUrl = `${apiUrl}/api/documents/d/${documentId}`;
            const docResponse = await fetch(docUrl, {
                headers: {
                    'Authorization': `Bearer ${req.user.accessToken}`,
                    'Accept': 'application/json'
                }
            });
            
            debugLog('api', `Document response status: ${docResponse.status}`);
            let document = { name: null };
            if (docResponse.ok) {
                document = await docResponse.json();
                debugLog('api', `Document name: ${document.name}`);
            } else {
                const errorText = await docResponse.text().catch(() => '');
                debugLog('error', `Failed to fetch document: ${docResponse.status} - ${errorText.substring(0, 200)}`);
            }
            
            debugLog('api', `Fetching element info: ${elementId}`);
            // Fetch element info
            const elementUrl = `${apiUrl}/api/documents/d/${documentId}/w/${workspaceId}/elements/${elementId}`;
            const elementResponse = await fetch(elementUrl, {
                headers: {
                    'Authorization': `Bearer ${req.user.accessToken}`,
                    'Accept': 'application/json'
                }
            });
            
            debugLog('api', `Element response status: ${elementResponse.status}`);
            let element = { name: null, elementType: null };
            if (elementResponse.ok) {
                element = await elementResponse.json();
                debugLog('api', `Element name: ${element.name}, type: ${element.elementType}`);
            } else {
                const errorText = await elementResponse.text().catch(() => '');
                debugLog('error', `Failed to fetch element: ${elementResponse.status} - ${errorText.substring(0, 200)}`);
            }
            
            const result = {
                documentName: document.name || `Document ${documentId.substring(0, 8)}...`,
                documentId: documentId,
                workspaceId: workspaceId,
                elementName: element.name || `Element ${elementId.substring(0, 8)}...`,
                elementId: elementId,
                elementType: element.elementType || 'UNKNOWN'
            };
            
            debugLog('api', 'Context result:', result);
            res.json(result);
        } catch (apiError) {
            debugLog('error', 'Error fetching context:', apiError);
            // Return IDs as fallback
            res.json({
                documentName: `Document ${documentId.substring(0, 8)}...`,
                documentId: documentId,
                workspaceId: workspaceId,
                elementName: `Element ${elementId.substring(0, 8)}...`,
                elementId: elementId,
                elementType: 'UNKNOWN',
                error: apiError.message
            });
        }
    } catch (error) {
        debugLog('error', 'Error in /context endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route to fetch planes
router.get('/planes', async (req, res) => {
    try {
        const { documentId, workspaceId, elementId } = req.query;
        
        // Validate required parameters
        if (!documentId || !workspaceId || !elementId) {
            return res.status(400).json({ 
                error: 'Missing required parameters' 
            });
        }

        // Determine authentication - prefer OAuth token, fallback to API keys
        let auth = null;
        if (req.user?.accessToken) {
            auth = { accessToken: req.user.accessToken };
        } else if (process.env.ONSHAPE_ACCESS_KEY && process.env.ONSHAPE_SECRET_KEY) {
            auth = { 
                apiKey: { 
                    accessKey: process.env.ONSHAPE_ACCESS_KEY, 
                    secretKey: process.env.ONSHAPE_SECRET_KEY 
                } 
            };
        } else {
            return res.status(401).json({ 
                error: 'Authentication required. Please log in or configure API keys.' 
            });
        }

        debugLog('api', `Fetching planes for element: ${elementId}`);
        console.log('[PLANES] Endpoint called with:', { documentId, workspaceId, elementId });
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/adf2d56b-ab7c-40dc-80c8-d55fefda3e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apiRouter.js:319',message:'PLANES endpoint called',data:{documentId,workspaceId,elementId,hasAuth:!!auth},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        try {
            // Use getFeatures to get planes - need to parse features response
            const featuresResponse = await onshapeApi.getFeatures(documentId, workspaceId, elementId, auth);
            
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/adf2d56b-ab7c-40dc-80c8-d55fefda3e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apiRouter.js:327',message:'Raw features API response',data:{hasResponse:!!featuresResponse,responseType:typeof featuresResponse,responseKeys:featuresResponse?Object.keys(featuresResponse):[],hasFeatures:!!featuresResponse?.features,featuresIsArray:Array.isArray(featuresResponse?.features),featuresCount:featuresResponse?.features?.length||0,firstFeatureSample:featuresResponse?.features?.[0]?JSON.stringify(featuresResponse.features[0]).substring(0,300):null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            
            console.log('[PLANES] Features response:', {
                hasFeatures: !!featuresResponse?.features,
                featuresCount: featuresResponse?.features?.length || 0,
                responseKeys: Object.keys(featuresResponse || {}),
                firstFeature: featuresResponse?.features?.[0] ? {
                    btType: featuresResponse.features[0].btType,
                    featureType: featuresResponse.features[0].featureType,
                    name: featuresResponse.features[0].name,
                    featureId: featuresResponse.features[0].featureId
                } : null
            });
            
            // Start with default planes
            const defaultPlanes = [
                { id: `${elementId}_XY`, name: 'Front (XY)', type: 'default' },
                { id: `${elementId}_YZ`, name: 'Right (YZ)', type: 'default' },
                { id: `${elementId}_XZ`, name: 'Top (XZ)', type: 'default' }
            ];
            
            // Extract custom planes from features
            const customPlanes = [];
            const planeTypes = ['cPlane', 'cPlanePoint', 'cPlane3Points', 'cPlaneMidpoint', 'datumPlane'];
            
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/adf2d56b-ab7c-40dc-80c8-d55fefda3e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apiRouter.js:337',message:'Features response structure',data:{hasFeatures:!!featuresResponse?.features,featuresCount:featuresResponse?.features?.length||0,responseKeys:Object.keys(featuresResponse||{}),firstFeatureKeys:featuresResponse?.features?.[0]?Object.keys(featuresResponse.features[0]):[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            
            if (featuresResponse && featuresResponse.features && Array.isArray(featuresResponse.features)) {
                console.log(`[PLANES] Checking ${featuresResponse.features.length} features for planes`);
                // #region agent log
                fetch('http://127.0.0.1:7243/ingest/adf2d56b-ab7c-40dc-80c8-d55fefda3e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apiRouter.js:355',message:'PLANES checking features',data:{featuresCount:featuresResponse.features.length,allFeatureNames:featuresResponse.features.map(f=>f.message?.name||f.name||f.featureId||'unknown').slice(0,10),allFeatureTypes:featuresResponse.features.map(f=>({btType:f.btType,type:f.type,featureType:f.featureType})).slice(0,10)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                // #endregion
                featuresResponse.features.forEach((feature, index) => {
                    // #region agent log
                    fetch('http://127.0.0.1:7243/ingest/adf2d56b-ab7c-40dc-80c8-d55fefda3e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apiRouter.js:343',message:'Checking feature for plane',data:{index,btType:feature.btType,featureType:feature.featureType,featureName:feature.name,featureId:feature.featureId,featureKeys:Object.keys(feature)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                    // #endregion
                    // Check feature type - can be btType string ("BTMFeature-134" for planes), numeric type (134), or featureType string
                    const btType = feature.btType || '';
                    // The actual feature type is nested in feature.message.featureType for BTM features
                    const messageFeatureType = feature.message?.featureType || '';
                    const featureType = feature.featureType || feature.type || feature.typeName;
                    const featureTypeStr = typeof featureType === 'string' ? featureType : '';
                    const featureName = feature.message?.name || feature.name || feature.featureId;
                    const featureId = feature.message?.featureId || feature.featureId || feature.id;
                    
                    // Check if it's a plane feature
                    // BTMFeature-134 is the btType for plane features (string)
                    const isPlaneBtType = btType === 'BTMFeature-134' || btType.includes('Plane');
                    // Check if it's a BTMFeature (type 134) AND has a plane-related featureType in message
                    // Type 134 alone is not enough - need to check message.featureType for actual plane types
                    // From logs: features have feature.message.featureType = "cPlane", "newPlane", etc.
                    const isNumericPlaneType = feature.type === 134 && (
                        messageFeatureType === 'newPlane' || 
                        messageFeatureType === 'cPlane' ||
                        messageFeatureType === 'cPlanePoint' ||
                        messageFeatureType === 'cPlane3Points' ||
                        messageFeatureType === 'cPlaneMidpoint' ||
                        messageFeatureType === 'datumPlane' ||
                        planeTypes.some(pt => messageFeatureType.includes(pt))
                    );
                    // Also check featureType for plane-related types (fallback)
                    const isStringPlaneType = typeof featureTypeStr === 'string' && (featureTypeStr === 'newPlane' || planeTypes.some(pt => featureTypeStr.includes(pt)));
                    // Name-based detection (for features with "plane" or "datum" in name)
                    const matchesPlaneName = featureName && (featureName.toLowerCase().includes('plane') || featureName.toLowerCase().includes('datum'));
                    
                    if ((isPlaneBtType || isNumericPlaneType || isStringPlaneType || matchesPlaneName) && featureId) {
                        const detectionMethod = isNumericPlaneType ? 'numeric+messageFeatureType' : isPlaneBtType ? 'btType' : isStringPlaneType ? 'featureType' : 'name';
                        
                        // Extract deterministic ID from plane feature parameters
                        // For plane features, we need to find the parameter that defines the plane itself
                        // This is typically the first parameter that references a plane geometry
                        let deterministicId = null;
                        const parameters = feature.message?.parameters || [];
                        const allGeometryIds = [];
                        
                        for (const param of parameters) {
                            const paramId = param.message?.parameterId || '';
                            if (param.message?.queries) {
                                for (const query of param.message.queries) {
                                    if (query.message?.geometryIds && query.message.geometryIds.length > 0) {
                                        const ids = query.message.geometryIds;
                                        allGeometryIds.push(...ids);
                                        // For plane features, the plane's own ID is typically in the first parameter
                                        // that has geometryIds (this is usually the plane definition parameter)
                                        if (!deterministicId && ids.length > 0) {
                                            deterministicId = ids[0];
                                        }
                                    }
                                }
                            }
                        }
                        
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/adf2d56b-ab7c-40dc-80c8-d55fefda3e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apiRouter.js:402',message:'Plane feature parameters analysis',data:{featureId,featureName,parametersCount:parameters.length,allGeometryIds,selectedDeterministicId:deterministicId,parameterDetails:parameters.map(p=>({paramId:p.message?.parameterId,hasQueries:!!p.message?.queries,geometryIds:p.message?.queries?.flatMap(q=>q.message?.geometryIds||[])||[]}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
                        // #endregion
                        
                        console.log(`[PLANES] Found plane: ${featureName} (${featureId}) - deterministicId: ${deterministicId || 'not found'}, method: ${detectionMethod}`);
                        customPlanes.push({
                            id: featureId,
                            name: featureName || `Plane ${featureId}`,
                            type: 'custom',
                            deterministicId: deterministicId // Store deterministic ID if found
                        });
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/adf2d56b-ab7c-40dc-80c8-d55fefda3e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apiRouter.js:410',message:'Added custom plane',data:{planeId:featureId,planeName:featureName,deterministicId,btType,messageFeatureType,featureType:featureTypeStr,featureTypeNumeric:feature.type,detectionMethod},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                        // #endregion
                    }
                });
            }
            
            console.log(`[PLANES] Returning ${defaultPlanes.length} default planes and ${customPlanes.length} custom planes`);
            debugLog('api', `Found ${customPlanes.length} custom planes`);
            const allPlanes = [...defaultPlanes, ...customPlanes];
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/adf2d56b-ab7c-40dc-80c8-d55fefda3e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apiRouter.js:385',message:'PLANES endpoint returning planes',data:{defaultPlanesCount:defaultPlanes.length,customPlanesCount:customPlanes.length,totalPlanes:allPlanes.length,planeIds:allPlanes.map(p=>p.id),planeNames:allPlanes.map(p=>p.name)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            res.json(allPlanes);
        } catch (apiError) {
            debugLog('error', 'Error fetching planes:', apiError);
            // Fallback to default planes if API call fails
            const defaultPlanes = [
                { id: 'XY', name: 'Front (XY)', type: 'default' },
                { id: 'YZ', name: 'Right (YZ)', type: 'default' },
                { id: 'XZ', name: 'Top (XZ)', type: 'default' }
            ];
            debugLog('api', 'Returning default planes as fallback');
            res.json(defaultPlanes);
        }
    } catch (error) {
        debugLog('error', 'Error in /planes endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route to detect patterns in SVG
router.post('/patterns/detect', async (req, res) => {
    try {
        const { svgContent } = req.body;
        
        if (!svgContent) {
            return res.status(400).json({ error: 'SVG content required' });
        }
        
        // Import parser and pattern analyzer
        const { parseSVGElements } = await import('../services/svg/svg-parser.js');
        const { detectPatterns } = await import('../services/svg/pattern-analyzer.js');
        
        // Parse SVG elements
        const elements = parseSVGElements(svgContent);
        
        // Detect patterns
        const patterns = detectPatterns(elements);
        
        res.json({ patterns });
    } catch (error) {
        debugLog('error', 'Pattern detection failed', error);
        res.status(500).json({ error: error.message });
    }
});

// Route to handle SVG file upload and conversion
router.post('/convert', async (req, res) => {
    try {
        // Check authentication - allow API keys as fallback
        if (!req.user?.accessToken && !(process.env.ONSHAPE_ACCESS_KEY && process.env.ONSHAPE_SECRET_KEY)) {
            return res.status(401).json({ 
                error: 'Authentication required. Please log in or configure API keys.' 
            });
        }

        const { documentId, workspaceId, elementId, planeId, scale = 1.0, 
                textAsSketchText = true, textAsPaths = true, patterns = '[]' } = req.body;
        
        if (!documentId || !workspaceId || !elementId || !planeId) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        // Get SVG content from file upload or body
        let svgContent = '';
        if (req.files && req.files.svgFile) {
            // File uploaded via multipart/form-data
            const file = req.files.svgFile;
            
            // Validate file type - accept .svg files directly (no .txt extension needed)
            const fileName = file.name.toLowerCase();
            if (!fileName.endsWith('.svg')) {
                return res.status(400).json({ 
                    error: 'Invalid file type. Only .svg files are accepted.' 
                });
            }
            
            // Check file size (already handled by fileUpload middleware, but double-check)
            if (file.size > 10 * 1024 * 1024) {
                return res.status(400).json({ 
                    error: 'File too large. Maximum size is 10MB.' 
                });
            }
            
            // Read file content - handle different file upload configurations
            // Priority: tempFilePath > Buffer > string data
            // When useTempFiles is true, the Buffer may be empty but tempFilePath has the actual file
            debugLog('api', 'File object structure:', {
                hasData: !!file.data,
                hasTempFilePath: !!file.tempFilePath,
                size: file.size,
                name: file.name,
                mimetype: file.mimetype
            });
            
            // Prefer tempFilePath when available (most reliable when useTempFiles is true)
            if (file.tempFilePath) {
                // File was saved to temp file, read it
                const fs = await import('fs');
                try {
                    svgContent = fs.readFileSync(file.tempFilePath, 'utf8');
                    debugLog('api', 'Read file from temp file path');
                } catch (fsError) {
                    debugLog('error', 'Failed to read temp file:', fsError);
                    return res.status(400).json({ 
                        error: 'Could not read file from temporary storage.' 
                    });
                }
            } else if (Buffer.isBuffer(file.data) && file.data.length > 0) {
                // File is in memory as Buffer (and has content)
                svgContent = file.data.toString('utf8');
                debugLog('api', 'Read file from Buffer in memory');
            } else if (file.data && typeof file.data === 'string' && file.data.length > 0) {
                // File data is already a string
                svgContent = file.data;
                debugLog('api', 'Read file from string data');
            } else {
                // Try to get data from mv (if using temp files) or other properties
                debugLog('error', 'Could not determine file data location. File object:', {
                    keys: Object.keys(file),
                    hasData: !!file.data,
                    hasTempFilePath: !!file.tempFilePath,
                    hasMv: typeof file.mv === 'function',
                    bufferLength: Buffer.isBuffer(file.data) ? file.data.length : 'N/A'
                });
                return res.status(400).json({ 
                    error: 'Could not read file content. File may be corrupted or too large.' 
                });
            }
            
            if (!svgContent || svgContent.length === 0) {
                debugLog('error', 'SVG content is empty after reading. File size was:', file.size);
                return res.status(400).json({ 
                    error: 'SVG file appears to be empty. Please check the file and try again.' 
                });
            }
            
            debugLog('api', `Processing uploaded SVG file: ${file.name} (${file.size} bytes, content length: ${svgContent.length} chars)`);
        } else if (req.body.svgContent) {
            // SVG content provided directly in body
            svgContent = req.body.svgContent;
            debugLog('api', `Processing SVG content from request body (${svgContent.length} bytes)`);
        } else {
            return res.status(400).json({
                error: 'Missing SVG content',
                message: 'Please upload an SVG file or provide SVG content in the request body'
            });
        }
        
        // Validate SVG content
        if (!svgContent || svgContent.length === 0) {
            debugLog('error', 'SVG content is empty after reading file');
            return res.status(400).json({ error: 'SVG content is empty' });
        }
        
        if (!svgContent.includes('<svg')) {
            debugLog('error', 'SVG content missing <svg> tag. First 200 chars:', svgContent.substring(0, 200));
            return res.status(400).json({ error: 'Invalid SVG file format: missing <svg> tag' });
        }
        
        // Import services
        const { parseSVGElements } = await import('../services/svg/svg-parser.js');
        const { needsChunkedProcessing, processLargeSVG } = await import('../services/svg/chunk-processor.js');
        const { parseTextElements } = await import('../services/svg/text-processor.js');
        const { parseTextPathElements } = await import('../services/svg/text-path-processor.js');
        
        // Handle large files with chunked processing
        let elements;
        if (needsChunkedProcessing(svgContent)) {
            debugLog('api', `File is large (${svgContent.length} chars), using chunked processing`);
            elements = await processLargeSVG(svgContent, { debug: true });
        } else {
            elements = parseSVGElements(svgContent);
        }
        
        debugLog('api', `Parsed ${elements.length} SVG elements`);
        
        // Process text elements if enabled
        let textElements = [];
        if (textAsSketchText || textAsPaths) {
            textElements = parseTextElements(svgContent);
            debugLog('api', `Found ${textElements.length} text elements`);
        }
        
        // Process textPath elements if enabled
        let textPathElements = [];
        if (textAsSketchText || textAsPaths) {
            textPathElements = parseTextPathElements(svgContent);
            debugLog('api', `Found ${textPathElements.length} textPath elements`);
        }
        
        // Filter out hidden elements (elements in <defs> that weren't expanded)
        const visibleElements = elements.filter(el => !el.isHidden && el.elementType !== 'use');
        
        debugLog('api', `Found ${visibleElements.length} visible geometric elements to process`);
        
        // Parse selected patterns
        let selectedPatterns = [];
        try {
            selectedPatterns = JSON.parse(patterns);
        } catch (e) {
            // Invalid JSON, ignore
        }
        
        // Determine which mode to use
        // Priority: BTM > v47 (IF) > v46.2 (raw SVG)
        const useBTM = req.body.useBTM === 'true' || req.body.useBTM === true || 
                       process.env.USE_BTM_MODE === 'true';
        const useV47 = !useBTM && (req.body.useV47 === 'true' || req.body.useV47 === true || 
                       selectedPatterns.length > 0 || 
                       (textAsPaths && textElements.length > 0));
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apiRouter.js:513',message:'Conversion mode decision',data:{useBTM,useV47,hasPatterns:selectedPatterns.length>0,textAsPaths,textElementCount:textElements.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
        // #endregion
        
        let result;
        
        // Determine authentication - prefer OAuth token, fallback to API keys
        let auth = null;
        if (req.user?.accessToken) {
            auth = { accessToken: req.user.accessToken };
        } else if (process.env.ONSHAPE_ACCESS_KEY && process.env.ONSHAPE_SECRET_KEY) {
            auth = { 
                apiKey: { 
                    accessKey: process.env.ONSHAPE_ACCESS_KEY, 
                    secretKey: process.env.ONSHAPE_SECRET_KEY 
                } 
            };
        } else {
            return res.status(401).json({ 
                error: 'No authentication available. Please log in or configure API keys.' 
            });
        }
        
        if (useBTM) {
            // Use BTM (Binary Tree Model) - native Onshape sketch creation
            const { buildSketchFeature } = await import('../services/sketch-builder.js');
            
            // Build BTM entities from parsed SVG elements
            const sketchData = await buildSketchFeature(
                visibleElements,
                textElements,
                textPathElements,
                selectedPatterns,
                {
                    scale: parseFloat(scale) || 0.001,
                    textAsSketchText: textAsSketchText,
                    sketchName: `SVG Import ${new Date().toLocaleTimeString()}`
                }
            );
            
            debugLog('api', `Generated ${sketchData.entities.length} BTM entities`);
            
            // Create sketch using BTM
            result = await onshapeApi.createSketchFromBTM({
                documentId,
                workspaceId,
                elementId,
                planeId,
                entities: sketchData.entities,
                ...auth,
                options: {
                    sketchName: `SVG Import ${new Date().toLocaleTimeString()}`,
                    scale: parseFloat(scale) || 0.001
                }
            });
        } else if (useV47) {
            // Use v47 with Intermediate Format
            const { generateIntermediateFormat } = await import('../services/if-generator.js');
            const { detectPatterns } = await import('../services/svg/pattern-analyzer.js');
            
            // Detect patterns if not already provided
            let detectedPatterns = selectedPatterns;
            if (detectedPatterns.length === 0) {
                detectedPatterns = detectPatterns(elements);
                debugLog('api', `Detected ${detectedPatterns.length} patterns`);
            }
            
            // Generate Intermediate Format
            const intermediateFormat = generateIntermediateFormat(
                visibleElements,
                textElements,
                detectedPatterns,
                {
                    scale: parseFloat(scale) || 0.001
                }
            );
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apiRouter.js:540',message:'Intermediate Format generated',data:{ifLength:intermediateFormat.length,patternCount:detectedPatterns.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
            // #endregion
            
            // Create sketch using FeatureScript v47 with IF
            result = await onshapeApi.createSketchFromIF({
                documentId,
                workspaceId,
                elementId,
                planeId,
                intermediateFormat: intermediateFormat,
                ...auth,
                options: {
                    scale: parseFloat(scale) || 1.0,
                    debugMode: false,
                    sketchName: `SVG Import ${new Date().toLocaleTimeString()}`,
                    featureType: process.env.ONSHAPE_FEATURE_TYPE_ID_V47 || "SVG to Sketch 47"
                }
            });
        } else {
            // Use v46.2 with raw SVG (backward compatible)
            result = await onshapeApi.createSketchFromSVG({
                documentId,
                workspaceId,
                elementId,
                planeId,
                svgContent: svgContent,  // Pass raw SVG string to FeatureScript
                ...auth,
                options: {
                    scale: parseFloat(scale) || 1.0,
                    debugMode: false,
                    sketchName: `SVG Import ${new Date().toLocaleTimeString()}`
                }
            });
        }
        
        res.json({ 
            success: true, 
            ...result,
            mode: useBTM ? 'BTM' : (useV47 ? 'v47-IF' : 'v46.2-SVG'),
            elementCount: visibleElements.length,
            textElementCount: textElements.length,
            textPathElementCount: textPathElements.length,
            patternCount: selectedPatterns.length
        });
    } catch (error) {
        debugLog('error', 'Conversion endpoint failed', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;

