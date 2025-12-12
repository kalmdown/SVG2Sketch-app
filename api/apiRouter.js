/**
 * API routes for SVG2Sketch app
 * Handles API endpoints including planes fetching and SVG conversion
 */
import express from 'express';
import fileUpload from 'express-fileupload';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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

