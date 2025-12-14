# Debugging v47 Setup - Finding the POST Request

## Understanding When POST Requests Appear

### Scenario 1: Adding Feature Directly in Onshape UI
When you click **Insert → Feature → SVG to Sketch 47** in Onshape:
- Onshape **does** make API calls that should be visible
- You **should** see a POST request in the Network tab
- If you don't see it, try:
  - Filtering by "features" in the Network tab
  - Making sure "Preserve log" is enabled
  - Clearing the log before adding the feature

### Scenario 2: Using the App to Convert SVG
When you use the **SVG2Sketch-app** to convert an SVG file:
- The app makes a POST request to Onshape's API
- You **should** see: `POST /api/partstudios/d/.../w/.../e/.../features`
- This is what you need to find the `featureType` ID

## How to Find the Feature Type ID

### Method 1: Use the App (Recommended)
1. **Start the app** and convert an SVG file
2. **Open DevTools Network tab** before clicking "Convert"
3. **Click "Convert"** in the app
4. **Look for POST request** to `/api/partstudios/.../features`
5. **Click the request** → **Payload/Request tab**
6. **Find `feature.featureType`** - copy this value

### Method 2: Check Onshape's Internal Calls
1. **Open DevTools** → **Network tab**
2. **Filter by**: `features` or `partstudios`
3. **Add the feature** in Onshape (Insert → Feature → SVG to Sketch 47)
4. **Look for any POST requests** that appear
5. **If you see one**, check the payload for `featureType`

### Method 3: Check Server Logs
If the app is running, check the server console logs:
- The app logs the `featureType` being used
- Look for: `"FeatureScript v47 feature definition before API call"`
- The log shows: `featureType: 'SVG to Sketch 47'` or the actual ID

## Verifying v47 is Being Used

### Check App Configuration
1. **Check `.env` file**:
   ```env
   ONSHAPE_FEATURE_TYPE_ID_V47=SVG to Sketch 47::e7a355754e359de9fbe54de5
   ```
   (Replace with your actual ID)

2. **Check if app is using v47**:
   - The app uses v47 when:
     - Patterns are detected
     - `textAsPaths` is enabled
     - `useV47=true` is sent in the request

### Check Server Logs
When converting via the app, look for:
```
Using Intermediate Format (v47 mode)
Generated Intermediate Format content length: ...
FeatureScript v47 feature definition before API call
```

### Check Network Tab (App Conversion)
1. **Open DevTools** → **Network tab**
2. **Filter by**: `features` or `convert`
3. **Convert an SVG** via the app
4. **Look for POST** to `/api/partstudios/.../features`
5. **Check the payload**:
   - Should have `"useIntermediateFormat": true`
   - Should have `"featureType": "SVG to Sketch 47::..."`

## Troubleshooting

### "I don't see any POST requests"
- **If adding directly in Onshape**: This is normal - Onshape handles it internally
- **If using the app**: 
  - Check that the app server is running
  - Check browser console for errors
  - Check server logs for API calls
  - Verify OAuth is working (you're logged in)

### "The feature works but I can't find the featureType ID"
- The featureType ID is only needed for the **app** to call v47
- If the feature works when added directly, it's installed correctly
- To find the ID, you need to see the API call (either via app or Onshape's internal calls)

### "How do I know if the app is using v47?"
Check the conversion response:
```json
{
  "success": true,
  "mode": "v47_intermediate_format",  // ← This indicates v47
  "message": "Sketch creation initiated via FeatureScript (IF)"
}
```

## Quick Test

1. **Start the app**: `npm start` in `SVG2Sketch-app`
2. **Open app in browser**: `https://localhost:3000`
3. **Open DevTools** → **Network tab**
4. **Select an SVG file** and click "Convert"
5. **Look for POST** to `/api/partstudios/.../features`
6. **Check payload** for `featureType` value

If you see the POST, you can copy the `featureType` value and add it to `.env`.

