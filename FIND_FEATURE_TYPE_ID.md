# How to Find and Configure ONSHAPE_FEATURE_TYPE_ID_V47

## Overview

The `ONSHAPE_FEATURE_TYPE_ID_V47` environment variable tells the app which FeatureScript feature to call when using v47 mode. This ID is unique to your Onshape installation of the FeatureScript.

## Step-by-Step Instructions

### Step 1: Install FeatureScript v47 in Onshape

1. **Open Onshape** and navigate to a document
2. **Open or create a Feature Studio** tab
3. **Copy the FeatureScript code** from `SVG to Sketch FS/SVG to Sketch v47.fs`
4. **Paste it into the Feature Studio**
5. **Save** (Ctrl+S or Cmd+S)
6. **Activate** the feature (if needed)

### Step 2: Find the Feature Type ID

**Important Note**: You don't need the ID in `.env` to make a POST request! The app will use a default value (`"SVG to Sketch 47"`) if the env var isn't set. The POST will likely fail, but you can still see it and learn what Onshape expects.

**Method 1: Adding Feature Directly in Onshape (Recommended First Try)**

This is the most direct way - Onshape will show you the exact format it uses:

1. **Open a Part Studio** tab in Onshape (in the same document where you saved v47)

2. **Open Browser DevTools**:
   - **Chrome/Edge**: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - **Firefox**: Press `F12` or `Ctrl+Shift+K` (Windows) / `Cmd+Option+K` (Mac)

3. **Go to the Network tab** in DevTools

4. **Enable "Preserve log"** (checkbox at the top of Network tab)

5. **Clear the network log** (click the 🚫 icon or press `Ctrl+Shift+E`)

6. **Add the FeatureScript feature**:
   - In the Part Studio, click **Insert** → **Feature**
   - Find **"SVG to Sketch 47"** in the feature list
   - Click to add it (you can cancel after it's added, we just need the network request)

7. **Find the API request**:
   - In the Network tab, **filter by "features"** (type "features" in the filter box)
   - Look for a **POST** request to `/features`
   - The URL will look like: `https://cad.onshape.com/api/partstudios/d/.../w/.../e/.../features`
   - Click on this request

8. **View the request payload**:
   - Click the **"Payload"** or **"Request"** tab
   - Look for the JSON body
   - Find the `feature` object
   - Inside `feature`, find the `featureType` field

9. **Copy the featureType value**:
   - It will look like: `"SVG to Sketch 47::e7a355754e359de9fbe54de5"`
   - The format is: `"Feature Name::unique_id"`
   - **Copy the entire string** (including the double colons and ID)

**Method 2: Using the App (Even Without Correct ID)**

You can use the app to make a POST request even without the correct ID - it will use a default and fail, but you can see the request:

1. **Start your app server** (`npm start` in `SVG2Sketch-app`)
   - **Don't worry** if `ONSHAPE_FEATURE_TYPE_ID_V47` isn't set yet - the app will use `"SVG to Sketch 47"` as default

2. **Open the app** in your browser: `https://localhost:3000`

3. **Open Browser DevTools** → **Network tab**

4. **Clear the network log**

5. **Convert an SVG file** via the app:
   - Select an SVG file
   - Click "Convert"
   - **It will likely fail**, but the POST request will still be visible

6. **Check the POST request**:
   - Look for POST to `/api/partstudios/.../features`
   - Check the **Response** tab - Onshape's error might tell you the correct format
   - Check the **Payload** tab - see what the app sent

7. **Check server logs**:
   - The server console shows: `Creating feature with definition: { featureType: '...' }`
   - This shows what the app tried to use

**Method 3: Check Error Response from App**

If Method 1 doesn't work and Method 2 fails, check the error response:

1. Use the app to convert (even without correct ID)
2. Check the **Response** tab in the Network request
3. Onshape's error message might include the correct `featureType` format
4. Also check server console logs for detailed error information

**Method 2: Adding Feature Directly in Onshape**

1. **Open a Part Studio** tab in Onshape

2. **Open Browser DevTools** → **Network tab**

3. **Clear the network log** (click the 🚫 icon)

4. **Add the FeatureScript feature**:
   - In the Part Studio, click **Insert** → **Feature**
   - Find **"SVG to Sketch 47"** in the feature list
   - Click to add it (you can cancel after it's added, we just need the network request)

5. **Find the API request**:
   - In the Network tab, look for a **POST** request to `/features`
   - **Note**: If you don't see it, try:
     - Filtering by "features" in the Network tab search box
     - Making sure "Preserve log" is checked
     - Refreshing and trying again

6. **View the request payload** (same as Method 1, steps 8-9)

### Step 3: Configure the .env File

1. **Open or create** `.env` file in the `SVG2Sketch-app` directory

2. **Add the configuration**:
   ```env
   # FeatureScript v47 Feature Type ID
   # Format: "Feature Name::unique_id"
   # Find this via DevTools Network tab when adding the feature in Onshape
   ONSHAPE_FEATURE_TYPE_ID_V47=SVG to Sketch 47::e7a355754e359de9fbe54de5
   ```

3. **Replace the example value** with your actual `featureType` from Step 2

4. **Save the file**

### Step 4: Verify Configuration

1. **Restart your Node.js server** (if it's running):
   ```bash
   # Stop the server (Ctrl+C)
   # Then restart
   npm start
   ```

2. **Test the configuration**:
   - The app will use this ID when calling FeatureScript v47
   - If the ID is wrong, you'll get an error when trying to convert SVG files
   - Check server logs for any featureType-related errors

## Example

Here's what the Network request payload looks like:

```json
{
  "btType": "BTFeatureDefinitionCall-1406",
  "feature": {
    "btType": "BTMFeature-134",
    "featureType": "SVG to Sketch 47::e7a355754e359de9fbe54de5",  ← Copy this value
    "name": "SVG Import",
    "parameters": [...]
  }
}
```

## Fallback Behavior

If `ONSHAPE_FEATURE_TYPE_ID_V47` is not set in `.env`, the app will use:
- Default: `"SVG to Sketch 47"` (just the name, without the ID)

**However**, this may not work reliably. Onshape typically requires the full ID format (`"Name::id"`), so it's **recommended** to set the environment variable.

## Troubleshooting

### Problem: "But the app needs the ID to work - how can it POST without it?"
- **Answer**: The app doesn't need the correct ID to make a POST request! 
  - If `ONSHAPE_FEATURE_TYPE_ID_V47` isn't set, it uses default: `"SVG to Sketch 47"`
  - The POST will likely fail, but you can still see it in the Network tab
  - The error response might tell you what format Onshape expects
  - **Best approach**: Use Method 1 (add feature directly in Onshape) to see the exact format

### Problem: Can't find the POST request when adding directly in Onshape
- **Solution**: 
  - Make sure you cleared the network log **before** adding the feature
  - Check that "Preserve log" is enabled in the Network tab
  - **Filter by "features"** in the Network tab search box (this is important!)
  - Try refreshing the page and adding the feature again
  - If still not visible, try Method 2 (use the app) - it will make a POST even if it fails

### Problem: Can't find the POST request when using the app
- **Solution**: 
  - Make sure the app server is running
  - Check that you're actually clicking "Convert" (not just selecting a file)
  - Filter by "features" or "partstudios" in the Network tab
  - Look for any POST request to Onshape's API
  - Check the server console logs - they show the featureType being used
  - **Even if conversion fails**, the POST request should be visible

### Problem: featureType is just the name (no `::id`)
- **Solution**: 
  - The full ID format (`::id`) is preferred but not always required
  - If just the name works, you can use it
  - However, the full ID format is more reliable
  - Try using Method 1 (the app) to see the exact format Onshape expects

### Problem: The app shows an error but I can't see the POST request
- **Solution**: 
  - Check the **server console logs** - they now show detailed error information including the featureType
  - The error message should tell you what featureType was used
  - Look for lines like: `Creating feature with definition: { featureType: '...' }`

### Problem: App still can't find the feature
- **Solution**: 
  1. Verify the FeatureScript is saved and activated in Onshape
  2. Check that you copied the entire string including `::` and the ID
  3. Make sure there are no extra spaces in the `.env` file
  4. Restart the Node.js server after updating `.env`

### Problem: Different featureType format
- **Solution**: Onshape may use different formats. Copy exactly what you see in the Network tab
- The format might be: `"SVG to Sketch 47"` (name only) or `"SVG to Sketch 47::abc123"` (name + ID)

## Quick Reference

**File to edit**: `SVG2Sketch-app/.env`

**Variable name**: `ONSHAPE_FEATURE_TYPE_ID_V47`

**Expected format**: `"SVG to Sketch 47::e7a355754e359de9fbe54de5"`

**Where to find it**: Browser DevTools → Network tab → POST `/features` → Request Payload → `feature.featureType`

