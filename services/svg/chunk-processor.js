/**
 * Chunk Processor for Large SVG Files
 * 
 * Handles processing of SVG files larger than 100k by splitting them
 * into manageable chunks, processing each, and merging results.
 */

import { parseSVGElements } from './svg-parser.js';
import { debugLog } from '../../utils/debug.js';

const CHUNK_SIZE = 50000; // Process 50k characters at a time

/**
 * Process a large SVG file in chunks
 * @param {string} svgContent - Full SVG content
 * @param {Object} options - Processing options
 * @returns {Promise<Array>} - Merged array of parsed elements
 */
export async function processLargeSVG(svgContent, options = {}) {
    const { debug = false } = options;
    
    if (svgContent.length <= 100000) {
        // Small enough to process normally
        if (debug) {
            debugLog('chunk', `Processing small file (${svgContent.length} chars) normally`);
        }
        return parseSVGElements(svgContent);
    }
    
    if (debug) {
        debugLog('chunk', `Processing large file (${svgContent.length} chars) in chunks`);
    }
    
    // For very large files, we need a different strategy
    // Since SVG elements can span chunks, we'll use a sliding window approach
    
    const elements = [];
    let position = 0;
    let chunkNumber = 0;
    
    // Find all top-level element boundaries (rough approximation)
    const elementBoundaries = findElementBoundaries(svgContent);
    
    if (debug) {
        debugLog('chunk', `Found ${elementBoundaries.length} potential element boundaries`);
    }
    
    // Process in chunks based on element boundaries
    while (position < svgContent.length) {
        const chunkEnd = Math.min(position + CHUNK_SIZE, svgContent.length);
        
        // Find the nearest element boundary after chunkEnd to avoid splitting elements
        let safeEnd = chunkEnd;
        for (const boundary of elementBoundaries) {
            if (boundary > chunkEnd && boundary < chunkEnd + 1000) {
                safeEnd = boundary;
                break;
            }
        }
        
        // If we're near the end, use the full remaining content
        if (safeEnd >= svgContent.length - 100) {
            safeEnd = svgContent.length;
        }
        
        const chunk = svgContent.substring(position, safeEnd);
        
        if (debug) {
            debugLog('chunk', `Processing chunk ${chunkNumber + 1} (${chunk.length} chars, pos ${position}-${safeEnd})`);
        }
        
        try {
            // Parse this chunk
            // Note: This may create incomplete elements at boundaries
            const chunkElements = parseSVGElements(chunk);
            
            // Filter out incomplete elements (those that might be split)
            const completeElements = filterCompleteElements(chunkElements, chunk);
            
            elements.push(...completeElements);
            
            if (debug) {
                debugLog('chunk', `Chunk ${chunkNumber + 1}: Found ${completeElements.length} complete elements`);
            }
        } catch (error) {
            debugLog('error', `Error processing chunk ${chunkNumber + 1}:`, error.message);
            // Continue with next chunk
        }
        
        position = safeEnd;
        chunkNumber++;
        
        // Safety limit
        if (chunkNumber > 1000) {
            debugLog('error', 'Too many chunks, stopping');
            break;
        }
    }
    
    if (debug) {
        debugLog('chunk', `Processed ${chunkNumber} chunks, found ${elements.length} total elements`);
    }
    
    // Final pass: re-parse the entire file if it's not too large
    // This ensures we catch any elements that were split across chunks
    if (svgContent.length < 500000) {
        if (debug) {
            debugLog('chunk', 'Re-parsing entire file to catch split elements');
        }
        try {
            const allElements = parseSVGElements(svgContent);
            return allElements;
        } catch (error) {
            debugLog('error', 'Error in final full parse, using chunked results:', error.message);
            return elements;
        }
    }
    
    return elements;
}

/**
 * Find approximate element boundaries in SVG
 * Looks for closing tags that likely indicate element boundaries
 */
function findElementBoundaries(svgContent) {
    const boundaries = [0]; // Start is always a boundary
    const tagPattern = /<\/[^>]+>/g;
    let match;
    
    while ((match = tagPattern.exec(svgContent)) !== null) {
        boundaries.push(match.index + match[0].length);
    }
    
    boundaries.push(svgContent.length); // End is always a boundary
    
    return boundaries;
}

/**
 * Filter out elements that might be incomplete due to chunking
 */
function filterCompleteElements(elements, chunk) {
    // For now, return all elements
    // A more sophisticated approach would check if elements are properly closed
    return elements;
}

/**
 * Check if an SVG file needs chunked processing
 */
export function needsChunkedProcessing(svgContent) {
    return svgContent.length > 100000;
}





