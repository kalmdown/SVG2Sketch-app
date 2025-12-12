/**
 * SVG Parser - Ported from FeatureScript v46.2
 * 
 * This module contains the core SVG parsing logic ported from
 * SVG to Sketch FS v46.2. It parses SVG elements and converts
 * them to a structured format for Onshape sketch creation.
 */

/**
 * Character at position i in string s
 */
function chAt(s, i) {
    if (i < 0 || i >= s.length) return "";
    return s.charAt(i);
}

/**
 * Check if character is whitespace
 */
function isWs(c) {
    // Check common whitespace first (fast path)
    if (c === " " || c === "\t" || c === "\n" || c === ",") return true;
    
    // Quick rejection for common non-whitespace
    if (c === "0" || c === "1" || c === "2" || c === "3" || c === "4" ||
        c === "5" || c === "6" || c === "7" || c === "8" || c === "9") return false;
    if (c === "-" || c === "." || c === "+") return false;
    if (c === "M" || c === "m" || c === "L" || c === "l" || c === "C" || c === "c" ||
        c === "S" || c === "s" || c === "Q" || c === "q" || c === "A" || c === "a" ||
        c === "H" || c === "h" || c === "V" || c === "v" || c === "Z" || c === "z" ||
        c === "T" || c === "t") return false;
    
    // Check if it's a control character
    return isControlChar(c);
}

/**
 * Check if character is a control character
 */
function isControlChar(c) {
    // Known good whitespace - NOT control chars
    if (c === " " || c === "\t" || c === "\n") return false;
    
    // Digits
    if (c >= "0" && c <= "9") return false;
    
    // Letters
    if ((c >= "A" && c <= "Z") || (c >= "a" && c <= "z")) return false;
    
    // Common punctuation and symbols used in SVG/XML
    const validChars = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
    if (validChars.includes(c)) return false;
    
    // Everything else is a control character
    return true;
}

/**
 * Convert string to lowercase (ASCII only)
 */
function toLowerAscii(s) {
    const parts = [];
    for (let k = 0; k < s.length; k++) {
        let c = s.charAt(k);
        if (c >= "A" && c <= "Z") {
            c = String.fromCharCode(c.charCodeAt(0) + 32);
        }
        parts.push(c);
    }
    return parts.join("");
}

/**
 * Trim whitespace from string
 */
function trimStr(s) {
    let i = 0;
    let j = s.length;
    while (i < j && isWs(s.charAt(i))) i++;
    while (j > i && isWs(s.charAt(j - 1))) j--;
    if (i >= j) return "";
    return s.substring(i, j);
}

/**
 * Split comma-separated values
 */
function splitCsv(s) {
    const out = [];
    const tokParts = [];
    let i = 0;
    while (i < s.length) {
        const c = s.charAt(i);
        if (c === ",") {
            out.push(trimStr(tokParts.join("")));
            tokParts.length = 0;
        } else {
            tokParts.push(c);
        }
        i++;
    }
    const finalTok = tokParts.join("");
    if (finalTok.length > 0 || out.length > 0) {
        out.push(trimStr(finalTok));
    }
    return out;
}

/**
 * Check if character is a digit
 */
function isDigit(c) {
    return c >= "0" && c <= "9";
}

/**
 * Get digit value
 */
function digitValue(c) {
    return c.charCodeAt(0) - "0".charCodeAt(0);
}

/**
 * Manual string to number conversion (for precision)
 */
function stringToNumberManual(s) {
    if (s.length === 0) return 0.0;
    let i = 0;
    let sign = 1.0;
    if (s.charAt(0) === "-") {
        sign = -1.0;
        i = 1;
    } else if (s.charAt(0) === "+") {
        i = 1;
    }
    let whole = 0.0;
    let frac = 0.0;
    let div = 1.0;
    let dec = false;
    while (i < s.length) {
        const c = s.charAt(i);
        if (c === ".") {
            dec = true;
        } else if (isDigit(c)) {
            const d = digitValue(c);
            if (!dec) {
                whole = whole * 10.0 + d;
            } else {
                div = div * 10.0;
                frac = frac + d / div;
            }
        }
        i++;
    }
    return sign * (whole + frac);
}

/**
 * Parse a number from string starting at position start
 */
function parseNumber(s, start) {
    let pos = start;
    while (pos < s.length && isWs(s.charAt(pos))) pos++;
    
    const outParts = [];
    if (pos < s.length && (s.charAt(pos) === "+" || s.charAt(pos) === "-")) {
        outParts.push(s.charAt(pos));
        pos++;
    }
    
    let hasDigit = false;
    while (pos < s.length) {
        const c = s.charAt(pos);
        if (isDigit(c) || c === "." || c === "e" || c === "E" || c === "+" || c === "-") {
            outParts.push(c);
            if (isDigit(c)) hasDigit = true;
            pos++;
        } else if (isWs(c) || c === ",") {
            break;
        } else {
            break;
        }
    }
    
    if (!hasDigit) {
        return { value: 0.0, endPos: start };
    }
    
    const numStr = outParts.join("");
    const value = stringToNumberManual(numStr);
    return { value, endPos: pos };
}

/**
 * Extract attribute value from tag string
 */
function extractAttribute(tag, name) {
    const searchPattern1 = " " + name + "=";
    const searchPattern2 = name + "=";
    
    const tagLower = toLowerAscii(tag);
    let pos = tagLower.indexOf(searchPattern1);
    let startOffset = searchPattern1.length;
    
    if (pos === -1 && tagLower.length >= searchPattern2.length) {
        if (tagLower.substring(0, searchPattern2.length) === searchPattern2) {
            pos = 0;
            startOffset = searchPattern2.length;
        }
    }
    
    if (pos === -1) return "";
    
    let i = pos + startOffset;
    while (i < tag.length && isWs(tag.charAt(i))) i++;
    
    if (i >= tag.length) return "";
    
    const quote = tag.charAt(i);
    if (quote !== "\"" && quote !== "'") return "";
    
    i++;
    const valueStart = i;
    while (i < tag.length && tag.charAt(i) !== quote) i++;
    
    if (i >= tag.length) return "";
    
    return tag.substring(valueStart, i);
}

/**
 * Parse attribute as number
 */
function parseAttributeNumber(tag, attrName, defaultValue) {
    const attrValue = extractAttribute(tag, attrName);
    if (attrValue.length === 0) return defaultValue;
    return stringToNumberManual(attrValue);
}

/**
 * Multiply two 2D affine transform matrices
 * Matrix format: [a, b, c, d, e, f] represents:
 * | a c e |
 * | b d f |
 * | 0 0 1 |
 */
function multiplyMatrices(m1, m2) {
    const [a1, b1, c1, d1, e1, f1] = m1;
    const [a2, b2, c2, d2, e2, f2] = m2;
    
    return [
        a1 * a2 + c1 * b2,           // a
        b1 * a2 + d1 * b2,           // b
        a1 * c2 + c1 * d2,           // c
        b1 * c2 + d1 * d2,           // d
        a1 * e2 + c1 * f2 + e1,      // e
        b1 * e2 + d1 * f2 + f1       // f
    ];
}

/**
 * Parse SVG transform string into matrix [a, b, c, d, e, f]
 */
function parseTransform(str) {
    // Start with identity matrix
    let result = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
    
    if (str.length === 0) return result;
    
    const strLower = toLowerAscii(str);
    let pos = 0;
    
    // Process all transforms in the string (handles chained transforms)
    while (pos < strLower.length) {
        // Skip whitespace and commas between transforms
        while (pos < strLower.length && 
               (strLower.charAt(pos) === " " || strLower.charAt(pos) === "," || 
                strLower.charAt(pos) === "\t" || strLower.charAt(pos) === "\n")) {
            pos++;
        }
        if (pos >= strLower.length) break;
        
        let transform = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0]; // Identity
        let foundTransform = false;
        
        // Check for matrix(a,b,c,d,e,f)
        if (pos + 7 <= strLower.length && strLower.substring(pos, pos + 7) === "matrix(") {
            const start = pos + 7;
            const endParen = str.indexOf(")", start);
            if (endParen !== -1) {
                const vals = splitCsv(str.substring(start, endParen));
                if (vals.length >= 6) {
                    transform = [
                        stringToNumberManual(vals[0]), stringToNumberManual(vals[1]),
                        stringToNumberManual(vals[2]), stringToNumberManual(vals[3]),
                        stringToNumberManual(vals[4]), stringToNumberManual(vals[5])
                    ];
                    foundTransform = true;
                }
                pos = endParen + 1;
            } else {
                pos = pos + 7;
            }
        }
        // Check for translate(tx, ty) or translate(tx)
        else if (pos + 10 <= strLower.length && strLower.substring(pos, pos + 10) === "translate(") {
            const start = pos + 10;
            const endParen = str.indexOf(")", start);
            if (endParen !== -1) {
                const vals = splitCsv(str.substring(start, endParen));
                if (vals.length >= 1) {
                    const tx = stringToNumberManual(vals[0]);
                    const ty = (vals.length >= 2) ? stringToNumberManual(vals[1]) : 0.0;
                    // translate matrix: [1, 0, 0, 1, tx, ty]
                    transform = [1.0, 0.0, 0.0, 1.0, tx, ty];
                    foundTransform = true;
                }
                pos = endParen + 1;
            } else {
                pos = pos + 10;
            }
        }
        // Check for scale(sx, sy) or scale(s)
        else if (pos + 6 <= strLower.length && strLower.substring(pos, pos + 6) === "scale(") {
            const start = pos + 6;
            const endParen = str.indexOf(")", start);
            if (endParen !== -1) {
                const vals = splitCsv(str.substring(start, endParen));
                if (vals.length >= 1) {
                    const sx = stringToNumberManual(vals[0]);
                    const sy = (vals.length >= 2) ? stringToNumberManual(vals[1]) : sx;
                    // scale matrix: [sx, 0, 0, sy, 0, 0]
                    transform = [sx, 0.0, 0.0, sy, 0.0, 0.0];
                    foundTransform = true;
                }
                pos = endParen + 1;
            } else {
                pos = pos + 6;
            }
        }
        // Check for rotate(angle) or rotate(angle, cx, cy)
        else if (pos + 7 <= strLower.length && strLower.substring(pos, pos + 7) === "rotate(") {
            const start = pos + 7;
            const endParen = str.indexOf(")", start);
            if (endParen !== -1) {
                const vals = splitCsv(str.substring(start, endParen));
                if (vals.length >= 1) {
                    const angleDeg = stringToNumberManual(vals[0]);
                    const angleRad = angleDeg * Math.PI / 180.0;
                    const cosA = Math.cos(angleRad);
                    const sinA = Math.sin(angleRad);
                    
                    if (vals.length >= 3) {
                        // rotate(angle, cx, cy) = translate(cx,cy) * rotate(angle) * translate(-cx,-cy)
                        const cx = stringToNumberManual(vals[1]);
                        const cy = stringToNumberManual(vals[2]);
                        // Combined matrix for rotation around point (cx, cy)
                        transform = [
                            cosA, sinA, -sinA, cosA,
                            cx - cosA * cx + sinA * cy,
                            cy - sinA * cx - cosA * cy
                        ];
                    } else {
                        // rotate matrix: [cos, sin, -sin, cos, 0, 0]
                        transform = [cosA, sinA, -sinA, cosA, 0.0, 0.0];
                    }
                    foundTransform = true;
                }
                pos = endParen + 1;
            } else {
                pos = pos + 7;
            }
        }
        // Check for skewX(angle)
        else if (pos + 6 <= strLower.length && strLower.substring(pos, pos + 6) === "skewx(") {
            const start = pos + 6;
            const endParen = str.indexOf(")", start);
            if (endParen !== -1) {
                const vals = splitCsv(str.substring(start, endParen));
                if (vals.length >= 1) {
                    const angleDeg = stringToNumberManual(vals[0]);
                    const angleRad = angleDeg * Math.PI / 180.0;
                    const tanA = Math.tan(angleRad);
                    // skewX matrix: [1, 0, tan(a), 1, 0, 0]
                    transform = [1.0, 0.0, tanA, 1.0, 0.0, 0.0];
                    foundTransform = true;
                }
                pos = endParen + 1;
            } else {
                pos = pos + 6;
            }
        }
        // Check for skewY(angle)
        else if (pos + 6 <= strLower.length && strLower.substring(pos, pos + 6) === "skewy(") {
            const start = pos + 6;
            const endParen = str.indexOf(")", start);
            if (endParen !== -1) {
                const vals = splitCsv(str.substring(start, endParen));
                if (vals.length >= 1) {
                    const angleDeg = stringToNumberManual(vals[0]);
                    const angleRad = angleDeg * Math.PI / 180.0;
                    const tanA = Math.tan(angleRad);
                    // skewY matrix: [1, tan(a), 0, 1, 0, 0]
                    transform = [1.0, tanA, 0.0, 1.0, 0.0, 0.0];
                    foundTransform = true;
                }
                pos = endParen + 1;
            } else {
                pos = pos + 6;
            }
        } else {
            // Unknown character, skip it
            pos++;
        }
        
        // Multiply result by this transform (result = result * transform)
        if (foundTransform) {
            result = multiplyMatrices(result, transform);
        }
    }
    
    return result;
}

/**
 * Extract stroke-dasharray from style attribute
 */
function extractStrokeDashArray(styleAttr) {
    const dashArrayPos = toLowerAscii(styleAttr).indexOf("stroke-dasharray");
    if (dashArrayPos !== -1) {
        let i = dashArrayPos + "stroke-dasharray".length;
        while (i < styleAttr.length && isWs(styleAttr.charAt(i))) i++;
        if (i < styleAttr.length && styleAttr.charAt(i) === ":") {
            i++;
            while (i < styleAttr.length && isWs(styleAttr.charAt(i))) i++;
            const start = i;
            while (i < styleAttr.length && styleAttr.charAt(i) !== ";" && styleAttr.charAt(i) !== "}") i++;
            return styleAttr.substring(start, i);
        }
    }
    return "";
}

/**
 * Convert polyline/polygon points to SVG path data
 */
function convertPointsToPath(pointsStr, closePath) {
    // Parse all numbers from the points string
    const numbers = [];
    let pos = 0;
    while (pos < pointsStr.length) {
        while (pos < pointsStr.length && (isWs(pointsStr.charAt(pos)) || pointsStr.charAt(pos) === ",")) {
            pos++;
        }
        if (pos >= pointsStr.length) break;
        
        const numResult = parseNumber(pointsStr, pos);
        if (numResult.endPos > pos) {
            numbers.push(numResult.value);
            pos = numResult.endPos;
        } else {
            pos++;
        }
    }
    
    // Build path data from pairs of coordinates
    const pathParts = [];
    for (let i = 0; i + 1 < numbers.length; i += 2) {
        const x = numbers[i];
        const y = numbers[i + 1];
        if (i === 0) {
            pathParts.push(`M${x},${y}`);
        } else {
            pathParts.push(`L${x},${y}`);
        }
    }
    
    if (closePath && pathParts.length > 0) {
        pathParts.push("Z");
    }
    
    return pathParts.join(" ");
}

/**
 * Clone an element (copy all relevant properties)
 */
function cloneElement(baseElement) {
    const instance = {
        elementType: baseElement.elementType
    };
    
    // Copy element-specific properties based on type
    if (baseElement.elementType === "path") {
        if (baseElement.d !== undefined) instance.d = baseElement.d;
    } else if (baseElement.elementType === "rect") {
        if (baseElement.x !== undefined) instance.x = baseElement.x;
        if (baseElement.y !== undefined) instance.y = baseElement.y;
        if (baseElement.width !== undefined) instance.width = baseElement.width;
        if (baseElement.height !== undefined) instance.height = baseElement.height;
    } else if (baseElement.elementType === "line") {
        if (baseElement.x1 !== undefined) instance.x1 = baseElement.x1;
        if (baseElement.y1 !== undefined) instance.y1 = baseElement.y1;
        if (baseElement.x2 !== undefined) instance.x2 = baseElement.x2;
        if (baseElement.y2 !== undefined) instance.y2 = baseElement.y2;
    } else if (baseElement.elementType === "circle") {
        if (baseElement.cx !== undefined) instance.cx = baseElement.cx;
        if (baseElement.cy !== undefined) instance.cy = baseElement.cy;
        if (baseElement.r !== undefined) instance.r = baseElement.r;
    } else if (baseElement.elementType === "ellipse") {
        if (baseElement.cx !== undefined) instance.cx = baseElement.cx;
        if (baseElement.cy !== undefined) instance.cy = baseElement.cy;
        if (baseElement.rx !== undefined) instance.rx = baseElement.rx;
        if (baseElement.ry !== undefined) instance.ry = baseElement.ry;
    }
    
    // Copy common properties
    if (baseElement.isConstruction !== undefined) instance.isConstruction = baseElement.isConstruction;
    if (baseElement.id !== undefined) instance.id = baseElement.id;
    
    return instance;
}

/**
 * Expand <use> elements into concrete instances of their referenced elements
 */
function expandUseElements(elements, debug = false) {
    // Copy input so we can append to it
    let result = [...elements];
    
    // Only iterate over the original elements
    const originalCount = elements.length;
    
    for (let i = 0; i < originalCount; i++) {
        const element = elements[i];
        
        if (element.elementType !== "use") {
            continue;
        }
        
        let href = element.href || "";
        
        if (href.length === 0) {
            if (debug) {
                console.log("Skipping <use> with empty href");
            }
            continue;
        }
        
        // Strip leading '#'
        if (href.charAt(0) === "#") {
            href = href.substring(1);
        }
        
        // Get the use element's transform
        let useTransform = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
        if (element.transform !== undefined) {
            useTransform = element.transform;
        }
        
        // Check if this is a symbol reference (multiple elements with parentSymbolId)
        const symbolElements = [];
        for (let j = 0; j < originalCount; j++) {
            const cand = elements[j];
            const parentSymbolId = cand.parentSymbolId || "";
            if (parentSymbolId.length > 0 && parentSymbolId === href) {
                symbolElements.push(cand);
            }
        }
        
        // If we found symbol elements, clone them all
        if (symbolElements.length > 0) {
            if (debug) {
                console.log(`Expanding <use> of symbol '${href}' (${symbolElements.length} elements)`);
            }
            
            for (let k = 0; k < symbolElements.length; k++) {
                const baseElement = symbolElements[k];
                
                // Compose transforms: instance = M_use ∘ M_base
                let baseTransform = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
                if (baseElement.transform !== undefined) {
                    baseTransform = baseElement.transform;
                }
                const instanceTransform = multiplyMatrices(useTransform, baseTransform);
                
                // Clone the element
                const instance = cloneElement(baseElement);
                instance.transform = instanceTransform;
                instance.sourceUseHref = href;
                instance.isHidden = false;
                
                result.push(instance);
            }
            continue;
        }
        
        // Not a symbol - look for a single element with matching id
        let baseFound = false;
        let baseElement = {};
        
        for (let j = 0; j < originalCount; j++) {
            const cand = elements[j];
            const candId = cand.id || "";
            if (candId.length > 0 && candId === href) {
                baseElement = cand;
                baseFound = true;
                break;
            }
        }
        
        if (!baseFound) {
            if (debug) {
                console.log(`WARNING: <use> reference '${href}' not found; skipping.`);
            }
            continue;
        }
        
        // Compose transforms: instance = M_use ∘ M_base
        let baseTransform = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
        if (baseElement.transform !== undefined) {
            baseTransform = baseElement.transform;
        }
        
        const instanceTransform = multiplyMatrices(useTransform, baseTransform);
        
        // Clone the element
        const instance = cloneElement(baseElement);
        instance.transform = instanceTransform;
        instance.sourceUseHref = href;
        instance.isHidden = false;
        
        result.push(instance);
        
        if (debug) {
            console.log(`Created <use> instance of id='${href}' as ${baseElement.elementType}`);
        }
    }
    
    return result;
}

/**
 * Main SVG element parser - parses SVG string and extracts all drawable elements
 * Ported from FeatureScript v46.2 parseSVGElements()
 */
export function parseSVGElements(svg) {
    const out = [];
    let p = 0;
    
    // Transform stack for group inheritance
    // Each entry is a transform matrix [a, b, c, d, e, f]
    // Start with identity matrix
    let transformStack = [[1.0, 0.0, 0.0, 1.0, 0.0, 0.0]];
    
    // Track nesting depth inside <defs> - elements inside are hidden
    let defsDepth = 0;
    
    // Track current symbol id - elements inside a <symbol> are grouped under this id
    let symbolStack = [];
    
    while (p < svg.length) {
        const a = svg.indexOf("<", p);
        if (a === -1) break;
        
        // Skip XML comments
        if (a + 3 < svg.length && svg.substring(a, a + 4) === "<!--") {
            const commentEnd = svg.indexOf("-->", a + 4);
            if (commentEnd !== -1) {
                p = commentEnd + 3;
                continue;
            }
        }
        
        // Skip processing instructions <?...?>
        if (a + 1 < svg.length && svg.charAt(a + 1) === "?") {
            const piEnd = svg.indexOf("?>", a + 2);
            if (piEnd !== -1) {
                p = piEnd + 2;
                continue;
            }
        }
        
        // For multi-line tags, find the closing > that's not inside quotes
        let tagEnd = -1;
        let inQuotes = false;
        let quoteChar = "";
        let i = a + 1;
        let isSelfClosing = false;
        
        while (i < svg.length) {
            const ch = svg.charAt(i);
            if (!inQuotes && (ch === "\"" || ch === "'")) {
                inQuotes = true;
                quoteChar = ch;
            } else if (inQuotes && ch === quoteChar) {
                inQuotes = false;
                quoteChar = "";
            } else if (!inQuotes) {
                if (ch === "/" && i + 1 < svg.length && svg.charAt(i + 1) === ">") {
                    tagEnd = i;
                    isSelfClosing = true;
                    i = i + 2;
                    break;
                } else if (ch === ">") {
                    tagEnd = i;
                    i = i + 1;
                    break;
                }
            }
            i++;
        }
        
        if (tagEnd === -1) break;
        const tag = svg.substring(a + 1, tagEnd);
        const b = i;
        
        if (tag.length > 0) {
            // Check if this is a closing tag
            if (tag.charAt(0) === "/") {
                const closeTagName = toLowerAscii(trimStr(tag.substring(1)));
                // Pop transform stack when closing a group
                if (closeTagName === "g" && transformStack.length > 1) {
                    transformStack = transformStack.slice(0, transformStack.length - 1);
                }
                // Decrement defs depth when closing </defs>
                if (closeTagName === "defs" && defsDepth > 0) {
                    defsDepth--;
                }
                // Pop symbol stack when closing </symbol>
                if (closeTagName === "symbol" && symbolStack.length > 0) {
                    symbolStack = symbolStack.slice(0, symbolStack.length - 1);
                }
            } else {
                const sp = tag.indexOf(" ");
                let name = "";
                if (sp === -1) {
                    name = toLowerAscii(tag);
                } else {
                    name = toLowerAscii(tag.substring(0, sp));
                }
                
                // Get current inherited transform (top of stack)
                const inheritedTransform = transformStack[transformStack.length - 1];
                
                // Handle group elements - push transform to stack
                if (name === "g") {
                    const tf = extractAttribute(tag, "transform");
                    let groupTransform = inheritedTransform;
                    if (tf.length > 0) {
                        groupTransform = multiplyMatrices(inheritedTransform, parseTransform(tf));
                    }
                    if (!isSelfClosing) {
                        transformStack.push(groupTransform);
                    }
                }
                // Handle <defs> - increment depth, elements inside will be hidden
                else if (name === "defs") {
                    if (!isSelfClosing) {
                        defsDepth++;
                    }
                }
                // Handle <symbol> - push to symbol stack
                else if (name === "symbol") {
                    if (!isSelfClosing) {
                        const symbolId = extractAttribute(tag, "id");
                        const symbolViewBox = extractAttribute(tag, "viewBox");
                        symbolStack.push({
                            id: symbolId,
                            viewBox: symbolViewBox
                        });
                    }
                }
                // Handle drawable elements
                else if (["path", "rect", "line", "ellipse", "circle", "polyline", "polygon", "use"].includes(name)) {
                    const el = { elementType: name };
                    
                    if (name === "path") {
                        let dAttr = extractAttribute(tag, "d");
                        const idAttr = extractAttribute(tag, "id");
                        
                        // Fallback extraction if extractAttribute didn't work
                        if (dAttr.length === 0) {
                            const tagLower = toLowerAscii(tag);
                            let dPos = tagLower.indexOf(" d=");
                            let dLen = 3;
                            if (dPos === -1 && tagLower.length >= 2 && tagLower.substring(0, 2) === "d=") {
                                dPos = 0;
                                dLen = 2;
                            }
                            if (dPos !== -1) {
                                let manualPos = dPos + dLen;
                                while (manualPos < tag.length && isWs(tag.charAt(manualPos))) manualPos++;
                                if (manualPos < tag.length) {
                                    const quote = tag.charAt(manualPos);
                                    if (quote === "\"" || quote === "'") {
                                        manualPos++;
                                        const valueStart = manualPos;
                                        while (manualPos < tag.length && tag.charAt(manualPos) !== quote) manualPos++;
                                        dAttr = tag.substring(valueStart, manualPos);
                                    }
                                }
                            }
                        }
                        
                        el.d = dAttr;
                        if (idAttr.length > 0) el.id = idAttr;
                        
                        // Check for stroke-dasharray
                        let strokeDashArray = extractAttribute(tag, "stroke-dasharray");
                        if (strokeDashArray.length === 0) {
                            const styleAttr = extractAttribute(tag, "style");
                            if (styleAttr.length > 0) {
                                strokeDashArray = extractStrokeDashArray(styleAttr);
                            }
                        }
                        if (strokeDashArray.length > 0) el.isConstruction = true;
                    } else if (name === "polyline" || name === "polygon") {
                        // Convert polyline/polygon to path
                        const pointsAttr = extractAttribute(tag, "points");
                        const idAttr = extractAttribute(tag, "id");
                        
                        if (pointsAttr.length > 0) {
                            const pathD = convertPointsToPath(pointsAttr, name === "polygon");
                            el.elementType = "path";
                            el.d = pathD;
                            if (idAttr.length > 0) el.id = idAttr;
                        }
                        
                        let strokeDashArray = extractAttribute(tag, "stroke-dasharray");
                        if (strokeDashArray.length === 0) {
                            const styleAttr = extractAttribute(tag, "style");
                            if (styleAttr.length > 0) {
                                strokeDashArray = extractStrokeDashArray(styleAttr);
                            }
                        }
                        if (strokeDashArray.length > 0) el.isConstruction = true;
                    } else if (name === "rect") {
                        const idAttr = extractAttribute(tag, "id");
                        el.x = parseAttributeNumber(tag, "x", 0.0);
                        el.y = parseAttributeNumber(tag, "y", 0.0);
                        el.width = parseAttributeNumber(tag, "width", 0.0);
                        el.height = parseAttributeNumber(tag, "height", 0.0);
                        if (idAttr.length > 0) el.id = idAttr;
                        
                        let strokeDashArray = extractAttribute(tag, "stroke-dasharray");
                        if (strokeDashArray.length === 0) {
                            const styleAttr = extractAttribute(tag, "style");
                            if (styleAttr.length > 0) {
                                strokeDashArray = extractStrokeDashArray(styleAttr);
                            }
                        }
                        if (strokeDashArray.length > 0) el.isConstruction = true;
                    } else if (name === "line") {
                        const idAttr = extractAttribute(tag, "id");
                        el.x1 = parseAttributeNumber(tag, "x1", 0.0);
                        el.y1 = parseAttributeNumber(tag, "y1", 0.0);
                        el.x2 = parseAttributeNumber(tag, "x2", 0.0);
                        el.y2 = parseAttributeNumber(tag, "y2", 0.0);
                        if (idAttr.length > 0) el.id = idAttr;
                        
                        let strokeDashArray = extractAttribute(tag, "stroke-dasharray");
                        if (strokeDashArray.length === 0) {
                            const styleAttr = extractAttribute(tag, "style");
                            if (styleAttr.length > 0) {
                                strokeDashArray = extractStrokeDashArray(styleAttr);
                            }
                        }
                        if (strokeDashArray.length > 0) el.isConstruction = true;
                    } else if (name === "ellipse") {
                        const idAttr = extractAttribute(tag, "id");
                        el.cx = parseAttributeNumber(tag, "cx", 0.0);
                        el.cy = parseAttributeNumber(tag, "cy", 0.0);
                        el.rx = parseAttributeNumber(tag, "rx", 0.0);
                        el.ry = parseAttributeNumber(tag, "ry", 0.0);
                        if (idAttr.length > 0) el.id = idAttr;
                        
                        let strokeDashArray = extractAttribute(tag, "stroke-dasharray");
                        if (strokeDashArray.length === 0) {
                            const styleAttr = extractAttribute(tag, "style");
                            if (styleAttr.length > 0) {
                                strokeDashArray = extractStrokeDashArray(styleAttr);
                            }
                        }
                        if (strokeDashArray.length > 0) el.isConstruction = true;
                    } else if (name === "circle") {
                        const idAttr = extractAttribute(tag, "id");
                        el.cx = parseAttributeNumber(tag, "cx", 0.0);
                        el.cy = parseAttributeNumber(tag, "cy", 0.0);
                        el.r = parseAttributeNumber(tag, "r", 0.0);
                        if (idAttr.length > 0) el.id = idAttr;
                        
                        let strokeDashArray = extractAttribute(tag, "stroke-dasharray");
                        if (strokeDashArray.length === 0) {
                            const styleAttr = extractAttribute(tag, "style");
                            if (styleAttr.length > 0) {
                                strokeDashArray = extractStrokeDashArray(styleAttr);
                            }
                        }
                        if (strokeDashArray.length > 0) el.isConstruction = true;
                    } else if (name === "use") {
                        // <use> element - references another element by id
                        const idAttr = extractAttribute(tag, "id");
                        
                        // href can be in either 'href' or 'xlink:href'
                        let href = extractAttribute(tag, "href");
                        if (href.length === 0) {
                            href = extractAttribute(tag, "xlink:href");
                        }
                        
                        // x / y attributes act as an extra translate(x,y)
                        const xNum = parseAttributeNumber(tag, "x", 0.0);
                        const yNum = parseAttributeNumber(tag, "y", 0.0);
                        
                        el.elementType = "use";
                        el.href = href;
                        if (idAttr.length > 0) el.id = idAttr;
                        
                        // Build the use transform: translate(x,y) first, then any transform attribute
                        let localTransform = [1.0, 0.0, 0.0, 1.0, xNum, yNum];
                        
                        // Get transform attribute if present
                        const transformAttr = extractAttribute(tag, "transform");
                        if (transformAttr.length > 0) {
                            const attrTransform = parseTransform(transformAttr);
                            // SVG semantics: transform="T1 T2" means apply T1 then T2
                            localTransform = multiplyMatrices(attrTransform, localTransform);
                        }
                        
                        // Inherit group/parent transform
                        const elementTransform = multiplyMatrices(inheritedTransform, localTransform);
                        
                        // Store the fully composed transform
                        el.transform = elementTransform;
                        
                        out.push(el);
                        // Skip the standard transform application below for <use>
                        p = b;
                        continue;
                    }
                    
                    // Apply transform: combine inherited transform with element's own transform
                    const tf = extractAttribute(tag, "transform");
                    let elementTransform = inheritedTransform;
                    if (tf.length > 0) {
                        elementTransform = multiplyMatrices(inheritedTransform, parseTransform(tf));
                    }
                    
                    // Only store transform if it's not identity
                    if (elementTransform[0] !== 1.0 || elementTransform[1] !== 0.0 ||
                        elementTransform[2] !== 0.0 || elementTransform[3] !== 1.0 ||
                        elementTransform[4] !== 0.0 || elementTransform[5] !== 0.0) {
                        el.transform = elementTransform;
                    }
                    
                    // Mark elements inside <defs> or <symbol> as hidden
                    if (defsDepth > 0 || symbolStack.length > 0) {
                        el.isHidden = true;
                    }
                    
                    // Tag elements inside a <symbol> with their parent symbol id
                    if (symbolStack.length > 0) {
                        const currentSymbol = symbolStack[symbolStack.length - 1];
                        if (currentSymbol.id && currentSymbol.id.length > 0) {
                            el.parentSymbolId = currentSymbol.id;
                        }
                    }
                    
                    out.push(el);
                }
            }
        }
        p = b;
    }
    
    // Expand <use> elements into concrete instances
    return expandUseElements(out, false);
}

// Export helper functions for testing
export {
    parseTransform,
    multiplyMatrices,
    expandUseElements,
    extractAttribute,
    parseAttributeNumber,
    stringToNumberManual
};





