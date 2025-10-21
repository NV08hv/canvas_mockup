# Setup and Usage Guide

## Overview
This mockup canvas application uses SQLite database for persistent file storage with separate workflows for file management and workspace loading.

## Architecture

### Components
1. **Frontend (Vite + React)** - Port 5174
   - Handles UI and file management
   - Manages file lifecycle (new vs saved)
   - Two modal workflows: Manager and Show Mockup

2. **Backend (Express + SQLite)** - Port 3001
   - Handles file uploads to database
   - Manages file retrieval and deletion
   - Serves file list and file data

### File Flow
```
User Upload → Frontend State (new files)
                    ↓
              Save Button → Backend API → SQLite Database
                                              ↓
                                    ┌─────────┴─────────┐
                                    ↓                   ↓
                            Manager Modal       Show Mockup Modal
                         (Permanent Delete)    (Load to Workspace)
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

### File Upload Flow
1. **Upload Files**: Click "Files" or "Folder" button to upload mockup images
2. **New File State**: Files are stored in frontend state as "new files"
3. **Save to Database**: Click "Save Changes" to persist files to SQLite database
4. **Memory Management**: Proper cleanup with URL.revokeObjectURL for deleted new files

### Delete Flow
1. **Delete New Files**: Click delete button on unsaved files
   - **Completely removed** from memory and interface
   - Object URLs revoked to free memory
   - ImageUploader reset to prevent re-adding

2. **Delete Saved Files**: Click delete button on database files
   - **Hidden from interface** (not deleted from database)
   - Still accessible via Manager modal
   - Can be permanently deleted via Manager

### Manager Modal
- **Purpose**: Manage database files with permanent deletion
- **Features**:
  - View all saved files in grid layout (4 per row)
  - Mark files for deletion (× button)
  - Delete selected files permanently
  - Delete all files with one click
  - Shows file count and source

### Show Mockup Modal
- **Purpose**: Load saved files into workspace for editing
- **Features**:
  - Preview all saved files
  - Select which files to load
  - Apply button loads files without deleting from database
  - Files removed in modal are NOT deleted permanently

### Save Button
- Location: Left sidebar under "Save & Export"
- Shows pending changes:
  - ✓ New files to upload
- Disabled when no changes
- Yellow badge shows unsaved changes count

## API Endpoints

### GET /api/files/:userId
Returns list of all saved files for a specific user
```javascript
Response: [
  {
    id: 1,
    user_id: "user123",
    name: "mockup_0.png",
    data: Buffer,
    created_at: "2024-01-15T10:30:00.000Z"
  }
]
```

### POST /api/files/:userId
Upload a new file for a specific user
```javascript
FormData:
  - file: File

Response: {
  message: "File uploaded successfully",
  file: { id, name, user_id }
}
```

### DELETE /api/files/:userId/:filename
Permanently delete a file from database
```javascript
Response: {
  message: "File deleted successfully"
}
```

## File Storage

### Database Structure
```
canvas_mockup/
├── database.sqlite        ← SQLite database file
├── server.js              ← Backend server with DB integration
├── src/
│   └── components/
│       ├── MockupCanvas.tsx
│       ├── ImageUploader.tsx
│       ├── MockupModal.tsx    ← Show Mockup modal
│       └── ManagerModal.tsx   ← File manager modal
```

### Database Schema
```sql
CREATE TABLE files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  data BLOB NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### File Lifecycle
- **New Files**: Stored in frontend state with blob URLs
- **Saved Files**: Persisted in SQLite database as BLOB
- **Deleted New Files**: Completely removed from memory
- **Hidden Saved Files**: Removed from workspace but remain in database

## Testing the Flow

### Test Case 1: Upload and Save New Files
1. Start both servers
2. Upload 3 mockup files
3. Files appear as "new files" in interface
4. Click "Save Changes"
5. Files saved to SQLite database
6. Toast notification confirms save

### Test Case 2: Using Manager Modal
1. Click "Manager" button
2. Manager modal shows all database files (grid layout, 4 per row)
3. Click × on a file to mark for deletion
4. File border turns red, × becomes ↺ (undo)
5. Click "Delete Selected" to permanently remove from database
6. Files deleted and modal closes

### Test Case 3: Using Show Mockup Modal
1. Click "Show Mockup" button
2. Modal shows all saved files
3. Remove some files in modal (they disappear from preview)
4. Click "Apply"
5. Selected files load into workspace
6. Files removed in modal are NOT deleted from database
7. Can still see them in Manager modal

### Test Case 4: Delete New vs Saved Files
1. Upload 2 new files (not saved)
2. Load 2 saved files via Show Mockup modal
3. Delete one new file → Completely removed from memory
4. Delete one saved file → Hidden from interface
5. New file cannot be recovered
6. Saved file still accessible via Manager modal

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
- `isFromDatabase` - Flag to distinguish saved vs new files
- `imageUploaderResetTrigger` - Counter to reset ImageUploader component
- `hiddenMockupIndices` - Set of indices hidden from interface
- `managerFiles[]` - Files displayed in Manager modal

### File Lifecycle States
1. **New Files** (`!isFromDatabase`):
   - Stored in frontend state with blob URLs
   - Deleted completely when user clicks delete
   - Object URLs revoked for memory cleanup
   - ImageUploader reset to prevent re-adding

2. **Saved Files** (`isFromDatabase`):
   - Stored in SQLite database
   - Deleted from interface adds to `hiddenMockupIndices`
   - Remain in database until Manager modal deletion
   - Can be reloaded via Show Mockup modal

### Modal Workflows
- **Manager Modal**: Permanent deletion from database
- **Show Mockup Modal**: Load files into workspace (no deletion)

### Memory Management
- `URL.revokeObjectURL()` called when deleting new files
- `cleanupNewFiles()` helper function for batch cleanup
- Proper cleanup prevents memory leaks

### Data Persistence
- Files saved as BLOBs in SQLite database
- Database is the source of truth
- User-specific storage via `user_id` column

## Future Enhancements
- [ ] Add progress indicators for uploads
- [ ] Support bulk operations in Manager modal
- [ ] Add file preview before save
- [ ] Implement undo/redo functionality
- [ ] Add file size optimization and compression
