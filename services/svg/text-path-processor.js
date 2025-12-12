/**
 * Text Path Processor
 * 
 * Parses SVG <textPath> elements and calculates text positioning along paths.
 */

import { extractAttribute, parseSVGElements } from './svg-parser.js';
import { debugLog } from '../../utils/debug.js';

/**
 * Parse textPath elements from SVG content
 * @param {string} svgContent - SVG content string
 * @returns {Array} Array of parsed textPath elements
 */
export function parseTextPathElements(svgContent) {
    const textPathElements = [];
    let position = 0;
    
    while (position < svgContent.length) {
        // Find <textPath> tags (inside <text> elements)
        const textPathStart = svgContent.indexOf('<textPath', position);
        if (textPathStart === -1) break;
        
        // Find the closing </textPath> tag
        const textPathEnd = svgContent.indexOf('</textPath>', textPathStart);
        if (textPathEnd === -1) break;
        
        const textPathTag = svgContent.substring(textPathStart, svgContent.indexOf('>', textPathStart) + 1);
        const textPathContent = svgContent.substring(
            svgContent.indexOf('>', textPathStart) + 1,
            textPathEnd
        );
        
        // Find parent <text> element
        const textStart = svgContent.lastIndexOf('<text', textPathStart);
        if (textStart === -1) {
            position = textPathEnd + 11;
            continue;
        }
        
        const textTag = svgContent.substring(textStart, svgContent.indexOf('>', textStart) + 1);
        
        // Extract textPath element properties
        const textPathElement = parseTextPathElement(textPathTag, textPathTag, textPathContent);
        if (textPathElement) {
            textPathElements.push(textPathElement);
        }
        
        position = textPathEnd + 11; // Move past </textPath>
    }
    
    return textPathElements;
}

/**
 * Parse a single <textPath> element
 */
function parseTextPathElement(textTag, textPathTag, textPathContent) {
    // Extract href to referenced path
    let href = extractAttribute(textPathTag, 'href');
    if (href.length === 0) {
        href = extractAttribute(textPathTag, 'xlink:href');
    }
    
    // Strip leading '#'
    if (href.charAt(0) === '#') {
        href = href.substring(1);
    }
    
    const element = {
        elementType: 'textPath',
        content: textPathContent.replace(/<[^>]+>/g, '').trim(),
        pathId: href,
        startOffset: parseFloat(extractAttribute(textPathTag, 'startOffset') || '0')
    };
    
    // Get text element properties
    element.x = parseFloat(extractAttribute(textTag, 'x') || '0');
    element.y = parseFloat(extractAttribute(textTag, 'y') || '0');
    element.fontSize = parseFloat(extractAttribute(textTag, 'font-size') || '12');
    element.fontFamily = extractAttribute(textTag, 'font-family') || 'sans-serif';
    
    // Parse transform from parent text element
    const transformAttr = extractAttribute(textTag, 'transform');
    if (transformAttr.length > 0) {
        // Will be parsed later when we have the transform parser available
        element.transformAttr = transformAttr;
    }
    
    return element;
}

/**
 * Calculate text positions along a path
 * @param {Object} textPathElement - Parsed textPath element
 * @param {string} pathData - SVG path data (d attribute)
 * @returns {Array} Array of character positions along path
 */
export function calculateTextOnPath(textPathElement, pathData) {
    // This is a simplified implementation
    // A full implementation would:
    // 1. Parse the path data into segments
    // 2. Calculate cumulative length along path
    // 3. Position each character at appropriate distance along path
    // 4. Calculate rotation for each character based on path tangent
    
    const positions = [];
    const content = textPathElement.content;
    const startOffset = textPathElement.startOffset || 0;
    
    // For now, return approximate positions
    // Full implementation would require path length calculation
    for (let i = 0; i < content.length; i++) {
        positions.push({
            character: content.charAt(i),
            position: [startOffset + i * textPathElement.fontSize * 0.6, 0],
            rotation: 0 // Would be calculated from path tangent
        });
    }
    
    return positions;
}

/**
 * Convert textPath to sketch text entities positioned along path
 * @param {Object} textPathElement - Parsed textPath element
 * @param {string} pathData - SVG path data
 * @param {number} scale - Scale factor
 * @returns {Array} Array of sketch text entities
 */
export function convertTextPathToSketchText(textPathElement, pathData, scale = 1.0) {
    const positions = calculateTextOnPath(textPathElement, pathData);
    
    return positions.map(pos => ({
        type: 'sketchText',
        text: pos.character,
        position: [pos.position[0] * scale, -pos.position[1] * scale], // Flip Y
        fontSize: textPathElement.fontSize * scale,
        fontFamily: textPathElement.fontFamily,
        rotation: pos.rotation
    }));
}

/**
 * Convert textPath to path-based text outlines (fallback)
 * This would require font-to-path conversion, which is complex
 * For now, return a placeholder
 */
export function convertTextPathToPaths(textPathElement, pathData, scale = 1.0) {
    // TODO: Implement font-to-path conversion
    // This would involve:
    // 1. Getting font glyph outlines
    // 2. Converting to SVG paths
    // 3. Positioning along the textPath
    // 4. Applying transforms
    
    debugLog('textPath', 'Text-to-path conversion not yet implemented');
    return [];
}





