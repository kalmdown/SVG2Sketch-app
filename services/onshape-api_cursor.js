/**
 * Onshape API Service
 * Handles communication with Onshape REST API for SVG2Sketch app
 */

import fetch from 'node-fetch';
import { debugLog } from '../utils/debug.js';

export default class OnshapeApiService {
    /**
     * Create an OnshapeApiService instance.
     * @param {string} apiUrl - The Onshape API URL.
     */
    constructor(apiUrl) {
        this.apiUrl = apiUrl || 'https://cad.onshape.com';
        // Store as baseUrl for compatibility
        this.baseUrl = this.apiUrl;
    }

    /**
     * Internal method to make API calls with authentication
     * @private
     */
    async _callApi(endpoint, accessToken, options = {}) {
        const url = `${this.apiUrl}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...options.headers
        };

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onshape-api.js:26',message:'_callApi request',data:{url,endpoint,headers:Object.keys(headers),method:options.method||'GET'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion

        const response = await fetch(url, {
            ...options,
            headers
        });

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onshape-api.js:35',message:'_callApi response received',data:{url,endpoint,status:response.status,statusText:response.statusText,ok:response.ok,contentType:response.headers.get('content-type')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
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
            let errorData = {};
            let errorText = '';
            
            try {
                errorText = await response.text();
                if (errorText) {
                    errorData = JSON.parse(errorText);
                }
            } catch (parseError) {
                // If JSON parsing fails, use the raw text
                errorData = { 
                    message: errorText.substring(0, 500),
                    rawResponse: errorText.substring(0, 1000),
                    parseError: parseError.message
                };
            }
            
            debugLog('error', 'API Error Details:', {
                url,
                statusCode: response.status,
                statusText: response.statusText,
                errorData,
                errorText: errorText.substring(0, 500)
            });
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onshape-api.js:58',message:'API error response',data:{status:response.status,statusText:response.statusText,errorData:JSON.stringify(errorData).substring(0,1000),errorText:errorText.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            
            // Extract more detailed error message
            let errorMessage = errorData.message || errorData.error || errorData.rawResponse || errorText || `API error: ${response.status} ${response.statusText}`;
            
            // If it's a JSON processing error, provide more context
            if (errorMessage.toLowerCase().includes('json') || errorMessage.toLowerCase().includes('parse') || response.status === 400) {
                errorMessage = `Error processing json: ${errorMessage}. ` +
                    `This usually means: (1) The featureType ID "${options?.featureType || 'SVG to Sketch 47'}" is incorrect or not found, ` +
                    `(2) The parameter structure doesn't match FeatureScript expectations, or ` +
                    `(3) The planeId format is invalid. ` +
                    `Check server logs for more details.`;
            }
            
            throw new Error(errorMessage);
        }
        
        const jsonResponse = await response.json();
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onshape-api.js:66',message:'_callApi success',data:{responseKeys:Object.keys(jsonResponse),hasFeature:!!jsonResponse.feature,hasFeatureId:!!jsonResponse.featureId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        return jsonResponse;
    }

    /**
     * Fetch all elements (part studios) in a document
     * @param {string} accessToken - OAuth2 access token
     * @param {string} documentId - Document ID
     * @param {string} workspaceId - Workspace ID
     * @returns {Promise<Array>} - Array of elements
     */
    async fetchAllElementsInDocument(accessToken, documentId, workspaceId) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onshape-api.js:75',message:'fetchAllElementsInDocument entry',data:{documentId,workspaceId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion

        const endpoint = `/api/documents/d/${documentId}/w/${workspaceId}/elements`;
        const elements = await this._callApi(endpoint, accessToken);
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onshape-api.js:81',message:'fetchAllElementsInDocument success',data:{elementsCount:Array.isArray(elements)?elements.length:'not array',elementTypes:Array.isArray(elements)?elements.map(e=>e.elementType):[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion

        return Array.isArray(elements) ? elements : [];
    }

    /**
     * Fetch all planes available in a document
     * @param {string} accessToken - OAuth2 access token
     * @param {string} documentId - Document ID
     * @param {string} workspaceId - Workspace ID
     * @param {string} elementId - Element ID of the active element
     * @returns {Promise<Array>} - Array of planes
     */
    async fetchPlanes(accessToken, documentId, workspaceId, elementId) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onshape-api.js:92',message:'fetchPlanes entry',data:{documentId,workspaceId,elementId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion

        const defaultPlanes = [
            { id: `${elementId}_XY`, name: 'Front (XY)', type: 'default' },
            { id: `${elementId}_YZ`, name: 'Right (YZ)', type: 'default' },
            { id: `${elementId}_XZ`, name: 'Top (XZ)', type: 'default' }
        ];

        let customPlanes = [];

        try {
            // Try to fetch element info to determine type
            let elementType = 'PARTSTUDIO';
            try {
                const elementEndpoint = `/api/documents/d/${documentId}/w/${workspaceId}/elements/${elementId}`;
                const elementInfo = await this._callApi(elementEndpoint, accessToken);
                elementType = elementInfo.elementType || 'PARTSTUDIO';
            } catch (error) {
                // Element info fetch failed, assume PARTSTUDIO
                debugLog('planes', `Could not fetch element info, assuming PARTSTUDIO: ${error.message}`);
            }

            // Fetch features from the part studio
            const featuresEndpoint = `/api/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
            const featuresResponse = await this._callApi(featuresEndpoint, accessToken);
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onshape-api.js:115',message:'Features response received',data:{hasResponse:!!featuresResponse,hasFeatures:!!featuresResponse.features,featuresCount:featuresResponse.features?.length||0,responseKeys:Object.keys(featuresResponse||{})},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion

            if (featuresResponse && featuresResponse.features) {
                customPlanes = this._extractPlanesFromFeatures(featuresResponse.features, elementId);
            }
        } catch (error) {
            debugLog('error', `Error fetching custom planes: ${error.message}`);
            // Continue with default planes only
        }

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onshape-api.js:125',message:'Planes merged',data:{defaultPlanesCount:defaultPlanes.length,customPlanesCount:customPlanes.length,totalPlanes:defaultPlanes.length+customPlanes.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion

        return [...defaultPlanes, ...customPlanes];
    }

    /**
     * Extract plane features from features response
     * @private
     */
    _extractPlanesFromFeatures(features, partStudioId) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onshape-api.js:135',message:'_extractPlanesFromFeatures entry',data:{hasFeatures:!!features,featuresLength:features?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion

        const planes = [];
        const planeTypes = ['cPlane', 'cPlanePoint', 'cPlane3Points', 'cPlaneMidpoint', 'datumPlane'];

        if (!Array.isArray(features)) {
            return planes;
        }

        for (let i = 0; i < features.length; i++) {
            const feature = features[i];
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onshape-api.js:147',message:'Feature structure check',data:{index:i,featureType:feature.type,featureTypeStr:feature.typeName,featureName:feature.message?.name||feature.name,hasMessage:!!feature.message,messageKeys:feature.message?Object.keys(feature.message):[],featureKeys:Object.keys(feature)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
            // #endregion

            // Check feature type - can be numeric (134) or string
            const featureType = feature.type || feature.typeName;
            const featureTypeStr = typeof featureType === 'string' ? featureType : feature.typeName;
            const featureName = feature.message?.name || feature.name || feature.featureId;
            const featureId = feature.message?.featureId || feature.featureId;

            // Check if it's a plane feature
            const isNumericPlaneType = featureType === 134; // BTMFeature-134
            const isStringPlaneType = typeof featureTypeStr === 'string' && planeTypes.some(pt => featureTypeStr.includes(pt));
            const matchesPlaneName = featureName && (featureName.toLowerCase().includes('plane') || featureName.toLowerCase().includes('datum'));

            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onshape-api.js:157',message:'Plane detection logic',data:{index:i,isNumericPlaneType,isStringPlaneType,matchesPlaneName,willInclude:isNumericPlaneType||isStringPlaneType||matchesPlaneName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
            // #endregion

            if (isNumericPlaneType || isStringPlaneType || matchesPlaneName) {
                if (featureId) {
                    planes.push({
                        id: featureId,
                        name: featureName || `Plane ${featureId}`,
                        type: 'custom'
                    });
                    
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onshape-api.js:168',message:'Adding custom plane',data:{planeName:featureName,planeId:featureId,featureType,featureTypeStr,detectionMethod:isNumericPlaneType?'numeric':isStringPlaneType?'string':'name'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
                    // #endregion
                }
            }
        }

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onshape-api.js:175',message:'_extractPlanesFromFeatures exit',data:{planesCount:planes.length,planes:planes.map(p=>({name:p.name,id:p.id}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion

        return planes;
    }

    /**
     * Create a sketch from SVG content using FeatureScript v46.2
     * @param {Object} params - Parameters object
     * @param {string} params.documentId - Document ID
     * @param {string} params.workspaceId - Workspace ID
     * @param {string} params.elementId - Element ID
     * @param {string} params.planeId - Plane ID
     * @param {string} params.svgContent - Raw SVG content string
     * @param {string} params.accessToken - OAuth2 access token
     * @param {Object} params.options - Options (scale, debugMode, sketchName)
     * @returns {Promise<Object>} - Feature creation result
     */
    async createSketchFromSVG({ documentId, workspaceId, elementId, planeId, svgContent, accessToken, options = {} }) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onshape-api.js:190',message:'createSketchFromSVG entry',data:{documentId,workspaceId,elementId,planeId,svgContentLength:svgContent.length,scale:options.scale},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
        // #endregion

        const endpoint = `/api/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;

        // FeatureScript parameters
        const parameters = [
            {
                btType: "BTMParameterString-149",
                parameterId: "inputText", // Matches FeatureScript parameter name
                value: svgContent
            },
            {
                btType: "BTMParameterQueryList-148",
                parameterId: "sketchPlane", // Matches FeatureScript parameter name
                queries: [
                    {
                        btType: "BTMIndividualQuery-138",
                        deterministicIds: [planeId]
                    }
                ]
            },
            {
                btType: "BTMParameterQuantity-147",
                parameterId: "scale", // Matches FeatureScript parameter name
                expression: `${options.scale || 1.0} mm` // Assuming scale is unitless and converts to mm
            },
            {
                btType: "BTMParameterBoolean-144",
                parameterId: "debugMode", // Matches FeatureScript parameter name
                value: options.debugMode || false
            }
        ];

        const featureDefinition = {
            btType: "BTFeatureDefinitionCall-1406",
            feature: {
                btType: "BTMFeature-134",
                featureType: "SVG to Sketch 46.2", // Feature Type Name from your FS
                name: options.sketchName || `SVG Import ${new Date().toLocaleTimeString()}`,
                parameters: parameters
            }
        };

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onshape-api.js:230',message:'FeatureScript feature definition before API call',data:{endpoint,planeId,featureDefinitionPreview:JSON.stringify(featureDefinition).substring(0,1000),parametersPreview:JSON.stringify(parameters).substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
        // #endregion

        const response = await this._callApi(endpoint, accessToken, {
            method: 'POST',
            body: JSON.stringify(featureDefinition)
        });

        return response;
    }

    /**
     * Create a sketch from Intermediate Format using FeatureScript v47
     * @param {Object} params - Parameters object
     * @param {string} params.documentId - Document ID
     * @param {string} params.workspaceId - Workspace ID
     * @param {string} params.elementId - Element ID
     * @param {string} params.planeId - Plane ID
     * @param {string} params.intermediateFormat - Intermediate Format string
     * @param {string} params.accessToken - OAuth2 access token
     * @param {Object} params.options - Options (scale, debugMode, sketchName)
     * @returns {Promise<Object>} - Feature creation result
     */
    async createSketchFromIF({ documentId, workspaceId, elementId, planeId, intermediateFormat, accessToken, options = {} }) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onshape-api.js:300',message:'createSketchFromIF entry',data:{documentId,workspaceId,elementId,planeId,ifLength:intermediateFormat.length,scale:options.scale},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
        // #endregion

        const endpoint = `/api/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;

        // FeatureScript v47 parameters - uses IF instead of raw SVG
        const parameters = [
            {
                btType: "BTMParameterString-149",
                parameterId: "inputText", // FeatureScript v47 accepts IF in inputText parameter
                value: intermediateFormat
            },
            {
                btType: "BTMParameterQueryList-148",
                parameterId: "sketchPlane",
                queries: [
                    {
                        btType: "BTMIndividualQuery-138",
                        deterministicIds: [planeId]
                    }
                ]
            },
            {
                btType: "BTMParameterQuantity-147",
                parameterId: "scale",
                expression: `${options.scale || 1.0} mm`
            },
            {
                btType: "BTMParameterBoolean-144",
                parameterId: "debugMode",
                value: options.debugMode || false
            },
            {
                btType: "BTMParameterBoolean-144",
                parameterId: "useIntermediateFormat", // New parameter to indicate IF mode
                value: true
            }
        ];

        const featureDefinition = {
            btType: "BTFeatureDefinitionCall-1406",
            feature: {
                btType: "BTMFeature-134",
                featureType: options.featureType || "SVG to Sketch 47", // Feature Type Name for v47
                name: options.sketchName || `SVG Import ${new Date().toLocaleTimeString()}`,
                parameters: parameters
            }
        };

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c51d25f2-8d26-4f89-8d36-646b610f4372',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onshape-api.js:345',message:'FeatureScript v47 feature definition before API call',data:{endpoint,planeId,featureType:options.featureType||'SVG to Sketch 47',ifPreview:intermediateFormat.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
        // #endregion

        // Log the feature definition for debugging
        debugLog('api', 'Creating feature with definition:', {
            featureType: featureDefinition.feature.featureType,
            parameterCount: featureDefinition.feature.parameters.length,
            parameterIds: featureDefinition.feature.parameters.map(p => p.parameterId),
            ifLength: intermediateFormat.length,
            planeId: planeId
        });

        const response = await this._callApi(endpoint, accessToken, {
            method: 'POST',
            body: JSON.stringify(featureDefinition)
        });

        return response;
    }
}
