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
    useTempFiles: true,
    tempFileDir: path.join(__dirname, '../tmp')
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
        // Validate authentication
        if (!req.user?.accessToken) {
            return res.status(401).json({ 
                error: 'Authentication required' 
            });
        }

        debugLog('api', 'Fetching all documents');
        
        try {
            const apiUrl = process.env.API_URL || 'https://cad.onshape.com';
            const docUrl = `${apiUrl}/api/documents`;
            const docResponse = await fetch(docUrl, {
                headers: {
                    'Authorization': `Bearer ${req.user.accessToken}`,
                    'Accept': 'application/json'
                }
            });
            
            if (docResponse.ok) {
                const data = await docResponse.json();
                const documents = data.items || [];
                debugLog('api', `Found ${documents.length} documents`);
                res.json(documents.map(doc => ({
                    id: doc.id,
                    name: doc.name,
                    owner: doc.owner?.name,
                    createdAt: doc.createdAt,
                    modifiedAt: doc.modifiedAt
                })));
            } else {
                throw new Error(`Failed to fetch documents: ${docResponse.status}`);
            }
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
    try {
        const { documentId, workspaceId } = req.query;
        
        // Validate required parameters
        if (!documentId || !workspaceId) {
            return res.status(400).json({ 
                error: 'Missing required parameters: documentId, workspaceId' 
            });
        }

        // Validate authentication
        if (!req.user?.accessToken) {
            return res.status(401).json({ 
                error: 'Authentication required' 
            });
        }

        debugLog('api', `Fetching elements for document: ${documentId}`);
        
        try {
            const elements = await onshapeApi.fetchAllElementsInDocument(
                req.user.accessToken,
                documentId,
                workspaceId
            );
            
            // Filter to only part studios
            const partStudios = elements
                .filter(elem => elem.elementType === 'PARTSTUDIO')
                .map(elem => ({
                    id: elem.id,
                    name: (elem.name || `Part Studio ${elem.id}`).replace(/\s*\([^)]*\)$/, ''),
                    elementType: elem.elementType
                }));
            
            debugLog('api', `Found ${partStudios.length} part studios`);
            res.json(partStudios);
        } catch (apiError) {
            debugLog('error', 'Error fetching elements:', apiError);
            res.status(500).json({ error: apiError.message });
        }
    } catch (error) {
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

        // Validate authentication
        if (!req.user?.accessToken) {
            return res.status(401).json({ 
                error: 'Authentication required' 
            });
        }

        debugLog('api', `Fetching planes for element: ${elementId}`);
        
        try {
            const planes = await onshapeApi.fetchPlanes(
                req.user.accessToken,
                documentId,
                workspaceId,
                elementId
            );
            res.json(planes);
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
        // Check authentication
        if (!req.user?.accessToken) {
            return res.status(401).json({ 
                error: 'Authentication required' 
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
            
            svgContent = file.data.toString('utf8');
            debugLog('api', `Processing uploaded SVG file: ${file.name} (${file.size} bytes)`);
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
            return res.status(400).json({ error: 'SVG content is empty' });
        }
        
        if (!svgContent.includes('<svg')) {
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
        
        // Create sketch in Onshape
        const result = await onshapeApi.createSketchFromElements({
            documentId,
            workspaceId,
            elementId,
            planeId,
            elements: visibleElements,
            textElements: textElements,
            textPathElements: textPathElements,
            patterns: selectedPatterns,
            accessToken: req.user.accessToken,
            options: {
                scale: parseFloat(scale) || 1.0,
                textAsSketchText: textAsSketchText === true || textAsSketchText === 'true',
                textAsPaths: textAsPaths === true || textAsPaths === 'true',
                sketchName: `SVG Import ${new Date().toLocaleTimeString()}`
            }
        });
        
        res.json({ 
            success: true, 
            ...result,
            elementCount: visibleElements.length,
            textElementCount: textElements.length,
            textPathElementCount: textPathElements.length
        });
    } catch (error) {
        debugLog('error', 'Conversion endpoint failed', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;

