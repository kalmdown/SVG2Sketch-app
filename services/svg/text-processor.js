/**
 * Text Element Processor
 * 
 * Parses SVG <text> and <tspan> elements and extracts text content,
 * position, font properties, and transforms.
 */

import { extractAttribute, parseAttributeNumber, parseTransform, multiplyMatrices } from './svg-parser.js';
import { debugLog } from '../../utils/debug.js';

/**
 * Parse text elements from SVG content
 * @param {string} svgContent - SVG content string
 * @returns {Array} Array of parsed text elements
 */
export function parseTextElements(svgContent) {
    const textElements = [];
    let position = 0;
    
    while (position < svgContent.length) {
        // Find <text> tags
        const textStart = svgContent.indexOf('<text', position);
        if (textStart === -1) break;
        
        // Find the closing </text> tag
        const textEnd = svgContent.indexOf('</text>', textStart);
        if (textEnd === -1) break;
        
        const textTag = svgContent.substring(textStart, svgContent.indexOf('>', textStart) + 1);
        const textContent = svgContent.substring(
            svgContent.indexOf('>', textStart) + 1,
            textEnd
        );
        
        // Extract text element properties
        const textElement = parseTextElement(textTag, textContent);
        if (textElement) {
            textElements.push(textElement);
        }
        
        position = textEnd + 7; // Move past </text>
    }
    
    return textElements;
}

/**
 * Parse a single <text> element
 */
function parseTextElement(textTag, textContent) {
    const element = {
        elementType: 'text',
        content: extractTextContent(textContent),
        x: parseAttributeNumber(textTag, 'x', 0.0),
        y: parseAttributeNumber(textTag, 'y', 0.0),
        fontSize: parseAttributeNumber(textTag, 'font-size', 12.0),
        fontFamily: extractAttribute(textTag, 'font-family') || 'sans-serif',
        textAnchor: extractAttribute(textTag, 'text-anchor') || 'start',
        transform: [1.0, 0.0, 0.0, 1.0, 0.0, 0.0]
    };
    
    // Extract id if present
    const idAttr = extractAttribute(textTag, 'id');
    if (idAttr.length > 0) {
        element.id = idAttr;
    }
    
    // Parse transform
    const transformAttr = extractAttribute(textTag, 'transform');
    if (transformAttr.length > 0) {
        element.transform = parseTransform(transformAttr);
    }
    
    // Parse style attribute for additional properties
    const styleAttr = extractAttribute(textTag, 'style');
    if (styleAttr.length > 0) {
        parseStyleAttributes(styleAttr, element);
    }
    
    // Parse nested <tspan> elements
    element.tspans = parseTspanElements(textContent);
    
    return element;
}

/**
 * Extract text content, handling nested <tspan> elements
 */
function extractTextContent(textContent) {
    // Remove all XML tags to get plain text
    return textContent.replace(/<[^>]+>/g, '').trim();
}

/**
 * Parse <tspan> elements within text content
 */
function parseTspanElements(textContent) {
    const tspans = [];
    let position = 0;
    
    while (position < textContent.length) {
        const tspanStart = textContent.indexOf('<tspan', position);
        if (tspanStart === -1) break;
        
        const tspanEnd = textContent.indexOf('</tspan>', tspanStart);
        if (tspanEnd === -1) break;
        
        const tspanTag = textContent.substring(tspanStart, textContent.indexOf('>', tspanStart) + 1);
        const tspanContent = textContent.substring(
            textContent.indexOf('>', tspanStart) + 1,
            tspanEnd
        );
        
        const tspan = {
            content: tspanContent.replace(/<[^>]+>/g, '').trim(),
            x: parseAttributeNumber(tspanTag, 'x', undefined),
            y: parseAttributeNumber(tspanTag, 'y', undefined),
            dx: parseAttributeNumber(tspanTag, 'dx', 0.0),
            dy: parseAttributeNumber(tspanTag, 'dy', 0.0)
        };
        
        tspans.push(tspan);
        position = tspanEnd + 8; // Move past </tspan>
    }
    
    return tspans;
}

/**
 * Parse style attribute and extract relevant properties
 */
function parseStyleAttributes(styleAttr, element) {
    // Extract font-size from style
    const fontSizeMatch = styleAttr.match(/font-size:\s*([^;]+)/i);
    if (fontSizeMatch) {
        const fontSizeStr = fontSizeMatch[1].trim();
        const fontSizeNum = parseFloat(fontSizeStr);
        if (!isNaN(fontSizeNum)) {
            element.fontSize = fontSizeNum;
        }
    }
    
    // Extract font-family from style
    const fontFamilyMatch = styleAttr.match(/font-family:\s*([^;]+)/i);
    if (fontFamilyMatch) {
        element.fontFamily = fontFamilyMatch[1].trim().replace(/['"]/g, '');
    }
    
    // Extract text-anchor from style
    const textAnchorMatch = styleAttr.match(/text-anchor:\s*([^;]+)/i);
    if (textAnchorMatch) {
        element.textAnchor = textAnchorMatch[1].trim();
    }
}

/**
 * Convert text element to Onshape sketch text format
 * @param {Object} textElement - Parsed text element
 * @param {number} scale - Scale factor
 * @returns {Object} Onshape sketch text entity
 */
export function convertTextToSketchText(textElement, scale = 1.0) {
    // Calculate position with text anchor
    let x = textElement.x * scale;
    let y = -textElement.y * scale; // Flip Y for Onshape coordinate system
    
    // Adjust for text anchor
    if (textElement.textAnchor === 'middle') {
        // Approximate text width (rough estimate)
        const textWidth = textElement.content.length * textElement.fontSize * 0.6 * scale;
        x -= textWidth / 2;
    } else if (textElement.textAnchor === 'end') {
        const textWidth = textElement.content.length * textElement.fontSize * 0.6 * scale;
        x -= textWidth;
    }
    
    return {
        type: 'sketchText',
        text: textElement.content,
        position: [x, y],
        fontSize: textElement.fontSize * scale,
        fontFamily: textElement.fontFamily,
        transform: textElement.transform
    };
}

/**
 * Check if text can be converted to sketch text (simple text)
 * Complex text with transforms, rotations, or special formatting should be converted to paths
 */
export function canConvertToSketchText(textElement) {
    // Check if transform is not identity (has rotation, scale, etc.)
    const transform = textElement.transform;
    const isIdentity = 
        transform[0] === 1.0 && transform[1] === 0.0 &&
        transform[2] === 0.0 && transform[3] === 1.0 &&
        transform[4] === 0.0 && transform[5] === 0.0;
    
    // Simple text: identity transform, no complex formatting
    return isIdentity && textElement.tspans.length === 0;
}





