/**
 * Sketch Builder Service
 * 
 * Converts parsed SVG elements to Onshape sketch entities via REST API
 */

import { debugLog } from '../utils/debug.js';

/**
 * Build sketch entities from parsed SVG elements
 * @param {Array} elements - Parsed SVG elements
 * @param {Array} textElements - Parsed text elements
 * @param {Array} textPathElements - Parsed textPath elements
 * @param {Array} patterns - Selected patterns for array optimization
 * @param {Object} options - Conversion options
 * @returns {Promise<Object>} Sketch feature data for Onshape API
 */
export async function buildSketchFeature(elements, textElements = [], textPathElements = [], patterns = [], options = {}) {
    const { scale = 1.0, textAsSketchText = true, textAsPaths = true } = options;
    
    const sketchEntities = [];
    const arrayFeatures = [];
    
    // Process geometric elements
    for (let index = 0; index < elements.length; index++) {
        const el = elements[index];
        if (el.isHidden || el.elementType === 'use') {
            continue; // Skip hidden and use elements (already expanded)
        }
        
        // Check if this element is part of a pattern
        const pattern = patterns.find(p => 
            p.href && el.sourceUseHref === p.href
        );
        
        if (pattern) {
            // This element will be handled by array feature
            // For now, we'll still create individual entities
            // TODO: Group into array features
        }
        
        // Convert element to sketch entities based on type
        switch (el.elementType) {
            case 'path':
                if (el.d && el.d.length > 0) {
                    const pathEntities = await convertPathToEntities(el, scale);
                    sketchEntities.push(...pathEntities);
                }
                break;
            case 'rect':
                const rectEntities = convertRectToEntities(el, scale);
                sketchEntities.push(...rectEntities);
                break;
            case 'line':
                const lineEntity = convertLineToEntity(el, scale);
                if (lineEntity) sketchEntities.push(lineEntity);
                break;
            case 'circle':
                const circleEntity = convertCircleToEntity(el, scale);
                if (circleEntity) sketchEntities.push(circleEntity);
                break;
            case 'ellipse':
                const ellipseEntity = convertEllipseToEntity(el, scale);
                if (ellipseEntity) sketchEntities.push(ellipseEntity);
                break;
        }
    }
    
    // Process text elements
    if (textAsSketchText || textAsPaths) {
        textElements.forEach(textEl => {
            // TODO: Convert text to sketch text entities or paths
            // This requires Onshape API support for sketch text
            debugLog('sketch', `Text element found: "${textEl.content}" at (${textEl.x}, ${textEl.y})`);
        });
    }
    
    // Process textPath elements
    if (textAsSketchText || textAsPaths) {
        textPathElements.forEach(textPathEl => {
            // TODO: Convert textPath to sketch entities
            debugLog('sketch', `TextPath element found: "${textPathEl.content}" on path ${textPathEl.pathId}`);
        });
    }
    
    return {
        entities: sketchEntities,
        arrayFeatures: arrayFeatures,
        entityCount: sketchEntities.length
    };
}

/**
 * Convert SVG path to sketch entities
 */
async function convertPathToEntities(pathElement, scale) {
    // Dynamic import to avoid circular dependencies
    const pathParser = await import('./svg/path-parser.js');
    const { parsePathData } = pathParser;
    
    if (!pathElement.d || pathElement.d.length === 0) {
        return [];
    }
    
    // Parse path commands
    const commands = parsePathData(pathElement.d);
    
    const entities = [];
    const transform = pathElement.transform || [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
    let currentPoint = null;
    let subpathStart = null;
    
    for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        
        switch (cmd.cmdType) {
            case 'M':
                // Move to - start new subpath
                currentPoint = applyTransform(transform, [cmd.point[0] * scale, -cmd.point[1] * scale]);
                subpathStart = currentPoint;
                break;
                
            case 'L':
                // Line to
                if (currentPoint === null) {
                    // No previous M command - skip
                    break;
                }
                const lineEnd = applyTransform(transform, [cmd.point[0] * scale, -cmd.point[1] * scale]);
                entities.push({
                    type: 'line',
                    start: currentPoint,
                    end: lineEnd,
                    isConstruction: pathElement.isConstruction || false
                });
                currentPoint = lineEnd;
                break;
                
            case 'C':
                // Cubic bezier curve
                if (currentPoint === null) {
                    break;
                }
                const c1 = applyTransform(transform, [cmd.control1[0] * scale, -cmd.control1[1] * scale]);
                const c2 = applyTransform(transform, [cmd.control2[0] * scale, -cmd.control2[1] * scale]);
                const curveEnd = applyTransform(transform, [cmd.point[0] * scale, -cmd.point[1] * scale]);
                
                entities.push({
                    type: 'spline',
                    start: currentPoint,
                    control1: c1,
                    control2: c2,
                    end: curveEnd,
                    isConstruction: pathElement.isConstruction || false
                });
                currentPoint = curveEnd;
                break;
                
            case 'Z':
                // Close path
                if (currentPoint !== null && subpathStart !== null) {
                    // Only close if start and end are different
                    const dist = Math.sqrt(
                        Math.pow(currentPoint[0] - subpathStart[0], 2) +
                        Math.pow(currentPoint[1] - subpathStart[1], 2)
                    );
                    if (dist > 0.001) {
                        entities.push({
                            type: 'line',
                            start: currentPoint,
                            end: subpathStart,
                            isConstruction: pathElement.isConstruction || false
                        });
                    }
                    currentPoint = subpathStart;
                }
                break;
        }
    }
    
    return entities;
}

/**
 * Convert SVG rect to sketch entities (4 line segments)
 */
function convertRectToEntities(rectElement, scale) {
    const x = (rectElement.x || 0) * scale;
    const y = -(rectElement.y || 0) * scale; // Flip Y
    const width = (rectElement.width || 0) * scale;
    const height = (rectElement.height || 0) * scale;
    
    const transform = rectElement.transform || [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
    
    // Apply transform to corners
    const corners = [
        applyTransform(transform, [x, y]),
        applyTransform(transform, [x + width, y]),
        applyTransform(transform, [x + width, y - height]),
        applyTransform(transform, [x, y - height])
    ];
    
    // Create 4 line segments
    return [
        { type: 'line', start: corners[0], end: corners[1], isConstruction: rectElement.isConstruction },
        { type: 'line', start: corners[1], end: corners[2], isConstruction: rectElement.isConstruction },
        { type: 'line', start: corners[2], end: corners[3], isConstruction: rectElement.isConstruction },
        { type: 'line', start: corners[3], end: corners[0], isConstruction: rectElement.isConstruction }
    ];
}

/**
 * Convert SVG line to sketch entity
 */
function convertLineToEntity(lineElement, scale) {
    const x1 = (lineElement.x1 || 0) * scale;
    const y1 = -(lineElement.y1 || 0) * scale; // Flip Y
    const x2 = (lineElement.x2 || 0) * scale;
    const y2 = -(lineElement.y2 || 0) * scale; // Flip Y
    
    const transform = lineElement.transform || [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
    
    const start = applyTransform(transform, [x1, y1]);
    const end = applyTransform(transform, [x2, y2]);
    
    return {
        type: 'line',
        start: start,
        end: end,
        isConstruction: lineElement.isConstruction || false
    };
}

/**
 * Convert SVG circle to sketch entity
 */
function convertCircleToEntity(circleElement, scale) {
    const cx = (circleElement.cx || 0) * scale;
    const cy = -(circleElement.cy || 0) * scale; // Flip Y
    const r = (circleElement.r || 0) * scale;
    
    if (r <= 0) return null;
    
    const transform = circleElement.transform || [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
    
    // Apply transform to center
    const center = applyTransform(transform, [cx, cy]);
    
    // For non-uniform transforms, convert to ellipse
    // For now, assume uniform scale
    return {
        type: 'circle',
        center: center,
        radius: r,
        isConstruction: circleElement.isConstruction || false
    };
}

/**
 * Convert SVG ellipse to sketch entity
 */
function convertEllipseToEntity(ellipseElement, scale) {
    const cx = (ellipseElement.cx || 0) * scale;
    const cy = -(ellipseElement.cy || 0) * scale; // Flip Y
    const rx = (ellipseElement.rx || 0) * scale;
    const ry = (ellipseElement.ry || 0) * scale;
    
    if (rx <= 0 || ry <= 0) return null;
    
    const transform = ellipseElement.transform || [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
    
    // Apply transform to center
    const center = applyTransform(transform, [cx, cy]);
    
    return {
        type: 'ellipse',
        center: center,
        radiusX: rx,
        radiusY: ry,
        isConstruction: ellipseElement.isConstruction || false
    };
}

/**
 * Apply 2D transform matrix to point
 */
function applyTransform(transform, point) {
    const [a, b, c, d, e, f] = transform;
    const x = a * point[0] + c * point[1] + e;
    const y = b * point[0] + d * point[1] + f;
    return [x, -y]; // Flip Y for Onshape coordinate system
}

