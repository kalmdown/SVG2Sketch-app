FeatureScript 2815;
import(path : "onshape/std/common.fs", version : "2815.0");
import(path : "onshape/std/valueBounds.fs", version : "2815.0");

/* ──────────────────────────────────────────────────────────────────────────
    SVG to Sketch v47 - Hybrid Architecture (Option D)
    
    PRIMARY PATH: Intermediate Format (IF)
    - Optimized format from SVG2Sketch-app
    - Supports pattern optimization, text-to-paths, large files
    - Recommended for app-generated content
    
    FALLBACK PATH: Raw SVG
    - Direct SVG parsing (from v46.5, performance optimized)
    - For standalone FeatureScript use
    - Use v46.5 if you only need raw SVG
    
    ARCHITECTURE:
    - Shared helpers: String, geometry, transform utilities
    - IF Parser: parseAndExecuteIF() - primary path
    - SVG Parser: parseSVGElements() + emitPath() - fallback path
    
    Unitful trig always (radian/degree)
    No zero-length close segments
    ────────────────────────────────────────────────────────────────────────── */

/* ────────────── SHARED HELPERS: STRING UTILITIES ────────────── */
// Used by both IF parser and SVG parser
// Performance optimized (v46.5): toLowerAscii uses map lookup
function chAt(s is string, i is number) returns string
{
    if (i < 0) return "";
    if (i >= length(s)) return "";
    return substring(s, i, i + 1);
}

function isWs(c is string) returns boolean
{
    // Check common whitespace first (fast path)
    if (c == " ") return true;
    if (c == "\t") return true;
    if (c == "\n") return true;
    if (c == ",") return true;
    // Quick rejection for common non-whitespace
    if (c == "0" || c == "1" || c == "2" || c == "3" || c == "4" ||
        c == "5" || c == "6" || c == "7" || c == "8" || c == "9") return false;
    if (c == "-" || c == "." || c == "+") return false;
    if (c == "M" || c == "m" || c == "L" || c == "l" || c == "C" || c == "c" ||
        c == "S" || c == "s" || c == "Q" || c == "q" || c == "A" || c == "a" ||
        c == "H" || c == "h" || c == "V" || c == "v" || c == "Z" || c == "z" ||
        c == "T" || c == "t") return false;
    // For rare characters, check if it's a control character (like \r)
    return isControlChar(c);
}

function isControlChar(c is string) returns boolean
{
    // Known good whitespace - NOT control chars for our purposes
    if (c == " " || c == "\t" || c == "\n") return false;
    // Check if it's a printable ASCII character
    // Digits
    if (c == "0" || c == "1" || c == "2" || c == "3" || c == "4" ||
        c == "5" || c == "6" || c == "7" || c == "8" || c == "9") return false;
    // Uppercase letters
    if (c == "A" || c == "B" || c == "C" || c == "D" || c == "E" || c == "F" ||
        c == "G" || c == "H" || c == "I" || c == "J" || c == "K" || c == "L" ||
        c == "M" || c == "N" || c == "O" || c == "P" || c == "Q" || c == "R" ||
        c == "S" || c == "T" || c == "U" || c == "V" || c == "W" || c == "X" ||
        c == "Y" || c == "Z") return false;
    // Lowercase letters
    if (c == "a" || c == "b" || c == "c" || c == "d" || c == "e" || c == "f" ||
        c == "g" || c == "h" || c == "i" || c == "j" || c == "k" || c == "l" ||
        c == "m" || c == "n" || c == "o" || c == "p" || c == "q" || c == "r" ||
        c == "s" || c == "t" || c == "u" || c == "v" || c == "w" || c == "x" ||
        c == "y" || c == "z") return false;
    // Common punctuation and symbols
    if (c == "!" || c == "\"" || c == "#" || c == "$" || c == "%" || c == "&" ||
        c == "'" || c == "(" || c == ")" || c == "*" || c == "+" || c == "," ||
        c == "-" || c == "." || c == "/" || c == ":" || c == ";" || c == "<" ||
        c == "=" || c == ">" || c == "?" || c == "@" || c == "[" || c == "\\" ||
        c == "]" || c == "^" || c == "_" || c == "`" || c == "{" || c == "|" ||
        c == "}" || c == "~") return false;
    // Everything else is a control character
    return true;
}

// Map for efficient uppercase to lowercase conversion (ASCII A-Z only)
const UPPER_TO_LOWER is map = {
    "A" : "a", "B" : "b", "C" : "c", "D" : "d", "E" : "e",
    "F" : "f", "G" : "g", "H" : "h", "I" : "i", "J" : "j",
    "K" : "k", "L" : "l", "M" : "m", "N" : "n", "O" : "o",
    "P" : "p", "Q" : "q", "R" : "r", "S" : "s", "T" : "t",
    "U" : "u", "V" : "v", "W" : "w", "X" : "x", "Y" : "y", "Z" : "z"
};

function toLowerAscii(s is string) returns string
{
    // Use splitIntoCharacters() for efficient character-by-character processing
    // O(1) map lookup instead of long if/else chain (v46.5 performance optimization)
    const chars = splitIntoCharacters(s);
    var result = [];
    for (var ch in chars)
    {
        // O(1) map lookup instead of long if/else chain
        if (UPPER_TO_LOWER[ch] != undefined)
        {
            result = append(result, UPPER_TO_LOWER[ch]);
        }
        else
        {
            result = append(result, ch);
        }
    }
    return join(result, "");
}

function trimStr(s is string) returns string
{
    var i = 0;
    var j = length(s);
    while (i < j && isWs(chAt(s, i))) i = i + 1;
    while (j > i && isWs(chAt(s, j - 1))) j = j - 1;
    if (i >= j) return "";
    return substring(s, i, j);
}

function splitCsv(s is string) returns array
{
    var out = [];
    var tokParts = [];
    var i = 0;
    while (i < length(s))
    {
        const c = chAt(s, i);
        if (c == ",")
        {
            out = append(out, trimStr(join(tokParts, "")));
            tokParts = [];
        }
        else
        {
            tokParts = append(tokParts, c);
        }
        i = i + 1;
    }
    const finalTok = join(tokParts, "");
    if (length(finalTok) > 0 || size(out) > 0) out = append(out, trimStr(finalTok));
    return out;
}

function stringToNumberManualNoPos(s is string) returns number
{
    if (length(s) == 0) return 0.0;
    var i = 0;
    var sign = 1.0;
    if (chAt(s, 0) == "-")
    {
        sign = -1.0;
        i = 1;
    }
    else if (chAt(s, 0) == "+")
    {
        i = 1;
    }
    var whole = 0.0;
    var frac = 0.0;
    var div = 1.0;
    var dec = false;
    while (i < length(s))
    {
        const c = chAt(s, i);
        if (c == ".") dec = true;
        else if (isDigit(c))
        {
            const d = digitValue(c);
            if (!dec) whole = whole * 10.0 + d;
            else
            {
                div = div * 10.0;
                frac = frac + d / div;
            }
        }
        i = i + 1;
    }
    return sign * (whole + frac);
}

function parseNumber(s is string, start is number) returns map
{
    var pos = start;
    while (pos < length(s) && isWs(chAt(s, pos))) pos = pos + 1;
    var outParts = [];
    if (pos < length(s) && (chAt(s, pos) == "+" || chAt(s, pos) == "-"))
    {
        outParts = append(outParts, chAt(s, pos));
        pos = pos + 1;
    }
    var hasD = false;
    var hasDot = false;
    while (pos < length(s))
    {
        const c = chAt(s, pos);
        if (isDigit(c))
        {
            outParts = append(outParts, c);
            hasD = true;
            pos = pos + 1;
        }
        else if (c == "." && !hasDot)
        {
            outParts = append(outParts, c);
            hasDot = true;
            pos = pos + 1;
        }
        else break;
    }
    if (!hasD) return { "value" : 0.0, "endPos" : start + 1 };
    return { "value" : stringToNumberManualNoPos(join(outParts, "")), "endPos" : pos };
}

function skipWsComma(s is string, pos is number) returns number
{
    var i = pos;
    while (i < length(s) && isWs(chAt(s, i))) i = i + 1;
    return i;
}

function skipWs(s is string, pos is number) returns number
{
    var p = pos;
    while (p < length(s) && isWs(chAt(s, p)))
    {
        p = p + 1;
    }
    return p;
}

function findLineEnd(s is string, start is number) returns number
{
    var p = start;
    while (p < length(s))
    {
        var c = chAt(s, p);
        if (c == "\n" || c == "\r")
        {
            return p;
        }
        p = p + 1;
    }
    return length(s);
}

function getLine(s is string, start is number) returns string
{
    var end = findLineEnd(s, start);
    return substring(s, start, end);
}

function isDigit(c is string) returns boolean
{
    return c == "0" || c == "1" || c == "2" || c == "3" || c == "4" ||
           c == "5" || c == "6" || c == "7" || c == "8" || c == "9";
}

function digitValue(c is string) returns number
{
    if (c == "0") return 0;
    if (c == "1") return 1;
    if (c == "2") return 2;
    if (c == "3") return 3;
    if (c == "4") return 4;
    if (c == "5") return 5;
    if (c == "6") return 6;
    if (c == "7") return 7;
    if (c == "8") return 8;
    if (c == "9") return 9;
    return 0;
}

function stringToNumberManual(s is string, start is number) returns map
{
    var pos = skipWs(s, start);
    if (pos >= length(s))
    {
        return { "value" : 0.0, "nextPos" : pos };
    }
    
    var sign = 1.0;
    if (chAt(s, pos) == "-")
    {
        sign = -1.0;
        pos = pos + 1;
    }
    else if (chAt(s, pos) == "+")
    {
        pos = pos + 1;
    }
    
    var value = 0.0;
    var hasDigits = false;
    
    // Integer part
    while (pos < length(s) && isDigit(chAt(s, pos)))
    {
        value = value * 10.0 + digitValue(chAt(s, pos));
        pos = pos + 1;
        hasDigits = true;
    }
    
    // Fractional part
    if (pos < length(s) && chAt(s, pos) == ".")
    {
        pos = pos + 1;
        var frac = 0.0;
        var fracDiv = 1.0;
        while (pos < length(s) && isDigit(chAt(s, pos)))
        {
            frac = frac * 10.0 + digitValue(chAt(s, pos));
            fracDiv = fracDiv * 10.0;
            pos = pos + 1;
            hasDigits = true;
        }
        value = value + (frac / fracDiv);
    }
    
    // Scientific notation (basic support)
    if (pos < length(s) && (chAt(s, pos) == "e" || chAt(s, pos) == "E"))
    {
        pos = pos + 1;
        var expSign = 1.0;
        if (pos < length(s) && chAt(s, pos) == "-")
        {
            expSign = -1.0;
            pos = pos + 1;
        }
        else if (pos < length(s) && chAt(s, pos) == "+")
        {
            pos = pos + 1;
        }
        var exp = 0.0;
        while (pos < length(s) && isDigit(chAt(s, pos)))
        {
            exp = exp * 10.0 + digitValue(chAt(s, pos));
            pos = pos + 1;
        }
        value = value * (10.0 ^ (expSign * exp));
    }
    
    if (!hasDigits)
    {
        return { "value" : 0.0, "nextPos" : start };
    }
    
    return { "value" : sign * value, "nextPos" : skipWs(s, pos) };
}

function parsePoint(s is string, start is number) returns map
{
    var pos = start;
    while (pos < length(s) && isWs(chAt(s, pos))) pos = pos + 1;
    const xr = parseNumber(s, pos); pos = xr.endPos;
    while (pos < length(s) && isWs(chAt(s, pos))) pos = pos + 1;
    const yr = parseNumber(s, pos); pos = yr.endPos;
    return { "point" : [xr.value, yr.value], "endPos" : pos };
}

function isIntermediateFormat(text is string) returns boolean
{
    // Check if text starts with IF header comment
    var trimmed = text;
    var start = 0;
    while (start < length(trimmed) && isWs(chAt(trimmed, start)))
    {
        start = start + 1;
    }
    if (start + 1 < length(trimmed) && chAt(trimmed, start) == "#")
    {
        var header = substring(trimmed, start, min(start + 30, length(trimmed)));
        if (indexOf(header, "Intermediate Format") != -1)
        {
            return true;
        }
    }
    return false;
}

/* ────────────── GEOMETRY HELPERS ────────────── */
function rad(deg is number) returns ValueWithUnits
{
    return deg * degree;
}

function distanceLocal(p is array, q is array) returns number
{
    var dx = p[0] - q[0];
    var dy = p[1] - q[1];
    return sqrt(dx * dx + dy * dy);
}

function toMM(p is array, scale is number) returns Vector
{
    return vector(p[0] * scale * millimeter, p[1] * scale * millimeter);
}

function length2D(v is array) returns number
{
    return sqrt(v[0] * v[0] + v[1] * v[1]);
}

function normalize2D(v is array) returns array
{
    const n = length2D(v);
    if (n < 1e-15) return [1.0, 0.0];
    return [v[0] / n, v[1] / n];
}

function angleBetween(ux is number, uy is number, vx is number, vy is number) returns number
{
    const dot = ux * vx + uy * vy;
    const det = ux * vy - uy * vx;
    return atan2(det * radian, dot * radian) / radian;
}

function pointToLineDistance(p is array, a is array, b is array) returns number
{
    const ab = [b[0] - a[0], b[1] - a[1]];
    const abLen = length2D(ab);
    if (abLen < 1e-15) return distanceLocal(p, a);
    const ap = [p[0] - a[0], p[1] - a[1]];
    const cross = ab[0] * ap[1] - ab[1] * ap[0];
    return abs(cross) / abLen;
}

function isBezierFlat(p0 is array, p1 is array, p2 is array, p3 is array, flatnessTol is number) returns boolean
{
    const segLen = distanceLocal(p0, p3);
    if (segLen < 1e-6) return true;
    const dist1 = pointToLineDistance(p1, p0, p3);
    const dist2 = pointToLineDistance(p2, p0, p3);
    const relativeTol = segLen * 0.01;
    const maxTol = max(flatnessTol * 100.0, relativeTol);
    const distToStart1 = distanceLocal(p1, p0);
    const distToEnd1 = distanceLocal(p1, p3);
    const distToStart2 = distanceLocal(p2, p0);
    const distToEnd2 = distanceLocal(p2, p3);
    const endpointTol = segLen * 0.01;
    const onLine = dist1 < maxTol && dist2 < maxTol;
    const nearEndpoints = (distToStart1 < endpointTol || distToEnd1 < endpointTol) &&
                          (distToStart2 < endpointTol || distToEnd2 < endpointTol);
    return onLine || nearEndpoints;
}

function isBezierFlatVectors(p0 is Vector, p1 is Vector, p2 is Vector, p3 is Vector, flatnessTolMM is ValueWithUnits) returns boolean
{
    // Convert vectors to arrays for distance calculation
    const p0_arr = [p0[0] / millimeter, p0[1] / millimeter];
    const p1_arr = [p1[0] / millimeter, p1[1] / millimeter];
    const p2_arr = [p2[0] / millimeter, p2[1] / millimeter];
    const p3_arr = [p3[0] / millimeter, p3[1] / millimeter];
    
    const segLenMM = distanceLocal(p0_arr, p3_arr);
    const segLen = segLenMM * millimeter;
    if (segLen < flatnessTolMM) return true; // Very short segment, treat as flat
    
    // Calculate perpendicular distance of each control point from the line p0-p3
    const dist1 = pointToLineDistance(p1_arr, p0_arr, p3_arr);
    const dist2 = pointToLineDistance(p2_arr, p0_arr, p3_arr);
    
    // Use a much more aggressive relative tolerance: 1% of segment length
    const relativeTol = segLenMM * 0.01; // 1% of segment length
    const maxTol = max(flatnessTolMM / millimeter, relativeTol);
    
    // Also check if control points are very close to endpoints
    const distToStart1 = distanceLocal(p1_arr, p0_arr);
    const distToEnd1 = distanceLocal(p1_arr, p3_arr);
    const distToStart2 = distanceLocal(p2_arr, p0_arr);
    const distToEnd2 = distanceLocal(p2_arr, p3_arr);
    const endpointTol = segLenMM * 0.01;
    
    // Curve is flat if both control points are within tolerance of the line
    const onLine = dist1 < maxTol && dist2 < maxTol;
    const nearEndpoints = (distToStart1 < endpointTol || distToEnd1 < endpointTol) && 
                          (distToStart2 < endpointTol || distToEnd2 < endpointTol);
    
    return onLine || nearEndpoints;
}

// Validate that a Bezier curve has distinct, valid points before creation
// Returns true if the curve should be created, false if it should be a line or skipped
function isValidBezierCurve(p0 is array, p1 is array, p2 is array, p3 is array) returns boolean
{
    const EPS = 1e-9;
    const segLen = distanceLocal(p0, p3);
    if (segLen < EPS) return false;
    const dist01 = distanceLocal(p0, p1);
    const dist02 = distanceLocal(p0, p2);
    const dist13 = distanceLocal(p1, p3);
    const dist23 = distanceLocal(p2, p3);
    const dist03 = distanceLocal(p0, p3);
    if (dist03 < EPS) return false;
    if (dist01 < EPS && dist02 < EPS && dist13 < EPS && dist23 < EPS) return false;
    const FLATNESS_CHECK = 1e-4;
    if (isBezierFlat(p0, p1, p2, p3, FLATNESS_CHECK)) return false;
    return true;
}

function getTransform(el is map) returns array
{
    if (el["transform"] != undefined) return el["transform"];
    return [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
}

function applyTransform(m is array, p is array) returns array
{
    const x = m[0] * p[0] + m[2] * p[1] + m[4];
    const y = m[1] * p[0] + m[3] * p[1] + m[5];
    return [x, -y];
}

/* ------------------- SEGMENT ID VISUALIZATION ------------------- */
// Draw a single digit (0-9) using line segments at a given position
// Each digit is drawn in a 5x7 grid (width x height)
function drawDigit(sk is Sketch, digit is number, centerPos is Vector, charSize is ValueWithUnits, entityCount is number, pathIndex is number) returns number
{
    // Normalize digit to 0-9
    var d = floor(digit);
    if (d < 0) d = 0;
    if (d > 9) d = 9;
    
    // Character size: width and height of each digit
    const w = charSize;
    const h = charSize * 1.4; // Height is 1.4x width for better proportions
    const strokeWidth = charSize * 0.1; // Line thickness
    
    // Define segments for each digit (7-segment display style, simplified to line segments)
    // Each digit is defined as an array of [x1, y1, x2, y2] segments in normalized coordinates (0-1)
    var segments = [] as array;
    
    if (d == 0)
    {
        segments = [[0.1, 0.1, 0.9, 0.1], [0.9, 0.1, 0.9, 0.9], [0.9, 0.9, 0.1, 0.9], [0.1, 0.9, 0.1, 0.1]];
    }
    else if (d == 1)
    {
        segments = [[0.5, 0.1, 0.5, 0.9]];
    }
    else if (d == 2)
    {
        segments = [[0.1, 0.1, 0.9, 0.1], [0.9, 0.1, 0.9, 0.5], [0.9, 0.5, 0.1, 0.5], [0.1, 0.5, 0.1, 0.9], [0.1, 0.9, 0.9, 0.9]];
    }
    else if (d == 3)
    {
        segments = [[0.1, 0.1, 0.9, 0.1], [0.9, 0.1, 0.9, 0.5], [0.1, 0.5, 0.9, 0.5], [0.9, 0.5, 0.9, 0.9], [0.1, 0.9, 0.9, 0.9]];
    }
    else if (d == 4)
    {
        segments = [[0.1, 0.1, 0.1, 0.5], [0.1, 0.5, 0.9, 0.5], [0.9, 0.1, 0.9, 0.9]];
    }
    else if (d == 5)
    {
        segments = [[0.1, 0.1, 0.9, 0.1], [0.1, 0.1, 0.1, 0.5], [0.1, 0.5, 0.9, 0.5], [0.9, 0.5, 0.9, 0.9], [0.1, 0.9, 0.9, 0.9]];
    }
    else if (d == 6)
    {
        segments = [[0.1, 0.1, 0.9, 0.1], [0.1, 0.1, 0.1, 0.9], [0.1, 0.5, 0.9, 0.5], [0.9, 0.5, 0.9, 0.9], [0.1, 0.9, 0.9, 0.9]];
    }
    else if (d == 7)
    {
        segments = [[0.1, 0.1, 0.9, 0.1], [0.9, 0.1, 0.9, 0.9]];
    }
    else if (d == 8)
    {
        segments = [[0.1, 0.1, 0.9, 0.1], [0.9, 0.1, 0.9, 0.5], [0.1, 0.5, 0.9, 0.5], [0.1, 0.1, 0.1, 0.5], [0.1, 0.5, 0.1, 0.9], [0.9, 0.5, 0.9, 0.9], [0.1, 0.9, 0.9, 0.9]];
    }
    else if (d == 9)
    {
        segments = [[0.1, 0.1, 0.9, 0.1], [0.1, 0.1, 0.1, 0.5], [0.1, 0.5, 0.9, 0.5], [0.9, 0.1, 0.9, 0.9], [0.1, 0.9, 0.9, 0.9]];
    }
    
    // Draw each segment
    // Note: Flip both X and Y coordinates because SVG coordinate system is Y-down, Onshape is Y-up
    // This causes both horizontal and vertical mirroring
    for (var segIdx = 0; segIdx < size(segments); segIdx += 1)
    {
        const seg = segments[segIdx];
        // Convert normalized coordinates to actual positions
        // Flip X coordinates: use (1.0 - seg[0]) instead of seg[0] to mirror horizontally
        // Flip Y coordinates: use (1.0 - seg[1]) instead of seg[1] to mirror vertically
        const x1 = centerPos[0] + (1.0 - seg[0] - 0.5) * w;
        const y1 = centerPos[1] + (1.0 - seg[1] - 0.5) * h;
        const x2 = centerPos[0] + (1.0 - seg[2] - 0.5) * w;
        const y2 = centerPos[1] + (1.0 - seg[3] - 0.5) * h;
        
        skLineSegment(sk, "segid_p" ~ pathIndex ~ "_" ~ entityCount ~ "_" ~ segIdx, {
            "start" : vector(x1, y1),
            "end" : vector(x2, y2),
            "construction" : true
        });
        entityCount = entityCount + 1;
    }
    
    return entityCount;
}

// Draw a number (can be multi-digit) at a given position
function drawNumber(sk is Sketch, num is number, centerPos is Vector, charSize is ValueWithUnits, entityCount is number, pathIndex is number) returns number
{
    // Convert number to string to get digits
    const numStr = toString(floor(num));
    const numDigits = length(numStr);
    
    // Calculate spacing between digits
    const digitSpacing = charSize * 1.2;
    const totalWidth = (numDigits - 1) * digitSpacing;
    const startX = centerPos[0] - totalWidth / 2;
    
    // Draw each digit
    for (var i = 0; i < numDigits; i += 1)
    {
        const digitChar = chAt(numStr, i);
        const digitValue = digitValue(digitChar);
        const digitX = startX + i * digitSpacing;
        const digitPos = vector(digitX, centerPos[1]);
        entityCount = drawDigit(sk, digitValue, digitPos, charSize, entityCount, pathIndex);
    }
    
    return entityCount;
}

function extractAttribute(tag is string, name is string) returns string
{
    const lt = toLowerAscii(tag);
    const ln = toLowerAscii(name);
    const nameLen = length(ln);
    var foundPos = -1;
    var i = 0;
    while (i <= length(lt) - nameLen - 1)
    {
        if (substring(lt, i, i + nameLen) == ln && chAt(lt, i + nameLen) == "=")
        {
            if (i == 0)
            {
                foundPos = i;
                break;
            }
            else
            {
                const prevChar = chAt(lt, i - 1);
                if (prevChar == " " || prevChar == "\t" || prevChar == "\n" ||
                    prevChar == "," || isControlChar(prevChar))
                {
                    foundPos = i;
                    break;
                }
            }
        }
        i = i + 1;
    }
    if (foundPos == -1) return "";
    i = foundPos + nameLen;
    while (i < length(tag) && isWs(chAt(tag, i))) i = i + 1;
    if (i >= length(tag) || chAt(tag, i) != "=") return "";
    i = i + 1;
    while (i < length(tag) && isWs(chAt(tag, i))) i = i + 1;
    if (i >= length(tag)) return "";
    const q = chAt(tag, i);
    if (q != "\"" && q != "'") return "";
    i = i + 1;
    const start = i;
    while (i < length(tag) && chAt(tag, i) != q) i = i + 1;
    return substring(tag, start, i);
}

function parseAttributeNumber(tag is string, attrName is string, defaultValue is number) returns number
{
    const attrStr = extractAttribute(tag, attrName);
    if (length(attrStr) == 0) return defaultValue;
    const numResult = parseNumber(attrStr, 0);
    return numResult.value;
}

function parseTransform(str is string) returns array
{
    var result = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
    if (length(str) == 0) return result;
    const strLower = toLowerAscii(str);
    var pos = 0;
    while (pos < length(strLower))
    {
        while (pos < length(strLower) && (chAt(strLower, pos) == " " || chAt(strLower, pos) == "," || chAt(strLower, pos) == "\t" || chAt(strLower, pos) == "\n"))
        {
            pos = pos + 1;
        }
        if (pos >= length(strLower)) break;
        var transform = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
        var foundTransform = false;
        if (pos + 7 <= length(strLower) && substring(strLower, pos, pos + 7) == "matrix(")
        {
            const start = pos + 7;
            const endParen = indexOf(str, ")", start);
            if (endParen != -1)
            {
                const vals = splitCsv(substring(str, start, endParen));
                if (size(vals) >= 6)
                {
                    transform = [
                        stringToNumberManualNoPos(vals[0]), stringToNumberManualNoPos(vals[1]),
                        stringToNumberManualNoPos(vals[2]), stringToNumberManualNoPos(vals[3]),
                        stringToNumberManualNoPos(vals[4]), stringToNumberManualNoPos(vals[5])
                    ];
                    foundTransform = true;
                }
                pos = endParen + 1;
            }
            else pos = pos + 7;
        }
        else if (pos + 10 <= length(strLower) && substring(strLower, pos, pos + 10) == "translate(")
        {
            const start = pos + 10;
            const endParen = indexOf(str, ")", start);
            if (endParen != -1)
            {
                const vals = splitCsv(substring(str, start, endParen));
                if (size(vals) >= 1)
                {
                    const tx = stringToNumberManualNoPos(vals[0]);
                    const ty = (size(vals) >= 2) ? stringToNumberManualNoPos(vals[1]) : 0.0;
                    transform = [1.0, 0.0, 0.0, 1.0, tx, ty];
                    foundTransform = true;
                }
                pos = endParen + 1;
            }
            else pos = pos + 10;
        }
        else if (pos + 6 <= length(strLower) && substring(strLower, pos, pos + 6) == "scale(")
        {
            const start = pos + 6;
            const endParen = indexOf(str, ")", start);
            if (endParen != -1)
            {
                const vals = splitCsv(substring(str, start, endParen));
                if (size(vals) >= 1)
                {
                    const sx = stringToNumberManualNoPos(vals[0]);
                    const sy = (size(vals) >= 2) ? stringToNumberManualNoPos(vals[1]) : sx;
                    transform = [sx, 0.0, 0.0, sy, 0.0, 0.0];
                    foundTransform = true;
                }
                pos = endParen + 1;
            }
            else pos = pos + 6;
        }
        else if (pos + 7 <= length(strLower) && substring(strLower, pos, pos + 7) == "rotate(")
        {
            const start = pos + 7;
            const endParen = indexOf(str, ")", start);
            if (endParen != -1)
            {
                const vals = splitCsv(substring(str, start, endParen));
                if (size(vals) >= 1)
                {
                    const angleDeg = stringToNumberManualNoPos(vals[0]);
                    const angleRad = angleDeg * PI / 180.0;
                    const cosA = cos(angleRad * radian);
                    const sinA = sin(angleRad * radian);
                    if (size(vals) >= 3)
                    {
                        const cx = stringToNumberManualNoPos(vals[1]);
                        const cy = stringToNumberManualNoPos(vals[2]);
                        transform = [cosA, sinA, -sinA, cosA, cx - cosA * cx + sinA * cy, cy - sinA * cx - cosA * cy];
                    }
                    else
                    {
                        transform = [cosA, sinA, -sinA, cosA, 0.0, 0.0];
                    }
                    foundTransform = true;
                }
                pos = endParen + 1;
            }
            else pos = pos + 7;
        }
        else if (pos + 6 <= length(strLower) && substring(strLower, pos, pos + 6) == "skewx(")
        {
            const start = pos + 6;
            const endParen = indexOf(str, ")", start);
            if (endParen != -1)
            {
                const vals = splitCsv(substring(str, start, endParen));
                if (size(vals) >= 1)
                {
                    const angleDeg = stringToNumberManualNoPos(vals[0]);
                    const angleRad = angleDeg * PI / 180.0;
                    const tanA = tan(angleRad * radian);
                    transform = [1.0, 0.0, tanA, 1.0, 0.0, 0.0];
                    foundTransform = true;
                }
                pos = endParen + 1;
            }
            else pos = pos + 6;
        }
        else if (pos + 6 <= length(strLower) && substring(strLower, pos, pos + 6) == "skewy(")
        {
            const start = pos + 6;
            const endParen = indexOf(str, ")", start);
            if (endParen != -1)
            {
                const vals = splitCsv(substring(str, start, endParen));
                if (size(vals) >= 1)
                {
                    const angleDeg = stringToNumberManualNoPos(vals[0]);
                    const angleRad = angleDeg * PI / 180.0;
                    const tanA = tan(angleRad * radian);
                    transform = [1.0, tanA, 0.0, 1.0, 0.0, 0.0];
                    foundTransform = true;
                }
                pos = endParen + 1;
            }
            else pos = pos + 6;
        }
        else
        {
            pos = pos + 1;
        }
        if (foundTransform)
        {
            result = multiplyMatrices(result, transform);
        }
    }
    return result;
}

function multiplyMatrices(m1 is array, m2 is array) returns array
{
    const a1 = m1[0]; const b1 = m1[1]; const c1 = m1[2]; const d1 = m1[3]; const e1 = m1[4]; const f1 = m1[5];
    const a2 = m2[0]; const b2 = m2[1]; const c2 = m2[2]; const d2 = m2[3]; const e2 = m2[4]; const f2 = m2[5];
    return [
        a1 * a2 + c1 * b2,
        b1 * a2 + d1 * b2,
        a1 * c2 + c1 * d2,
        b1 * c2 + d1 * d2,
        a1 * e2 + c1 * f2 + e1,
        b1 * e2 + d1 * f2 + f1
    ];
}

function extractStrokeDashArray(styleAttr is string) returns string
{
    const dashArrayPos = indexOf(toLowerAscii(styleAttr), "stroke-dasharray");
    if (dashArrayPos != -1)
    {
        var i = dashArrayPos + length("stroke-dasharray");
        while (i < length(styleAttr) && isWs(chAt(styleAttr, i))) i = i + 1;
        if (i < length(styleAttr) && chAt(styleAttr, i) == ":")
        {
            i = i + 1;
            while (i < length(styleAttr) && isWs(chAt(styleAttr, i))) i = i + 1;
            var valueStart = i;
            while (i < length(styleAttr) && chAt(styleAttr, i) != ";" && chAt(styleAttr, i) != "\"") i = i + 1;
            return trimStr(substring(styleAttr, valueStart, i));
        }
    }
    return "";
}

function convertPointsToPath(pointsStr is string, closePath is boolean) returns string
{
    var numbers = [];
    var pos = 0;
    while (pos < length(pointsStr))
    {
        while (pos < length(pointsStr) && (isWs(chAt(pointsStr, pos)) || chAt(pointsStr, pos) == ","))
        {
            pos = pos + 1;
        }
        if (pos >= length(pointsStr)) break;
        const numResult = parseNumber(pointsStr, pos);
        if (numResult.endPos > pos)
        {
            numbers = append(numbers, numResult.value);
            pos = numResult.endPos;
        }
        else
        {
            pos = pos + 1;
        }
    }
    var pathParts = [];
    var i = 0;
    while (i + 1 < size(numbers))
    {
        const x = numbers[i];
        const y = numbers[i + 1];
        if (i == 0)
        {
            pathParts = append(pathParts, "M" ~ x ~ "," ~ y);
        }
        else
        {
            pathParts = append(pathParts, "L" ~ x ~ "," ~ y);
        }
        i = i + 2;
    }
    if (closePath && size(pathParts) > 0)
    {
        pathParts = append(pathParts, "Z");
    }
    return join(pathParts, " ");
}

function isCommandChar(c is string) returns boolean
{
    return c == "M" || c == "m" || c == "L" || c == "l" || c == "C" || c == "c" ||
           c == "S" || c == "s" || c == "Q" || c == "q" || c == "T" || c == "t" ||
           c == "H" || c == "h" || c == "V" || c == "v" ||
           c == "A" || c == "a" || c == "Z" || c == "z";
}

function isNumberStart(c is string) returns boolean
{
    return c == "+" || c == "-" || c == "." || isDigit(c);
}

// parsePointPath removed - unused (parsePoint is used instead)

function cloneElement(baseElement is map) returns map
{
    var instance = {};
    instance["elementType"] = baseElement["elementType"];
    if (baseElement["elementType"] == "path")
    {
        if (baseElement["d"] != undefined) instance["d"] = baseElement["d"];
    }
    else if (baseElement["elementType"] == "rect")
    {
        if (baseElement["x"] != undefined) instance["x"] = baseElement["x"];
        if (baseElement["y"] != undefined) instance["y"] = baseElement["y"];
        if (baseElement["width"] != undefined) instance["width"] = baseElement["width"];
        if (baseElement["height"] != undefined) instance["height"] = baseElement["height"];
    }
    else if (baseElement["elementType"] == "line")
    {
        if (baseElement["x1"] != undefined) instance["x1"] = baseElement["x1"];
        if (baseElement["y1"] != undefined) instance["y1"] = baseElement["y1"];
        if (baseElement["x2"] != undefined) instance["x2"] = baseElement["x2"];
        if (baseElement["y2"] != undefined) instance["y2"] = baseElement["y2"];
    }
    else if (baseElement["elementType"] == "circle")
    {
        if (baseElement["cx"] != undefined) instance["cx"] = baseElement["cx"];
        if (baseElement["cy"] != undefined) instance["cy"] = baseElement["cy"];
        if (baseElement["r"] != undefined) instance["r"] = baseElement["r"];
    }
    else if (baseElement["elementType"] == "ellipse")
    {
        if (baseElement["cx"] != undefined) instance["cx"] = baseElement["cx"];
        if (baseElement["cy"] != undefined) instance["cy"] = baseElement["cy"];
        if (baseElement["rx"] != undefined) instance["rx"] = baseElement["rx"];
        if (baseElement["ry"] != undefined) instance["ry"] = baseElement["ry"];
    }
    if (baseElement["isConstruction"] != undefined) instance["isConstruction"] = baseElement["isConstruction"];
    if (baseElement["id"] != undefined) instance["id"] = baseElement["id"];
    return instance;
}

function expandUseElements(elements is array, debug is boolean) returns array
{
    var result = elements;
    const originalCount = size(elements);
    for (var i = 0; i < originalCount; i += 1)
    {
        const element = elements[i];
        if (element["elementType"] != "use")
        {
            continue;
        }
        var href = "";
        if (element["href"] != undefined)
        {
            href = element["href"];
        }
        if (length(href) == 0)
        {
            continue;
        }
        if (chAt(href, 0) == "#")
        {
            href = substring(href, 1, length(href));
        }
        var useTransform = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
        if (element["transform"] != undefined)
        {
            useTransform = element["transform"];
        }
        var symbolElements = [];
        for (var j = 0; j < originalCount; j += 1)
        {
            const cand = elements[j];
            var parentSymbolId = "";
            if (cand["parentSymbolId"] != undefined)
            {
                parentSymbolId = cand["parentSymbolId"];
            }
            if (length(parentSymbolId) > 0 && parentSymbolId == href)
            {
                symbolElements = append(symbolElements, cand);
            }
        }
        if (size(symbolElements) > 0)
        {
            for (var k = 0; k < size(symbolElements); k += 1)
            {
                const baseElement = symbolElements[k];
                var baseTransform = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
                if (baseElement["transform"] != undefined)
                {
                    baseTransform = baseElement["transform"];
                }
                const instanceTransform = multiplyMatrices(useTransform, baseTransform);
                var instance = cloneElement(baseElement);
                instance["transform"] = instanceTransform;
                instance["sourceUseHref"] = href;
                instance["isHidden"] = false;
                result = append(result, instance);
            }
            continue;
        }
        var baseFound = false;
        var baseElement = {};
        for (var j = 0; j < originalCount; j += 1)
        {
            const cand = elements[j];
            var candId = "";
            if (cand["id"] != undefined)
            {
                candId = cand["id"];
            }
            if (length(candId) > 0 && candId == href)
            {
                baseElement = cand;
                baseFound = true;
                break;
            }
        }
        if (!baseFound)
        {
            continue;
        }
        var baseTransform = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
        if (baseElement["transform"] != undefined)
        {
            baseTransform = baseElement["transform"];
        }
        const instanceTransform = multiplyMatrices(useTransform, baseTransform);
        var instance = cloneElement(baseElement);
        instance["transform"] = instanceTransform;
        instance["sourceUseHref"] = href;
        instance["isHidden"] = false;
        result = append(result, instance);
    }
    return result;
}

/* ────────────── FALLBACK PATH: SVG ELEMENT PARSING ────────────── */

function parseSVGElements(svg is string) returns array
{
    var out = [];
    var p = 0;
    var transformStack = [[1.0, 0.0, 0.0, 1.0, 0.0, 0.0]];
    var defsDepth = 0;
    var symbolStack = [];
    while (p < length(svg))
    {
        const a = indexOf(svg, "<", p);
        if (a == -1) break;
        var tagEnd = -1;
        var inQuotes = false;
        var quoteChar = "";
        var i = a + 1;
        var isSelfClosing = false;
        while (i < length(svg))
        {
            const ch = chAt(svg, i);
            if (!inQuotes && (ch == "\"" || ch == "'"))
            {
                inQuotes = true;
                quoteChar = ch;
            }
            else if (inQuotes && ch == quoteChar)
            {
                inQuotes = false;
                quoteChar = "";
            }
            else if (!inQuotes)
            {
                if (ch == "/" && i + 1 < length(svg) && chAt(svg, i + 1) == ">")
                {
                    tagEnd = i;
                    isSelfClosing = true;
                    i = i + 2;
                    break;
                }
                else if (ch == ">")
                {
                    tagEnd = i;
                    i = i + 1;
                    break;
                }
            }
            i = i + 1;
        }
        if (tagEnd == -1) break;
        const tag = substring(svg, a + 1, tagEnd);
        const b = i;
        if (length(tag) > 0)
        {
            if (chAt(tag, 0) == "/")
            {
                const closeTagName = toLowerAscii(trimStr(substring(tag, 1, length(tag))));
                if (closeTagName == "g" && size(transformStack) > 1)
                {
                    transformStack = subArray(transformStack, 0, size(transformStack) - 1);
                }
                else if (closeTagName == "defs" && defsDepth > 0)
                {
                    defsDepth = defsDepth - 1;
                }
                else if (closeTagName == "symbol" && size(symbolStack) > 0)
                {
                    symbolStack = subArray(symbolStack, 0, size(symbolStack) - 1);
                }
            }
            else
            {
                const sp = indexOf(tag, " ");
                var name = "";
                if (sp == -1)
                    name = toLowerAscii(tag);
                else
                    name = toLowerAscii(substring(tag, 0, sp));
                var inheritedTransform = transformStack[size(transformStack) - 1];
                if (name == "g")
                {
                    const tf = extractAttribute(tag, "transform");
                    var groupTransform = inheritedTransform;
                    if (length(tf) > 0)
                    {
                        groupTransform = multiplyMatrices(inheritedTransform, parseTransform(tf));
                    }
                    if (!isSelfClosing)
                    {
                        transformStack = append(transformStack, groupTransform);
                    }
                }
                else if (name == "defs")
                {
                    if (!isSelfClosing)
                    {
                        defsDepth = defsDepth + 1;
                    }
                }
                else if (name == "symbol")
                {
                    if (!isSelfClosing)
                    {
                        const symbolId = extractAttribute(tag, "id");
                        symbolStack = append(symbolStack, { "id" : symbolId });
                    }
                }
                else if (name == "path" || name == "rect" || name == "line" || name == "ellipse" || name == "circle" || name == "polyline" || name == "polygon" || name == "use")
                {
                    var el = { "elementType" : name };
                    if (name == "path")
                    {
                        var dAttr = extractAttribute(tag, "d");
                        const idAttr = extractAttribute(tag, "id");
                        if (length(dAttr) == 0)
                        {
                            const tagLower = toLowerAscii(tag);
                            var dPos = indexOf(tagLower, " d=");
                            var dLen = 3;
                            if (dPos == -1 && length(tagLower) >= 2 && substring(tagLower, 0, 2) == "d=")
                            {
                                dPos = 0;
                                dLen = 2;
                            }
                            if (dPos != -1)
                            {
                                var manualPos = dPos + dLen;
                                while (manualPos < length(tag) && isWs(chAt(tag, manualPos))) manualPos = manualPos + 1;
                                if (manualPos < length(tag))
                                {
                                    const quote = chAt(tag, manualPos);
                                    if (quote == "\"" || quote == "'")
                                    {
                                        manualPos = manualPos + 1;
                                        const valueStart = manualPos;
                                        while (manualPos < length(tag) && chAt(tag, manualPos) != quote) manualPos = manualPos + 1;
                                        dAttr = substring(tag, valueStart, manualPos);
                                    }
                                }
                            }
                        }
                        el["d"] = dAttr;
                        if (length(idAttr) > 0) el["id"] = idAttr;
                        var strokeDashArray = extractAttribute(tag, "stroke-dasharray");
                        if (length(strokeDashArray) == 0)
                        {
                            const styleAttr = extractAttribute(tag, "style");
                            if (length(styleAttr) > 0)
                            {
                                strokeDashArray = extractStrokeDashArray(styleAttr);
                            }
                        }
                        if (length(strokeDashArray) > 0) el["isConstruction"] = true;
                    }
                    else if (name == "polyline" || name == "polygon")
                    {
                        const pointsAttr = extractAttribute(tag, "points");
                        const idAttr = extractAttribute(tag, "id");
                        if (length(pointsAttr) > 0)
                        {
                            const pathD = convertPointsToPath(pointsAttr, name == "polygon");
                            el["elementType"] = "path";
                            el["d"] = pathD;
                            if (length(idAttr) > 0) el["id"] = idAttr;
                        }
                        var strokeDashArray = extractAttribute(tag, "stroke-dasharray");
                        if (length(strokeDashArray) == 0)
                        {
                            const styleAttr = extractAttribute(tag, "style");
                            if (length(styleAttr) > 0)
                            {
                                strokeDashArray = extractStrokeDashArray(styleAttr);
                            }
                        }
                        if (length(strokeDashArray) > 0) el["isConstruction"] = true;
                    }
                    else if (name == "rect")
                    {
                        const idAttr = extractAttribute(tag, "id");
                        el["x"] = parseAttributeNumber(tag, "x", 0.0);
                        el["y"] = parseAttributeNumber(tag, "y", 0.0);
                        el["width"] = parseAttributeNumber(tag, "width", 0.0);
                        el["height"] = parseAttributeNumber(tag, "height", 0.0);
                        if (length(idAttr) > 0) el["id"] = idAttr;
                        var strokeDashArray = extractAttribute(tag, "stroke-dasharray");
                        if (length(strokeDashArray) == 0)
                        {
                            const styleAttr = extractAttribute(tag, "style");
                            if (length(styleAttr) > 0)
                            {
                                strokeDashArray = extractStrokeDashArray(styleAttr);
                            }
                        }
                        if (length(strokeDashArray) > 0) el["isConstruction"] = true;
                    }
                    else if (name == "line")
                    {
                        const idAttr = extractAttribute(tag, "id");
                        el["x1"] = parseAttributeNumber(tag, "x1", 0.0);
                        el["y1"] = parseAttributeNumber(tag, "y1", 0.0);
                        el["x2"] = parseAttributeNumber(tag, "x2", 0.0);
                        el["y2"] = parseAttributeNumber(tag, "y2", 0.0);
                        if (length(idAttr) > 0) el["id"] = idAttr;
                        var strokeDashArray = extractAttribute(tag, "stroke-dasharray");
                        if (length(strokeDashArray) == 0)
                        {
                            const styleAttr = extractAttribute(tag, "style");
                            if (length(styleAttr) > 0)
                            {
                                strokeDashArray = extractStrokeDashArray(styleAttr);
                            }
                        }
                        if (length(strokeDashArray) > 0) el["isConstruction"] = true;
                    }
                    else if (name == "ellipse")
                    {
                        const idAttr = extractAttribute(tag, "id");
                        el["cx"] = parseAttributeNumber(tag, "cx", 0.0);
                        el["cy"] = parseAttributeNumber(tag, "cy", 0.0);
                        el["rx"] = parseAttributeNumber(tag, "rx", 0.0);
                        el["ry"] = parseAttributeNumber(tag, "ry", 0.0);
                        if (length(idAttr) > 0) el["id"] = idAttr;
                        var strokeDashArray = extractAttribute(tag, "stroke-dasharray");
                        if (length(strokeDashArray) == 0)
                        {
                            const styleAttr = extractAttribute(tag, "style");
                            if (length(styleAttr) > 0)
                            {
                                strokeDashArray = extractStrokeDashArray(styleAttr);
                            }
                        }
                        if (length(strokeDashArray) > 0) el["isConstruction"] = true;
                    }
                    else if (name == "circle")
                    {
                        const idAttr = extractAttribute(tag, "id");
                        el["cx"] = parseAttributeNumber(tag, "cx", 0.0);
                        el["cy"] = parseAttributeNumber(tag, "cy", 0.0);
                        el["r"] = parseAttributeNumber(tag, "r", 0.0);
                        if (length(idAttr) > 0) el["id"] = idAttr;
                        var strokeDashArray = extractAttribute(tag, "stroke-dasharray");
                        if (length(strokeDashArray) == 0)
                        {
                            const styleAttr = extractAttribute(tag, "style");
                            if (length(styleAttr) > 0)
                            {
                                strokeDashArray = extractStrokeDashArray(styleAttr);
                            }
                        }
                        if (length(strokeDashArray) > 0) el["isConstruction"] = true;
                    }
                    else if (name == "use")
                    {
                        const idAttr = extractAttribute(tag, "id");
                        var href = extractAttribute(tag, "href");
                        if (length(href) == 0)
                        {
                            href = extractAttribute(tag, "xlink:href");
                        }
                        const xNum = parseAttributeNumber(tag, "x", 0.0);
                        const yNum = parseAttributeNumber(tag, "y", 0.0);
                        el["elementType"] = "use";
                        el["href"] = href;
                        if (length(idAttr) > 0) el["id"] = idAttr;
                        var localTransform = [1.0, 0.0, 0.0, 1.0, xNum, yNum];
                        const transformAttr = extractAttribute(tag, "transform");
                        if (length(transformAttr) > 0)
                        {
                            const attrTransform = parseTransform(transformAttr);
                            localTransform = multiplyMatrices(attrTransform, localTransform);
                        }
                        const elementTransform = multiplyMatrices(inheritedTransform, localTransform);
                        el["transform"] = elementTransform;
                        out = append(out, el);
                        p = b;
                        continue;
                    }
                    const tf = extractAttribute(tag, "transform");
                    var elementTransform = inheritedTransform;
                    if (length(tf) > 0)
                    {
                        elementTransform = multiplyMatrices(inheritedTransform, parseTransform(tf));
                    }
                    if (elementTransform[0] != 1.0 || elementTransform[1] != 0.0 ||
                        elementTransform[2] != 0.0 || elementTransform[3] != 1.0 ||
                        elementTransform[4] != 0.0 || elementTransform[5] != 0.0)
                    {
                        el["transform"] = elementTransform;
                    }
                    if (defsDepth > 0 || size(symbolStack) > 0)
                    {
                        el["isHidden"] = true;
                    }
                    if (size(symbolStack) > 0)
                    {
                        const currentSymbol = symbolStack[size(symbolStack) - 1];
                        if (length(currentSymbol["id"]) > 0)
                        {
                            el["parentSymbolId"] = currentSymbol["id"];
                        }
                    }
                    out = append(out, el);
                }
            }
        }
        p = b;
    }
    return out;
}

/* ────────────── MAIN FEATURE ────────────── */
annotation { "Feature Type Name" : "SVG to Sketch 47" }
export const pathToSketch = defineFeature(function(context is Context, id is Id, definition is map)
    precondition
    {
        annotation { "Name" : "Input SVG Text" }
        definition.inputText is TextData;

        annotation { "Name" : "Target Sketch Plane",
                     "Filter" : EntityType.FACE,
                     "MaxNumberOfPicks" : 1,
                     "Filter Compound" : QueryFilterCompound.ALLOWS_PLANE }
        definition.sketchPlane is Query;

        annotation { "Name" : "Scale (unitless->mm)", "Default" : 1.0 }
        isReal(definition.scale, POSITIVE_REAL_BOUNDS);

        annotation { "Name" : "Debug mode", "Default" : false }
        definition.debugMode is boolean;

        annotation { "Name" : "Use Intermediate Format", "Default" : false,
                     "Description" : "If true, expects Intermediate Format instead of raw SVG. Auto-detected if input starts with '# Intermediate Format'." }
        definition.useIntermediateFormat is boolean;
    }
    {
        const featureName = "SVG to Sketch 47";
        
        if (definition.inputText == undefined)
        {
            return;
        }
        
        const text = toString(definition.inputText);
        
        // Check if text is empty
        var isEmpty = true;
        for (var i = 0; i < length(text); i += 1)
        {
            if (!isWs(chAt(text, i)))
            {
                isEmpty = false;
                break;
            }
        }
        if (isEmpty)
        {
            return;
        }
        
        // ────────────────────────────────────────────────────────────────
        // FORMAT DETECTION: Prefer IF, fallback to SVG
        // ────────────────────────────────────────────────────────────────
        var useIF = definition.useIntermediateFormat;
        if (!useIF)
        {
            useIF = isIntermediateFormat(text);
        }
        
        if (definition.debugMode)
        {
            println("");
            println("═══════════════════════════════════════════════════════════════");
            println("Feature: " ~ featureName);
            println("Format: " ~ (useIF ? "Intermediate Format (PRIMARY)" : "Raw SVG (FALLBACK)"));
            if (!useIF)
            {
                println("NOTE: Using raw SVG fallback. For best results, use SVG2Sketch-app");
                println("      to generate Intermediate Format, or use v46.5 for raw SVG.");
            }
            println("═══════════════════════════════════════════════════════════════");
            println("");
        }
        
        const sk = newSketch(context, id + "sketch", { "sketchPlane" : definition.sketchPlane });
        
        if (useIF)
        {
            // ────────────────────────────────────────────────────────────────
            // PRIMARY PATH: Intermediate Format (from SVG2Sketch-app)
            // ────────────────────────────────────────────────────────────────
            parseAndExecuteIF(sk, text, definition.scale, definition.debugMode);
        }
        else
        {
            // ────────────────────────────────────────────────────────────────
            // FALLBACK PATH: Raw SVG (from v46.5, performance optimized)
            // ────────────────────────────────────────────────────────────────
            // NOTE: This path is maintained for backward compatibility and
            //       standalone use. For production workflows, prefer IF format
            //       generated by SVG2Sketch-app, or use v46.5 for raw SVG.
            
            // Check if text appears to be valid SVG (don't throw error on launch when empty)
            if (indexOf(text, "<svg") == -1 && indexOf(text, "<SVG") == -1)
            {
                // Not valid SVG and not IF - silently return (likely empty/default on launch)
                return;
            }
            
            var els = parseSVGElements(text);
            els = expandUseElements(els, definition.debugMode == true);
            
            const elementCount = size(els);
            if (elementCount == 0)
            {
                if (indexOf(toLowerAscii(text), "<svg") != -1)
                {
                    throw regenError("No drawable SVG elements found. Ensure the SVG has <path>, <ellipse>, <rect>, <line>, <circle>, or <use>.");
                }
                return;
            }
            
            if (definition.debugMode)
            {
                println("Found " ~ elementCount ~ " SVG elements to process (fallback mode)");
            }
            
            // Create sketch entities from parsed elements
            var entityCount = 0;
            var i = 0;
            while (i < size(els))
            {
                const el = els[i];
                var shouldCreate = true;
                
                if (el["isHidden"] != undefined && el["isHidden"] == true)
                {
                    shouldCreate = false;
                }
                if (el["elementType"] == "use")
                {
                    shouldCreate = false;
                }
                
                if (shouldCreate)
                {
                    const T = getTransform(el);
                    if (el["elementType"] == "path" && length(el["d"]) > 0)
                    {
                        const isConstruction = (el["isConstruction"] != undefined && el["isConstruction"] == true);
                        entityCount = emitPath(sk, el["d"], T, definition.scale, entityCount, isConstruction, definition.debugMode == true, 1.0, false, 0, featureName, "SVG Input");
                    }
                    else if (el["elementType"] == "rect")
                    {
                        const isConstruction = (el["isConstruction"] != undefined && el["isConstruction"] == true);
                        entityCount = createRectEntities(sk, el, T, definition.scale, entityCount, isConstruction);
                    }
                    else if (el["elementType"] == "line")
                    {
                        const isConstruction = (el["isConstruction"] != undefined && el["isConstruction"] == true);
                        entityCount = createLineEntities(sk, el, T, definition.scale, entityCount, isConstruction);
                    }
                    else if (el["elementType"] == "ellipse")
                    {
                        const isConstruction = (el["isConstruction"] != undefined && el["isConstruction"] == true);
                        entityCount = createEllipseEntities(sk, el, T, definition.scale, entityCount, isConstruction);
                    }
                    else if (el["elementType"] == "circle")
                    {
                        const isConstruction = (el["isConstruction"] != undefined && el["isConstruction"] == true);
                        entityCount = createCircleEntities(sk, el, T, definition.scale, entityCount, isConstruction);
                    }
                }
                i = i + 1;
            }
        }
        
        skSolve(sk);
    });

/* ────────────── FALLBACK PATH: RAW SVG PARSING (from v46.5) ────────────── */
// NOTE: This section contains functions for raw SVG parsing (fallback mode)
// These are copied from v46.5 (performance optimized) for backward compatibility
// 
// PRIMARY PATH: Use Intermediate Format (IF) from SVG2Sketch-app
// FALLBACK PATH: Raw SVG parsing (this section)
// 
// For production workflows, prefer IF format. For standalone raw SVG needs,
// consider using v46.5 directly.

// Helper functions for parsePathData and emitPath
// cmdToString removed - unused (printParsedCommands doesn't use it)

// Print concise command summary
function printParsedCommands(cmds is array, label is string)
{
    // Count command types
    var cmdCounts = {} as map;
    for (var i = 0; i < size(cmds); i += 1)
    {
        const cmdType = cmds[i].cmdType;
        if (cmdCounts[cmdType] == undefined) cmdCounts[cmdType] = 0;
        cmdCounts[cmdType] = cmdCounts[cmdType] + 1;
    }
    
    // Build summary string
    var summary = "    Commands (" ~ size(cmds) ~ "): ";
    var first = true;
    for (var cmdType in cmdCounts)
    {
        if (!first) summary = summary ~ ", ";
        summary = summary ~ cmdType ~ "=" ~ cmdCounts[cmdType];
        first = false;
    }
    println(summary);
}

function parsePathData(d is string, debugDetailed is boolean, featureName is string, fileName is string) returns array
{
    // Minimal debug: just show path data length
    // println("    [parsePathData] Parsing path data (length=" ~ length(d) ~ ")");
    
    var cmds = []; 
    var pos = 0;
    var cur = [0.0, 0.0]; 
    var subStart = [0.0, 0.0]; 
    var lastCmd = ""; 
    var lastC2 = undefined;
    var lastQ = undefined;
    var parseErrors = [] as array;
    
    while (pos < length(d))
    {
        while (pos < length(d) && isWs(chAt(d, pos))) pos = pos + 1;
        if (pos >= length(d)) break;

        var c = chAt(d, pos);
        // Debug: Log when we encounter a 'c' command after segment 4 (around position 200-250)
        if (c == "c" && pos > 200 && pos < 250)
        {
            const contextStart = (pos - 30 > 0) ? pos - 30 : 0;
            const contextEnd = (pos + 30 < length(d)) ? pos + 30 : length(d);
            const context = substring(d, contextStart, contextEnd);
            println("    [parsePathData] Found 'c' command at pos " ~ pos ~ ", context: '" ~ context ~ "'");
            println("    [parsePathData]   Current position (cur): [" ~ cur[0] ~ ", " ~ cur[1] ~ "]");
            println("    [parsePathData]   Last command: '" ~ lastCmd ~ "'");
        }
        // Removed verbose main loop debug output
        var explicit = (c == "M" || c == "m" || c == "L" || c == "l" || c == "H" || c == "h" || c == "V" || c == "v" ||
                        c == "C" || c == "c" || c == "S" || c == "s" || c == "Q" || c == "q" || c == "T" || c == "t" ||
                        c == "A" || c == "a" || c == "Z" || c == "z");
        if (explicit)
        {
            pos = pos + 1;
            lastCmd = c;
            // Removed verbose command recognition debug
        }
        else 
        {
            // Before using implicit command, check if there's an explicit command after whitespace
            // Look ahead through whitespace AND numbers to find the next explicit command
            // This handles cases where numbers continue after a newline before an explicit command
            var checkPos = pos;
            var foundExplicitCmd = false;
            var explicitCmdPos = -1;
            var explicitCmdChar = "";
            
            // Look ahead up to 200 characters to find an explicit command
            while (checkPos < length(d) && checkPos < pos + 200)
            {
                const ch = chAt(d, checkPos);
                if (isWs(ch))
                {
                    // Skip whitespace
                    checkPos = checkPos + 1;
                }
                else if (isCommandChar(ch))
                {
                    // Found a command character
                    // Z/z commands are always explicit (they close a path)
                    if (ch == "Z" || ch == "z")
                    {
                        foundExplicitCmd = true;
                        explicitCmdPos = checkPos;
                        explicitCmdChar = "Z";
                        break;
                    }
                    // For case-sensitive commands, uppercase is always explicit
                    // For lowercase 'c', check if there's an uppercase 'C' coming up
                    else if (ch == "C" || ch == "M" || ch == "L" || 
                        ch == "S" || ch == "Q" || ch == "T" || ch == "A" ||
                        ch == "H" || ch == "V")
                    {
                        // Explicit uppercase command found
                        foundExplicitCmd = true;
                        explicitCmdPos = checkPos;
                        explicitCmdChar = ch;
                        break;
                    }
                    else if (ch == "c" && lastCmd == "c")
                    {
                        // Lowercase 'c' while parsing 'c' - check what comes after
                        var lookAhead = checkPos + 1;
                        while (lookAhead < length(d) && lookAhead < checkPos + 100 && isWs(chAt(d, lookAhead))) lookAhead = lookAhead + 1;
                        if (lookAhead < length(d))
                        {
                            const charAfterC = chAt(d, lookAhead);
                            if (charAfterC == "C")
                            {
                                // There's an explicit 'C' coming - use that instead
                                foundExplicitCmd = true;
                                explicitCmdPos = lookAhead;
                                explicitCmdChar = "C";
                                break;
                            }
                            // CRITICAL FIX: If there's a NUMBER after 'c', this 'c' IS an explicit command!
                            // SVG 'c' commands are always followed by numbers (coordinates).
                            if (isNumberStart(charAfterC))
                            {
                                foundExplicitCmd = true;
                                explicitCmdPos = checkPos;
                                explicitCmdChar = "c";
                                break;
                            }
                        }
                        // Otherwise, this 'c' might be part of something else - keep looking
                    }
                    else if (ch != "c" && ch != lastCmd)
                    {
                        // Different command character - explicit command found
                        foundExplicitCmd = true;
                        explicitCmdPos = checkPos;
                        explicitCmdChar = ch;
                        break;
                    }
                    // If it's the same command (lowercase 'c' while parsing 'c'), it might be continuation
                    // Continue looking for an explicit uppercase command
                    checkPos = checkPos + 1;
                }
                else if (isNumberStart(ch) || isDigit(ch) || ch == "." || ch == "+" || ch == "-" || ch == ",")
                {
                    // Skip numbers and number-related characters - they're part of the current command
                    // Skip to the end of this number
                    while (checkPos < length(d) && (isDigit(chAt(d, checkPos)) || chAt(d, checkPos) == "." || 
                           chAt(d, checkPos) == "+" || chAt(d, checkPos) == "-" || chAt(d, checkPos) == "e" || 
                           chAt(d, checkPos) == "E")) checkPos = checkPos + 1;
                    // Skip comma if present
                    if (checkPos < length(d) && chAt(d, checkPos) == ",") checkPos = checkPos + 1;
                }
                else
                {
                    // Unexpected character - stop looking
                    break;
                }
            }
            
            if (foundExplicitCmd)
            {
                // There's an explicit command ahead, skip to it and use that instead
                pos = explicitCmdPos;
                c = explicitCmdChar;
                explicit = true;
                pos = pos + 1;
                lastCmd = c;
            }
            else if (length(lastCmd) == 0)
            {
                parseErrors = append(parseErrors, "ERROR at position " ~ pos ~ ": No previous command to repeat, found character: '" ~ c ~ "'");
                pos = pos + 1;
                continue;
            }
            else
            {
                c = lastCmd;
                // Using implicit command
            }
        }
        
        if (c == "M" || c == "m")
        {
            var first = true;
            while (true)
            {
                const pr = parsePoint(d, pos);
                pos = pr.endPos;
                var p = pr.point; 
                if (c == "m") p = [cur[0] + p[0], cur[1] + p[1]];
                
                if (first)
                {
                    cmds = append(cmds, { "cmdType" : "M", "point" : p });
                    cur = p; subStart = p; first = false;
                }
                else
                {
                    cmds = append(cmds, { "cmdType" : "L", "point" : p });
                    cur = p;
                }
                
                // Check for continuation
                pos = skipWsComma(d, pos);
                if (pos >= length(d)) break;
                const nextChar = chAt(d, pos);
                if (isCommandChar(nextChar)) break;
                if (!isNumberStart(nextChar)) break;
            }
            lastC2 = undefined;
            lastQ = undefined;
        }
        else if (c == "L" || c == "l")
        {
            var firstPoint = true;
            var iterationCount = 0;
            while (true)
            {
                iterationCount = iterationCount + 1;
                
                // On subsequent iterations, check BEFORE parsing
                if (!firstPoint)
                {
                    const posBeforeSkip = pos;
                    pos = skipWsComma(d, pos);
                    if (pos >= length(d)) 
                    {
                        break;
                    }
                    
                    const nextChar = chAt(d, pos);
                    if (isCommandChar(nextChar))
                    {
                        break;
                    }
                    if (!isNumberStart(nextChar))
                    {
                        // Not a number and not a command - could be whitespace that skipWsComma didn't skip
                        // Always peek ahead (skipping whitespace) to see if the next non-whitespace character is a command or number
                        // If so, treat the current character as whitespace and advance past it
                        var shouldAdvance = false;
                        var testPos = pos + 1;
                        // Skip past any whitespace to find the next meaningful character
                        while (testPos < length(d) && isWs(chAt(d, testPos))) testPos = testPos + 1;
                        if (testPos < length(d))
                        {
                            const testChar = chAt(d, testPos);
                            if (isCommandChar(testChar) || isNumberStart(testChar))
                            {
                                // The next non-whitespace character is a command or number, so current char is likely whitespace
                                shouldAdvance = true;
                                // Character appears to be whitespace, advancing
                            }
                        }
                        
                        if (isWs(nextChar))
                        {
                            // Also check isWs - if it recognizes it as whitespace, definitely advance
                            shouldAdvance = true;
                            if (debugDetailed && !shouldAdvance)
                            {
                                println("    [parsePathData]   WARNING: Found whitespace after skipWsComma, manually advancing");
                            }
                        }
                        
                        if (shouldAdvance)
                        {
                            // Manually advance past this character and any additional whitespace
                            pos = pos + 1;
                            // Skip any additional whitespace
                            while (pos < length(d) && isWs(chAt(d, pos))) pos = pos + 1;
                            if (pos >= length(d)) break;
                            const charAfterWs = chAt(d, pos);
                            if (isCommandChar(charAfterWs))
                            {
                                // Found command after whitespace, breaking
                                break;
                            }
                            if (!isNumberStart(charAfterWs))
                            {
                                // Not a number after whitespace, breaking
                                break;
                            }
                            // After skipping whitespace, found a number - continue to parse it
                        }
                        else
                        {
                            // Not a number and not whitespace, breaking
                            break;
                        }
                    }
                }
                
                // Now parse the point
                const posBeforeParse = pos;
                // Removed verbose first iteration debug
                const pr = parsePoint(d, pos);
                pos = pr.endPos;
                // Removed verbose point parsing debug
                var p = pr.point; 
                if (c == "l") p = [cur[0] + p[0], cur[1] + p[1]];
                cmds = append(cmds, { "cmdType" : "L", "point" : p }); 
                cur = p;
                
                firstPoint = false;
            }
            lastC2 = undefined;
            lastQ = undefined;
        }
        else if (c == "H" || c == "h")
        {
            var firstValue = true;
            while (true)
            {
                // On subsequent iterations, check BEFORE parsing
                if (!firstValue)
                {
                    pos = skipWsComma(d, pos);
                    if (pos >= length(d)) break;
                    
                    const nextChar = chAt(d, pos);
                    if (isCommandChar(nextChar)) break;
                    if (!isNumberStart(nextChar)) break;
                }
                
                // Now parse the number
                const xr = parseNumber(d, pos);
                pos = xr.endPos;
                var p = [ (c == "h" ? cur[0] + xr.value : xr.value), cur[1] ];
                cmds = append(cmds, { "cmdType" : "L", "point" : p }); 
                cur = p;
                
                firstValue = false;
            }
            lastC2 = undefined;
            lastQ = undefined;
        }
        else if (c == "V" || c == "v")
        {
            var firstValue = true;
            while (true)
            {
                // On subsequent iterations, check BEFORE parsing
                if (!firstValue)
                {
                    pos = skipWsComma(d, pos);
                    if (pos >= length(d)) break;
                    
                    const nextChar = chAt(d, pos);
                    if (isCommandChar(nextChar)) break;
                    if (!isNumberStart(nextChar)) break;
                }
                
                // Now parse the number
                const yr = parseNumber(d, pos);
                pos = yr.endPos;
                var p = [ cur[0], (c == "v" ? cur[1] + yr.value : yr.value) ];
                cmds = append(cmds, { "cmdType" : "L", "point" : p }); 
                cur = p;
                
                firstValue = false;
            }
            lastC2 = undefined;
            lastQ = undefined;
        }
        else if (c == "C" || c == "c")
        {
            var firstCurve = true;
            var curveCount = 0;
            while (true)
            {
                curveCount = curveCount + 1;
                // On subsequent iterations, check BEFORE parsing
                if (!firstCurve)
                {
                    pos = skipWsComma(d, pos);
                    if (pos >= length(d)) break;
                    
                    const nextChar = chAt(d, pos);
                    // Special check: if we encounter 'z' or 'Z', we must break (Z closes the subpath)
                    if (nextChar == "z" || nextChar == "Z") break;
                    
                    // Check for explicit command characters
                    // In SVG, case matters: uppercase = absolute, lowercase = relative
                    // But both are explicit commands and should break implicit continuation
                    // The tricky case is when we're parsing 'c' (relative) and encounter another 'c'
                    // - if it's immediately after whitespace, it's likely an explicit command
                    // - if it's part of a number (like in "1.5c"), it's not a command
                    // We can distinguish by checking if there's whitespace before it
                    if (isCommandChar(nextChar))
                    {
                        // If we're parsing 'c' and encounter 'c', check if it's an explicit command
                        // by looking ahead to see if there's a different command or if we've parsed enough numbers
                        if (c == "c" && nextChar == "c")
                        {
                            // Look ahead through whitespace to see what comes after this 'c'
                            var lookAheadPos = pos + 1;
                            while (lookAheadPos < length(d) && lookAheadPos < pos + 50 && isWs(chAt(d, lookAheadPos))) lookAheadPos = lookAheadPos + 1;
                            if (lookAheadPos < length(d))
                            {
                                const charAfter = chAt(d, lookAheadPos);
                                // If there's a command (especially uppercase) after, this 'c' is definitely an explicit command
                                if (isCommandChar(charAfter) && charAfter != "c")
                                {
                                    // There's another command after - this 'c' is explicit, break
                                    break;
                                }
                                if (charAfter == "C")
                                {
                                    // Explicit uppercase 'C' coming - break
                                    break;
                                }
                                // CRITICAL FIX: If there's a NUMBER after the 'c', this 'c' IS a new explicit command
                                // because valid SVG path data has 'c' followed by coordinates (numbers).
                                // A 'c' embedded in number continuation would not have numbers directly after it.
                                if (isNumberStart(charAfter))
                                {
                                    // 'c' followed by a number = new explicit 'c' command, break
                                    break;
                                }
                            }
                            // If we couldn't determine, treat as explicit command and break
                            break;
                        }
                        else
                        {
                            // Any other command character (including uppercase 'C') is explicit - break
                            break;
                        }
                    }
                    if (!isNumberStart(nextChar))
                    {
                        // Not a number start - break
                        break;
                    }
                }
                else
                {
                    // On first iteration, also check if we're at a Z command before parsing
                    const posBeforeCheck = pos;
                    pos = skipWsComma(d, pos);
                    if (pos < length(d))
                    {
                        const peekChar = chAt(d, pos);
                        if (peekChar == "z" || peekChar == "Z")
                        {
                            // Reset pos and break - let main loop handle the Z
                            pos = posBeforeCheck;
                            break;
                        }
                    }
                    // Reset pos to before the skip since we'll parse from there
                    pos = posBeforeCheck;
                }
                
                // Now parse the three points
                const r1StartPos = pos;
                const r1 = parsePoint(d, pos);
                pos = r1.endPos;
                const r2StartPos = pos;
                const r2 = parsePoint(d, pos); 
                pos = r2.endPos;
                const r3StartPos = pos;
                const r3 = parsePoint(d, pos);
                pos = r3.endPos;
                
                // Workaround for malformed path data: if Y is 0 and next char is a command (like 'z'),
                // the Y coordinate is likely missing. Use the current Y coordinate as fallback.
                var endPoint = r3.point;
                if (abs(endPoint[1]) < 1e-9 && pos < length(d))
                {
                    const nextChar = chAt(d, pos);
                    if (isCommandChar(nextChar) || nextChar == "z" || nextChar == "Z")
                    {
                        // Y coordinate is missing, use current Y as fallback
                        endPoint = [endPoint[0], cur[1]];
                    }
                }
                
                var c1 = r1.point; 
                var c2 = r2.point; 
                var pC = endPoint;
                
                if (c == "c") 
                { 
                    c1 = [cur[0] + c1[0], cur[1] + c1[1]];
                    c2 = [cur[0] + c2[0], cur[1] + c2[1]]; 
                    pC = [cur[0] + pC[0], cur[1] + pC[1]];
                }
                
                cmds = append(cmds, { "cmdType" : "C", "control1" : c1, "control2" : c2, "point" : pC });
                cur = pC; 
                lastC2 = c2; 
                lastQ = undefined;
                
                firstCurve = false;
            }
        }
        else if (c == "S" || c == "s")
        {
            var firstCurve = true;
            while (true)
            {
                // On subsequent iterations, check BEFORE parsing
                if (!firstCurve)
                {
                    pos = skipWsComma(d, pos);
                    if (pos >= length(d)) break;
                    
                    const nextChar = chAt(d, pos);
                    if (isCommandChar(nextChar)) break;
                    if (!isNumberStart(nextChar)) break;
                }
                
                // Now parse the two points
                const r2 = parsePoint(d, pos);
                pos = r2.endPos;
                const r3 = parsePoint(d, pos); 
                pos = r3.endPos;
                
                var refl = cur;
                if (lastC2 != undefined) 
                    refl = [ 2.0 * cur[0] - lastC2[0], 2.0 * cur[1] - lastC2[1] ];
                
                var c2 = r2.point; 
                var pS = r3.point;
                
                if (c == "s") 
                { 
                    c2 = [cur[0] + c2[0], cur[1] + c2[1]];
                    pS = [cur[0] + pS[0], cur[1] + pS[1]]; 
                }
                
                cmds = append(cmds, { "cmdType" : "C", "control1" : refl, "control2" : c2, "point" : pS });
                cur = pS; 
                lastC2 = c2; 
                lastQ = undefined;
                
                firstCurve = false;
            }
        }
        else if (c == "Q" || c == "q")
        {
            var firstCurve = true;
            while (true)
            {
                // On subsequent iterations, check BEFORE parsing
                if (!firstCurve)
                {
                    pos = skipWsComma(d, pos);
                    if (pos >= length(d)) break;
                    
                    const nextChar = chAt(d, pos);
                    if (isCommandChar(nextChar)) break;
                    if (!isNumberStart(nextChar)) break;
                }
                
                // Now parse the two points
                const r1 = parsePoint(d, pos);
                pos = r1.endPos;
                const r2 = parsePoint(d, pos); 
                pos = r2.endPos;
                
                var cq = r1.point; 
                var pQ = r2.point;
                
                if (c == "q") 
                { 
                    cq = [cur[0] + cq[0], cur[1] + cq[1]];
                    pQ = [cur[0] + pQ[0], cur[1] + pQ[1]]; 
                }
                
                cmds = append(cmds, { "cmdType" : "Q", "control" : cq, "point" : pQ });
                cur = pQ; 
                lastQ = cq; 
                lastC2 = undefined;
                
                firstCurve = false;
            }
        }
        else if (c == "T" || c == "t")
        {
            var firstPoint = true;
            while (true)
            {
                // On subsequent iterations, check BEFORE parsing
                if (!firstPoint)
                {
                    pos = skipWsComma(d, pos);
                    if (pos >= length(d)) break;
                    
                    const nextChar = chAt(d, pos);
                    if (isCommandChar(nextChar)) break;
                    if (!isNumberStart(nextChar)) break;
                }
                
                // Now parse the point
                const r1 = parsePoint(d, pos);
                pos = r1.endPos;
                
                var cRef = cur; 
                if (lastQ != undefined) 
                    cRef = [ 2.0 * cur[0] - lastQ[0], 2.0 * cur[1] - lastQ[1] ];
                
                var pT = r1.point; 
                if (c == "t") pT = [cur[0] + pT[0], cur[1] + pT[1]];
                
                cmds = append(cmds, { "cmdType" : "Q", "control" : cRef, "point" : pT });
                cur = pT; 
                lastQ = cRef;
                lastC2 = undefined;
                
                firstPoint = false;
            }
        }
        else if (c == "A" || c == "a")
        {
            var firstArc = true;
            while (true)
            {
                // On subsequent iterations, check BEFORE parsing
                if (!firstArc)
                {
                    pos = skipWsComma(d, pos);
                    if (pos >= length(d)) break;
                    
                    const nextChar = chAt(d, pos);
                    if (isCommandChar(nextChar)) break;
                    if (!isNumberStart(nextChar)) break;
                }
                
                // Now parse the arc parameters
                const rxr = parseNumber(d, pos);
                pos = rxr.endPos;
                const ryr = parseNumber(d, pos); 
                pos = ryr.endPos;
                const rot = parseNumber(d, pos); 
                pos = rot.endPos;
                const lar = parseNumber(d, pos); 
                pos = lar.endPos;
                const swr = parseNumber(d, pos); 
                pos = swr.endPos;
                const pr = parsePoint(d, pos); 
                pos = pr.endPos;
                
                var pA = pr.point;
                if (c == "a") pA = [cur[0] + pA[0], cur[1] + pA[1]];
                
                cmds = append(cmds, { 
                    "cmdType" : "A", 
                    "rx" : rxr.value, 
                    "ry" : ryr.value, 
                    "rotation" : rot.value, 
                    "largeArc" : lar.value > 0.5, 
                    "sweep" : swr.value > 0.5, 
                    "point" : pA 
                });
                cur = pA; 
                lastC2 = undefined; 
                lastQ = undefined;
                
                firstArc = false;
            }
        }
        else if (c == "Z" || c == "z")
        {
            cmds = append(cmds, { "cmdType" : "Z" });
            cur = subStart; 
            lastC2 = undefined; 
            lastQ = undefined;
            lastCmd = "";  // Clear lastCmd so next command must be explicit (prevents continuation after Z)
        }
        else 
        {
            parseErrors = append(parseErrors, "WARNING at position " ~ pos ~ ": Unknown character '" ~ c ~ "', skipping");
            pos = pos + 1;
        }
    }
    
    if (size(parseErrors) > 0)
    {
        println("    [parsePathData] Parsing errors/warnings (" ~ size(parseErrors) ~ "):");
        for (var errIdx = 0; errIdx < size(parseErrors); errIdx += 1)
        {
            println("      " ~ parseErrors[errIdx]);
        }
    }
    
    if (size(cmds) == 0)
    {
        println("    [parsePathData] ERROR: No valid commands parsed from path data!");
        println("    [parsePathData]   Input length: " ~ length(d));
        println("    [parsePathData]   Input preview: " ~ (length(d) > 200 ? substring(d, 0, 200) ~ "..." : d));
    }
    else if (debugDetailed)
    {
        // Print detailed command list for comparison
        printParsedCommands(cmds, fileName);
    }
    
    return cmds;
}

function arcEndpointToCenter(start is array, end is array, rx is number, ry is number, rotDeg is number, largeArc is boolean, sweep is boolean) returns map
{
    if ((start[0] == end[0]) && (start[1] == end[1])) return { "valid" : false };
    if (rx == 0 || ry == 0) return { "valid" : false };

    const phi = rad(rotDeg);
    const cphi = cos(phi);
    const sphi = sin(phi);
    const dx = (start[0] - end[0]) / 2.0;
    const dy = (start[1] - end[1]) / 2.0;
    const x1p =  cphi * dx + sphi * dy;
    const y1p = -sphi * dx + cphi * dy;

    var RX = abs(rx);
    var RY = abs(ry);
    const lam = (x1p * x1p) / (RX * RX) + (y1p * y1p) / (RY * RY);
    if (lam > 1.0)
    {
        const s = sqrt(lam);
        RX = RX * s;
        RY = RY * s;
    }

    const RX2 = RX * RX;
    const RY2 = RY * RY;
    const x1p2 = x1p * x1p;
    const y1p2 = y1p * y1p;
    var sign = 1.0;
    if (largeArc == sweep) sign = -1.0;
    var num = RX2 * RY2 - RX2 * y1p2 - RY2 * x1p2;
    var den = RX2 * y1p2 + RY2 * x1p2;
    if (den == 0) return { "valid" : false };
    var coef = num / den;
    if (coef < 0) coef = 0;
    const cFac = sign * sqrt(coef);
    const cxp =  cFac * RX * y1p / RY;
    const cyp = -cFac * RY * x1p / RX;

    const midX = (start[0] + end[0]) / 2.0;
    const midY = (start[1] + end[1]) / 2.0;
    const cx =  cphi * cxp - sphi * cyp + midX;
    const cy =  sphi * cxp + cphi * cyp + midY;
    const ux = (x1p - cxp) / RX;
    const uy = (y1p - cyp) / RY;
    const vx = (-x1p - cxp) / RX;
    const vy = (-y1p - cyp) / RY;
    var theta1 = atan2(uy * radian, ux * radian) / radian;
    var dtheta = angleBetween(ux, uy, vx, vy);
    if (!sweep && dtheta > 0) dtheta = dtheta - 2.0 * PI;
    if ( sweep && dtheta < 0) dtheta = dtheta + 2.0 * PI;
    return {
        "valid" : true,
        "center" : [cx, cy],
        "majorAxis" : [cos(phi), sin(phi)],
        "majorRadius" : max(RX, RY),
        "minorRadius" : min(RX, RY),
        "theta1" : theta1,
        "deltaTheta" : dtheta
    };
}

function circParamPoint(center is array, r is number, phi is ValueWithUnits, theta is number) returns array
{
    const ct = cos(theta * radian);
    const st = sin(theta * radian);
    const cph = cos(phi);
    const sph = sin(phi);
    return [center[0] + r * (cph * ct - sph * st), center[1] + r * (sph * ct + cph * st)];
}

function normalizeTurn(t is number) returns number
{
    var x = t - floor(t);
    if (x < 0) x = x + 1.0;
    return x;
}

function createLineSegmentWithSnap(sk is Sketch, name is string, startLocal is array, endLocal is array, T is array, scale is number, isConstruction is boolean, lastEndpoint is map) returns map
{
    const COINCIDENT_TOL = 1e-6;
    var start = startLocal;
    var end = endLocal;
    if (lastEndpoint["last"] != undefined && distanceLocal(start, lastEndpoint["last"]) < COINCIDENT_TOL)
    {
        start = lastEndpoint["last"];
    }
    if (lastEndpoint["last"] != undefined && distanceLocal(end, lastEndpoint["last"]) < COINCIDENT_TOL)
    {
        end = lastEndpoint["last"];
    }
    var lineParams = { "start" : toMM(applyTransform(T, start), scale), "end" : toMM(applyTransform(T, end), scale) };
    if (isConstruction)
    {
        lineParams["construction"] = true;
    }
    skLineSegment(sk, name, lineParams);
    return { "last" : end };
}

function lineMidpoint(startLocal is array, endLocal is array, T is array, scale is number) returns Vector
{
    const midLocal = [(startLocal[0] + endLocal[0]) / 2.0, (startLocal[1] + endLocal[1]) / 2.0];
    const midTransformed = applyTransform(T, midLocal);
    return toMM(midTransformed, scale);
}

function bezierMidpoint(p0 is array, p1 is array, p2 is array, p3 is array, T is array, scale is number) returns Vector
{
    const t = 0.5;
    const mt = 1.0 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;
    const midLocal = [
        mt3 * p0[0] + 3.0 * mt2 * t * p1[0] + 3.0 * mt * t2 * p2[0] + t3 * p3[0],
        mt3 * p0[1] + 3.0 * mt2 * t * p1[1] + 3.0 * mt * t2 * p2[1] + t3 * p3[1]
    ];
    const midTransformed = applyTransform(T, midLocal);
    return toMM(midTransformed, scale);
}

function arcMidpoint(startLocal is array, endLocal is array, centerLocal is array, startAngle is number, deltaAngle is number, T is array, scale is number) returns Vector
{
    const midAngle = startAngle + deltaAngle / 2.0;
    const r = distanceLocal(centerLocal, startLocal);
    const midLocal = [centerLocal[0] + r * cos(midAngle * radian), centerLocal[1] + r * sin(midAngle * radian)];
    const midTransformed = applyTransform(T, midLocal);
    return toMM(midTransformed, scale);
}

function emitPath(sk is Sketch, d is string, T is array, scale is number, entityCount is number, isConstruction is boolean, debugDetailed is boolean, segmentIdScale is number, showSegmentIds is boolean, pathIndex is number, featureName is string, fileName is string) returns number
{
    if (debugDetailed)
    {
        // Concise header with essential info only
        println("    [emitPath] Processing " ~ size(parsePathData(d, false, featureName, fileName)) ~ " commands, d=" ~ (length(d) > 60 ? substring(d, 0, 60) ~ "..." : d));
    }
    
    const cmds = parsePathData(d, debugDetailed, featureName, fileName);
    if (debugDetailed)
    {
        // Show transform if not identity
        if (T[0] != 1.0 || T[1] != 0.0 || T[2] != 0.0 || T[3] != 1.0 || T[4] != 0.0 || T[5] != 0.0)
        {
            println("    Transform: [" ~ T[0] ~ ", " ~ T[1] ~ ", " ~ T[2] ~ ", " ~ T[3] ~ ", " ~ T[4] ~ ", " ~ T[5] ~ "]");
        }
        
        if (size(cmds) == 0)
        {
            println("    [emitPath] WARNING: No commands parsed!");
            return entityCount;
        }
    }
    else
    {
        // Minimal output when not debugging
        if (size(cmds) == 0)
        {
            return entityCount;
        }
    }
    
    var cur = [0.0, 0.0];
    var start = [0.0, 0.0];
    var subIdx = 0;
    const EPS = 1e-9;
    const COINCIDENT_TOL = 1e-6; // Tolerance for snapping points to be coincident
    const CLOSURE_TOL = 1e-3; // Larger tolerance for snapping to start when Z follows (for proper closure)
    var lastEndpoint = undefined; // Track last endpoint to ensure coincident connections
    
    var entitiesCreated = 0;
    var lineCount = 0;
    var bezierCount = 0;
    var arcCount = 0;
    
    // Separate counter for drawing segment ID numbers (should not affect entity numbering)
    // Use a large offset (1 million * pathIndex) to ensure segment ID entities never conflict with actual path entities
    // This ensures each path gets its own namespace for segment ID entities
    var drawingEntityCount = entityCount + 1000000 * pathIndex;
    
    // Command-to-entity mapping for comparison
    var commandToEntityMap = [] as array; // Array of {commandIndex, commandType, entityName, entityType, skipped}
    var entityToCommandMap = [] as array; // Array of {entityIndex, entityName, entityType, commandIndex, commandType}

    var i = 0;
    while (i < size(cmds))
    {
        const c = cmds[i];
        const nxt = (i + 1 < size(cmds)) ? cmds[i + 1] : undefined;
        const willZ = (nxt != undefined && nxt.cmdType == "Z");
        
        if (c.cmdType == "M")
        {
            // Start new subpath - no auto-closing (respect SVG semantics where only Z commands close paths)
            // IMPORTANT: Always preserve the original M point as start, don't snap it
            // This ensures Z commands can properly close back to the original start point
            cur = c.point; 
            start = c.point; // Always use the original M point as start, never snap it
            // Only snap cur (current position) for continuity, but keep start unchanged
            if (lastEndpoint != undefined && distanceLocal(cur, lastEndpoint) < COINCIDENT_TOL)
            {
                cur = lastEndpoint;
                // DO NOT modify start here - it must remain the original M point
            }
            const transformed = applyTransform(T, cur);
            const onshapeCoords = toMM(transformed, scale);
            if (debugDetailed)
            {
                println("      M[" ~ i ~ "] -> [" ~ cur[0] ~ ", " ~ cur[1] ~ "]");
            }
            subIdx = subIdx + 1;
            lastEndpoint = cur;
            // Record M command (doesn't create entity)
            commandToEntityMap = append(commandToEntityMap, {
                "commandIndex" : i,
                "commandType" : "M",
                "entityName" : "",
                "entityType" : "",
                "skipped" : false,
                "noEntity" : true
            });
        }
        else if (c.cmdType == "L")
        {
            // Snap current point to last endpoint if very close (ensure coincident paths)
            if (lastEndpoint != undefined && distanceLocal(cur, lastEndpoint) < COINCIDENT_TOL)
            {
                cur = lastEndpoint;
            }
            
            // If Z follows, prioritize snapping to start for perfect closure
            var endLocal = c.point;
            if (willZ)
            {
                // When Z follows, always snap to start if close enough (for proper closure)
                // Use larger tolerance to ensure closure even with small rounding errors
                if (distanceLocal(endLocal, start) < CLOSURE_TOL) 
                {
                    endLocal = start;
                    if (debugDetailed)
                    {
                        println("    [L Command #" ~ i ~ "] Snapped endpoint to start for Z closure: [" ~ endLocal[0] ~ ", " ~ endLocal[1] ~ "]");
                    }
                }
            }
            else
            {
                // Only snap to lastEndpoint if Z is NOT following (to avoid breaking closure)
                if (lastEndpoint != undefined && distanceLocal(endLocal, lastEndpoint) < COINCIDENT_TOL)
                {
                    endLocal = lastEndpoint;
                }
            }
            
            // Skip zero-length segments (unless it's for Z closure)
            const segLen = distanceLocal(cur, endLocal);
            if (segLen < EPS && !willZ)
            {
                if (debugDetailed)
                {
                    println("    [L Command #" ~ i ~ "] SKIPPED: Zero-length segment (start=end)");
                }
                // Record skipped command
                commandToEntityMap = append(commandToEntityMap, {
                    "commandIndex" : i,
                    "commandType" : "L",
                    "entityName" : "",
                    "entityType" : "",
                    "skipped" : true,
                    "reason" : "zero-length segment"
                });
                cur = endLocal;
                lastEndpoint = endLocal;
            }
            else
            {
                const startTransformed = applyTransform(T, cur);
                const endTransformed = applyTransform(T, endLocal);
                const startOnshape = toMM(startTransformed, scale);
                const endOnshape = toMM(endTransformed, scale);
                if (debugDetailed)
                {
                    println("      L[" ~ i ~ "] line #" ~ entityCount);
                }
                const entityName = "L" ~ entityCount;
                const snapResult = createLineSegmentWithSnap(sk, entityName, cur, endLocal, T, scale, isConstruction, { "last" : lastEndpoint });
                // Record command-to-entity mapping
                commandToEntityMap = append(commandToEntityMap, {
                    "commandIndex" : i,
                    "commandType" : "L",
                    "entityName" : entityName,
                    "entityType" : "LINE",
                    "skipped" : false
                });
                entityToCommandMap = append(entityToCommandMap, {
                    "entityIndex" : entitiesCreated,
                    "entityName" : entityName,
                    "entityType" : "LINE",
                    "commandIndex" : i,
                    "commandType" : "L"
                });
                entityCount = entityCount + 1;
                lineCount = lineCount + 1;
                entitiesCreated = entitiesCreated + 1;
                
                // Draw segment ID at midpoint
                if (showSegmentIds)
                {
                    const segmentId = entitiesCreated;
                    const charSize = 0.5 * millimeter * scale * segmentIdScale; // Character size scales with the drawing and user scale factor
                    const midPoint = lineMidpoint(cur, endLocal, T, scale);
                    drawingEntityCount = drawNumber(sk, segmentId, midPoint, charSize, drawingEntityCount, pathIndex);
                }
                
                cur = endLocal;
                lastEndpoint = snapResult.last;
            }
        }
        else if (c.cmdType == "Q")
        {
            // Snap current point to last endpoint if very close
            if (lastEndpoint != undefined && distanceLocal(cur, lastEndpoint) < COINCIDENT_TOL)
            {
                cur = lastEndpoint;
            }
            
            // If Z follows, prioritize snapping to start for perfect closure
            var e = c.point;
            if (willZ)
            {
                // When Z follows, always snap to start if close enough (for proper closure)
                // Use larger tolerance to ensure closure even with small rounding errors
                if (distanceLocal(e, start) < CLOSURE_TOL) 
                {
                    e = start;
                    if (debugDetailed)
                    {
                        println("    [Q Command #" ~ i ~ "] Snapped endpoint to start for Z closure: [" ~ e[0] ~ ", " ~ e[1] ~ "]");
                    }
                }
            }
            
            // Check for degenerate quadratic Bezier
            const distStartControl = distanceLocal(cur, c.control);
            const distControlEnd = distanceLocal(c.control, e);
            const distStartEnd = distanceLocal(cur, e);
            
            if (distStartControl < EPS && distControlEnd < EPS)
            {
                // All points coincident - degenerate, skip
                if (debugDetailed) println("    [emitPath] WARNING: Q command #" ~ i ~ " - All points coincident, skipping");
                // Record skipped command
                commandToEntityMap = append(commandToEntityMap, {
                    "commandIndex" : i,
                    "commandType" : "Q",
                    "entityName" : "",
                    "entityType" : "",
                    "skipped" : true,
                    "reason" : "all points coincident"
                });
                cur = e;
            }
            else if (distStartEnd < EPS)
            {
                // Start and end are coincident - skip (would be zero-length curve)
                if (debugDetailed) println("    [emitPath] WARNING: Q command #" ~ i ~ " - Start and end coincident (zero-length), skipping");
                // Record skipped command
                commandToEntityMap = append(commandToEntityMap, {
                    "commandIndex" : i,
                    "commandType" : "Q",
                    "entityName" : "",
                    "entityType" : "",
                    "skipped" : true,
                    "reason" : "zero-length curve"
                });
                cur = e;
            }
            else
            {
                // Check if the quadratic Bezier is effectively a straight line
                // Convert to cubic first to check flatness, then decide
                var p0 = cur;
                const q1 = c.control;
                const p2 = e;
                
                // Snap current point to last endpoint if very close
                if (lastEndpoint != undefined && distanceLocal(p0, lastEndpoint) < COINCIDENT_TOL)
                {
                    p0 = lastEndpoint;
                }
                
                // Calculate cubic control points for flatness check
                const c1 = [p0[0] + (2.0 / 3.0) * (q1[0] - p0[0]), p0[1] + (2.0 / 3.0) * (q1[1] - p0[1])];
                const c2 = [p2[0] + (2.0 / 3.0) * (q1[0] - p2[0]), p2[1] + (2.0 / 3.0) * (q1[1] - p2[1])];
                
                // Use aggressive flatness tolerance - if curve is very close to a line, use line segment
                // This prevents spurious control points from appearing in Onshape
                const FLATNESS_TOL = 1e-4; // Much more aggressive tolerance
                
                // Validate the curve before creating it
                if (!isValidBezierCurve(p0, c1, c2, p2) || isBezierFlat(p0, c1, c2, p2, FLATNESS_TOL))
                {
                    // Curve is effectively flat - use a line segment to avoid spurious control points
                    if (debugDetailed) println("    [emitPath] NOTE: Q command #" ~ i ~ " converted to line (curve was effectively flat)");
                    var endSnap = p2;
                    if (lastEndpoint != undefined && distanceLocal(p2, lastEndpoint) < COINCIDENT_TOL)
                    {
                        endSnap = lastEndpoint;
                    }
                    const entityName = "Q_line" ~ entityCount;
                    const snapResult = createLineSegmentWithSnap(sk, entityName, p0, endSnap, T, scale, isConstruction, { "last" : lastEndpoint });
                    // Record command-to-entity mapping (Q converted to line)
                    commandToEntityMap = append(commandToEntityMap, {
                        "commandIndex" : i,
                        "commandType" : "Q",
                        "entityName" : entityName,
                        "entityType" : "LINE",
                        "skipped" : false,
                        "converted" : true
                    });
                    entityToCommandMap = append(entityToCommandMap, {
                        "entityIndex" : entitiesCreated,
                        "entityName" : entityName,
                        "entityType" : "LINE",
                        "commandIndex" : i,
                        "commandType" : "Q"
                    });
                    entityCount = entityCount + 1;
                    lineCount = lineCount + 1;
                    entitiesCreated = entitiesCreated + 1;
                    cur = e;
                    lastEndpoint = snapResult.last;
                }
                else
                {
                    // Convert quadratic Bezier to cubic Bezier using proper mathematical conversion
                    // Quadratic: Q(t) = (1-t)²P₀ + 2(1-t)tQ₁ + t²P₂
                    // Cubic equivalent: C(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
                    // Where: P₀ = start, P₁ = (1/3)P₀ + (2/3)Q₁, P₂ = (1/3)P₂ + (2/3)Q₁, P₃ = end
                    
                    // Final validation check using transformed coordinates
                    const p0_val = toMM(applyTransform(T, p0), scale);
                    const c1_val = toMM(applyTransform(T, c1), scale);
                    const c2_val = toMM(applyTransform(T, c2), scale);
                    const p2_val = toMM(applyTransform(T, p2), scale);
                    
                    // Check flatness using transformed coordinates (more accurate)
                    const FLATNESS_TOL_MM = 1e-4 * millimeter; // Tolerance in millimeters
                    if (isBezierFlatVectors(p0_val, c1_val, c2_val, p2_val, FLATNESS_TOL_MM))
                    {
                        // Final check - use line segment to avoid spurious control points
                        var endSnap = p2;
                        if (lastEndpoint != undefined)
                        {
                            const p2_local = [(p2_val[0] / millimeter) / scale, (p2_val[1] / millimeter) / scale];
                            if (distanceLocal(p2_local, lastEndpoint) < COINCIDENT_TOL)
                            {
                                endSnap = lastEndpoint;
                                const endSnap_val = toMM(applyTransform(T, endSnap), scale);
                                const entityName = "Q_line_final" ~ entityCount;
                                const snapResult = createLineSegmentWithSnap(sk, entityName, p0, endSnap, T, scale, isConstruction, { "last" : lastEndpoint });
                                // Record command-to-entity mapping (Q converted to line)
                                commandToEntityMap = append(commandToEntityMap, {
                                    "commandIndex" : i,
                                    "commandType" : "Q",
                                    "entityName" : entityName,
                                    "entityType" : "LINE",
                                    "skipped" : false,
                                    "converted" : true
                                });
                                entityToCommandMap = append(entityToCommandMap, {
                                    "entityIndex" : entitiesCreated,
                                    "entityName" : entityName,
                                    "entityType" : "LINE",
                                    "commandIndex" : i,
                                    "commandType" : "Q"
                                });
                                entityCount = entityCount + 1;
                                lineCount = lineCount + 1;
                                entitiesCreated = entitiesCreated + 1;
                                lastEndpoint = snapResult.last;
                            }
                            else
                            {
                                const entityName = "Q_line_final" ~ entityCount;
                                const snapResult = createLineSegmentWithSnap(sk, entityName, p0, p2, T, scale, isConstruction, { "last" : lastEndpoint });
                                // Record command-to-entity mapping (Q converted to line)
                                commandToEntityMap = append(commandToEntityMap, {
                                    "commandIndex" : i,
                                    "commandType" : "Q",
                                    "entityName" : entityName,
                                    "entityType" : "LINE",
                                    "skipped" : false,
                                    "converted" : true
                                });
                                entityToCommandMap = append(entityToCommandMap, {
                                    "entityIndex" : entitiesCreated,
                                    "entityName" : entityName,
                                    "entityType" : "LINE",
                                    "commandIndex" : i,
                                    "commandType" : "Q"
                                });
                                entityCount = entityCount + 1;
                                lineCount = lineCount + 1;
                                entitiesCreated = entitiesCreated + 1;
                                lastEndpoint = snapResult.last;
                            }
                        }
                        else
                        {
                            const entityName = "Q_line_final" ~ entityCount;
                            const snapResult = createLineSegmentWithSnap(sk, entityName, p0, p2, T, scale, isConstruction, { "last" : lastEndpoint });
                            // Record command-to-entity mapping (Q converted to line)
                            commandToEntityMap = append(commandToEntityMap, {
                                "commandIndex" : i,
                                "commandType" : "Q",
                                "entityName" : entityName,
                                "entityType" : "LINE",
                                "skipped" : false,
                                "converted" : true
                            });
                            entityToCommandMap = append(entityToCommandMap, {
                                "entityIndex" : entitiesCreated,
                                "entityName" : entityName,
                                "entityType" : "LINE",
                                "commandIndex" : i,
                                "commandType" : "Q"
                            });
                            entityCount = entityCount + 1;
                            lineCount = lineCount + 1;
                            entitiesCreated = entitiesCreated + 1;
                            lastEndpoint = snapResult.last;
                        }
                    }
                    else
                    {
                        println("    [Q->C Bezier] SVG start: [" ~ p0[0] ~ ", " ~ p0[1] ~ "] -> Onshape: [" ~ (p0_val[0] / millimeter) ~ "mm, " ~ (p0_val[1] / millimeter) ~ "mm]");
                        println("    [Q->C Bezier] SVG control1: [" ~ c1[0] ~ ", " ~ c1[1] ~ "] -> Onshape: [" ~ (c1_val[0] / millimeter) ~ "mm, " ~ (c1_val[1] / millimeter) ~ "mm]");
                        println("    [Q->C Bezier] SVG control2: [" ~ c2[0] ~ ", " ~ c2[1] ~ "] -> Onshape: [" ~ (c2_val[0] / millimeter) ~ "mm, " ~ (c2_val[1] / millimeter) ~ "mm]");
                        println("    [Q->C Bezier] SVG end: [" ~ p2[0] ~ ", " ~ p2[1] ~ "] -> Onshape: [" ~ (p2_val[0] / millimeter) ~ "mm, " ~ (p2_val[1] / millimeter) ~ "mm]");
                        var bezierParams = {
                            "points" : [p0_val, c1_val, c2_val, p2_val]
                        };
                        if (isConstruction)
                        {
                            bezierParams["construction"] = true;
                        }
                        if (debugDetailed)
                        {
                            println("    [Q Command #" ~ i ~ "] Creating BEZIER entity #" ~ entityCount);
                            println("      SVG start: [" ~ cur[0] ~ ", " ~ cur[1] ~ "] -> Onshape: [" ~ (p0_val[0] / millimeter) ~ "mm, " ~ (p0_val[1] / millimeter) ~ "mm]");
                            println("      SVG control: [" ~ c.control[0] ~ ", " ~ c.control[1] ~ "] -> Onshape: [" ~ (c1_val[0] / millimeter) ~ "mm, " ~ (c1_val[1] / millimeter) ~ "mm]");
                            println("      SVG end: [" ~ e[0] ~ ", " ~ e[1] ~ "] -> Onshape: [" ~ (p2_val[0] / millimeter) ~ "mm, " ~ (p2_val[1] / millimeter) ~ "mm]");
                            println("      ✓ Created BEZIER entity: Q" ~ entityCount);
                        }
                        const entityName = "Q" ~ entityCount;
                        skBezier(sk, entityName, bezierParams);
                        // Record command-to-entity mapping
                        commandToEntityMap = append(commandToEntityMap, {
                            "commandIndex" : i,
                            "commandType" : "Q",
                            "entityName" : entityName,
                            "entityType" : "BEZIER",
                            "skipped" : false
                        });
                        entityToCommandMap = append(entityToCommandMap, {
                            "entityIndex" : entitiesCreated,
                            "entityName" : entityName,
                            "entityType" : "BEZIER",
                            "commandIndex" : i,
                            "commandType" : "Q"
                        });
                        bezierCount = bezierCount + 1;
                        entitiesCreated = entitiesCreated + 1;
                        
                        // Draw segment ID at midpoint
                        if (showSegmentIds)
                        {
                            const segmentId = entitiesCreated;
                            const charSize = 0.5 * millimeter * scale * segmentIdScale;
                            const midPoint = bezierMidpoint(p0, c1, c2, p2, T, scale);
                            drawingEntityCount = drawNumber(sk, segmentId, midPoint, charSize, drawingEntityCount, pathIndex);
                        }
                        
                        lastEndpoint = e;
                    }
                    entityCount = entityCount + 1;
                    cur = e;
                }
            }
        }
        else if (c.cmdType == "C")
        {
            // Snap current point to last endpoint if very close
            if (lastEndpoint != undefined && distanceLocal(cur, lastEndpoint) < COINCIDENT_TOL)
            {
                cur = lastEndpoint;
            }
            
            // If Z follows, prioritize snapping to start for perfect closure
            var e2 = c.point;
            if (willZ)
            {
                // When Z follows, always snap to start if close enough (for proper closure)
                // Use larger tolerance to ensure closure even with small rounding errors
                if (distanceLocal(e2, start) < CLOSURE_TOL) 
                {
                    e2 = start;
                    if (debugDetailed)
                    {
                        println("    [C Command #" ~ i ~ "] Snapped endpoint to start for Z closure: [" ~ e2[0] ~ ", " ~ e2[1] ~ "]");
                    }
                }
            }
            
            // Check for degenerate Bezier curves and special cases
            const p0 = cur;
            const p1 = c.control1;
            const p2 = c.control2;
            const p3 = e2;
            
            const dist01 = distanceLocal(p0, p1);
            const dist12 = distanceLocal(p1, p2);
            const dist23 = distanceLocal(p2, p3);
            const dist03 = distanceLocal(p0, p3);
            
            if (dist01 < EPS && dist12 < EPS && dist23 < EPS)
            {
                // All points are coincident - degenerate curve, skip it
                if (debugDetailed) println("    [emitPath] WARNING: C command #" ~ i ~ " - All points coincident, skipping");
                // Record skipped command
                commandToEntityMap = append(commandToEntityMap, {
                    "commandIndex" : i,
                    "commandType" : "C",
                    "entityName" : "",
                    "entityType" : "",
                    "skipped" : true,
                    "reason" : "all points coincident"
                });
                cur = e2;
            }
            else if (dist01 < EPS && dist23 < EPS)
            {
                // Control1 equals start AND control2 equals end - effectively a straight line
                if (debugDetailed) println("    [emitPath] NOTE: C command #" ~ i ~ " converted to line (control points at endpoints)");
                const entityName = "C_line" ~ entityCount;
                const snapResult = createLineSegmentWithSnap(sk, entityName, cur, e2, T, scale, isConstruction, { "last" : lastEndpoint });
                // Record command-to-entity mapping (C converted to line)
                commandToEntityMap = append(commandToEntityMap, {
                    "commandIndex" : i,
                    "commandType" : "C",
                    "entityName" : entityName,
                    "entityType" : "LINE",
                    "skipped" : false,
                    "converted" : true
                });
                entityToCommandMap = append(entityToCommandMap, {
                    "entityIndex" : entitiesCreated,
                    "entityName" : entityName,
                    "entityType" : "LINE",
                    "commandIndex" : i,
                    "commandType" : "C"
                });
                entityCount = entityCount + 1;
                lineCount = lineCount + 1;
                entitiesCreated = entitiesCreated + 1;
                cur = e2;
                lastEndpoint = snapResult.last;
            }
            else if (dist23 < EPS && dist01 >= EPS)
            {
                // Control2 equals end (but control1 != start)
                // Check if this is effectively a line - if control1 is close to the line p0-p3, use line segment
                const FLATNESS_TOL = 1e-4; // Much more aggressive tolerance
                if (!isValidBezierCurve(p0, p1, p3, p3) || isBezierFlat(p0, p1, p3, p3, FLATNESS_TOL))
                {
                    // Effectively a straight line - use line segment to avoid spurious points
                    const entityName = "C_line" ~ entityCount;
                    const snapResult = createLineSegmentWithSnap(sk, entityName, cur, e2, T, scale, isConstruction, { "last" : lastEndpoint });
                    // Record command-to-entity mapping (C converted to line)
                    commandToEntityMap = append(commandToEntityMap, {
                        "commandIndex" : i,
                        "commandType" : "C",
                        "entityName" : entityName,
                        "entityType" : "LINE",
                        "skipped" : false,
                        "converted" : true
                    });
                    entityToCommandMap = append(entityToCommandMap, {
                        "entityIndex" : entitiesCreated,
                        "entityName" : entityName,
                        "entityType" : "LINE",
                        "commandIndex" : i,
                        "commandType" : "C"
                    });
                    entityCount = entityCount + 1;
                    lineCount = lineCount + 1;
                    entitiesCreated = entitiesCreated + 1;
                    cur = e2;
                    lastEndpoint = snapResult.last;
                }
                else
                {
                    // Offset control2 slightly to make curve valid
                    const dirFromC1 = [p3[0] - p1[0], p3[1] - p1[1]];
                    const lenFromC1 = sqrt(dirFromC1[0] * dirFromC1[0] + dirFromC1[1] * dirFromC1[1]);
                    var offsetControl2 = p3;
                    if (lenFromC1 > EPS)
                    {
                        const offsetScale = 0.05; // 5% offset
                        offsetControl2 = [p3[0] - dirFromC1[0] * offsetScale, p3[1] - dirFromC1[1] * offsetScale];
                    }
                    else
                    {
                        // If control1 is also at end, offset in direction from start
                        const dirFromStart = [p3[0] - p0[0], p3[1] - p0[1]];
                        const lenFromStart = sqrt(dirFromStart[0] * dirFromStart[0] + dirFromStart[1] * dirFromStart[1]);
                        if (lenFromStart > EPS)
                        {
                            const offsetScale = 0.05;
                            offsetControl2 = [p3[0] - dirFromStart[0] * offsetScale, p3[1] - dirFromStart[1] * offsetScale];
                        }
                    }
                    
                        // Check flatness again with the offset control point
                        const FLATNESS_TOL = 1e-4; // Much more aggressive tolerance
                        if (!isValidBezierCurve(p0, p1, offsetControl2, p3) || isBezierFlat(p0, p1, offsetControl2, p3, FLATNESS_TOL))
                    {
                        // Even with offset, still effectively a line - use line segment
                        const snapResult = createLineSegmentWithSnap(sk, "C_line" ~ entityCount, cur, e2, T, scale, isConstruction, { "last" : lastEndpoint });
                        entityCount = entityCount + 1;
                        cur = e2;
                        lastEndpoint = snapResult.last;
                    }
                    else
                    {
                        const p0_mm = toMM(applyTransform(T, cur), scale);
                        const p1_mm = toMM(applyTransform(T, c.control1), scale);
                        const p2_mm = toMM(applyTransform(T, offsetControl2), scale);
                        const p3_mm = toMM(applyTransform(T, e2), scale);
                        
                        var bezierParams1 = {
                            "points" : [p0_mm, p1_mm, p2_mm, p3_mm]
                        };
                        if (isConstruction)
                        {
                            bezierParams1["construction"] = true;
                        }
                        if (debugDetailed)
                        {
                            println("    [C Command #" ~ i ~ "] Creating BEZIER entity #" ~ entityCount);
                            println("      SVG start: [" ~ cur[0] ~ ", " ~ cur[1] ~ "] -> Onshape: [" ~ (p0_mm[0] / millimeter) ~ "mm, " ~ (p0_mm[1] / millimeter) ~ "mm]");
                            println("      SVG ctrl1: [" ~ c.control1[0] ~ ", " ~ c.control1[1] ~ "] -> Onshape: [" ~ (p1_mm[0] / millimeter) ~ "mm, " ~ (p1_mm[1] / millimeter) ~ "mm]");
                            println("      SVG ctrl2: [" ~ c.control2[0] ~ ", " ~ c.control2[1] ~ "] -> Onshape: [" ~ (p2_mm[0] / millimeter) ~ "mm, " ~ (p2_mm[1] / millimeter) ~ "mm]");
                            println("      SVG end: [" ~ e2[0] ~ ", " ~ e2[1] ~ "] -> Onshape: [" ~ (p3_mm[0] / millimeter) ~ "mm, " ~ (p3_mm[1] / millimeter) ~ "mm]");
                            println("[" ~ featureName ~ " | " ~ fileName ~ "]       ✓ Created BEZIER entity: C" ~ entityCount);
                        }
                        const entityName = "C" ~ entityCount;
                        skBezier(sk, entityName, bezierParams1);
                        // Record command-to-entity mapping
                        commandToEntityMap = append(commandToEntityMap, {
                            "commandIndex" : i,
                            "commandType" : "C",
                            "entityName" : entityName,
                            "entityType" : "BEZIER",
                            "skipped" : false
                        });
                        entityToCommandMap = append(entityToCommandMap, {
                            "entityIndex" : entitiesCreated,
                            "entityName" : entityName,
                            "entityType" : "BEZIER",
                            "commandIndex" : i,
                            "commandType" : "C"
                        });
                        bezierCount = bezierCount + 1;
                        entitiesCreated = entitiesCreated + 1;
                        
                        // Draw segment ID at midpoint
                        if (showSegmentIds)
                        {
                            const segmentId1 = entitiesCreated;
                            const charSize1 = 0.5 * millimeter * scale * segmentIdScale;
                            const midPoint1 = bezierMidpoint(p0, p1, offsetControl2, p3, T, scale);
                            drawingEntityCount = drawNumber(sk, segmentId1, midPoint1, charSize1, drawingEntityCount, pathIndex);
                        }
                        
                        entityCount = entityCount + 1;
                        cur = e2;
                        lastEndpoint = e2;
                    }
                }
            }
            else if (dist01 < EPS)
            {
                // Control1 equals start - create valid cubic Bezier
                // For a cubic Bezier where p0=p1, we can create a proper cubic by using
                // p0, p0+epsilon*(p2-p0), p2, p3 to ensure all points are distinct
                // But a better approach: use the mathematical conversion from quadratic to cubic
                // Q(t) = (1-t)²P₀ + 2(1-t)tP₁ + t²P₂ converts to:
                // C(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₁ + t³P₂
                // This requires P₀, P₁, P₁, P₂, but Onshape may reject duplicate points
                // Instead, try using a tiny offset to make control1 distinct from start
                const dist02 = distanceLocal(p0, p2);
                const dist23 = distanceLocal(p2, p3);
                const dist03 = distanceLocal(p0, p3);
                
                if (dist02 < EPS && dist23 < EPS)
                {
                    // All three points are coincident - degenerate, skip
                    cur = e2;
                }
                else if (dist03 < EPS)
                {
                    // Start and end are coincident - skip (would be zero-length curve)
                    cur = e2;
                }
                else
                {
                    // Control1 equals start - check if this is effectively a line
                    // Use flatness check to see if control2 is close enough to the line p0-p3
                    const FLATNESS_TOL = 1e-4; // Much more aggressive tolerance
                    if (!isValidBezierCurve(p0, p0, p2, p3) || isBezierFlat(p0, p0, p2, p3, FLATNESS_TOL))
                    {
                        // Effectively a straight line - use line segment to avoid spurious points
                        const entityName = "C_line" ~ entityCount;
                        const snapResult = createLineSegmentWithSnap(sk, entityName, cur, e2, T, scale, isConstruction, { "last" : lastEndpoint });
                        // Record command-to-entity mapping (C converted to line)
                        commandToEntityMap = append(commandToEntityMap, {
                            "commandIndex" : i,
                            "commandType" : "C",
                            "entityName" : entityName,
                            "entityType" : "LINE",
                            "skipped" : false,
                            "converted" : true
                        });
                        entityToCommandMap = append(entityToCommandMap, {
                            "entityIndex" : entitiesCreated,
                            "entityName" : entityName,
                            "entityType" : "LINE",
                            "commandIndex" : i,
                            "commandType" : "C"
                        });
                        entityCount = entityCount + 1;
                        lineCount = lineCount + 1;
                        entitiesCreated = entitiesCreated + 1;
                        cur = e2;
                        lastEndpoint = snapResult.last;
                    }
                    else
                    {
                        // Control1 equals start - convert to quadratic Bezier then to cubic
                        // Use a small but meaningful offset to ensure Onshape accepts the curve
                        // Offset control1 slightly toward control2 to create a valid cubic Bezier
                        const dirToC2 = [p2[0] - p0[0], p2[1] - p0[1]];
                        const lenToC2 = sqrt(dirToC2[0] * dirToC2[0] + dirToC2[1] * dirToC2[1]);
                        var offsetControl1 = p0;
                        if (lenToC2 > EPS)
                        {
                            // Offset control1 by a small but meaningful amount toward control2
                            // Use 5% offset - large enough for Onshape to accept, small enough to preserve shape
                            const offsetScale = 0.05; // 5% offset
                            offsetControl1 = [p0[0] + dirToC2[0] * offsetScale, p0[1] + dirToC2[1] * offsetScale];
                        }
                        else
                        {
                            // If control2 is also at start, offset in direction toward end
                            const dirToEnd = [p3[0] - p0[0], p3[1] - p0[1]];
                            const lenToEnd = sqrt(dirToEnd[0] * dirToEnd[0] + dirToEnd[1] * dirToEnd[1]);
                            if (lenToEnd > EPS)
                            {
                                const offsetScale = 0.05; // 5% offset
                                offsetControl1 = [p0[0] + dirToEnd[0] * offsetScale, p0[1] + dirToEnd[1] * offsetScale];
                            }
                        }
                        
                        // Check flatness again with the offset control point
                        const FLATNESS_TOL = 1e-4; // Much more aggressive tolerance
                        if (!isValidBezierCurve(p0, offsetControl1, p2, p3) || isBezierFlat(p0, offsetControl1, p2, p3, FLATNESS_TOL))
                        {
                            // Even with offset, still effectively a line - use line segment
                            const entityName = "C_line" ~ entityCount;
                            const snapResult = createLineSegmentWithSnap(sk, entityName, cur, e2, T, scale, isConstruction, { "last" : lastEndpoint });
                            // Record command-to-entity mapping (C converted to line)
                            commandToEntityMap = append(commandToEntityMap, {
                                "commandIndex" : i,
                                "commandType" : "C",
                                "entityName" : entityName,
                                "entityType" : "LINE",
                                "skipped" : false,
                                "converted" : true
                            });
                            entityToCommandMap = append(entityToCommandMap, {
                                "entityIndex" : entitiesCreated,
                                "entityName" : entityName,
                                "entityType" : "LINE",
                                "commandIndex" : i,
                                "commandType" : "C"
                            });
                            entityCount = entityCount + 1;
                            lineCount = lineCount + 1;
                            entitiesCreated = entitiesCreated + 1;
                            cur = e2;
                            lastEndpoint = snapResult.last;
                        }
                        else
                        {
                            const p0_mm = toMM(applyTransform(T, cur), scale);
                            const p1_mm = toMM(applyTransform(T, offsetControl1), scale);
                            const p2_mm = toMM(applyTransform(T, c.control2), scale);
                            const p3_mm = toMM(applyTransform(T, e2), scale);
                            
                            var bezierParams2 = {
                                "points" : [p0_mm, p1_mm, p2_mm, p3_mm]
                            };
                            if (isConstruction)
                            {
                                bezierParams2["construction"] = true;
                            }
                            if (debugDetailed)
                            {
                                println("    [C Command #" ~ i ~ "] Creating BEZIER entity #" ~ entityCount);
                                println("      SVG start: [" ~ cur[0] ~ ", " ~ cur[1] ~ "] -> Onshape: [" ~ (p0_mm[0] / millimeter) ~ "mm, " ~ (p0_mm[1] / millimeter) ~ "mm]");
                                println("      SVG ctrl1: [" ~ c.control1[0] ~ ", " ~ c.control1[1] ~ "] -> Onshape: [" ~ (p1_mm[0] / millimeter) ~ "mm, " ~ (p1_mm[1] / millimeter) ~ "mm]");
                                println("      SVG ctrl2: [" ~ c.control2[0] ~ ", " ~ c.control2[1] ~ "] -> Onshape: [" ~ (p2_mm[0] / millimeter) ~ "mm, " ~ (p2_mm[1] / millimeter) ~ "mm]");
                                println("      SVG end: [" ~ e2[0] ~ ", " ~ e2[1] ~ "] -> Onshape: [" ~ (p3_mm[0] / millimeter) ~ "mm, " ~ (p3_mm[1] / millimeter) ~ "mm]");
                                println("      ✓ Created BEZIER entity: C" ~ entityCount);
                            }
                            const entityName = "C" ~ entityCount;
                            skBezier(sk, entityName, bezierParams2);
                            // Record command-to-entity mapping
                            commandToEntityMap = append(commandToEntityMap, {
                                "commandIndex" : i,
                                "commandType" : "C",
                                "entityName" : entityName,
                                "entityType" : "BEZIER",
                                "skipped" : false
                            });
                            entityToCommandMap = append(entityToCommandMap, {
                                "entityIndex" : entitiesCreated,
                                "entityName" : entityName,
                                "entityType" : "BEZIER",
                                "commandIndex" : i,
                                "commandType" : "C"
                            });
                            bezierCount = bezierCount + 1;
                            entitiesCreated = entitiesCreated + 1;
                            
                            // Draw segment ID at midpoint
                            if (showSegmentIds)
                            {
                                const segmentId2 = entitiesCreated;
                                const charSize2 = 0.5 * millimeter * scale * segmentIdScale;
                                const midPoint2 = bezierMidpoint(p0, offsetControl1, p2, p3, T, scale);
                                drawingEntityCount = drawNumber(sk, segmentId2, midPoint2, charSize2, drawingEntityCount, pathIndex);
                            }
                            
                            entityCount = entityCount + 1;
                            cur = e2;
                            lastEndpoint = e2;
                        }
                    }
                }
            }
            else
            {
                // Valid cubic Bezier curve - check if it's effectively a straight line
                // Use flatness check to avoid spurious control points
                const p0_local = cur;
                const p1_local = c.control1;
                const p2_local = c.control2;
                const p3_local = e2;
                
                // Use aggressive flatness tolerance - if curve is very close to a line, use line segment
                // This prevents spurious control points from appearing in Onshape
                const FLATNESS_TOL = 1e-4; // Much more aggressive tolerance
                
                // Validate the curve before creating it
                if (!isValidBezierCurve(p0_local, p1_local, p2_local, p3_local) || isBezierFlat(p0_local, p1_local, p2_local, p3_local, FLATNESS_TOL))
                {
                    // Curve is effectively flat - use a line segment to avoid spurious control points
                    if (debugDetailed) println("    [emitPath] NOTE: C command #" ~ i ~ " converted to line (curve was effectively flat)");
                    const entityName = "C_line" ~ entityCount;
                    const snapResult = createLineSegmentWithSnap(sk, entityName, p0_local, p3_local, T, scale, isConstruction, { "last" : lastEndpoint });
                    // Record command-to-entity mapping (C converted to line)
                    commandToEntityMap = append(commandToEntityMap, {
                        "commandIndex" : i,
                        "commandType" : "C",
                        "entityName" : entityName,
                        "entityType" : "LINE",
                        "skipped" : false,
                        "converted" : true
                    });
                    entityToCommandMap = append(entityToCommandMap, {
                        "entityIndex" : entitiesCreated,
                        "entityName" : entityName,
                        "entityType" : "LINE",
                        "commandIndex" : i,
                        "commandType" : "C"
                    });
                    entityCount = entityCount + 1;
                    lineCount = lineCount + 1;
                    entitiesCreated = entitiesCreated + 1;
                    cur = e2;
                    lastEndpoint = snapResult.last;
                }
                else
                {
                    // Valid curved cubic Bezier - final validation check using transformed coordinates
                    const p0 = toMM(applyTransform(T, cur), scale);
                    const p1 = toMM(applyTransform(T, c.control1), scale);
                    const p2 = toMM(applyTransform(T, c.control2), scale);
                    const p3 = toMM(applyTransform(T, e2), scale);
                    
                    // Check flatness using transformed coordinates (more accurate)
                    const FLATNESS_TOL_MM = 1e-4 * millimeter; // Tolerance in millimeters
                    if (isBezierFlatVectors(p0, p1, p2, p3, FLATNESS_TOL_MM))
                    {
                        // Final check - use line segment to avoid spurious control points
                        // Convert vectors back to local coordinates for snapping
                        const p0_local_final = [(p0[0] / millimeter) / scale, (p0[1] / millimeter) / scale];
                        const p3_local_final = [(p3[0] / millimeter) / scale, (p3[1] / millimeter) / scale];
                        const entityName = "C_line_final" ~ entityCount;
                        const snapResult = createLineSegmentWithSnap(sk, entityName, p0_local_final, p3_local_final, T, scale, isConstruction, { "last" : lastEndpoint });
                        // Record command-to-entity mapping (C converted to line)
                        commandToEntityMap = append(commandToEntityMap, {
                            "commandIndex" : i,
                            "commandType" : "C",
                            "entityName" : entityName,
                            "entityType" : "LINE",
                            "skipped" : false,
                            "converted" : true
                        });
                        entityToCommandMap = append(entityToCommandMap, {
                            "entityIndex" : entitiesCreated,
                            "entityName" : entityName,
                            "entityType" : "LINE",
                            "commandIndex" : i,
                            "commandType" : "C"
                        });
                        entityCount = entityCount + 1;
                        lineCount = lineCount + 1;
                        entitiesCreated = entitiesCreated + 1;
                        lastEndpoint = snapResult.last;
                    }
                    else
                    {
                        // Removed verbose C Bezier debug output
                        var bezierParams3 = {
                            "points" : [p0, p1, p2, p3]
                        };
                        if (isConstruction)
                        {
                            bezierParams3["construction"] = true;
                        }
                        if (debugDetailed)
                        {
                            println("    [C Command #" ~ i ~ "] Creating BEZIER entity #" ~ entityCount);
                            println("      SVG start: [" ~ cur[0] ~ ", " ~ cur[1] ~ "] -> Onshape: [" ~ (p0[0] / millimeter) ~ "mm, " ~ (p0[1] / millimeter) ~ "mm]");
                            println("      SVG ctrl1: [" ~ c.control1[0] ~ ", " ~ c.control1[1] ~ "] -> Onshape: [" ~ (p1[0] / millimeter) ~ "mm, " ~ (p1[1] / millimeter) ~ "mm]");
                            println("      SVG ctrl2: [" ~ c.control2[0] ~ ", " ~ c.control2[1] ~ "] -> Onshape: [" ~ (p2[0] / millimeter) ~ "mm, " ~ (p2[1] / millimeter) ~ "mm]");
                            println("      SVG end: [" ~ e2[0] ~ ", " ~ e2[1] ~ "] -> Onshape: [" ~ (p3[0] / millimeter) ~ "mm, " ~ (p3[1] / millimeter) ~ "mm]");
                            println("[" ~ featureName ~ " | " ~ fileName ~ "]       ✓ Created BEZIER entity: C" ~ entityCount);
                        }
                        const entityName = "C" ~ entityCount;
                        skBezier(sk, entityName, bezierParams3);
                        // Record command-to-entity mapping
                        commandToEntityMap = append(commandToEntityMap, {
                            "commandIndex" : i,
                            "commandType" : "C",
                            "entityName" : entityName,
                            "entityType" : "BEZIER",
                            "skipped" : false
                        });
                        entityToCommandMap = append(entityToCommandMap, {
                            "entityIndex" : entitiesCreated,
                            "entityName" : entityName,
                            "entityType" : "BEZIER",
                            "commandIndex" : i,
                            "commandType" : "C"
                        });
                        bezierCount = bezierCount + 1;
                        entitiesCreated = entitiesCreated + 1;
                        
                        // Draw segment ID at midpoint
                        if (showSegmentIds)
                        {
                            const segmentId3 = entitiesCreated;
                            const charSize3 = 0.5 * millimeter * scale * segmentIdScale;
                            const midPoint3 = bezierMidpoint(p0_local, p1_local, p2_local, p3_local, T, scale);
                            drawingEntityCount = drawNumber(sk, segmentId3, midPoint3, charSize3, drawingEntityCount, pathIndex);
                        }
                        
                        lastEndpoint = e2;
                    }
                    
                    entityCount = entityCount + 1;
                    cur = e2;
                }
            }
        }
        else if (c.cmdType == "A")
        {
            // Snap current point to last endpoint if very close
            if (lastEndpoint != undefined && distanceLocal(cur, lastEndpoint) < COINCIDENT_TOL)
            {
                cur = lastEndpoint;
            }
            
            // If Z follows, prioritize snapping to start for perfect closure
            var e3 = c.point;
            if (willZ)
            {
                // When Z follows, always snap to start if close enough (for proper closure)
                // Use larger tolerance to ensure closure even with small rounding errors
                if (distanceLocal(e3, start) < CLOSURE_TOL) 
                {
                    e3 = start;
                    if (debugDetailed)
                    {
                        println("    [A Command #" ~ i ~ "] Snapped endpoint to start for Z closure: [" ~ e3[0] ~ ", " ~ e3[1] ~ "]");
                    }
                }
            }
            else
            {
                // Only snap to lastEndpoint if Z is NOT following (to avoid breaking closure)
                if (lastEndpoint != undefined && distanceLocal(e3, lastEndpoint) < COINCIDENT_TOL)
                {
                    e3 = lastEndpoint;
                }
            }
            
            const conv = arcEndpointToCenter(cur, e3, c.rx, c.ry, c.rotation, c.largeArc, c.sweep);
            if (conv.valid == false || conv.valid == undefined)
            {
                if (debugDetailed)
                {
                    println("    [emitPath] WARNING: A command #" ~ i ~ " - Invalid arc (start=end or rx/ry=0), converted to line");
                    println("    [emitPath]   Arc params: start=[" ~ cur[0] ~ ", " ~ cur[1] ~ "] end=[" ~ e3[0] ~ ", " ~ e3[1] ~ "] rx=" ~ c.rx ~ " ry=" ~ c.ry);
                }
                const entityName = "A_line" ~ entityCount;
                const snapResult = createLineSegmentWithSnap(sk, entityName, cur, e3, T, scale, isConstruction, { "last" : lastEndpoint });
                // Record command-to-entity mapping (A converted to line)
                commandToEntityMap = append(commandToEntityMap, {
                    "commandIndex" : i,
                    "commandType" : "A",
                    "entityName" : entityName,
                    "entityType" : "LINE",
                    "skipped" : false,
                    "converted" : true
                });
                entityToCommandMap = append(entityToCommandMap, {
                    "entityIndex" : entitiesCreated,
                    "entityName" : entityName,
                    "entityType" : "LINE",
                    "commandIndex" : i,
                    "commandType" : "A"
                });
                entityCount = entityCount + 1;
                lineCount = lineCount + 1;
                entitiesCreated = entitiesCreated + 1;
                cur = e3; 
                lastEndpoint = snapResult.last;
                i = i + 1; continue;
            }

            const a = T[0]; const b = T[1];
            const cM = T[2]; const d = T[3]; const eTr = T[4]; const fTr = T[5];
            // Use applyTransform to ensure Y-axis flip is applied consistently
            const ctr = applyTransform(T, conv.center);
            const axX = a * conv.majorAxis[0] + cM * conv.majorAxis[1];
            const axY = b * conv.majorAxis[0] + d  * conv.majorAxis[1];
            // Flip Y component of direction vector to match coordinate system conversion
            const majDir = normalize2D([axX, -axY]);

            const uMaj = normalize2D(conv.majorAxis);
            const uMin = [-uMaj[1], uMaj[0]];
            const tMaj = [a * uMaj[0] + cM * uMaj[1], b * uMaj[0] + d * uMaj[1]];
            const tMin = [a * uMin[0] + cM * uMin[1], b * uMin[0] + d * uMin[1]];
            const Rmaj = conv.majorRadius * length2D(tMaj);
            const Rmin = conv.minorRadius * length2D(tMin);
            if (abs(Rmaj - Rmin) < 1e-9)
            {
                const r = (Rmaj + Rmin) / 2.0;
                const phiVal = atan2(majDir[1] * radian, majDir[0] * radian);
                const tMid = conv.theta1 + conv.deltaTheta / 2.0;
                const sp = applyTransform(T, cur); const ep = applyTransform(T, e3);
                const mp = applyTransform(T, circParamPoint(conv.center, r, phiVal, tMid));
                var arcParams = { "start" : toMM(sp, scale), "mid" : toMM(mp, scale), "end" : toMM(ep, scale) };
                if (isConstruction)
                {
                    arcParams["construction"] = true;
                }
                if (debugDetailed)
                {
                    println("    [A Command #" ~ i ~ "] Creating ARC entity #" ~ entityCount);
                                println("      SVG start: [" ~ cur[0] ~ ", " ~ cur[1] ~ "] -> Onshape: [" ~ (arcParams.start[0] / millimeter) ~ "mm, " ~ (arcParams.start[1] / millimeter) ~ "mm]");
                                println("      SVG mid: [" ~ (circParamPoint(conv.center, r, phiVal, tMid)[0]) ~ ", " ~ (circParamPoint(conv.center, r, phiVal, tMid)[1]) ~ "] -> Onshape: [" ~ (arcParams.mid[0] / millimeter) ~ "mm, " ~ (arcParams.mid[1] / millimeter) ~ "mm]");
                                println("      SVG end: [" ~ e3[0] ~ ", " ~ e3[1] ~ "] -> Onshape: [" ~ (arcParams.end[0] / millimeter) ~ "mm, " ~ (arcParams.end[1] / millimeter) ~ "mm]");
                    println("      Arc radius: " ~ (r * scale) ~ "mm");
                    println("      ✓ Created ARC entity: A_arc" ~ entityCount);
                }
                const entityName = "A_arc" ~ entityCount;
                skArc(sk, entityName, arcParams);
                // Record command-to-entity mapping
                commandToEntityMap = append(commandToEntityMap, {
                    "commandIndex" : i,
                    "commandType" : "A",
                    "entityName" : entityName,
                    "entityType" : "ARC",
                    "skipped" : false
                });
                entityToCommandMap = append(entityToCommandMap, {
                    "entityIndex" : entitiesCreated,
                    "entityName" : entityName,
                    "entityType" : "ARC",
                    "commandIndex" : i,
                    "commandType" : "A"
                });
                arcCount = arcCount + 1;
                entitiesCreated = entitiesCreated + 1;
                
                // Draw segment ID at midpoint
                if (showSegmentIds)
                {
                    const segmentIdArc = entitiesCreated;
                    const charSizeArc = 0.5 * millimeter * scale * segmentIdScale;
                    const midPointArc = arcMidpoint(cur, e3, conv.center, conv.theta1, conv.deltaTheta, T, scale);
                    drawingEntityCount = drawNumber(sk, segmentIdArc, midPointArc, charSizeArc, drawingEntityCount, pathIndex);
                }
                
                entityCount = entityCount + 1;
            }
            else
            {
                const startParam = normalizeTurn(conv.theta1 / (2.0 * PI));
                const endParam = normalizeTurn((conv.theta1 + conv.deltaTheta) / (2.0 * PI));
                var ellipticalArcParams = {
                    "center" : toMM(ctr, scale),
                    "majorAxis" : vector(majDir[0], majDir[1]),
                    "majorRadius" : Rmaj * scale * millimeter,
                    "minorRadius" : Rmin * scale * millimeter,
                    "startParameter" : startParam,
                    "endParameter" : endParam
                };
                if (isConstruction)
                {
                    ellipticalArcParams["construction"] = true;
                }
                if (debugDetailed)
                {
                    println("    [A Command #" ~ i ~ "] Creating ELLIPTICAL ARC entity #" ~ entityCount);
                    println("      SVG start: [" ~ cur[0] ~ ", " ~ cur[1] ~ "] -> Onshape center: [" ~ (ellipticalArcParams.center[0] / millimeter) ~ "mm, " ~ (ellipticalArcParams.center[1] / millimeter) ~ "mm]");
                    println("      SVG end: [" ~ e3[0] ~ ", " ~ e3[1] ~ "]");
                    println("      Major radius: " ~ (ellipticalArcParams.majorRadius / millimeter) ~ "mm, Minor radius: " ~ (ellipticalArcParams.minorRadius / millimeter) ~ "mm");
                    println("      Start param: " ~ ellipticalArcParams.startParameter ~ ", End param: " ~ ellipticalArcParams.endParameter);
                    println("      ✓ Created ELLIPTICAL ARC entity: A_ell" ~ entityCount);
                }
                const entityName = "A_ell" ~ entityCount;
                skEllipticalArc(sk, entityName, ellipticalArcParams);
                // Record command-to-entity mapping
                commandToEntityMap = append(commandToEntityMap, {
                    "commandIndex" : i,
                    "commandType" : "A",
                    "entityName" : entityName,
                    "entityType" : "ELLIPTICAL_ARC",
                    "skipped" : false
                });
                entityToCommandMap = append(entityToCommandMap, {
                    "entityIndex" : entitiesCreated,
                    "entityName" : entityName,
                    "entityType" : "ELLIPTICAL_ARC",
                    "commandIndex" : i,
                    "commandType" : "A"
                });
                arcCount = arcCount + 1;
                entitiesCreated = entitiesCreated + 1;
                
                // Draw segment ID at midpoint
                if (showSegmentIds)
                {
                    const segmentIdEll = entitiesCreated;
                    const charSizeEll = 0.5 * millimeter * scale * segmentIdScale;
                    const midPointEll = arcMidpoint(cur, e3, conv.center, conv.theta1, conv.deltaTheta, T, scale);
                    drawingEntityCount = drawNumber(sk, segmentIdEll, midPointEll, charSizeEll, drawingEntityCount, pathIndex);
                }
                
                entityCount = entityCount + 1;
            }
            cur = e3;
            lastEndpoint = e3;
        }
        else if (c.cmdType == "Z")
        {
            // Snap current point to last endpoint if very close
            if (lastEndpoint != undefined && distanceLocal(cur, lastEndpoint) < COINCIDENT_TOL)
            {
                cur = lastEndpoint;
            }
            
            // NEVER modify start - it must remain the original M point for proper closure
            // The start point is the target for closure, don't change it
            
            const p0 = applyTransform(T, cur);
            const p1 = applyTransform(T, start);
            const gapLocal = distanceLocal(cur, start);
            
            // For Z commands: ALWAYS create closing segment for explicit closure
            // Onshape requires explicit topological connection to recognize closed loops
            // Even if points are coincident, the explicit segment is needed for closure recognition
            const entityName = "Z" ~ entityCount;
            const snapResult = createLineSegmentWithSnap(sk, entityName, cur, start, T, scale, isConstruction, { "last" : lastEndpoint });
            // Record command-to-entity mapping
            commandToEntityMap = append(commandToEntityMap, {
                "commandIndex" : i,
                "commandType" : "Z",
                "entityName" : entityName,
                "entityType" : "LINE",
                "skipped" : false
            });
            entityToCommandMap = append(entityToCommandMap, {
                "entityIndex" : entitiesCreated,
                "entityName" : entityName,
                "entityType" : "LINE",
                "commandIndex" : i,
                "commandType" : "Z"
            });
            entityCount = entityCount + 1;
            lineCount = lineCount + 1;
            entitiesCreated = entitiesCreated + 1;
            
            // Draw segment ID at midpoint for Z (close path) segment
            if (showSegmentIds)
            {
                const segmentIdZ = entitiesCreated;
                const charSizeZ = 0.5 * millimeter * scale * segmentIdScale;
                const midPointZ = lineMidpoint(cur, start, T, scale);
                drawingEntityCount = drawNumber(sk, segmentIdZ, midPointZ, charSizeZ, drawingEntityCount, pathIndex);
            }
            
            cur = start;
            lastEndpoint = start;
        }

        i = i + 1;
    }

    // Respect SVG semantics: only close paths with explicit Z commands
    // If a path is geometrically closed but has no Z command, it remains open (as per SVG spec)
    
    if (debugDetailed)
    {
        // Concise summary
        println("    Result: " ~ entitiesCreated ~ " entities (L=" ~ lineCount ~ " B=" ~ bezierCount ~ " A=" ~ arcCount ~ ")");
        
        // Only show issues, not the full mapping
        var hasZCommand = false;
        for (var cmdIdx = 0; cmdIdx < size(cmds); cmdIdx += 1)
        {
            if (cmds[cmdIdx].cmdType == "Z") hasZCommand = true;
        }
        if (!hasZCommand && size(cmds) > 1)
        {
            println("      Note: Path not closed (no Z command)");
        }
    }
    
    // Calculate expected entities for validation
    var expectedEntities = 0;
    for (var cmdIdx = 0; cmdIdx < size(cmds); cmdIdx += 1)
    {
        const cmd = cmds[cmdIdx];
        if (cmd.cmdType != "M")
        {
            expectedEntities = expectedEntities + 1;
        }
    }
    
    if (debugDetailed)
    {
        if (entitiesCreated != expectedEntities)
        {
            println("      ⚠️ Entity count mismatch: created " ~ entitiesCreated ~ ", expected " ~ expectedEntities);
        }
        if (entitiesCreated == 0)
        {
            println("      ⚠️ No entities created for this path!");
        }
    }
    
    return entityCount;
}

function createRectEntities(sk is Sketch, el is map, T is array, scale is number, entityCount is number, isConstruction is boolean) returns number
{
    const w = el["width"];
    const h = el["height"];
    if (w <= 0 || h <= 0) return entityCount;
    const p1 = applyTransform(T, [el["x"], el["y"]]);
    const p2 = applyTransform(T, [el["x"] + w, el["y"]]);
    const p3 = applyTransform(T, [el["x"] + w, el["y"] + h]);
    const p4 = applyTransform(T, [el["x"], el["y"] + h]);
    var rectParams1 = { "start" : toMM(p1, scale), "end" : toMM(p2, scale) };
    var rectParams2 = { "start" : toMM(p2, scale), "end" : toMM(p3, scale) };
    var rectParams3 = { "start" : toMM(p3, scale), "end" : toMM(p4, scale) };
    var rectParams4 = { "start" : toMM(p4, scale), "end" : toMM(p1, scale) };
    if (isConstruction)
    {
        rectParams1["construction"] = true;
        rectParams2["construction"] = true;
        rectParams3["construction"] = true;
        rectParams4["construction"] = true;
    }
    skLineSegment(sk, "R1_" ~ entityCount, rectParams1);
    entityCount = entityCount + 1;
    skLineSegment(sk, "R2_" ~ entityCount, rectParams2);
    entityCount = entityCount + 1;
    skLineSegment(sk, "R3_" ~ entityCount, rectParams3);
    entityCount = entityCount + 1;
    skLineSegment(sk, "R4_" ~ entityCount, rectParams4);
    entityCount = entityCount + 1;
    return entityCount;
}

function createLineEntities(sk is Sketch, el is map, T is array, scale is number, entityCount is number, isConstruction is boolean) returns number
{
    const p1 = applyTransform(T, [el["x1"], el["y1"]]);
    const p2 = applyTransform(T, [el["x2"], el["y2"]]);
    const dist = distanceLocal(p1, p2);
    if (dist > 1e-12)
    {
        var lineParams = { "start" : toMM(p1, scale), "end" : toMM(p2, scale) };
        if (isConstruction)
        {
            lineParams["construction"] = true;
        }
        skLineSegment(sk, "line_" ~ entityCount, lineParams);
        entityCount = entityCount + 1;
    }
    return entityCount;
}

function createEllipseEntities(sk is Sketch, el is map, T is array, scale is number, entityCount is number, isConstruction is boolean) returns number
{
    const rx = el["rx"];
    const ry = el["ry"];
    if (rx <= 0 || ry <= 0) return entityCount;
    const ctr = applyTransform(T, [el["cx"], el["cy"]]);
    const a = T[0];
    const b = T[1];
    const cM = T[2];
    const d = T[3];
    const xLen = length2D([a, b]);
    const yLen = length2D([cM, d]);
    const rxScaled = rx * xLen;
    const ryScaled = ry * yLen;
    if (abs(rxScaled - ryScaled) < 1e-9)
    {
        var circleParams = {
            "center" : toMM(ctr, scale),
            "radius" : rxScaled * scale * millimeter
        };
        if (isConstruction)
        {
            circleParams["construction"] = true;
        }
        skCircle(sk, "ellipse_as_circle_" ~ entityCount, circleParams);
        return entityCount + 1;
    }
    else
    {
        const majR = max(rxScaled, ryScaled) * scale * millimeter;
        const minR = min(rxScaled, ryScaled) * scale * millimeter;
        var majDir;
        if (rxScaled >= ryScaled)
        {
            majDir = normalize2D([a, b]);
        }
        else
        {
            majDir = normalize2D([cM, d]);
        }
        const majDirFlipped = [majDir[0], -majDir[1]];
        var ellipseParams = {
            "center" : toMM(ctr, scale),
            "majorAxis" : vector(majDirFlipped[0], majDirFlipped[1]),
            "majorRadius" : majR,
            "minorRadius" : minR
        };
        if (isConstruction)
        {
            ellipseParams["construction"] = true;
        }
        skEllipse(sk, "ellipse_" ~ entityCount, ellipseParams);
        return entityCount + 1;
    }
}

function createCircleEntities(sk is Sketch, el is map, T is array, scale is number, entityCount is number, isConstruction is boolean) returns number
{
    const r = el["r"];
    if (r <= 0) return entityCount;
    const ctr = applyTransform(T, [el["cx"], el["cy"]]);
    const a = T[0];
    const b = T[1];
    const cM = T[2];
    const d = T[3];
    const xLen = length2D([a, b]);
    const yLen = length2D([cM, d]);
    const rxScaled = r * xLen;
    const ryScaled = r * yLen;
    if (abs(xLen - yLen) < 1e-9 && abs(a * d - b * cM) < 1e-9)
    {
        var circleParams = {
            "center" : toMM(ctr, scale),
            "radius" : rxScaled * scale * millimeter
        };
        if (isConstruction)
        {
            circleParams["construction"] = true;
        }
        skCircle(sk, "circle_" ~ entityCount, circleParams);
        return entityCount + 1;
    }
    else
    {
        const majR = max(rxScaled, ryScaled) * scale * millimeter;
        const minR = min(rxScaled, ryScaled) * scale * millimeter;
        var majDir;
        if (rxScaled >= ryScaled)
        {
            majDir = normalize2D([a, b]);
        }
        else
        {
            majDir = normalize2D([cM, d]);
        }
        const majDirFlipped = [majDir[0], -majDir[1]];
        var ellipseParams = {
            "center" : toMM(ctr, scale),
            "majorAxis" : vector(majDirFlipped[0], majDirFlipped[1]),
            "majorRadius" : majR,
            "minorRadius" : minR
        };
        if (isConstruction)
        {
            ellipseParams["construction"] = true;
        }
        skEllipse(sk, "circle_as_ellipse_" ~ entityCount, ellipseParams);
        return entityCount + 1;
    }
}

/* ────────────── PRIMARY PATH: INTERMEDIATE FORMAT PARSER ────────────── */
// This is the primary/recommended path for v47
// IF format is generated by SVG2Sketch-app and includes:
// - Pattern optimization
// - Text-to-paths conversion
// - Large file handling
// - Enhanced preprocessing
function parseAndExecuteIF(sk is Sketch, text is string, scale is number, debugMode is boolean)
{
    var pos = 0;
    var entityCount = 0;
    var currentPath = [];
    var currentPathStart = undefined;
    var inPattern = false;
    var patternBaseEntities = [];
    var currentPattern = undefined;
    
    while (pos < length(text))
    {
        pos = skipWs(text, pos);
        if (pos >= length(text))
        {
            break;
        }
        
        // Skip comments
        if (chAt(text, pos) == "#")
        {
            pos = findLineEnd(text, pos);
            if (pos < length(text) && chAt(text, pos) == "\n")
            {
                pos = pos + 1;
            }
            if (pos < length(text) && chAt(text, pos) == "\r")
            {
                pos = pos + 1;
            }
            continue;
        }
        
        var lineEnd = findLineEnd(text, pos);
        var line = getLine(text, pos);
        pos = lineEnd;
        if (pos < length(text) && chAt(text, pos) == "\n")
        {
            pos = pos + 1;
        }
        if (pos < length(text) && chAt(text, pos) == "\r")
        {
            pos = pos + 1;
        }
        
        // Parse command
        var cmdPos = skipWs(line, 0);
        if (cmdPos >= length(line))
        {
            continue;
        }
        
        // Extract command word
        var cmdEnd = cmdPos;
        while (cmdEnd < length(line) && !isWs(chAt(line, cmdEnd)))
        {
            cmdEnd = cmdEnd + 1;
        }
        var cmd = substring(line, cmdPos, cmdEnd);
        var argsPos = skipWs(line, cmdEnd);
        
        // Execute command
        if (cmd == "M")
        {
            // Move - start new subpath
            var point = parsePoint(line, argsPos);
            currentPathStart = vector(point.x * scale * millimeter, point.y * scale * millimeter);
            currentPath = [currentPathStart];
            if (inPattern)
            {
                patternBaseEntities = [];
            }
        }
        else if (cmd == "L")
        {
            // Line to
            var point = parsePoint(line, argsPos);
            var endPoint = vector(point.x * scale * millimeter, point.y * scale * millimeter);
            if (size(currentPath) > 0)
            {
                var startPoint = currentPath[size(currentPath) - 1];
                var entityName = "L_" ~ entityCount;
                var lineParams = { "start" : startPoint, "end" : endPoint };
                if (inPattern)
                {
                    patternBaseEntities = append(patternBaseEntities, { "type" : "LINE", "params" : lineParams, "name" : entityName });
                }
                else
                {
                    skLineSegment(sk, entityName, lineParams);
                    entityCount = entityCount + 1;
                }
                currentPath = append(currentPath, endPoint);
            }
        }
        else if (cmd == "C")
        {
            // Cubic Bezier
            var c1 = parsePoint(line, argsPos);
            var c1Pos = c1.nextPos;
            var c2 = parsePoint(line, c1Pos);
            var c2Pos = c2.nextPos;
            var end = parsePoint(line, c2Pos);
            
            var p0 = size(currentPath) > 0 ? currentPath[size(currentPath) - 1] : vector(0 * millimeter, 0 * millimeter);
            var p1 = vector(c1.x * scale * millimeter, c1.y * scale * millimeter);
            var p2 = vector(c2.x * scale * millimeter, c2.y * scale * millimeter);
            var p3 = vector(end.x * scale * millimeter, end.y * scale * millimeter);
            
            var entityName = "C_" ~ entityCount;
            var bezierParams = { "points" : [p0, p1, p2, p3] };
            if (inPattern)
            {
                patternBaseEntities = append(patternBaseEntities, { "type" : "BEZIER", "params" : bezierParams, "name" : entityName });
            }
            else
            {
                skBezier(sk, entityName, bezierParams);
                entityCount = entityCount + 1;
            }
            currentPath = append(currentPath, p3);
        }
        else if (cmd == "Q")
        {
            // Quadratic Bezier (convert to cubic)
            var control = parsePoint(line, argsPos);
            var controlPos = control.nextPos;
            var end = parsePoint(line, controlPos);
            
            var p0 = size(currentPath) > 0 ? currentPath[size(currentPath) - 1] : vector(0 * millimeter, 0 * millimeter);
            var qControl = vector(control.x * scale * millimeter, control.y * scale * millimeter);
            var p3 = vector(end.x * scale * millimeter, end.y * scale * millimeter);
            
            // Convert quadratic to cubic: control points at 1/3 and 2/3 along the curve
            var p1 = p0 + (qControl - p0) * (2.0 / 3.0);
            var p2 = p3 + (qControl - p3) * (2.0 / 3.0);
            
            var entityName = "Q_" ~ entityCount;
            var bezierParams = { "points" : [p0, p1, p2, p3] };
            if (inPattern)
            {
                patternBaseEntities = append(patternBaseEntities, { "type" : "BEZIER", "params" : bezierParams, "name" : entityName });
            }
            else
            {
                skBezier(sk, entityName, bezierParams);
                entityCount = entityCount + 1;
            }
            currentPath = append(currentPath, p3);
        }
        else if (cmd == "A")
        {
            // Arc - parse all parameters
            var rxResult = stringToNumberManual(line, argsPos);
            var rx = rxResult.value;
            var ryResult = stringToNumberManual(line, rxResult.nextPos);
            var ry = ryResult.value;
            var rotResult = stringToNumberManual(line, ryResult.nextPos);
            var rotation = rotResult.value;
            var largeArcResult = stringToNumberManual(line, rotResult.nextPos);
            var largeArc = largeArcResult.value;
            var sweepResult = stringToNumberManual(line, largeArcResult.nextPos);
            var sweep = sweepResult.value;
            var end = parsePoint(line, sweepResult.nextPos);
            
            var p0 = size(currentPath) > 0 ? currentPath[size(currentPath) - 1] : vector(0 * millimeter, 0 * millimeter);
            var p1 = vector(end.x * scale * millimeter, end.y * scale * millimeter);
            
            // Simplified arc implementation
            // For circular arcs (rx == ry), use skArc with midpoint
            // For elliptical arcs, use skEllipticalArc (requires complex conversion from SVG format)
            var rxScaled = rx * scale * millimeter;
            var ryScaled = ry * scale * millimeter;
            
            if (abs(rxScaled - ryScaled) < 1e-6 * millimeter && abs(rotation) < 1e-6)
            {
                // Circular arc - calculate midpoint for 3-point arc
                var centerX = (p0[0] + p1[0]) / 2.0;
                var centerY = (p0[1] + p1[1]) / 2.0;
                var dx = p1[0] - p0[0];
                var dy = p1[1] - p0[1];
                var chordLength = sqrt(dx * dx + dy * dy);
                
                // Calculate perpendicular distance to arc midpoint
                var perpDist = sqrt(max(0.0, rxScaled * rxScaled - (chordLength / 2.0) ^ 2));
                var perpDir = vector(-dy, dx);
                var perpNorm = perpDir / norm(perpDir);
                
                // Choose direction based on largeArc and sweep flags
                var sign = (largeArc > 0.5) ? 1.0 : -1.0;
                if (sweep < 0.5) sign = -sign;
                
                var midPoint = vector(centerX, centerY) + perpNorm * perpDist * sign;
                
                var entityName = "A_" ~ entityCount;
                var arcParams = { "start" : p0, "mid" : midPoint, "end" : p1 };
                if (inPattern)
                {
                    patternBaseEntities = append(patternBaseEntities, { "type" : "ARC", "params" : arcParams, "name" : entityName });
                }
                else
                {
                    skArc(sk, entityName, arcParams);
                    entityCount = entityCount + 1;
                }
            }
            else
            {
                // Elliptical arc - simplified implementation
                // Full implementation would require converting SVG arc parameters to elliptical arc parameters
                // For now, approximate with a line segment
                // TODO: Implement full elliptical arc conversion (see v46.2 for reference)
                var entityName = "A_" ~ entityCount;
                var lineParams = { "start" : p0, "end" : p1 };
                if (inPattern)
                {
                    patternBaseEntities = append(patternBaseEntities, { "type" : "LINE", "params" : lineParams, "name" : entityName });
                }
                else
                {
                    skLineSegment(sk, entityName, lineParams);
                    entityCount = entityCount + 1;
                }
            }
            currentPath = append(currentPath, p1);
        }
        else if (cmd == "Z")
        {
            // Close path
            if (size(currentPath) > 1 && currentPathStart != undefined)
            {
                var startPoint = currentPath[0];
                var endPoint = currentPath[size(currentPath) - 1];
                if (norm(startPoint - endPoint) > 1e-6 * millimeter)
                {
                    var entityName = "Z_" ~ entityCount;
                    var lineParams = { "start" : endPoint, "end" : startPoint };
                    if (inPattern)
                    {
                        patternBaseEntities = append(patternBaseEntities, { "type" : "LINE", "params" : lineParams, "name" : entityName });
                    }
                    else
                    {
                        skLineSegment(sk, entityName, lineParams);
                        entityCount = entityCount + 1;
                    }
                }
            }
            currentPath = [];
            currentPathStart = undefined;
        }
        else if (cmd == "LINE")
        {
            // Line primitive
            var p1 = parsePoint(line, argsPos);
            var p1Pos = p1.nextPos;
            var p2 = parsePoint(line, p1Pos);
            
            var start = vector(p1.x * scale * millimeter, p1.y * scale * millimeter);
            var end = vector(p2.x * scale * millimeter, p2.y * scale * millimeter);
            
            // Check for CONSTRUCTION flag
            var isConstruction = indexOf(line, "CONSTRUCTION") != -1;
            
            var entityName = "LINE_" ~ entityCount;
            var lineParams = { "start" : start, "end" : end };
            if (isConstruction)
            {
                lineParams["construction"] = true;
            }
            if (inPattern)
            {
                patternBaseEntities = append(patternBaseEntities, { "type" : "LINE", "params" : lineParams, "name" : entityName });
            }
            else
            {
                skLineSegment(sk, entityName, lineParams);
                entityCount = entityCount + 1;
            }
        }
        else if (cmd == "CIRCLE")
        {
            // Circle primitive
            var center = parsePoint(line, argsPos);
            var centerPos = center.nextPos;
            var rResult = stringToNumberManual(line, centerPos);
            var r = rResult.value;
            
            var c = vector(center.x * scale * millimeter, center.y * scale * millimeter);
            var radius = r * scale * millimeter;
            
            // Check for CONSTRUCTION flag
            var isConstruction = indexOf(line, "CONSTRUCTION") != -1;
            
            var entityName = "CIRCLE_" ~ entityCount;
            var circleParams = { "center" : c, "radius" : radius };
            if (isConstruction)
            {
                circleParams["construction"] = true;
            }
            if (inPattern)
            {
                patternBaseEntities = append(patternBaseEntities, { "type" : "CIRCLE", "params" : circleParams, "name" : entityName });
            }
            else
            {
                skCircle(sk, entityName, circleParams);
                entityCount = entityCount + 1;
            }
        }
        else if (cmd == "ELLIPSE")
        {
            // Ellipse primitive
            var center = parsePoint(line, argsPos);
            var centerPos = center.nextPos;
            var rxResult = stringToNumberManual(line, centerPos);
            var rx = rxResult.value;
            var ryResult = stringToNumberManual(line, rxResult.nextPos);
            var ry = ryResult.value;
            
            var c = vector(center.x * scale * millimeter, center.y * scale * millimeter);
            var majorR = max(rx, ry) * scale * millimeter;
            var minorR = min(rx, ry) * scale * millimeter;
            
            // Check for CONSTRUCTION flag
            var isConstruction = indexOf(line, "CONSTRUCTION") != -1;
            
            var entityName = "ELLIPSE_" ~ entityCount;
            var ellipseParams = {
                "center" : c,
                "majorAxis" : vector(majorR, 0 * millimeter),
                "minorRadius" : minorR
            };
            if (isConstruction)
            {
                ellipseParams["construction"] = true;
            }
            if (inPattern)
            {
                patternBaseEntities = append(patternBaseEntities, { "type" : "ELLIPSE", "params" : ellipseParams, "name" : entityName });
            }
            else
            {
                skEllipse(sk, entityName, ellipseParams);
                entityCount = entityCount + 1;
            }
        }
        else if (cmd == "RECT")
        {
            // Rectangle primitive (4 corners)
            var p1 = parsePoint(line, argsPos);
            var p1Pos = p1.nextPos;
            var p2 = parsePoint(line, p1Pos);
            var p2Pos = p2.nextPos;
            var p3 = parsePoint(line, p2Pos);
            var p3Pos = p3.nextPos;
            var p4 = parsePoint(line, p3Pos);
            
            var v1 = vector(p1.x * scale * millimeter, p1.y * scale * millimeter);
            var v2 = vector(p2.x * scale * millimeter, p2.y * scale * millimeter);
            var v3 = vector(p3.x * scale * millimeter, p3.y * scale * millimeter);
            var v4 = vector(p4.x * scale * millimeter, p4.y * scale * millimeter);
            
            // Check for CONSTRUCTION flag
            var isConstruction = indexOf(line, "CONSTRUCTION") != -1;
            
            // Create 4 line segments
            var rectParams1 = { "start" : v1, "end" : v2 };
            var rectParams2 = { "start" : v2, "end" : v3 };
            var rectParams3 = { "start" : v3, "end" : v4 };
            var rectParams4 = { "start" : v4, "end" : v1 };
            if (isConstruction)
            {
                rectParams1["construction"] = true;
                rectParams2["construction"] = true;
                rectParams3["construction"] = true;
                rectParams4["construction"] = true;
            }
            
            if (inPattern)
            {
                patternBaseEntities = append(patternBaseEntities, { "type" : "LINE", "params" : rectParams1, "name" : "RECT1_" ~ entityCount });
                patternBaseEntities = append(patternBaseEntities, { "type" : "LINE", "params" : rectParams2, "name" : "RECT2_" ~ entityCount });
                patternBaseEntities = append(patternBaseEntities, { "type" : "LINE", "params" : rectParams3, "name" : "RECT3_" ~ entityCount });
                patternBaseEntities = append(patternBaseEntities, { "type" : "LINE", "params" : rectParams4, "name" : "RECT4_" ~ entityCount });
            }
            else
            {
                skLineSegment(sk, "RECT1_" ~ entityCount, rectParams1);
                entityCount = entityCount + 1;
                skLineSegment(sk, "RECT2_" ~ entityCount, rectParams2);
                entityCount = entityCount + 1;
                skLineSegment(sk, "RECT3_" ~ entityCount, rectParams3);
                entityCount = entityCount + 1;
                skLineSegment(sk, "RECT4_" ~ entityCount, rectParams4);
                entityCount = entityCount + 1;
            }
        }
        else if (cmd == "ARRAY_LINEAR" || cmd == "ARRAY_GRID" || cmd == "ARRAY_CIRCULAR")
        {
            // Pattern command - store for later execution
            currentPattern = {
                "type" : cmd,
                "args" : substring(line, argsPos, length(line))
            };
            inPattern = true;
            patternBaseEntities = [];
        }
        else if (cmd == "BEGIN_PATTERN")
        {
            // Start collecting pattern base geometry
            inPattern = true;
            patternBaseEntities = [];
        }
        else if (cmd == "END_PATTERN")
        {
            // Execute pattern
            if (currentPattern != undefined && size(patternBaseEntities) > 0)
            {
                executePattern(sk, currentPattern, patternBaseEntities, entityCount, debugMode);
                entityCount = entityCount + size(patternBaseEntities);
            }
            inPattern = false;
            currentPattern = undefined;
            patternBaseEntities = [];
        }
    }
    
    // Close any open path
    if (size(currentPath) > 1 && currentPathStart != undefined)
    {
        var startPoint = currentPath[0];
        var endPoint = currentPath[size(currentPath) - 1];
        if (norm(startPoint - endPoint) > 1e-6 * millimeter)
        {
            var entityName = "Z_final_" ~ entityCount;
            var lineParams = { "start" : endPoint, "end" : startPoint };
            skLineSegment(sk, entityName, lineParams);
        }
    }
}

function executePattern(sk is Sketch, pattern is map, baseEntities is array, startEntityCount is number, debugMode is boolean)
{
    // Create base entities first
    var baseEntityQueries = [];
    var entityCount = startEntityCount;
    
    for (var entity in baseEntities)
    {
        if (entity["type"] == "LINE")
        {
            skLineSegment(sk, entity.name, entity.params);
            baseEntityQueries = append(baseEntityQueries, qCreatedBy(entity.name, EntityType.EDGE));
        }
        else if (entity["type"] == "CIRCLE")
        {
            skCircle(sk, entity.name, entity.params);
            baseEntityQueries = append(baseEntityQueries, qCreatedBy(entity.name, EntityType.EDGE));
        }
        else if (entity["type"] == "ELLIPSE")
        {
            skEllipse(sk, entity.name, entity.params);
            baseEntityQueries = append(baseEntityQueries, qCreatedBy(entity.name, EntityType.EDGE));
        }
        else if (entity["type"] == "BEZIER")
        {
            skBezier(sk, entity.name, entity.params);
            baseEntityQueries = append(baseEntityQueries, qCreatedBy(entity.name, EntityType.EDGE));
        }
        else if (entity["type"] == "ARC")
        {
            skArc(sk, entity.name, entity.params);
            baseEntityQueries = append(baseEntityQueries, qCreatedBy(entity.name, EntityType.EDGE));
        }
        entityCount = entityCount + 1;
    }
    
    if (size(baseEntityQueries) == 0)
    {
        return;
    }
    
    // Parse pattern arguments and create pattern
    // Note: Pattern execution would require opPattern, which needs to be called after skSolve
    // For now, this is a placeholder - full pattern implementation would require
    // solving the sketch first, then applying opPattern
    // baseQuery would be used here: var baseQuery = qUnion(baseEntityQueries);
    
    if (debugMode)
    {
        println("Pattern detected: " ~ pattern["type"] ~ " (base entities: " ~ size(baseEntities) ~ ")");
    }
}

