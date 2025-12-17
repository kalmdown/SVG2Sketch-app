/**
 * Sketch Builder Service (BTM Version)
 * * Converts parsed SVG elements into Onshape BTM (Binary Tree Model) JSON entities.
 * STRICTLY adheres to the "Golden Record" format to ensure API acceptance.
 */

import { debugLog } from '../utils/debug.js';
import { parsePathData } from './svg/path-parser.js';

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
    // DEBUG MODE: Return hardcoded single circle for testing basic connectivity
    if (process.env.DEBUG_SKETCH_MODE === 'simple-circle') {
        debugLog('debug', '=== DEBUG MODE ACTIVE: Returning hardcoded circle ===');
        return {
            entities: [
                {
                    "btType": "BTMSketchCurve-4",
                    "entityId": "debug_circle_1", 
                    "centerId": "debug_circle_1.center",
                    "isConstruction": false,
                    "parameters": [],
                    "geometry": {
                        "btType": "BTCurveGeometryCircle-115",
                        "radius": 0.05, // 50mm
                        "xCenter": 0.0,
                        "yCenter": 0.0,
                        "xDir": 1,
                        "yDir": 0,
                        "clockwise": false
                    }
                }
            ],
            entityCount: 1
        };
    }
    
    const { scale = 0.001, textAsSketchText = true } = options; // Default scale: 1px = 1mm
    
    const sketchEntities = [];
    let entityCounter = 0;

    // Helper to generate unique IDs
    const nextId = (prefix) => `${prefix}_${entityCounter++}`;

    // 1. Process Geometric Elements
    for (const el of elements) {
        if (el.isHidden || el.elementType === 'use') continue;

        try {
            switch (el.elementType) {
                case 'line':
                    const lStart = applyTransform(el.transform, [el.x1 || 0, el.y1 || 0], scale);
                    const lEnd = applyTransform(el.transform, [el.x2 || 0, el.y2 || 0], scale);
                    sketchEntities.push(BTMFactory.createLineSegment(nextId('line'), lStart, lEnd, el.isConstruction));
                    break;

                case 'rect':
                    // Convert Rect to 4 Lines
                    const rX = el.x || 0;
                    const rY = el.y || 0;
                    const rW = el.width || 0;
                    const rH = el.height || 0;
                    
                    // Define corners in local SVG space
                    const p1 = applyTransform(el.transform, [rX, rY], scale);
                    const p2 = applyTransform(el.transform, [rX + rW, rY], scale);
                    const p3 = applyTransform(el.transform, [rX + rW, rY + rH], scale);
                    const p4 = applyTransform(el.transform, [rX, rY + rH], scale);

                    sketchEntities.push(
                        BTMFactory.createLineSegment(nextId('rect_top'), p1, p2, el.isConstruction),
                        BTMFactory.createLineSegment(nextId('rect_right'), p2, p3, el.isConstruction),
                        BTMFactory.createLineSegment(nextId('rect_bottom'), p3, p4, el.isConstruction),
                        BTMFactory.createLineSegment(nextId('rect_left'), p4, p1, el.isConstruction)
                    );
                    break;

                case 'circle':
                    const cCenter = applyTransform(el.transform, [el.cx || 0, el.cy || 0], scale);
                    // Radius scaling assumes uniform scale. If non-uniform, should be ellipse.
                    // Taking X scale as approximation.
                    const cRadius = (el.r || 0) * scale * getScaleFactor(el.transform);
                    
                    sketchEntities.push(BTMFactory.createCircle(nextId('circle'), cCenter, cRadius, el.isConstruction));
                    break;

                case 'ellipse':
                    const eCenter = applyTransform(el.transform, [el.cx || 0, el.cy || 0], scale);
                    // Approximate radii scaling
                    const scaleFac = getScaleFactor(el.transform);
                    const rx = (el.rx || 0) * scale * scaleFac;
                    const ry = (el.ry || 0) * scale * scaleFac;
                    
                    sketchEntities.push(BTMFactory.createEllipse(nextId('ellipse'), eCenter, rx, ry, el.isConstruction));
                    break;

                case 'path':
                    if (el.d) {
                        const pathEntities = convertPathToBTM(el, scale, nextId);
                        sketchEntities.push(...pathEntities);
                    }
                    break;
            }
        } catch (err) {
            debugLog('error', `Failed to convert element ${el.elementType}: ${err.message}`);
        }
    }

    // 2. Process Text Elements
    if (textAsSketchText) {
        for (const textEl of textElements) {
            try {
                // Approximate baseline start
                const tPos = applyTransform(textEl.transform, [textEl.x || 0, textEl.y || 0], scale);
                // Font size scaling
                const tSize = (textEl.fontSize || 12) * scale * getScaleFactor(textEl.transform);
                
                sketchEntities.push(BTMFactory.createText(
                    nextId('text'),
                    textEl.content,
                    tPos,
                    tSize,
                    textEl.fontFamily
                ));
            } catch (err) {
                debugLog('error', `Failed to convert text: ${err.message}`);
            }
        }
    }

    return {
        entities: sketchEntities,
        arrayFeatures: [], // Array features would be handled separately if implementing OP_PATTERN
        entityCount: sketchEntities.length
    };
}

/**
 * Convert SVG Path Data to BTM Entities
 * Handles M, L, C, Q, Z commands by generating Lines and Splines
 */
function convertPathToBTM(pathEl, scale, idGen) {
    const commands = parsePathData(pathEl.d);
    const entities = [];
    const transform = pathEl.transform || [1, 0, 0, 1, 0, 0];
    const isConstruction = pathEl.isConstruction || false;

    let startPoint = null;
    let currentPoint = null;

    for (const cmd of commands) {
        switch (cmd.cmdType) {
            case 'M': // Move
                currentPoint = applyTransform(transform, cmd.point, scale);
                startPoint = currentPoint;
                break;

            case 'L': // Line
                if (currentPoint) {
                    const endPoint = applyTransform(transform, cmd.point, scale);
                    entities.push(BTMFactory.createLineSegment(idGen('path_line'), currentPoint, endPoint, isConstruction));
                    currentPoint = endPoint;
                }
                break;

            case 'C': // Cubic Bezier
                if (currentPoint) {
                    const p0 = currentPoint;
                    const p1 = applyTransform(transform, cmd.control1, scale);
                    const p2 = applyTransform(transform, cmd.control2, scale);
                    const p3 = applyTransform(transform, cmd.point, scale);

                    entities.push(BTMFactory.createBezier(idGen('path_curve'), [p0, p1, p2, p3], isConstruction));
                    currentPoint = p3;
                }
                break;

            case 'Q': // Quadratic Bezier -> Convert to Cubic
                if (currentPoint) {
                    const p0 = currentPoint;
                    const qc = applyTransform(transform, cmd.control, scale);
                    const p3 = applyTransform(transform, cmd.point, scale);

                    // Degree elevation: Q(p0, qc, p3) -> C(p0, p1, p2, p3)
                    // p1 = p0 + (2/3)*(qc - p0)
                    // p2 = p3 + (2/3)*(qc - p3)
                    const p1 = [
                        p0[0] + (2/3) * (qc[0] - p0[0]),
                        p0[1] + (2/3) * (qc[1] - p0[1])
                    ];
                    const p2 = [
                        p3[0] + (2/3) * (qc[0] - p3[0]),
                        p3[1] + (2/3) * (qc[1] - p3[1])
                    ];

                    entities.push(BTMFactory.createBezier(idGen('path_quad'), [p0, p1, p2, p3], isConstruction));
                    currentPoint = p3;
                }
                break;

            case 'Z': // Close Path
                if (currentPoint && startPoint) {
                    // Avoid zero-length lines if we are already at start
                    const dist = Math.hypot(currentPoint[0] - startPoint[0], currentPoint[1] - startPoint[1]);
                    if (dist > 1e-9) {
                        entities.push(BTMFactory.createLineSegment(idGen('path_close'), currentPoint, startPoint, isConstruction));
                    }
                    currentPoint = startPoint;
                }
                break;
        }
    }
    return entities;
}

/**
 * ------------------------------------------------------------------
 * BTM FACTORY
 * Creates strict JSON structures matching Onshape's "Golden Record"
 * ------------------------------------------------------------------
 */
const BTMFactory = {
    /**
     * Create a Line Segment
     * Geometry: Defined by Midpoint (pntX, pntY), Direction (dirX, dirY)
     * Trimming: Defined by startParam, endParam relative to midpoint
     */
    createLineSegment: (id, start, end, isConstruction = false) => {
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];
        const len = Math.hypot(dx, dy);
        
        // Midpoint
        const midX = (start[0] + end[0]) / 2;
        const midY = (start[1] + end[1]) / 2;

        // Normalized Direction
        // Default to X-axis if length is 0 to avoid NaNs
        const dirX = len > 1e-9 ? dx / len : 1;
        const dirY = len > 1e-9 ? dy / len : 0;

        return {
            "btType": "BTMSketchCurveSegment-155",
            "entityId": id,
            "startPointId": `${id}.start`,
            "endPointId": `${id}.end`,
            "isConstruction": !!isConstruction,
            "parameters": [],
            "geometry": {
                "btType": "BTCurveGeometryLine-117",
                "pntX": midX,
                "pntY": midY,
                "dirX": dirX,
                "dirY": dirY
            },
            // Params are distance from midpoint
            "startParam": -len / 2,
            "endParam": len / 2
        };
    },

    /**
     * Create a Circle
     * Geometry: Defined by Center, Radius, Direction
     */
    createCircle: (id, center, radius, isConstruction = false) => {
        return {
            "btType": "BTMSketchCurve-4",
            "entityId": id,
            "centerId": `${id}.center`,
            "isConstruction": !!isConstruction,
            "parameters": [],
            "geometry": {
                "btType": "BTCurveGeometryCircle-115",
                "radius": radius,
                "xCenter": center[0],
                "yCenter": center[1],
                "xDir": 1,
                "yDir": 0,
                "clockwise": false
            }
        };
    },

    /**
     * Create an Ellipse
     */
    createEllipse: (id, center, majorRadius, minorRadius, isConstruction = false) => {
        return {
            "btType": "BTMSketchCurve-4",
            "entityId": id,
            "centerId": `${id}.center`,
            "isConstruction": !!isConstruction,
            "parameters": [],
            "geometry": {
                "btType": "BTCurveGeometryEllipse-1189",
                "radius": majorRadius, // Major radius
                "minorRadius": minorRadius,
                "xCenter": center[0],
                "yCenter": center[1],
                "xDir": 1, // Assumes axis aligned for now
                "yDir": 0,
                "clockwise": false
            }
        };
    },

    /**
     * Create a Cubic Bezier Spline
     * Points: Array of 4 points [p0, p1, p2, p3]
     */
    createBezier: (id, points, isConstruction = false) => {
        // Flatten points for controlPoints array
        const flatPoints = [];
        points.forEach(p => flatPoints.push(p[0], p[1]));

        return {
            "btType": "BTMSketchCurveSegment-155",
            "entityId": id,
            "startPointId": `${id}.start`,
            "endPointId": `${id}.end`,
            "isConstruction": !!isConstruction,
            "parameters": [],
            "startParam": 0,
            "endParam": 1,
            "geometry": {
                "btType": "BTCurveGeometryControlPointSpline-2197",
                "degree": 3,
                "isBezier": true,
                "isPeriodic": false,
                "isRational": false,
                "controlPointCount": 4,
                "controlPoints": flatPoints,
                // Knots for a standard clamped Bezier: [0,0,0,0, 1,1,1,1]
                "knots": [0, 0, 0, 0, 1, 1, 1, 1]
            }
        };
    },

    /**
     * Create Text Entity
     * Note: BTM text creation can be finicky. This matches the Golden Record structure.
     */
    createText: (id, content, position, size, font) => {
        return {
            "btType": "BTMSketchTextEntity-1761",
            "entityId": id,
            "name": "",
            "isConstruction": false,
            // Baseline defined by position and X-direction
            "baselineStartX": position[0],
            "baselineStartY": position[1],
            "baselineDirectionX": 1,
            "baselineDirectionY": 0,
            "ascent": size, 
            "parameters": [
                {
                    "btType": "BTMParameterString-149",
                    "parameterId": "text",
                    "value": content
                },
                {
                    "btType": "BTMParameterString-149",
                    "parameterId": "fontName",
                    // Use a safe default if font is unknown, Golden record used "CourierPrime-Bold.ttf"
                    "value": "OpenSans-Regular.ttf" 
                }
            ]
        };
    }
};

/**
 * ------------------------------------------------------------------
 * UTILITIES
 * ------------------------------------------------------------------
 */

/**
 * Apply SVG Transform Matrix to a Point [x, y]
 * Transform: [a, b, c, d, e, f] -> x' = ax + cy + e, y' = bx + dy + f
 * Also flips Y-axis for Onshape coordinate system (SVG Y-down -> Onshape Y-up)
 */
function applyTransform(transform, point, scale) {
    // Default Identity
    const t = transform || [1, 0, 0, 1, 0, 0];
    const [a, b, c, d, e, f] = t;
    const x = point[0];
    const y = point[1];

    // Apply affine transform
    const tx = a * x + c * y + e;
    const ty = b * x + d * y + f;

    // Apply global scale and FLIP Y (standard SVG to CAD conversion)
    return [
        tx * scale,
        -ty * scale
    ];
}

/**
 * Extract an approximate scale factor from a transform matrix for scalar values (like radius)
 */
function getScaleFactor(transform) {
    if (!transform) return 1;
    // Magnitude of the X basis vector (a, b)
    const [a, b] = transform;
    return Math.hypot(a, b);
}