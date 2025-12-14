# Architecture Options: FeatureScript v47 vs Onshape App

## Current State

Your app currently uses **FeatureScript v46.2** via REST API:
- App receives SVG file
- App passes raw SVG string to FeatureScript
- FeatureScript parses and creates sketch

## Architecture Options

### Option A: Standalone FeatureScript v47

**Structure:**
```
User → Onshape UI → FeatureScript v47 → Sketch
```

**Pros:**
- ✅ Simple - no external dependencies
- ✅ Works offline
- ✅ No OAuth required
- ✅ Direct Onshape integration

**Cons:**
- ❌ No backend processing (text-to-paths, large files)
- ❌ Manual SVG input (copy/paste)
- ❌ No pattern detection/optimization
- ❌ Limited to FeatureScript capabilities

**Use Case:** Basic SVG → Sketch conversion without enhancements

---

### Option B: App + FeatureScript (Current)

**Structure:**
```
User → Onshape App (Node.js) → REST API → FeatureScript v46.2 → Sketch
```

**Pros:**
- ✅ OAuth integration
- ✅ File upload UI
- ✅ Can add backend processing
- ✅ Better UX

**Cons:**
- ❌ Currently just passes raw SVG (no processing yet)
- ❌ Requires app deployment
- ❌ More complex setup

**Use Case:** Enhanced conversion with future backend processing

---

### Option C: Hybrid (Recommended)

**Structure:**
```
User → Onshape App (Node.js) → Backend Processing → Intermediate Format → FeatureScript v47 → Sketch
```

**Flow:**
1. **App receives SVG** (file upload)
2. **Backend processes SVG:**
   - Converts text to paths (opentype.js)
   - Handles large files (chunking)
   - Detects patterns (USE/DEFS → arrays)
   - Generates Intermediate Format
3. **App sends IF to FeatureScript v47** (via REST API)
4. **FeatureScript v47 parses IF** (simpler than raw SVG)
5. **FeatureScript creates sketch**

**Pros:**
- ✅ Best of both worlds
- ✅ Backend handles complex processing
- ✅ FeatureScript handles geometry (what it's good at)
- ✅ FeatureScript v47 can also work standalone (for simple cases)

**Cons:**
- ❌ Most complex architecture
- ❌ Requires both app and FeatureScript

**Use Case:** Full-featured conversion with all enhancements

---

## Communication Flow

### App → FeatureScript (One-Way)

```
┌─────────────┐         REST API          ┌──────────────────┐
│ Onshape App │ ────────────────────────> │ FeatureScript    │
│ (Node.js)   │    POST /features         │ (Onshape Server) │
│             │    {                      │                  │
│             │      featureType: "...",   │                  │
│             │      parameters: [...]     │                  │
│             │    }                       │                  │
└─────────────┘                            └──────────────────┘
```

**How it works:**
1. App authenticates via OAuth
2. App calls `/api/partstudios/d/{did}/w/{wid}/e/{eid}/features`
3. Sends BTM JSON with FeatureScript feature definition
4. Onshape executes FeatureScript
5. Returns feature result (success/error)

### FeatureScript → App (Not Possible)

FeatureScript **cannot** call back to your app because:
- Runs in Onshape's sandbox
- No HTTP client capabilities
- No access to external APIs
- Security restrictions

---

## Implementation Status

### Current (v46.2 Approach)
- ✅ App calls FeatureScript via REST API
- ✅ Passes raw SVG string
- ✅ FeatureScript parses SVG internally

### Proposed (v47 Approach)
- 🚧 App processes SVG → Intermediate Format
- 🚧 App sends IF to FeatureScript v47
- ⏳ FeatureScript v47 parses IF (simpler)

---

## Recommendation

**Use Option C (Hybrid):**

1. **FeatureScript v47** should be **standalone-capable**:
   - Can accept raw SVG (for simple cases)
   - Can accept Intermediate Format (for enhanced cases)
   - Users can use it directly in Onshape if they want

2. **Onshape App** enhances the experience:
   - File upload UI
   - Backend processing (text-to-paths, patterns)
   - Generates Intermediate Format
   - Calls FeatureScript v47 with IF

3. **Both work together:**
   - App users get enhanced features
   - FeatureScript users get basic functionality
   - Same FeatureScript codebase

---

## Next Steps

1. ✅ **Create FeatureScript v47** that accepts:
   - Raw SVG (backward compatible with v46.2)
   - Intermediate Format (new, enhanced)
   - **Status**: Specification created, needs FeatureScript implementation

2. ✅ **Update App** to:
   - Process SVG → Intermediate Format
   - Call FeatureScript v47 with IF
   - **Status**: ✅ Implemented - see `IMPLEMENTATION_SUMMARY.md`

3. ⏳ **Test both modes:**
   - Standalone: User adds FeatureScript directly in Onshape
   - App-enhanced: User uses app, gets IF processing
   - **Status**: Ready for testing once FeatureScript v47 is installed

## Implementation Status

✅ **Completed**:
- Intermediate Format generator (`services/if-generator.js`)
- Pattern detection integration
- Dual-mode API support (v46.2 and v47)
- Automatic mode selection
- Documentation (IF spec, architecture options)

⏳ **Pending**:
- FeatureScript v47 implementation (accepts IF)
- End-to-end testing
- Text-to-path conversion (opentype.js integration)

