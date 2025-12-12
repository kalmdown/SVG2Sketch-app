/**
 * SVG Path Parser
 * 
 * Parses SVG path data (d attribute) into command objects.
 * This is a simplified version - full implementation would port the complete
 * parsePathData function from FeatureScript v46.2
 */

// Import helper functions - these are not exported, so we'll define them locally
// For now, we'll use a simplified version that works with the path parser
import { debugLog } from '../../utils/debug.js';

// Helper functions (copied from svg-parser.js since they're not exported)
function chAt(s, i) {
    if (i < 0 || i >= s.length) return "";
    return s.charAt(i);
}

function isWs(c) {
    if (c === " " || c === "\t" || c === "\n" || c === ",") return true;
    if (c >= "0" && c <= "9") return false;
    if (c === "-" || c === "." || c === "+") return false;
    return false; // Simplified - assume other chars are not whitespace for path parsing
}

function isDigit(c) {
    return c >= "0" && c <= "9";
}

function parseNumber(s, start) {
    let pos = start;
    while (pos < s.length && isWs(chAt(s, pos))) pos++;
    
    const outParts = [];
    if (pos < s.length && (chAt(s, pos) === "+" || chAt(s, pos) === "-")) {
        outParts.push(chAt(s, pos));
        pos++;
    }
    
    let hasDigit = false;
    while (pos < s.length) {
        const c = chAt(s, pos);
        if (isDigit(c) || c === "." || c === "e" || c === "E" || c === "+" || c === "-") {
            outParts.push(c);
            if (isDigit(c)) hasDigit = true;
            pos++;
        } else {
            break;
        }
    }
    
    if (!hasDigit) {
        return { value: 0, endPos: start };
    }
    
    const numStr = outParts.join("");
    const value = parseFloat(numStr);
    return { value: isNaN(value) ? 0 : value, endPos: pos };
}

/**
 * Parse SVG path data string into command array
 * @param {string} pathData - SVG path data (d attribute)
 * @returns {Array} Array of path command objects
 */
export function parsePathData(pathData) {
    if (!pathData || pathData.length === 0) {
        return [];
    }
    
    const commands = [];
    let position = 0;
    let currentPoint = [0.0, 0.0];
    let subpathStart = [0.0, 0.0];
    let lastCommand = '';
    
    while (position < pathData.length) {
        // Skip whitespace
        while (position < pathData.length && isWs(chAt(pathData, position))) {
            position++;
        }
        if (position >= pathData.length) break;
        
        let command = chAt(pathData, position);
        const isExplicit = isCommandChar(command);
        
        if (isExplicit) {
            position++;
            lastCommand = command;
        } else if (lastCommand) {
            // Implicit command repetition
            command = lastCommand;
        } else {
            // No previous command - skip this character
            position++;
            continue;
        }
        
        // Parse command based on type
        const upperCommand = command.toUpperCase();
        
        switch (upperCommand) {
            case 'M':
                const moveResult = parseMoveCommand(pathData, position, command, currentPoint);
                if (moveResult.command) {
                    commands.push(moveResult.command);
                    currentPoint = moveResult.command.point;
                    subpathStart = moveResult.command.point;
                }
                position = moveResult.nextPosition;
                break;
                
            case 'L':
                const lineResult = parseLineCommand(pathData, position, command, currentPoint);
                if (lineResult.command) {
                    commands.push(lineResult.command);
                    currentPoint = lineResult.command.point;
                }
                position = lineResult.nextPosition;
                break;
                
            case 'H':
                const hResult = parseHorizontalCommand(pathData, position, command, currentPoint);
                if (hResult.command) {
                    commands.push(hResult.command);
                    currentPoint = hResult.command.point;
                }
                position = hResult.nextPosition;
                break;
                
            case 'V':
                const vResult = parseVerticalCommand(pathData, position, command, currentPoint);
                if (vResult.command) {
                    commands.push(vResult.command);
                    currentPoint = vResult.command.point;
                }
                position = vResult.nextPosition;
                break;
                
            case 'C':
                const cubicResult = parseCubicBezierCommand(pathData, position, command, currentPoint);
                if (cubicResult.command) {
                    commands.push(cubicResult.command);
                    currentPoint = cubicResult.command.point;
                }
                position = cubicResult.nextPosition;
                break;
                
            case 'S':
                const smoothCubicResult = parseSmoothCubicCommand(pathData, position, command, currentPoint);
                if (smoothCubicResult.command) {
                    commands.push(smoothCubicResult.command);
                    currentPoint = smoothCubicResult.command.point;
                }
                position = smoothCubicResult.nextPosition;
                break;
                
            case 'Q':
                const quadResult = parseQuadraticBezierCommand(pathData, position, command, currentPoint);
                if (quadResult.command) {
                    commands.push(quadResult.command);
                    currentPoint = quadResult.command.point;
                }
                position = quadResult.nextPosition;
                break;
                
            case 'T':
                const smoothQuadResult = parseSmoothQuadraticCommand(pathData, position, command, currentPoint);
                if (smoothQuadResult.command) {
                    commands.push(smoothQuadResult.command);
                    currentPoint = smoothQuadResult.command.point;
                }
                position = smoothQuadResult.nextPosition;
                break;
                
            case 'A':
                const arcResult = parseArcCommand(pathData, position, command, currentPoint);
                if (arcResult.command) {
                    commands.push(arcResult.command);
                    currentPoint = arcResult.command.point;
                }
                position = arcResult.nextPosition;
                break;
                
            case 'Z':
                commands.push({ cmdType: 'Z' });
                currentPoint = subpathStart;
                position++;
                break;
                
            default:
                // Unknown command - skip
                position++;
                break;
        }
    }
    
    return commands;
}

/**
 * Check if character is a path command
 */
function isCommandChar(c) {
    return c === 'M' || c === 'm' || c === 'L' || c === 'l' ||
           c === 'H' || c === 'h' || c === 'V' || c === 'v' ||
           c === 'C' || c === 'c' || c === 'S' || c === 's' ||
           c === 'Q' || c === 'q' || c === 'T' || c === 't' ||
           c === 'A' || c === 'a' || c === 'Z' || c === 'z';
}

/**
 * Parse Move command (M or m)
 */
function parseMoveCommand(pathData, position, command, currentPoint) {
    const pointResult = parsePoint(pathData, position);
    if (pointResult.endPos <= position) {
        return { command: null, nextPosition: position + 1 };
    }
    
    let point = pointResult.point;
    if (command === 'm') {
        // Relative move
        point = [currentPoint[0] + point[0], currentPoint[1] + point[1]];
    }
    
    return {
        command: { cmdType: 'M', point: point },
        nextPosition: pointResult.endPos
    };
}

/**
 * Parse Line command (L or l)
 */
function parseLineCommand(pathData, position, command, currentPoint) {
    const pointResult = parsePoint(pathData, position);
    if (pointResult.endPos <= position) {
        return { command: null, nextPosition: position + 1 };
    }
    
    let point = pointResult.point;
    if (command === 'l') {
        // Relative line
        point = [currentPoint[0] + point[0], currentPoint[1] + point[1]];
    }
    
    return {
        command: { cmdType: 'L', point: point },
        nextPosition: pointResult.endPos
    };
}

/**
 * Parse Horizontal line command (H or h)
 */
function parseHorizontalCommand(pathData, position, command, currentPoint) {
    const numResult = parseNumber(pathData, position);
    if (numResult.endPos <= position) {
        return { command: null, nextPosition: position + 1 };
    }
    
    let x = numResult.value;
    if (command === 'h') {
        // Relative horizontal
        x = currentPoint[0] + x;
    }
    
    const point = [x, currentPoint[1]];
    
    return {
        command: { cmdType: 'L', point: point },
        nextPosition: numResult.endPos
    };
}

/**
 * Parse Vertical line command (V or v)
 */
function parseVerticalCommand(pathData, position, command, currentPoint) {
    const numResult = parseNumber(pathData, position);
    if (numResult.endPos <= position) {
        return { command: null, nextPosition: position + 1 };
    }
    
    let y = numResult.value;
    if (command === 'v') {
        // Relative vertical
        y = currentPoint[1] + y;
    }
    
    const point = [currentPoint[0], y];
    
    return {
        command: { cmdType: 'L', point: point },
        nextPosition: numResult.endPos
    };
}

/**
 * Parse Cubic Bezier command (C or c)
 */
function parseCubicBezierCommand(pathData, position, command, currentPoint) {
    const c1Result = parsePoint(pathData, position);
    if (c1Result.endPos <= position) {
        return { command: null, nextPosition: position + 1 };
    }
    
    let c1 = c1Result.point;
    let nextPos = c1Result.endPos;
    
    const c2Result = parsePoint(pathData, nextPos);
    if (c2Result.endPos <= nextPos) {
        return { command: null, nextPosition: position + 1 };
    }
    
    let c2 = c2Result.point;
    nextPos = c2Result.endPos;
    
    const endResult = parsePoint(pathData, nextPos);
    if (endResult.endPos <= nextPos) {
        return { command: null, nextPosition: position + 1 };
    }
    
    let end = endResult.point;
    
    if (command === 'c') {
        // Relative cubic bezier
        c1 = [currentPoint[0] + c1[0], currentPoint[1] + c1[1]];
        c2 = [currentPoint[0] + c2[0], currentPoint[1] + c2[1]];
        end = [currentPoint[0] + end[0], currentPoint[1] + end[1]];
    }
    
    return {
        command: {
            cmdType: 'C',
            control1: c1,
            control2: c2,
            point: end
        },
        nextPosition: endResult.endPos
    };
}

/**
 * Parse Smooth Cubic Bezier command (S or s)
 * Simplified - assumes previous control point is current point
 */
function parseSmoothCubicCommand(pathData, position, command, currentPoint) {
    const c2Result = parsePoint(pathData, position);
    if (c2Result.endPos <= position) {
        return { command: null, nextPosition: position + 1 };
    }
    
    let c2 = c2Result.point;
    let nextPos = c2Result.endPos;
    
    const endResult = parsePoint(pathData, nextPos);
    if (endResult.endPos <= nextPos) {
        return { command: null, nextPosition: position + 1 };
    }
    
    let end = endResult.point;
    
    if (command === 's') {
        c2 = [currentPoint[0] + c2[0], currentPoint[1] + c2[1]];
        end = [currentPoint[0] + end[0], currentPoint[1] + end[1]];
    }
    
    // Reflect previous control point (simplified - use current point)
    const c1 = currentPoint;
    
    return {
        command: {
            cmdType: 'C',
            control1: c1,
            control2: c2,
            point: end
        },
        nextPosition: endResult.endPos
    };
}

/**
 * Parse Quadratic Bezier command (Q or q)
 */
function parseQuadraticBezierCommand(pathData, position, command, currentPoint) {
    const cResult = parsePoint(pathData, position);
    if (cResult.endPos <= position) {
        return { command: null, nextPosition: position + 1 };
    }
    
    let control = cResult.point;
    let nextPos = cResult.endPos;
    
    const endResult = parsePoint(pathData, nextPos);
    if (endResult.endPos <= nextPos) {
        return { command: null, nextPosition: position + 1 };
    }
    
    let end = endResult.point;
    
    if (command === 'q') {
        control = [currentPoint[0] + control[0], currentPoint[1] + control[1]];
        end = [currentPoint[0] + end[0], currentPoint[1] + end[1]];
    }
    
    // Convert quadratic to cubic bezier
    const c1 = [
        currentPoint[0] + (2/3) * (control[0] - currentPoint[0]),
        currentPoint[1] + (2/3) * (control[1] - currentPoint[1])
    ];
    const c2 = [
        end[0] + (2/3) * (control[0] - end[0]),
        end[1] + (2/3) * (control[1] - end[1])
    ];
    
    return {
        command: {
            cmdType: 'C',
            control1: c1,
            control2: c2,
            point: end
        },
        nextPosition: endResult.endPos
    };
}

/**
 * Parse Smooth Quadratic Bezier command (T or t)
 */
function parseSmoothQuadraticCommand(pathData, position, command, currentPoint) {
    const endResult = parsePoint(pathData, position);
    if (endResult.endPos <= position) {
        return { command: null, nextPosition: position + 1 };
    }
    
    let end = endResult.point;
    if (command === 't') {
        end = [currentPoint[0] + end[0], currentPoint[1] + end[1]];
    }
    
    // Reflect previous control point (simplified - use current point)
    const control = currentPoint;
    
    // Convert to cubic bezier
    const c1 = [
        currentPoint[0] + (2/3) * (control[0] - currentPoint[0]),
        currentPoint[1] + (2/3) * (control[1] - currentPoint[1])
    ];
    const c2 = [
        end[0] + (2/3) * (control[0] - end[0]),
        end[1] + (2/3) * (control[1] - end[1])
    ];
    
    return {
        command: {
            cmdType: 'C',
            control1: c1,
            control2: c2,
            point: end
        },
        nextPosition: endResult.endPos
    };
}

/**
 * Parse Arc command (A or a)
 * Simplified - converts to cubic bezier approximation
 */
function parseArcCommand(pathData, position, command, currentPoint) {
    // Parse arc parameters: rx ry x-axis-rotation large-arc-flag sweep-flag x y
    const rxResult = parseNumber(pathData, position);
    if (rxResult.endPos <= position) {
        return { command: null, nextPosition: position + 1 };
    }
    let rx = rxResult.value;
    let nextPos = rxResult.endPos;
    
    const ryResult = parseNumber(pathData, nextPos);
    if (ryResult.endPos <= nextPos) {
        return { command: null, nextPosition: position + 1 };
    }
    let ry = ryResult.value;
    nextPos = ryResult.endPos;
    
    const rotationResult = parseNumber(pathData, nextPos);
    if (rotationResult.endPos <= nextPos) {
        return { command: null, nextPosition: position + 1 };
    }
    nextPos = rotationResult.endPos;
    
    const largeArcResult = parseNumber(pathData, nextPos);
    if (largeArcResult.endPos <= nextPos) {
        return { command: null, nextPosition: position + 1 };
    }
    nextPos = largeArcResult.endPos;
    
    const sweepResult = parseNumber(pathData, nextPos);
    if (sweepResult.endPos <= nextPos) {
        return { command: null, nextPosition: position + 1 };
    }
    nextPos = sweepResult.endPos;
    
    const endResult = parsePoint(pathData, nextPos);
    if (endResult.endPos <= nextPos) {
        return { command: null, nextPosition: position + 1 };
    }
    let end = endResult.point;
    
    if (command === 'a') {
        end = [currentPoint[0] + end[0], currentPoint[1] + end[1]];
    }
    
    // Simplified: convert arc to line segment
    // Full implementation would convert to cubic bezier approximation
    return {
        command: {
            cmdType: 'L',
            point: end
        },
        nextPosition: endResult.endPos
    };
}

/**
 * Parse a point (x, y) from path data
 */
function parsePoint(pathData, position) {
    const xResult = parseNumber(pathData, position);
    if (xResult.endPos <= position) {
        return { point: null, endPos: position };
    }
    
    let nextPos = xResult.endPos;
    const yResult = parseNumber(pathData, nextPos);
    if (yResult.endPos <= nextPos) {
        return { point: null, endPos: position };
    }
    
    return {
        point: [xResult.value, yResult.value],
        endPos: yResult.endPos
    };
}

