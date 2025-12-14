# Intermediate Format (IF) Specification

## Overview

The Intermediate Format (IF) is a simplified command-based format that bridges between backend SVG processing and FeatureScript geometry creation. It's designed to be:

- **Easier to parse** than raw SVG
- **Directly mappable** to FeatureScript drawing operations
- **Supportive of enhancements** like patterns and text-to-paths

## Format Structure

### General Rules

1. **Line-based**: One command per line
2. **Comments**: Lines starting with `#` are ignored
3. **Whitespace**: Commands are space-separated
4. **Case-sensitive**: Commands use uppercase letters

### Command Types

#### Path Commands

| Command | Format | Description |
|---------|--------|-------------|
| `M` | `M x y` | Move to point (start new subpath) |
| `L` | `L x y` | Line to point |
| `C` | `C c1x c1y c2x c2y x y` | Cubic Bezier curve |
| `Q` | `Q cx cy x y` | Quadratic Bezier curve |
| `A` | `A rx ry rotation largeArc sweep x y` | Arc |
| `Z` | `Z` | Close path |

#### Geometric Primitives

| Command | Format | Description |
|---------|--------|-------------|
| `LINE` | `LINE x1 y1 x2 y2 [CONSTRUCTION]` | Line segment |
| `CIRCLE` | `CIRCLE cx cy r [CONSTRUCTION]` | Circle |
| `ELLIPSE` | `ELLIPSE cx cy rx ry [CONSTRUCTION]` | Ellipse |
| `RECT` | `RECT x1 y1 x2 y2 x3 y3 x4 y4 [CONSTRUCTION]` | Rectangle (4 corners) |

#### Array Patterns

| Command | Format | Description |
|---------|--------|-------------|
| `ARRAY_LINEAR` | `ARRAY_LINEAR count spacing dirX dirY` | Linear array pattern |
| `ARRAY_GRID` | `ARRAY_GRID rows cols rowSpacing colSpacing` | Grid array pattern |
| `ARRAY_CIRCULAR` | `ARRAY_CIRCULAR count radius centerX centerY startAngle` | Circular array pattern |
| `BEGIN_PATTERN` | `BEGIN_PATTERN` | Start pattern base geometry |
| `END_PATTERN` | `END_PATTERN` | End pattern base geometry |

## Example

```
# Intermediate Format for SVG to Sketch v47
# Scale: 0.001

# Rectangle
RECT 0.000000 0.000000 100.000000 0.000000 100.000000 50.000000 0.000000 50.000000

# Circle
CIRCLE 50.000000 25.000000 10.000000

# Path
M 0.000000 0.000000
L 50.000000 0.000000
C 75.000000 0.000000 100.000000 25.000000 100.000000 50.000000
L 0.000000 50.000000
Z

# Pattern: linear (5 instances)
ARRAY_LINEAR 5 10.000000 1.000000 0.000000
BEGIN_PATTERN
M 0.000000 0.000000
L 5.000000 0.000000
L 5.000000 5.000000
L 0.000000 5.000000
Z
END_PATTERN
```

## Coordinate System

- **Origin**: Top-left (SVG standard)
- **Units**: Millimeters (after scaling)
- **Scale**: Applied during IF generation (default: 0.001 = 1px = 1mm)

## FeatureScript v47 Integration

FeatureScript v47 should:

1. **Detect IF format**: Check if `inputText` starts with `# Intermediate Format`
2. **Parse commands**: Process line by line
3. **Execute drawing**: Map commands to FeatureScript operations:
   - `M`, `L`, `C`, `Q`, `A`, `Z` → `skLineSegment`, `skArc`, etc.
   - `CIRCLE` → `skCircle`
   - `RECT` → `skLineSegment` (4 lines)
   - `ARRAY_*` → `opPattern` with appropriate parameters

## Benefits

1. **Simplified parsing**: No XML/HTML parsing needed
2. **Direct mapping**: Commands map 1:1 to FeatureScript operations
3. **Pattern support**: Native array commands
4. **Extensible**: Easy to add new command types

## Migration from v46.2

- **v46.2**: Parses raw SVG internally
- **v47**: Can accept either:
  - Raw SVG (backward compatible)
  - Intermediate Format (enhanced mode)

FeatureScript v47 should detect the format automatically and route to the appropriate parser.

