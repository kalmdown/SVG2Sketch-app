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
            
            // If we didn't find planes from all part studios, fall back to current element
            if (elementId && Object.keys(groupedPlanes).length === 0) {
                try {
                    const elementEndpoint = `/api/documents/d/${documentId}/w/${workspaceId}/elements/${elementId}`;
                    const elementInfo = await this._callApi(elementEndpoint, accessToken);
                    debugLog('planes', `Current element type: ${elementInfo.elementType}`);
                    
                    if (elementInfo.elementType === 'PARTSTUDIO' || elementInfo.elementType === 'ASSEMBLY') {
                        let endpoint;
                        const studioName = (elementInfo.name || 'Current Element').replace(/\s*\([^)]*\)$/, '');
                        
                        const studioDefaultPlanes = [
                            { id: `${elementId}_XY`, name: `Front (XY)`, type: 'default', partStudioId: elementId, partStudioName: studioName },
                            { id: `${elementId}_YZ`, name: `Right (YZ)`, type: 'default', partStudioId: elementId, partStudioName: studioName },
                            { id: `${elementId}_XZ`, name: `Top (XZ)`, type: 'default', partStudioId: elementId, partStudioName: studioName }
                        ];
                        
                        if (elementInfo.elementType === 'PARTSTUDIO') {
                            endpoint = `/api/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
                        } else if (elementInfo.elementType === 'ASSEMBLY') {
                            endpoint = `/api/assemblies/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
                        }
                        
                        if (endpoint) {
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
                        }
                    }
                } catch (elementError) {
                    console.warn('Error fetching current element info:', elementError.message);
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
            return planes;
        }

        // Look for datum plane features
        data.features.forEach(feature => {
            const datumPlaneTypes = [148, 149, 150];
            const isPlaneName = feature.message?.name &&
                /plane|datum/i.test(feature.message.name.toLowerCase());
            
            if (datumPlaneTypes.includes(feature.type) || isPlaneName) {
                planes.push({
                    id: feature.id,
                    name: feature.message?.name || `Plane ${planes.length + 1}`,
                    type: 'custom',
                    partStudioName: partStudioName,
                    partStudioId: partStudioId,
                    featureId: feature.id
                });
            }
        });

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
                throw new Error(errorData.message || `API error: ${response.status} ${response.statusText}`);
            }
            
            return await response.json();
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
            
            // Build feature definition for sketch
            const featureDefinition = {
                feature: {
                    featureType: 'sketch',
                    name: options.sketchName || 'SVG Import',
                    parameters: [
                        {
                            type: 'query',
                            query: [
                                {
                                    type: 'entityType',
                                    entityType: 'Face'
                                },
                                {
                                    type: 'id',
                                    id: planeId
                                }
                            ],
                            name: 'sketchPlane'
                        }
                    ],
                    entities: sketchData.entities
                }
            };
            
            // Make API call to create sketch
            const response = await this._callApi(endpoint, accessToken, {
                method: 'POST',
                body: JSON.stringify(featureDefinition)
            });
            
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

