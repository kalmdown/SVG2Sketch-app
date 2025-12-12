/**
 * Pattern Analyzer for USE/DEFS Elements
 * 
 * Detects repeated <use> elements that form patterns suitable for
 * Onshape Array features (linear, grid, circular patterns).
 */

import { debugLog } from '../../utils/debug.js';

/**
 * Analyze SVG elements to detect patterns
 * @param {Array} elements - Parsed SVG elements (after expandUseElements)
 * @returns {Array} Array of detected patterns
 */
export function detectPatterns(elements) {
    const patterns = [];
    
    // Group elements by their sourceUseHref (elements created from <use>)
    const useGroups = new Map();
    
    elements.forEach((el, index) => {
        if (el.sourceUseHref) {
            if (!useGroups.has(el.sourceUseHref)) {
                useGroups.set(el.sourceUseHref, []);
            }
            useGroups.get(el.sourceUseHref).push({ element: el, index });
        }
    });
    
    // Analyze each group for patterns
    useGroups.forEach((instances, href) => {
        if (instances.length < 2) {
            // Need at least 2 instances to form a pattern
            return;
        }
        
        // Extract positions and transforms
        const positions = instances.map(({ element }) => {
            const transform = element.transform || [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
            // Transform matrix [a, b, c, d, e, f] - e and f are translation
            return {
                x: transform[4],
                y: transform[5],
                transform: transform
            };
        });
        
        // Try to detect linear pattern
        const linearPattern = detectLinearPattern(positions, href, instances[0].element);
        if (linearPattern) {
            patterns.push(linearPattern);
            return;
        }
        
        // Try to detect grid pattern
        const gridPattern = detectGridPattern(positions, href, instances[0].element);
        if (gridPattern) {
            patterns.push(gridPattern);
            return;
        }
        
        // Try to detect circular pattern
        const circularPattern = detectCircularPattern(positions, href, instances[0].element);
        if (circularPattern) {
            patterns.push(circularPattern);
            return;
        }
    });
    
    return patterns;
}

/**
 * Detect linear (1D) pattern
 */
function detectLinearPattern(positions, href, baseElement) {
    if (positions.length < 2) return null;
    
    // Calculate differences between consecutive positions
    const deltas = [];
    for (let i = 1; i < positions.length; i++) {
        const dx = positions[i].x - positions[i - 1].x;
        const dy = positions[i].y - positions[i - 1].y;
        deltas.push({ dx, dy, distance: Math.sqrt(dx * dx + dy * dy) });
    }
    
    // Check if all deltas are approximately equal (within tolerance)
    const tolerance = 0.01; // 1% tolerance
    const firstDistance = deltas[0].distance;
    
    if (firstDistance < 0.001) return null; // Too close together
    
    const allSimilar = deltas.every(delta => {
        const ratio = delta.distance / firstDistance;
        return Math.abs(ratio - 1.0) < tolerance;
    });
    
    if (!allSimilar) return null;
    
    // Check if all deltas are in the same direction
    const firstDx = deltas[0].dx;
    const firstDy = deltas[0].dy;
    const allSameDirection = deltas.every(delta => {
        const dotProduct = (delta.dx * firstDx + delta.dy * firstDy) / (delta.distance * firstDistance);
        return dotProduct > 0.99; // Almost parallel
    });
    
    if (!allSameDirection) return null;
    
    // Calculate direction vector (normalized)
    const direction = {
        x: firstDx / firstDistance,
        y: firstDy / firstDistance
    };
    
    return {
        type: 'linear',
        href: href,
        elementType: baseElement.elementType,
        count: positions.length,
        spacing: firstDistance,
        direction: direction,
        startPosition: { x: positions[0].x, y: positions[0].y },
        instances: positions.length,
        estimatedReduction: `${positions.length} instances → 1 array feature`
    };
}

/**
 * Detect grid (2D) pattern
 */
function detectGridPattern(positions, href, baseElement) {
    if (positions.length < 4) return null;
    
    // Try to find rows and columns
    // Group by Y coordinate (rows)
    const yGroups = new Map();
    positions.forEach(pos => {
        const yKey = Math.round(pos.y * 100) / 100; // Round to 0.01
        if (!yGroups.has(yKey)) {
            yGroups.set(yKey, []);
        }
        yGroups.get(yKey).push(pos);
    });
    
    // Check if we have multiple rows
    if (yGroups.size < 2) return null;
    
    // Check if rows have same number of elements
    const rowSizes = Array.from(yGroups.values()).map(row => row.length);
    const firstRowSize = rowSizes[0];
    const allRowsSameSize = rowSizes.every(size => size === firstRowSize);
    
    if (!allRowsSameSize || firstRowSize < 2) return null;
    
    // Check if rows are evenly spaced
    const yCoords = Array.from(yGroups.keys()).sort((a, b) => a - b);
    const rowSpacings = [];
    for (let i = 1; i < yCoords.length; i++) {
        rowSpacings.push(yCoords[i] - yCoords[i - 1]);
    }
    
    const firstRowSpacing = rowSpacings[0];
    const tolerance = 0.01;
    const rowsEvenlySpaced = rowSpacings.every(spacing => 
        Math.abs(spacing / firstRowSpacing - 1.0) < tolerance
    );
    
    if (!rowsEvenlySpaced) return null;
    
    // Check if columns are evenly spaced within each row
    const firstRow = yGroups.get(yCoords[0]);
    firstRow.sort((a, b) => a.x - b.x);
    
    const colSpacings = [];
    for (let i = 1; i < firstRow.length; i++) {
        colSpacings.push(firstRow[i].x - firstRow[i - 1].x);
    }
    
    const firstColSpacing = colSpacings[0];
    const colsEvenlySpaced = colSpacings.every(spacing =>
        Math.abs(spacing / firstColSpacing - 1.0) < tolerance
    );
    
    if (!colsEvenlySpaced) return null;
    
    // Verify all rows have same column spacing
    let allRowsValid = true;
    for (let i = 1; i < yCoords.length; i++) {
        const row = yGroups.get(yCoords[i]);
        row.sort((a, b) => a.x - b.x);
        for (let j = 1; j < row.length; j++) {
            const spacing = row[j].x - row[j - 1].x;
            if (Math.abs(spacing / firstColSpacing - 1.0) >= tolerance) {
                allRowsValid = false;
                break;
            }
        }
        if (!allRowsValid) break;
    }
    
    if (!allRowsValid) return null;
    
    return {
        type: 'grid',
        href: href,
        elementType: baseElement.elementType,
        rowCount: yGroups.size,
        colCount: firstRowSize,
        rowSpacing: firstRowSpacing,
        colSpacing: firstColSpacing,
        startPosition: { x: firstRow[0].x, y: yCoords[0] },
        instances: positions.length,
        estimatedReduction: `${positions.length} instances → 1 array feature`
    };
}

/**
 * Detect circular/radial pattern
 */
function detectCircularPattern(positions, href, baseElement) {
    if (positions.length < 3) return null;
    
    // Find center point (average of all positions as approximation)
    const centerX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
    const centerY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;
    
    // Calculate distances from center
    const distances = positions.map(pos => {
        const dx = pos.x - centerX;
        const dy = pos.y - centerY;
        return Math.sqrt(dx * dx + dy * dy);
    });
    
    // Check if all distances are approximately equal (circular pattern)
    const firstDistance = distances[0];
    const tolerance = 0.01;
    const allSameRadius = distances.every(dist =>
        Math.abs(dist / firstDistance - 1.0) < tolerance
    );
    
    if (!allSameRadius) return null;
    
    // Calculate angles
    const angles = positions.map(pos => {
        const dx = pos.x - centerX;
        const dy = pos.y - centerY;
        return Math.atan2(dy, dx);
    });
    
    angles.sort((a, b) => a - b);
    
    // Check if angles are evenly spaced
    const angleDiffs = [];
    for (let i = 1; i < angles.length; i++) {
        angleDiffs.push(angles[i] - angles[i - 1]);
    }
    // Handle wrap-around
    angleDiffs.push((angles[0] + 2 * Math.PI) - angles[angles.length - 1]);
    
    const expectedAngle = (2 * Math.PI) / positions.length;
    const angleTolerance = 0.1; // radians
    
    const evenlySpaced = angleDiffs.every(diff =>
        Math.abs(diff - expectedAngle) < angleTolerance
    );
    
    if (!evenlySpaced) return null;
    
    return {
        type: 'circular',
        href: href,
        elementType: baseElement.elementType,
        count: positions.length,
        radius: firstDistance,
        center: { x: centerX, y: centerY },
        startAngle: angles[0],
        instances: positions.length,
        estimatedReduction: `${positions.length} instances → 1 array feature`
    };
}

/**
 * Get pattern description for UI display
 */
export function getPatternDescription(pattern) {
    switch (pattern.type) {
        case 'linear':
            return `Linear: ${pattern.count} instances, spacing ${pattern.spacing.toFixed(2)}`;
        case 'grid':
            return `Grid: ${pattern.rowCount}×${pattern.colCount} (${pattern.instances} total), row spacing ${pattern.rowSpacing.toFixed(2)}, col spacing ${pattern.colSpacing.toFixed(2)}`;
        case 'circular':
            return `Circular: ${pattern.count} instances, radius ${pattern.radius.toFixed(2)}`;
        default:
            return `Pattern: ${pattern.instances} instances`;
    }
}





