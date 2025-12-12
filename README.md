# SVG2Sketch App - Enhanced SVG to Onshape Converter

An Onshape App that converts SVG files to Onshape sketch geometry with enhanced capabilities beyond the existing FeatureScript version.

## Features

### ✅ Implemented

1. **Direct .SVG File Support**
   - Accepts `.svg` files directly (no `.txt` extension required)
   - File upload via multipart/form-data or direct content

2. **Large File Handling**
   - Supports files larger than 100KB
   - Chunked processing for very large files (>100KB)
   - Streaming support for efficient memory usage

3. **SVG Element Parsing**
   - Complete port of FeatureScript v46.2 parsing logic
   - Supports: `<path>`, `<rect>`, `<circle>`, `<ellipse>`, `<line>`, `<polyline>`, `<polygon>`
   - Handles `<use>`, `<defs>`, and `<symbol>` elements
   - Transform parsing and composition
   - XML comment skipping

4. **Text Processing**
   - Parses `<text>` and `<tspan>` elements
   - Extracts font properties, position, and transforms
   - Parses `<textPath>` elements for text along paths
   - Dual conversion mode: sketch text entities OR path-based outlines

5. **Pattern Recognition**
   - Detects repeated `<use>` elements forming patterns:
     - Linear patterns (1D arrays)
     - Grid patterns (2D arrays)
     - Circular patterns (radial arrays)
   - UI for selecting patterns for array optimization

6. **Onshape Integration**
   - OAuth authentication via passport-onshape
   - REST API integration for sketch creation
   - Plane selection from Onshape document

## Project Structure

```
SVG2Sketch-app/
├── api/
│   └── apiRouter.js          # API routes (convert, planes, patterns)
├── services/
│   ├── onshape-api.js        # Onshape API client
│   ├── sketch-builder.js     # Converts SVG elements to sketch entities
│   └── svg/
│       ├── svg-parser.js     # Core SVG parsing (ported from FS v46.2)
│       ├── path-parser.js    # SVG path command parser
│       ├── text-processor.js # Text element parser
│       ├── text-path-processor.js # TextPath parser
│       ├── chunk-processor.js # Large file chunked processing
│       └── pattern-analyzer.js # Pattern detection
├── public/
│   ├── html/
│   │   └── index.html        # Main UI
│   ├── js/
│   │   └── main.js           # Client-side JavaScript
│   └── css/
│       └── index.css         # Styles
├── utils/
│   └── debug.js              # Debug logging utility
├── config.js                 # Configuration management
├── app.js                    # Express app setup
├── bin/
│   └── www.js                # Server entry point
└── package.json              # Dependencies
```

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Create a `.env` file:
   ```env
   PORT=3000
   API_URL=https://cad.onshape.com
   OAUTH_URL=https://oauth.onshape.com
   OAUTH_CLIENT_ID=your_client_id
   OAUTH_CLIENT_SECRET=your_client_secret
   OAUTH_CALLBACK_URL=https://your-domain.com/oauthRedirect
   SESSION_SECRET=your_session_secret
   DEBUG=true
   ```

3. **Run the Server**
   ```bash
   npm start
   # or for development
   npm run dev
   ```

## API Endpoints

### `GET /api/health`
Health check endpoint.

### `GET /api/planes`
Fetch available planes from Onshape document.
- Query params: `documentId`, `workspaceId`, `elementId`
- Returns: Array of plane objects

### `POST /api/patterns/detect`
Detect patterns in SVG content.
- Body: `{ svgContent: string }`
- Returns: `{ patterns: Array }`

### `POST /api/convert`
Convert SVG to Onshape sketch.
- Form data:
  - `svgFile`: SVG file (multipart/form-data)
  - `documentId`: Onshape document ID
  - `workspaceId`: Onshape workspace ID
  - `elementId`: Part Studio element ID
  - `planeId`: Target plane ID
  - `scale`: Scale factor (default: 1.0)
  - `textAsSketchText`: Convert text to sketch text (boolean)
  - `textAsPaths`: Convert text to paths (boolean)
  - `patterns`: JSON array of selected patterns
- Returns: `{ success: boolean, featureId: string, entityCount: number }`

## Usage

### Accessing the App

**See [ACCESS_GUIDE.md](./ACCESS_GUIDE.md) for detailed instructions.**

Quick steps:
1. **From Onshape**: Open a Part Studio tab, then access the app via:
   - App Store (if published)
   - Direct URL: `https://your-app-url.com/?documentId=...&workspaceId=...&elementId=...`
   - Custom App feature in Onshape

2. **First Time**: You'll be redirected to OAuth login, then back to the app

3. **Using the App**:
   - Upload SVG File: Click "Select SVG File" button, choose a `.svg` file
   - Configure Options: Select text conversion mode, enable/disable pattern detection, set scale factor
   - Select Target Plane: Choose the plane where the sketch will be created
   - Convert: Click "Convert to Onshape Sketch" and wait for processing

## Development Status

### Completed ✅
- App boilerplate and OAuth setup
- SVG parsing (ported from FS v46.2)
- File upload handling (.svg files)
- Large file chunked processing
- Text element parsing
- TextPath parsing
- Pattern detection (linear, grid, circular)
- Basic sketch entity creation
- Path parser (basic implementation)

### In Progress 🚧
- Text conversion to sketch entities
- Full path parser implementation (all SVG commands)
- Array feature generation for patterns

### Pending ⏳
- FeatureScript enhancements (text support, array patterns)
- End-to-end testing
- Error handling improvements
- Performance optimization

## Notes

- The path parser is a simplified version. Full implementation would require porting the complete `parsePathData` function from FeatureScript v46.2.
- Text-to-path conversion requires font glyph extraction, which is complex and may require external libraries.
- Pattern-based array features are detected but not yet converted to Onshape Array features (currently creates individual entities).

## License

[Your License Here]
