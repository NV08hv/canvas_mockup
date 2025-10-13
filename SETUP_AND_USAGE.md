# Setup and Usage Guide

## Overview
This mockup canvas application now supports saving files locally to the `public/mockups` folder with automatic loading on startup.

## Architecture

### Components
1. **Frontend (Vite + React)** - Port 5174
   - Handles UI and file management
   - Manages file state and indices

2. **Backend (Express)** - Port 3001
   - Handles file uploads to `public/mockups/`
   - Manages file deletion
   - Serves saved files list

### File Flow
```
User Upload → Frontend State → Save Button → Backend API → public/mockups/
                                                                    ↓
                                               On Page Load ← Files loaded back
```

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Both Servers

**Terminal 1 - Backend Server:**
```bash
npm run server
```
Output: `Server running on http://localhost:3001`

**Terminal 2 - Frontend Dev Server:**
```bash
npm run dev
```
Output: `Local: http://localhost:5174/`

### 3. Open Application
Navigate to: http://localhost:5174/

## Features

### Add Flow
1. **Upload Files**: Click "Files" or "Folder" button to upload mockup images
2. **Automatic Indexing**: Each file gets a unique index (0, 1, 2, 3...)
3. **Multiple Uploads**: Add more files and they get sequential indices (4, 5, 6...)
4. **Save to Disk**: Click "Save Changes" to persist files to `public/mockups/`

### Delete Flow
1. **Delete File**: Click delete button on any mockup thumbnail
2. **Smart Tracking**:
   - New files (not saved): Deleted immediately
   - Saved files: Added to deletion queue
3. **Batch Deletion**: Click "Save Changes" to execute all deletions

### Save Button
- Location: Left sidebar under "Save & Export"
- Shows pending changes:
  - ✓ New files to upload
  - ✓ Files marked for deletion
- Disabled when no changes
- Yellow badge shows unsaved changes count

## API Endpoints

### GET /api/mockups
Returns list of all saved mockup files
```javascript
Response: [
  {
    name: "mockup_0.png",
    path: "/mockups/mockup_0.png",
    index: 0,
    isFromDatabase: true
  }
]
```

### POST /api/mockups
Upload a new mockup file
```javascript
FormData:
  - file: File
  - index: number

Response: {
  message: "File uploaded successfully",
  file: { name, path, index }
}
```

### DELETE /api/mockups/:filename
Delete a mockup file
```javascript
Response: {
  message: "File deleted successfully",
  filename: "mockup_0.png"
}
```

## File Storage

### Directory Structure
```
canvas_mockup/
├── public/
│   └── mockups/           ← Saved files location
│       ├── mockup_0.png
│       ├── mockup_1.png
│       └── ...
├── server.js              ← Backend server
├── src/
│   └── components/
│       ├── MockupCanvas.tsx
│       └── ImageUploader.tsx
```

### File Naming Convention
Files are saved with format: `{original_name}_{index}.{extension}`
- Example: `tshirt_mockup_0.png`, `bottle_mockup_1.jpg`

## Testing the Flow

### Test Case 1: Initial Upload and Save
1. Start both servers
2. Upload 3 mockup files
3. See indices: 0, 1, 2 assigned
4. Click "Save Changes"
5. Refresh page → Files should load automatically

### Test Case 2: Add More Files
1. Page loads with saved files (indices 0, 1, 2)
2. Upload 2 more files
3. New files get indices 3, 4
4. "Unsaved Changes" badge shows: "2 new file(s) to upload"
5. Click "Save Changes"
6. All 5 files now saved to disk

### Test Case 3: Delete and Save
1. Page loads with 5 files
2. Delete file at index 1 (from database)
3. "Unsaved Changes" badge shows: "1 file(s) to delete"
4. Delete a newly uploaded file (index 4)
5. Click "Save Changes"
6. Only database file gets deleted from disk

## Troubleshooting

### Server Not Running
**Error:** `Error saving files: Failed to fetch`
**Solution:**
```bash
# Start the backend server
npm run server
```

### Port Already in Use
**Error:** `EADDRINUSE: address already in use :::3001`
**Solution:**
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Or use a different port in server.js
const PORT = 3002
```

### Files Not Loading
**Issue:** Page loads but no files appear
**Debug:**
1. Check console for errors
2. Verify server is running: `http://localhost:3001/api/mockups`
3. Check if files exist: `ls public/mockups/`

### CORS Errors
**Solution:** Server already configured with CORS. Ensure server is running on port 3001.

## Console Logs

### On Page Load
```
Loading saved files: [...]
Loaded 3 saved mockup files
```

### On Save
```
=== SAVE OPERATION ===
New files to upload: [{ name: "...", index: 3 }]
Files to delete: ["mockup_1.png"]
Uploaded: { message: "...", file: {...} }
Deleted: { message: "...", filename: "..." }
```

## Development Notes

### State Management
- `mockupFiles[]` - Array of ImageFile objects with metadata
- `deletedFileNames[]` - Queue of files to delete on save
- `isFromDatabase` - Flag to distinguish saved vs new files

### Index Tracking
- Indices are assigned sequentially starting from 0
- When loading saved files, indices are preserved
- New uploads get next available index

### Data Persistence
- Files saved as actual files in `public/mockups/`
- No database required - filesystem is the source of truth
- On load, reads directory and reconstructs state

## Future Enhancements
- [ ] Add progress indicators for uploads
- [ ] Support bulk operations (select multiple files)
- [ ] Add file preview before save
- [ ] Implement undo/redo functionality
- [ ] Add file size optimization
