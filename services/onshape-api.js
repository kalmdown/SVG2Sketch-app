// Import dependencies
import fetch from 'node-fetch';
import { debugLog } from '../utils/debug.js';

export default class OnshapeApiService {
    /**
     * Create an OnshapeApiService instance.
     * @param {string} apiUrl - The Onshape API URL.
     */
    constructor(apiUrl) {
        if (!apiUrl) {
            throw new Error('API URL is required');
        }
        this.apiUrl = apiUrl;
    }

    /**
     * Fetch all planes available in a document, grouped by part studio
     * @param {string} accessToken - OAuth2 access token
     * @param {string} documentId - Document ID
     * @param {string} workspaceId - Workspace ID
     * @param {string} elementId - Element ID of the active element (optional)
     * @param {boolean} [grouped=false] - Whether to return planes grouped by part studio
     * @returns {Promise<Object|Array>} - Resolves with planes data
     */
    async fetchPlanes(accessToken, documentId, workspaceId, elementId, grouped = false) {
        try {
            if (!accessToken) {
                throw new Error('Access token is required');
            }

            const shouldGroupPlanes = grouped || process.env.GROUP_PLANES_BY_STUDIO === 'true';
            
            debugLog('planes', `Fetching planes for document: ${documentId}, workspace: ${workspaceId}, grouped: ${shouldGroupPlanes}`);
            
            // Always try to fetch planes from the current element (and optionally all part studios)
            const fetchFromAllPartStudios = process.env.FETCH_ALL_PART_STUDIO_PLANES === 'true';
            let allPlanes = [];
            const groupedPlanes = {};
            
            // First try to get all elements to discover part studios if feature is enabled
            if (fetchFromAllPartStudios) {
                try {
                    debugLog('planes', 'Fetching all elements to discover part studios...');
                    const elements = await this.fetchAllElementsInDocument(accessToken, documentId, workspaceId);
                    const partStudios = elements.filter(elem => elem.elementType === 'PARTSTUDIO');
                    
                    debugLog('planes', `Found ${partStudios.length} part studios in document`);
                    
                    // Process each part studio to find planes
                    for (const studio of partStudios) {
                        try {
                            const studioName = (studio.name || `Part Studio ${studio.id}`).replace(/\s*\([^)]*\)$/, '');
                            
                            const studioDefaultPlanes = [
                                { id: `${studio.id}_XY`, name: `Front (XY)`, type: 'default', partStudioId: studio.id, partStudioName: studioName },
                                { id: `${studio.id}_YZ`, name: `Right (YZ)`, type: 'default', partStudioId: studio.id, partStudioName: studioName },
                                { id: `${studio.id}_XZ`, name: `Top (XZ)`, type: 'default', partStudioId: studio.id, partStudioName: studioName }
                            ];
                            
                            const endpoint = `/api/partstudios/d/${documentId}/w/${workspaceId}/e/${studio.id}/features`;
                            const featuresResponse = await this._callApi(endpoint, accessToken);
                            
                            const customPlanes = this._extractPlanesFromFeatures(
                                featuresResponse,
                                studioName,
                                studio.id
                            );
                            
                            if (!groupedPlanes[studioName]) {
                                groupedPlanes[studioName] = [...studioDefaultPlanes];
                            }
                            
                            if (customPlanes.length > 0) {
                                debugLog('planes', `Found ${customPlanes.length} custom planes in "${studioName}"`);
                                groupedPlanes[studioName] = groupedPlanes[studioName].concat(customPlanes);
                            }
                            
                            allPlanes = allPlanes.concat(studioDefaultPlanes, customPlanes);
                        } catch (studioError) {
                            debugLog('error', `Could not fetch planes from part studio ${studio.id}:`, studioError.message);
                        }
                    }
                } catch (elementsError) {
                    debugLog('error', 'Error fetching all elements:', elementsError.message);
                }
            }
            
            // Always fetch planes from current element (even if we fetched from all part studios)
            // This ensures we get custom planes from the active part studio
            if (elementId) {
                let elementInfo = null;
                let elementType = 'PARTSTUDIO'; // Default assumption
                
                try {
                    const elementEndpoint = `/api/documents/d/${documentId}/w/${workspaceId}/elements/${elementId}`;
                    elementInfo = await this._callApi(elementEndpoint, accessToken);
                    elementType = elementInfo.elementType || 'PARTSTUDIO';
                    debugLog('planes', `Current element type: ${elementType}`);
                } catch (elementError) {
                    // Element info fetch failed, but we can still try to fetch features
                    // Assume it's a PARTSTUDIO and proceed
                    debugLog('planes', `Could not fetch element info, assuming PARTSTUDIO: ${elementError.message}`);
                }
                
                // Try to fetch features regardless of element info success
                // Most elements are PARTSTUDIOs, so try that first
                if (elementType === 'PARTSTUDIO' || elementType === 'ASSEMBLY' || !elementInfo) {
                    let endpoint;
                    const studioName = (elementInfo?.name || 'Current Element').replace(/\s*\([^)]*\)$/, '');
                    
                    const studioDefaultPlanes = [
                        { id: `${elementId}_XY`, name: `Front (XY)`, type: 'default', partStudioId: elementId, partStudioName: studioName },
                        { id: `${elementId}_YZ`, name: `Right (YZ)`, type: 'default', partStudioId: elementId, partStudioName: studioName },
                        { id: `${elementId}_XZ`, name: `Top (XZ)`, type: 'default', partStudioId: elementId, partStudioName: studioName }
                    ];
                    
                    // Try PARTSTUDIO first (most common), then ASSEMBLY
                    if (elementType === 'ASSEMBLY') {
                        endpoint = `/api/assemblies/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
                    } else {
                        // Default to PARTSTUDIO (most common case)
                        endpoint = `/api/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
                    }
                    
                    if (endpoint) {
                        try {
                            const featuresResponse = await this._callApi(endpoint, accessToken);
                            
                            const customPlanes = this._extractPlanesFromFeatures(
                                featuresResponse,
                                studioName,
                                elementId
                            );
                            
                            if (!groupedPlanes[studioName]) {
                                groupedPlanes[studioName] = [...studioDefaultPlanes];
                            }
                            
                            if (customPlanes.length > 0) {
                                groupedPlanes[studioName] = groupedPlanes[studioName].concat(customPlanes);
                            }
                            
                            allPlanes = allPlanes.concat(studioDefaultPlanes, customPlanes);
                        } catch (featuresError) {
                            // Features API call failed, but we still have default planes
                            debugLog('error', `Could not fetch features for element ${elementId}:`, featuresError.message);
                            
                            // Still add default planes even if features fetch failed
                            if (!groupedPlanes[studioName]) {
                                groupedPlanes[studioName] = [...studioDefaultPlanes];
                            }
                            allPlanes = allPlanes.concat(studioDefaultPlanes);
                        }
                    }
                }
            }
            
            // If still no planes found, add a generic default set
            if (Object.keys(groupedPlanes).length === 0) {
                const defaultStudioName = 'Default Planes';
                const genericDefaultPlanes = [
                    { id: 'XY', name: `Front (XY)`, type: 'default', partStudioName: defaultStudioName },
                    { id: 'YZ', name: `Right (YZ)`, type: 'default', partStudioName: defaultStudioName },
                    { id: 'XZ', name: `Top (XZ)`, type: 'default', partStudioName: defaultStudioName }
                ];
                
                groupedPlanes[defaultStudioName] = genericDefaultPlanes;
                allPlanes = allPlanes.concat(genericDefaultPlanes);
            }
            
            // Format response based on the "grouped" parameter
            if (shouldGroupPlanes) {
                const result = Object.entries(groupedPlanes).map(([studioName, planes]) => ({
                    studioName,
                    planes
                })).filter(group => group.planes.length > 0);
                
                return {
                    grouped: true,
                    groups: result,
                    allPlanes
                };
            } else {
                return allPlanes;
            }
        } catch (error) {
            debugLog('error', 'Error in fetchPlanes:', error);
            const defaultStudioName = 'Default Planes';
            const genericDefaultPlanes = [
                { id: 'XY', name: `Front (XY)`, type: 'default', partStudioName: defaultStudioName },
                { id: 'YZ', name: `Right (YZ)`, type: 'default', partStudioName: defaultStudioName },
                { id: 'XZ', name: `Top (XZ)`, type: 'default', partStudioName: defaultStudioName }
            ];
            
            if (grouped || process.env.GROUP_PLANES_BY_STUDIO === 'true') {
                return {
                    grouped: true,
                    groups: [{
                        studioName: defaultStudioName,
                        planes: genericDefaultPlanes
                    }],
                    allPlanes: genericDefaultPlanes
                };
            } else {
                return genericDefaultPlanes;
            }
        }
    }

    /**
     * Fetch all elements in a document
     * @param {string} accessToken - OAuth2 access token
     * @param {string} documentId - Document ID
     * @param {string} workspaceId - Workspace ID
     * @returns {Promise<Array>} - Resolves with an array of elements
     */
    async fetchAllElementsInDocument(accessToken, documentId, workspaceId) {
        try {
            const endpoint = `/api/documents/d/${documentId}/w/${workspaceId}/elements`;
            const response = await this._callApi(endpoint, accessToken);
            return response;
        } catch (error) {
            debugLog('error', 'Error fetching document elements:', error);
            throw error;
        }
    }

    /**
     * Extract plane information from features response
     * @private
     * @param {Object} data - API response data
     * @param {string} partStudioName - Name of the part studio
     * @param {string} partStudioId - ID of the part studio
     * @returns {Array} Array of plane objects
     */
    _extractPlanesFromFeatures(data, partStudioName = 'Unknown', partStudioId = null) {
        const planes = [];
        
        if (!data || !Array.isArray(data.features)) {
            debugLog('planes', 'No features array in response, or data is null');
            return planes;
        }

        debugLog('planes', `Extracting planes from ${data.features.length} features`);

        // Look for datum plane features
        // Check both numeric types (148, 149, 150) and string featureType ('cPlane', 'datumPlane', etc.)
        // Based on Onshape API: cPlane, cPlanePoint, cPlane3Points, cPlaneMidpoint are custom plane types
        const planeFeatureTypes = ['cPlane', 'cPlanePoint', 'cPlane3Points', 'cPlaneMidpoint', 'datumPlane'];
        
        data.features.forEach((feature, index) => {
            const datumPlaneTypes = [148, 149, 150];
            const featureType = feature.type;
            const featureTypeStr = feature.featureType || feature.message?.featureType || '';
            // Check both feature.name and feature.message.name
            const featureName = feature.name || feature.message?.name || '';
            const isPlaneName = /plane|datum/i.test(featureName.toLowerCase());
            
            // Check multiple ways: numeric type, string featureType, or name pattern
            const isNumericPlaneType = datumPlaneTypes.includes(featureType);
            const isStringPlaneType = planeFeatureTypes.includes(featureTypeStr);
            const matchesPlaneName = isPlaneName;
            
            if (isNumericPlaneType || isStringPlaneType || matchesPlaneName) {
                // Prefer feature.name over feature.message.name (as per Claude's suggestion)
                const planeName = feature.name || feature.message?.name || `Plane ${planes.length + 1}`;
                // Prefer feature.featureId over feature.id (as per Claude's suggestion)
                const planeId = feature.featureId || feature.id || feature.message?.featureId;
                
                planes.push({
                    id: planeId,
                    name: planeName,
                    type: 'custom',
                    partStudioName: partStudioName,
                    partStudioId: partStudioId,
                    featureId: planeId
                });
                debugLog('planes', `Found custom plane: ${planeName} (type: ${featureType}, featureType: ${featureTypeStr})`);
            }
        });

        debugLog('planes', `Extracted ${planes.length} custom planes`);
        return planes;
    }

    /**
     * Make an API call to Onshape
     * @private
     * @param {string} endpoint - API endpoint
     * @param {string} accessToken - OAuth2 access token
     * @param {Object} [options] - Additional fetch options
     * @returns {Promise<Object>} API response
     */
    async _callApi(endpoint, accessToken, options = {}) {
        const url = `${this.apiUrl}${endpoint}`;
        debugLog('api', `Making API request to: ${url}`);
        
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        };
        
        const fetchOptions = { ...defaultOptions, ...options };
        
        try {
            const response = await fetch(url, fetchOptions);
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onshape-api.js:311',message:'_callApi response received',data:{url,endpoint,status:response.status,statusText:response.statusText,ok:response.ok,contentType:response.headers.get('content-type')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            
            // Handle authentication errors
            if (response.status === 401 || response.status === 403) {
                throw new Error('Authentication failed - please log in again');
            }
            
            const contentType = response.headers.get('content-type');
            
            // Handle non-JSON responses
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                debugLog('error', 'API Error Details:', {
                    url,
                    statusCode: response.status,
                    statusText: response.statusText,
                    contentType,
                    responseText: text.substring(0, 200)
                });
                throw new Error(`Invalid response type: ${response.status} ${response.statusText}`);
            }
            
            // Handle unsuccessful responses with JSON
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                debugLog('error', 'API Error Details:', {
                    url,
                    statusCode: response.status,
                    statusText: response.statusText,
                    errorData
                });
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onshape-api.js:339',message:'API error response',data:{status:response.status,statusText:response.statusText,errorData:JSON.stringify(errorData).substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
                const errorMessage = errorData.message || errorData.error || `API error: ${response.status} ${response.statusText}`;
                throw new Error(errorMessage);
            }
            
            const jsonResponse = await response.json();
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onshape-api.js:352',message:'_callApi success',data:{responseKeys:Object.keys(jsonResponse),hasFeature:!!jsonResponse.feature,hasFeatureId:!!jsonResponse.featureId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            return jsonResponse;
        } catch (error) {
            debugLog('error', 'API call failed:', error);
            throw error;
        }
    }

    /**
     * Create sketch entities in Onshape from parsed SVG elements
     * @param {Object} params - Request parameters
     * @param {string} params.documentId - Onshape document ID
     * @param {string} params.workspaceId - Onshape workspace ID
     * @param {string} params.elementId - Onshape element ID (Part Studio)
     * @param {string} params.planeId - Target plane ID
     * @param {Array} params.elements - Parsed SVG elements
     * @param {Array} [params.textElements] - Parsed text elements
     * @param {Array} [params.textPathElements] - Parsed textPath elements
     * @param {Array} [params.patterns] - Selected patterns for array optimization
     * @param {string} params.accessToken - OAuth access token
     * @param {Object} [params.options] - Optional parameters
     * @returns {Promise<Object>} - Sketch creation result
     */
    async createSketchFromElements(params) {
        const { 
            documentId, 
            workspaceId, 
            elementId, 
            planeId, 
            elements, 
            textElements = [],
            textPathElements = [],
            patterns = [],
            accessToken, 
            options = {} 
        } = params;
        
        try {
            debugLog('api', 'Creating sketch from elements', {
                documentId,
                elementId,
                planeId,
                elementCount: elements.length,
                textElementCount: textElements.length,
                textPathElementCount: textPathElements.length,
                patternCount: patterns.length
            });
            
            // Import sketch builder
            const { buildSketchFeature } = await import('./sketch-builder.js');
            
            // Build sketch feature data
            const sketchData = await buildSketchFeature(
                elements,
                textElements,
                textPathElements,
                patterns,
                options
            );
            
            // Create sketch feature via Onshape API
            // Onshape API endpoint: POST /api/partstudios/d/{did}/w/{wid}/e/{eid}/features
            const endpoint = `/api/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
            
            // Convert entities to Onshape format
            const onshapeEntities = (sketchData.entities || []).map((entity, index) => {
                const entityId = `entity-${index}`;
                
                switch (entity.type) {
                    case 'line':
                        return {
                            btType: 'BTMSketchCurve-4',
                            entityId: entityId,
                            geometry: {
                                btType: 'BTCurveGeometryLine-116',
                                p1: entity.start,
                                p2: entity.end
                            },
                            isConstruction: entity.isConstruction || false
                        };
                    
                    case 'circle':
                        return {
                            btType: 'BTMSketchCurve-4',
                            entityId: entityId,
                            geometry: {
                                btType: 'BTCurveGeometryCircle-115',
                                radius: entity.radius || 0,
                                xCenter: entity.center[0],
                                yCenter: entity.center[1],
                                xDir: 1,
                                yDir: 0,
                                clockwise: false
                            },
                            centerId: `${entityId}.center`,
                            isConstruction: entity.isConstruction || false
                        };
                    
                    case 'ellipse':
                        // Convert ellipse to circle if radii are equal, otherwise approximate with spline
                        // For now, use circle format (Onshape may require different format for ellipses)
                        const avgRadius = ((entity.radiusX || 0) + (entity.radiusY || 0)) / 2;
                        return {
                            btType: 'BTMSketchCurve-4',
                            entityId: entityId,
                            geometry: {
                                btType: 'BTCurveGeometryCircle-115',
                                radius: avgRadius,
                                xCenter: entity.center[0],
                                yCenter: entity.center[1],
                                xDir: 1,
                                yDir: 0,
                                clockwise: false
                            },
                            centerId: `${entityId}.center`,
                            isConstruction: entity.isConstruction || false
                        };
                    
                    case 'spline':
                    case 'bezier':
                        // Convert bezier/spline to line segments for now
                        // TODO: Support proper spline entities
                        return {
                            btType: 'BTMSketchCurve-4',
                            entityId: entityId,
                            geometry: {
                                btType: 'BTCurveGeometryLine-116',
                                p1: entity.start,
                                p2: entity.end
                            },
                            isConstruction: entity.isConstruction || false
                        };
                    
                    default:
                        // Fallback to line
                        return {
                            btType: 'BTMSketchCurve-4',
                            entityId: entityId,
                            geometry: {
                                btType: 'BTCurveGeometryLine-116',
                                p1: entity.start || [0, 0],
                                p2: entity.end || [0, 0]
                            },
                            isConstruction: entity.isConstruction || false
                        };
                }
            });
            
            // Build feature definition for sketch
            // Use btType format (as shown in official Onshape API Features HTML documentation)
            // Determine if this is a default plane (format: "elementId_XY") or custom plane (featureId)
            const isDefaultPlane = planeId.includes('_XY') || planeId.includes('_YZ') || planeId.includes('_XZ');
            
            // For default planes, we need to query for the actual deterministic ID
            // For custom planes, use the featureId directly as deterministicIds
            // Note: Default plane IDs like "elementId_XY" won't work - we'd need to query for actual IDs
            // For now, try using deterministicIds for both (custom planes should work)
            
            const featureDefinition = {
                feature: {
                    btType: "BTMSketch-151",
                    featureType: "newSketch",
                    name: options.sketchName || 'SVG Import',
                    entities: onshapeEntities,
                    constraints: [],
                    parameters: [
                        {
                            btType: "BTMParameterQueryList-148",
                            parameterId: "sketchPlane",
                            queries: [
                                {
                                    btType: "BTMIndividualQuery-138",
                                    deterministicIds: [planeId]
                                }
                            ]
                        }
                    ]
                }
            };
            
            // #region agent log
            const fullFeatureDef = JSON.stringify(featureDefinition, null, 2);
            fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onshape-api.js:529',message:'Feature definition before API call',data:{endpoint,planeId,isDefaultPlane,entityCount:sketchData.entities?.length,onshapeEntityCount:onshapeEntities.length,featureDefinitionPreview:fullFeatureDef.substring(0,1000),parametersPreview:JSON.stringify(featureDefinition.feature.message.parameters).substring(0,500),firstEntity:onshapeEntities[0]},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            
            // Make API call to create sketch
            const response = await this._callApi(endpoint, accessToken, {
                method: 'POST',
                body: JSON.stringify(featureDefinition)
            });
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onshape-api.js:438',message:'API call response',data:{hasResponse:!!response,responseKeys:response?Object.keys(response):[],hasFeatureId:!!response?.featureId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            
            debugLog('api', 'Sketch created successfully', {
                featureId: response.featureId,
                entityCount: sketchData.entityCount
            });
            
            return {
                success: true,
                featureId: response.featureId,
                entityCount: sketchData.entityCount,
                message: 'Sketch created successfully'
            };
        } catch (error) {
            debugLog('error', 'Failed to create sketch from elements:', error);
            throw new Error(`Failed to create sketch: ${error.message}`);
        }
    }
}

