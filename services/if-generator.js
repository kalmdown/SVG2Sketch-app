/**
 * Intermediate Format (IF) Generator
 * 
 * Converts parsed SVG elements into a simplified command format that
 * FeatureScript v47 can parse more easily than raw SVG.
 * 
 * Format Specification:
 * - Commands are line-based, one command per line
 * - Commands map directly to FeatureScript drawing operations
 * - Supports: M (move), L (line), C (cubic bezier), Q (quadratic), A (arc), Z (close)
 * - Supports: CIRCLE, RECT, ELLIPSE, LINE
 * - Supports: ARRAY_LINEAR, ARRAY_GRID, ARRAY_CIRCULAR for patterns
 */

import { debugLog } from '../utils/debug.js';
import { parsePathData } from './svg/path-parser.js';

/**
 * Generate Intermediate Format from parsed SVG elements
 * @param {Array} elements - Parsed SVG elements
 * @param {Array} textElements - Parsed text elements (for future text-to-path conversion)
 * @param {Array} patterns - Detected patterns from pattern-analyzer
 * @param {Object} options - Conversion options
 * @returns {string} Intermediate Format string
 */
export function generateIntermediateFormat(elements, textElements = [], patterns = [], options = {}) {
    const { scale = 0.001 } = options; // Default: 1px = 1mm
    const lines = [];
    
    // Header
    lines.push('# Intermediate Format for SVG to Sketch v47');
    lines.push(`# Scale: ${scale}`);
    lines.push('');
    
    // Process patterns first (they contain references to elements)
    const patternElements = new Set();
    patterns.forEach(pattern => {
        if (pattern.href) {
            // Mark elements from this pattern
            elements.forEach((el, idx) => {
                if (el.sourceUseHref === pattern.href) {
                    patternElements.add(idx);
                }
            });
        }
    });
    
    // Group elements by pattern
    const patternGroups = new Map();
    patterns.forEach((pattern, patternIdx) => {
        if (pattern.href) {
            const groupElements = elements
                .map((el, idx) => ({ el, idx }))
                .filter(({ el, idx }) => el.sourceUseHref === pattern.href && !el.isHidden);
            
            if (groupElements.length > 0) {
                patternGroups.set(patternIdx, { pattern, elements: groupElements });
            }
        }
    });
    
    // Process non-pattern elements first
    elements.forEach((el, idx) => {
        if (patternElements.has(idx) || el.isHidden || el.elementType === 'use') {
            return; // Skip - will be handled by pattern
        }
        
        try {
            const commands = elementToIFCommands(el, scale);
            if (commands && commands.length > 0) {
                lines.push(...commands);
            }
        } catch (error) {
            debugLog('error', `Failed to convert element ${idx} to IF: ${error.message}`);
        }
    });
    
    // Process patterns
    patternGroups.forEach(({ pattern, elements: patternEls }) => {
        lines.push('');
        lines.push(`# Pattern: ${pattern.type} (${pattern.instances} instances)`);
        
        // Generate array command
        const arrayCommand = patternToIFCommand(pattern);
        if (arrayCommand) {
            lines.push(arrayCommand);
        }
        
        // Generate base element (first instance)
        if (patternEls.length > 0) {
            const baseEl = patternEls[0].el;
            const commands = elementToIFCommands(baseEl, scale, true); // true = relative to pattern start
            if (commands && commands.length > 0) {
                lines.push('BEGIN_PATTERN');
                lines.push(...commands);
                lines.push('END_PATTERN');
            }
        }
    });
    
    return lines.join('\n');
}

/**
 * Convert a single SVG element to IF commands
 * @param {Object} el - Parsed SVG element
 * @param {number} scale - Scale factor
 * @param {boolean} relativeToPattern - If true, positions are relative to pattern start
 * @returns {Array<string>} Array of IF command strings
 */
function elementToIFCommands(el, scale, relativeToPattern = false) {
    const commands = [];
    const transform = el.transform || [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
    
    switch (el.elementType) {
        case 'line':
            const lStart = applyTransform(transform, [el.x1 || 0, el.y1 || 0], scale);
            const lEnd = applyTransform(transform, [el.x2 || 0, el.y2 || 0], scale);
            commands.push(`LINE ${formatPoint(lStart)} ${formatPoint(lEnd)} ${el.isConstruction ? 'CONSTRUCTION' : ''}`);
            break;
            
        case 'rect':
            const rX = el.x || 0;
            const rY = el.y || 0;
            const rW = el.width || 0;
            const rH = el.height || 0;
            
            // Convert to path commands
            const p1 = applyTransform(transform, [rX, rY], scale);
            const p2 = applyTransform(transform, [rX + rW, rY], scale);
            const p3 = applyTransform(transform, [rX + rW, rY + rH], scale);
            const p4 = applyTransform(transform, [rX, rY + rH], scale);
            
            commands.push(`RECT ${formatPoint(p1)} ${formatPoint(p2)} ${formatPoint(p3)} ${formatPoint(p4)} ${el.isConstruction ? 'CONSTRUCTION' : ''}`);
            break;
            
        case 'circle':
            const cCenter = applyTransform(transform, [el.cx || 0, el.cy || 0], scale);
            const cRadius = (el.r || 0) * scale * getScaleFactor(transform);
            commands.push(`CIRCLE ${formatPoint(cCenter)} ${cRadius} ${el.isConstruction ? 'CONSTRUCTION' : ''}`);
            break;
            
        case 'ellipse':
            const eCenter = applyTransform(transform, [el.cx || 0, el.cy || 0], scale);
            const eRx = (el.rx || 0) * scale * getScaleFactor(transform);
            const eRy = (el.ry || 0) * scale * getScaleFactor(transform);
            commands.push(`ELLIPSE ${formatPoint(eCenter)} ${eRx} ${eRy} ${el.isConstruction ? 'CONSTRUCTION' : ''}`);
            break;
            
        case 'path':
            const pathCommands = pathToIFCommands(el, scale);
            if (pathCommands && pathCommands.length > 0) {
                commands.push(...pathCommands);
            }
            break;
            
        default:
            debugLog('warn', `Unsupported element type for IF: ${el.elementType}`);
    }
    
    return commands;
}

/**
 * Convert SVG path to IF commands
 * @param {Object} pathEl - Path element with 'd' attribute
 * @param {number} scale - Scale factor
 * @returns {Array<string>} Array of IF command strings
 */
function pathToIFCommands(pathEl, scale) {
    if (!pathEl.d || pathEl.d.length === 0) {
        return [];
    }
    
    const commands = [];
    const pathCommands = parsePathData(pathEl.d);
    const transform = pathEl.transform || [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
    const isConstruction = pathEl.isConstruction || false;
    
    for (const cmd of pathCommands) {
        switch (cmd.cmdType) {
            case 'M': // Move
                const movePoint = applyTransform(transform, cmd.point, scale);
                commands.push(`M ${formatPoint(movePoint)}`);
                break;
                
            case 'L': // Line
                const linePoint = applyTransform(transform, cmd.point, scale);
                commands.push(`L ${formatPoint(linePoint)}`);
                break;
                
            case 'C': // Cubic Bezier
                const c1 = applyTransform(transform, cmd.control1, scale);
                const c2 = applyTransform(transform, cmd.control2, scale);
                const cEnd = applyTransform(transform, cmd.point, scale);
                commands.push(`C ${formatPoint(c1)} ${formatPoint(c2)} ${formatPoint(cEnd)}`);
                break;
                
            case 'Q': // Quadratic Bezier
                const qControl = applyTransform(transform, cmd.control, scale);
                const qEnd = applyTransform(transform, cmd.point, scale);
                commands.push(`Q ${formatPoint(qControl)} ${formatPoint(qEnd)}`);
                break;
                
            case 'A': // Arc
                const aRx = (cmd.rx || 0) * scale * getScaleFactor(transform);
                const aRy = (cmd.ry || 0) * scale * getScaleFactor(transform);
                const aRotation = cmd.rotation || 0;
                const aLargeArc = cmd.largeArc ? 1 : 0;
                const aSweep = cmd.sweep ? 1 : 0;
                const aEnd = applyTransform(transform, cmd.point, scale);
                commands.push(`A ${aRx} ${aRy} ${aRotation} ${aLargeArc} ${aSweep} ${formatPoint(aEnd)}`);
                break;
                
            case 'Z': // Close path
                commands.push('Z');
                break;
        }
    }
    
    if (isConstruction && commands.length > 0) {
        // Mark path as construction
        commands[0] = commands[0] + ' CONSTRUCTION';
    }
    
    return commands;
}

/**
 * Convert pattern to IF array command
 * @param {Object} pattern - Pattern object from pattern-analyzer
 * @returns {string|null} IF array command or null
 */
function patternToIFCommand(pattern) {
    switch (pattern.type) {
        case 'linear':
            return `ARRAY_LINEAR ${pattern.count} ${pattern.spacing} ${pattern.direction.x} ${pattern.direction.y}`;
            
        case 'grid':
            return `ARRAY_GRID ${pattern.rowCount} ${pattern.colCount} ${pattern.rowSpacing} ${pattern.colSpacing}`;
            
        case 'circular':
            return `ARRAY_CIRCULAR ${pattern.count} ${pattern.radius} ${pattern.center.x} ${pattern.center.y} ${pattern.startAngle}`;
            
        default:
            return null;
    }
}

/**
 * Apply transform matrix to a point
 * @param {Array<number>} transform - [a, b, c, d, e, f] matrix
 * @param {Array<number>} point - [x, y]
 * @param {number} scale - Additional scale factor
 * @returns {Array<number>} Transformed [x, y]
 */
function applyTransform(transform, point, scale) {
    const [a, b, c, d, e, f] = transform;
    const [x, y] = point;
    
    // Apply matrix transformation: [a c e] [x]   [a*x + c*y + e]
    //                              [b d f] [y] = [b*x + d*y + f]
    //                              [0 0 1] [1]   [1]
    const tx = a * x + c * y + e;
    const ty = b * x + d * y + f;
    
    return [tx * scale, ty * scale];
}

/**
 * Get scale factor from transform matrix
 * @param {Array<number>} transform - [a, b, c, d, e, f] matrix
 * @returns {number} Scale factor
 */
function getScaleFactor(transform) {
    const [a, b, c, d] = transform;
    // Scale is the magnitude of the first column vector
    return Math.sqrt(a * a + b * b);
}

/**
 * Format point for IF output
 * @param {Array<number>} point - [x, y]
 * @returns {string} Formatted point string
 */
function formatPoint(point) {
    return `${point[0].toFixed(6)} ${point[1].toFixed(6)}`;
}

