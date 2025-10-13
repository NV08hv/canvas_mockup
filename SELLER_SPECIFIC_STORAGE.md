# Seller-Specific Storage Implementation

## Overview
Files are now saved to seller-specific folders in the format: `public/mockup_<sellerId>/`

## Default Configuration
- **Default Seller ID**: 10
- **Default Folder**: `public/mockup_10/`

## Features Implemented

### 1. Seller ID Display
- Top right of "Upload Images" section shows current seller ID
- Format: "Seller ID: 10" (in blue)

### 2. Show Mockup Button
- **Location**: Top of left sidebar, above file upload controls
- **Label**: "Show Mockup (Seller 10)"
- **Color**: Cyan/Teal
- **Function**: Loads all saved mockups for the current seller

### 3. Automatic Folder Creation
- When saving files, the server automatically creates `mockup_<sellerId>` folder if it doesn't exist
- No manual folder creation needed

### 4. Seller-Specific Save
- Files are saved to: `public/mockup_<sellerId>/`
- Each seller's mockups are isolated in their own folder

### 5. Seller-Specific Load
- Click "Show Mockup" to load all files from seller's folder
- Only loads mockups for the current seller ID
- Shows alert with count of loaded files

## User Flow

### Initial State (Page Load)
```
1. Page opens
2. Seller ID is set to 10 (default)
3. No mockups loaded automatically
4. "Show Mockup (Seller 10)" button is visible
```

### Loading Saved Mockups
```
1. Click "Show Mockup (Seller 10)" button
2. System fetches from: public/mockup_10/
3. All images in folder are loaded
4. Alert shows: "Loaded X mockup(s) for seller 10"
5. Mockups appear in grid
```

### Uploading and Saving New Files
```
1. Upload mockup files using file/folder/URL upload
2. Files are staged in memory (not saved yet)
3. "Unsaved Changes" badge shows count
4. Click "Save Changes"
5. System creates public/mockup_10/ if needed
6. Files are saved to public/mockup_10/
7. Alert confirms: "Files saved to: public/mockup_10/"
```

### Deleting Files
```
1. Delete a mockup from grid
2. If file is from database: Added to deletion queue
3. If file is new: Deleted immediately
4. Click "Save Changes"
5. Queued files are deleted from public/mockup_10/
```

## API Endpoints

### GET /api/mockups/:sellerId
Load all mockups for specific seller

**Request:**
```
GET http://localhost:3001/api/mockups/10
```

**Response:**
```json
[
  {
    "name": "tshirt_0.png",
    "path": "/mockup_10/tshirt_0.png",
    "index": 0,
    "isFromDatabase": true
  }
]
```

### POST /api/mockups
Upload new mockup file

**Request:**
```
POST http://localhost:3001/api/mockups
FormData:
  - file: <File>
  - index: 0
  - sellerId: 10
```

**Response:**
```json
{
  "message": "File uploaded successfully",
  "file": {
    "name": "tshirt_0.png",
    "path": "/mockup_10/tshirt_0.png",
    "index": 0,
    "sellerId": 10
  }
}
```

### DELETE /api/mockups/:sellerId/:filename
Delete specific file for seller

**Request:**
```
DELETE http://localhost:3001/api/mockups/10/tshirt_0.png
```

**Response:**
```json
{
  "message": "File deleted successfully",
  "filename": "tshirt_0.png",
  "sellerId": 10
}
```

## Folder Structure

```
canvas_mockup/
├── public/
│   ├── mockup_10/          ← Seller 10's mockups
│   │   ├── tshirt_0.png
│   │   ├── bottle_1.png
│   │   └── mug_2.png
│   ├── mockup_11/          ← Seller 11's mockups
│   │   └── ...
│   └── mockup_12/          ← Seller 12's mockups
│       └── ...
```

## Testing Steps

### Test 1: First Time Setup
1. Open app: http://localhost:5174/
2. See "Seller ID: 10" in top right
3. Click "Show Mockup (Seller 10)"
4. See alert: "No mockups found for seller 10"

### Test 2: Upload and Save
1. Upload 3 mockup files
2. See "3 new file(s) to upload"
3. Click "Save Changes"
4. Alert: "Files saved to: public/mockup_10/"
5. Check filesystem: `ls public/mockup_10/`
6. Should see 3 files

### Test 3: Reload and Show Mockups
1. Refresh page
2. Click "Show Mockup (Seller 10)"
3. Alert: "Loaded 3 mockup(s) for seller 10"
4. See 3 mockups in grid

### Test 4: Add More Files
1. With 3 existing mockups loaded
2. Upload 2 more files
3. See "2 new file(s) to upload"
4. Click "Save Changes"
5. Now have 5 files total in public/mockup_10/

### Test 5: Delete File
1. Load mockups for seller 10
2. Delete one mockup (from database)
3. See "1 file(s) to delete"
4. Click "Save Changes"
5. File removed from public/mockup_10/

## Multiple Sellers

To support different sellers, you can modify the sellerId state:

```typescript
// Change in MockupCanvas.tsx line 1502
const [sellerId] = useState<number>(11) // Change to 11

// Now files will be saved to public/mockup_11/
// "Show Mockup" will load from public/mockup_11/
```

## Benefits

✅ **Isolation**: Each seller's mockups are completely separate
✅ **Organization**: Easy to find files for specific seller
✅ **Scalability**: Can support unlimited sellers
✅ **Clean URLs**: Images accessible via `/mockup_<sellerId>/<filename>`
✅ **Manual Loading**: No auto-load on page refresh - user controls when to load
✅ **Visual Feedback**: Clear seller ID display and loading states

## Console Logs

### On Load Mockups:
```
Loading saved files for seller 10: [...]
Loaded 3 saved mockup files for seller 10
```

### On Save:
```
=== SAVE OPERATION ===
Seller ID: 10
New files to upload: [{ name: "...", index: 3 }]
Files to delete: []
Created directory: /Users/.../public/mockup_10
Uploaded: { message: "...", file: {...} }
```

## Troubleshooting

### Button Shows "Loading..." Forever
- Check server is running: `npm run server`
- Check console for errors
- Verify API endpoint: http://localhost:3001/api/mockups/10

### Files Not Saving
- Check sellerId is set correctly (line 1502 in MockupCanvas.tsx)
- Verify server has write permissions to public/ folder
- Check server console for errors

### Wrong Folder Created
- Verify sellerId value in FormData
- Check server logs for "Created directory:" message
- Ensure sellerId is passed in POST request

## Next Steps

To make seller ID dynamic:
1. Add input field in UI to change seller ID
2. Or fetch from URL params: `?sellerId=10`
3. Or fetch from user authentication system
