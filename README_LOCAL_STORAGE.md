# Local File Storage Implementation

## Quick Start

### Option 1: Using Start Script (Recommended)
```bash
./start.sh
```

### Option 2: Manual Start
```bash
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend
npm run dev
```

Then open: **http://localhost:5174/**

---

## Implementation Summary

### What Was Implemented

✅ **File Upload with Index Tracking**
- Each uploaded file gets a unique sequential index (0, 1, 2...)
- Supports single files, folder uploads, and URL imports
- Indices are preserved across sessions

✅ **Local File Persistence**
- Files saved to `public/mockups/` folder
- Automatic loading on application startup
- No database required - filesystem is source of truth

✅ **Smart Delete Flow**
- New files: Deleted immediately from state
- Saved files: Queued for deletion on next save
- Batch delete operation on "Save Changes" click

✅ **Save Button with Status**
- Shows count of unsaved changes
- Visual indicators for new uploads and pending deletions
- Disabled when no changes to save

✅ **Backend API Server**
- Express server for file operations
- Endpoints for upload, delete, and list files
- CORS-enabled for local development

---

## File Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        User Actions                          │
└────────┬────────────────────────────────────────────────┬───┘
         │                                                │
    Upload Files                                    Delete Files
         │                                                │
         ▼                                                ▼
┌─────────────────────┐                        ┌──────────────────┐
│  Assign Index       │                        │ Check isFromDB?  │
│  (0,1,2,3,4...)     │                        └────────┬─────────┘
│  Mark as new        │                                 │
└────────┬────────────┘                        ┌────────┴─────────┐
         │                                     │                  │
         ▼                                  New File        Saved File
┌─────────────────────┐                       │                  │
│  Add to State       │                Delete Now         Add to Queue
│  Show in UI         │                       │                  │
└────────┬────────────┘                       └────────┬─────────┘
         │                                              │
         ▼                                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Click "Save Changes"                       │
└────────┬─────────────────────────────────────────────────────┘
         │
    ┌────┴─────┐
    │          │
    ▼          ▼
Upload New  Delete Queued
   Files       Files
    │          │
    └────┬─────┘
         ▼
┌──────────────────────┐
│  public/mockups/     │
│  ├─ mockup_0.png     │
│  ├─ mockup_1.png     │
│  └─ mockup_2.png     │
└──────────────────────┘
         │
    On App Load
         │
         ▼
   Load & Display
```

---

## Example Usage

### Scenario 1: Fresh Start
```javascript
// Start with empty public/mockups/ folder

1. Upload 3 files
   → Files assigned indices: 0, 1, 2
   → Marked as "not from database"

2. Click "Save Changes"
   → POST /api/mockups (3 times)
   → Files saved to public/mockups/
   → Files marked as "from database"

3. Refresh page
   → GET /api/mockups
   → Loads 3 files automatically
```

### Scenario 2: Add More Files
```javascript
// Start with 3 saved files (indices 0, 1, 2)

1. Page loads
   → Automatically loads files 0, 1, 2
   → Next index = 3

2. Upload 2 more files
   → New files get indices: 3, 4
   → Shows "2 new file(s) to upload"

3. Click "Save Changes"
   → Uploads files 3 and 4
   → Now have 5 files total (0-4)
```

### Scenario 3: Delete Files
```javascript
// Start with 5 saved files (indices 0-4)

1. Delete file at index 1
   → File is from database
   → Added to deletedFileNames: ["mockup_1.png"]
   → Shows "1 file(s) to delete"

2. Upload 1 new file
   → Gets index 5
   → Shows "1 new file(s) to upload, 1 file(s) to delete"

3. Delete the new file (index 5)
   → Not from database
   → Deleted immediately
   → Shows "1 file(s) to delete" only

4. Click "Save Changes"
   → DELETE /api/mockups/mockup_1.png
   → Final state: 4 files (0, 2, 3, 4)
```

---

## Technical Details

### State Variables

```typescript
// File metadata with indices
const [mockupFiles, setMockupFiles] = useState<ImageFile[]>([])

// Queue of files to delete on save
const [deletedFileNames, setDeletedFileNames] = useState<string[]>([])

// Loading indicator
const [isLoadingFiles, setIsLoadingFiles] = useState(true)
```

### ImageFile Interface

```typescript
interface ImageFile {
  id: string              // Unique ID
  url: string            // Data URL
  name: string           // Original filename
  source: 'file' | 'folder' | 'url'
  file?: File            // Original File object
  index: number          // Sequential index
  isFromDatabase: boolean // True if saved to disk
}
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/mockups` | List all saved files |
| POST | `/api/mockups` | Upload new file |
| DELETE | `/api/mockups/:filename` | Delete file |

---

## Files Modified/Created

### New Files
- `server.js` - Express backend server
- `start.sh` - Convenience script to start both servers
- `SETUP_AND_USAGE.md` - Detailed setup guide
- `FILE_MANAGEMENT_FLOW.md` - Flow documentation
- `public/mockups/` - Directory for saved files

### Modified Files
- `package.json` - Added express, multer, cors dependencies
- `src/components/ImageUploader.tsx` - Index tracking
- `src/components/MockupCanvas.tsx` - Save/load functionality

---

## Storage Limits

### Local Filesystem
- **Limit**: Depends on available disk space
- **Location**: `public/mockups/`
- **Format**: Original image files (PNG, JPG, etc.)

### Advantages
✅ No size limits (vs localStorage 5-10MB)
✅ Persistent across browser sessions
✅ Accessible via filesystem
✅ Can be backed up easily
✅ Works offline after initial load

---

## Browser Console Logs

### Successful Save
```
=== SAVE OPERATION ===
New files to upload: [{ name: "tshirt.png", index: 3 }]
Files to delete: []
Uploaded: { message: "File uploaded successfully", file: {...} }
Changes saved successfully!
```

### Successful Load
```
Loading saved files: [{ name: "mockup_0.png", ... }]
Loaded 3 saved mockup files
```

---

## Troubleshooting

### Cannot Save Files
**Check:**
1. Backend server running? → `npm run server`
2. Port 3001 available?
3. Console errors?

### Files Not Loading
**Check:**
1. Files exist? → `ls public/mockups/`
2. Server returns data? → Open `http://localhost:3001/api/mockups`
3. CORS enabled? (should be by default)

### Port Conflicts
```bash
# Kill processes on ports
lsof -ti:3001 | xargs kill -9  # Backend
lsof -ti:5174 | xargs kill -9  # Frontend
```

---

## Next Steps

You can now:
1. ✅ Upload mockup files
2. ✅ Save them to local project folder
3. ✅ Delete files (with queue system)
4. ✅ Reload page and files persist

The implementation is complete and ready to use!
