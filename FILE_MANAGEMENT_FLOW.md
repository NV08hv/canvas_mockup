# File Management Flow Documentation

## Overview
This document describes the complete file lifecycle including add, delete, and management flows with SQLite database synchronization and distinct handling of new vs saved files.

## Data Structure

### ImageFile Interface
```typescript
interface ImageFile {
  id: string                      // Unique identifier (generated client-side)
  url: string                     // Blob URL (new files) or data URL (saved files)
  name: string                    // File name
  source: 'file' | 'folder' | 'url'
  file?: File                     // Original file object (only for new uploads)
  isFromDatabase?: boolean        // Flag: true = saved in DB, false/undefined = new file
}
```

### State Variables
```typescript
// Main file arrays
const [mockupFiles, setMockupFiles] = useState<ImageFile[]>([])
const [mockupImages, setMockupImages] = useState<HTMLImageElement[]>([])

// File lifecycle tracking
const [hiddenMockupIndices, setHiddenMockupIndices] = useState<Set<number>>(new Set())
const [imageUploaderResetTrigger, setImageUploaderResetTrigger] = useState(0)

// Modal state
const [managerFiles, setManagerFiles] = useState<ImageFile[]>([])
const [showManagerModal, setShowManagerModal] = useState(false)
const [showMockupModal, setShowMockupModal] = useState(false)
```

## Add Flow

### 1. Upload New Files

**User uploads files via ImageUploader component:**

1. **File Selection**
   - User clicks "Files" or "Folder" button
   - Files are converted to blob URLs
   - ImageFile objects created with `isFromDatabase: false`

2. **State Update**
   - Files added to `mockupFiles[]` array
   - Images added to `mockupImages[]` array
   - Files appear in interface immediately

3. **Memory Management**
   - Each new file gets a blob URL: `blob:http://localhost:5174/...`
   - Blob URLs must be revoked when file is deleted

### 2. Save to Database

**User clicks "Save Changes" button:**

1. **Identify New Files**
   ```typescript
   const newFiles = mockupFiles.filter(f => !f.isFromDatabase && f.file)
   ```

2. **Upload to Backend**
   - Loop through each new file
   - Create FormData with file
   - POST to `/api/files/:userId`
   - Backend saves to SQLite as BLOB

3. **Update State After Save**
   ```typescript
   // Mark files as saved
   setMockupFiles(prev => prev.map(f => ({ ...f, isFromDatabase: true })))
   ```

4. **Success Feedback**
   - Toast notification: "Saved 3 file(s) successfully"
   - Save button becomes disabled

## Delete Flow

### Two Distinct Delete Behaviors

The system handles deletion differently based on file state:

### 1. Delete New File (Not Saved to Database)

**User clicks delete (×) on a new file:**

```typescript
const deleteMockup = async (index: number) => {
  const file = mockupFiles[index]

  if (file && !file.isFromDatabase) {
    // 1. Revoke blob URL to free memory
    if (file.url && file.url.startsWith('blob:')) {
      URL.revokeObjectURL(file.url)
    }

    // 2. Completely remove from arrays
    const newMockupFiles = mockupFiles.filter((_, i) => i !== index)
    const newMockupImages = mockupImages.filter((_, i) => i !== index)

    // 3. Rebuild all Maps with shifted indices
    // (offsets, transforms, blend modes, etc.)

    // 4. Update state
    setMockupFiles(newMockupFiles)
    setMockupImages(newMockupImages)

    // 5. Reset ImageUploader to prevent re-adding
    setImageUploaderResetTrigger(prev => prev + 1)
  }
}
```

**Result:**
- File completely removed from memory
- Cannot be recovered
- Object URL revoked (prevents memory leak)
- ImageUploader reset

### 2. Delete Saved File (In Database)

**User clicks delete (×) on a saved file:**

```typescript
const deleteMockup = async (index: number) => {
  const file = mockupFiles[index]

  if (file && file.isFromDatabase) {
    // Only hide from interface - DO NOT delete from database
    setHiddenMockupIndices(prev => new Set(prev).add(index))

    // Update selected index to next visible file
    const visibleIndices = mockupFiles
      .map((_, i) => i)
      .filter(i => i !== index && !hiddenMockupIndices.has(i))

    if (visibleIndices.length > 0) {
      const nextVisible = visibleIndices.find(i => i > index)
      setSelectedMockupIndex(nextVisible ?? visibleIndices[visibleIndices.length - 1])
    }
  }
}
```

**Result:**
- File hidden from workspace interface
- File remains in database
- Can be accessed via Manager modal
- Can be reloaded via Show Mockup modal

### 3. Delete All Files

**User clicks "Delete All" button:**

```typescript
const deleteAllMockups = async () => {
  const newFiles = mockupFiles.filter(f => !f.isFromDatabase)
  const savedFiles = mockupFiles.filter(f => !!f.isFromDatabase)

  // 1. Delete all new files completely
  if (newFiles.length > 0) {
    cleanupNewFiles(newFiles)  // Revoke all blob URLs

    // Remove from arrays and rebuild Maps
    const remainingFiles = mockupFiles.filter(f => !!f.isFromDatabase)
    const remainingImages = mockupImages.filter((_, i) => mockupFiles[i]?.isFromDatabase)

    setMockupFiles(remainingFiles)
    setMockupImages(remainingImages)
    setImageUploaderResetTrigger(prev => prev + 1)
  }

  // 2. Hide all saved files
  if (savedFiles.length > 0) {
    const allIndices = mockupFiles
      .map((_, index) => index)
      .filter(i => mockupFiles[i]?.isFromDatabase)
    setHiddenMockupIndices(new Set(allIndices))
  }
}
```

**Result:**
- New files: Completely removed from memory
- Saved files: Hidden from interface, remain in database

## Modal Workflows

### Manager Modal

**Purpose:** Permanent deletion of files from database

**Flow:**
1. User clicks "Manager" button
2. Fetch all files from database: `GET /api/files/:userId`
3. Display files in grid layout (4 per row)
4. User marks files for deletion (× button)
   - Border turns red
   - × changes to ↺ (undo)
5. User clicks "Delete Selected" or "Delete All"
6. Send DELETE requests to backend
7. Files permanently removed from database
8. Modal closes with success toast

**Code:**
```typescript
const handleManager = async () => {
  const response = await fetch(`${API_BASE}/files/${userId}`)
  const serverFiles = await response.json()

  // Convert to ImageFile objects
  const loadedFiles: ImageFile[] = serverFiles.map(sf => ({
    id: Math.random().toString(36).substring(2, 11),
    url: `data:image/${sf.name.split('.').pop()};base64,${btoa(...)}`,
    name: sf.name,
    source: 'file' as const,
    isFromDatabase: true
  }))

  setManagerFiles(loadedFiles)
  setShowManagerModal(true)
}
```

### Show Mockup Modal

**Purpose:** Load saved files into workspace (no deletion from database)

**Flow:**
1. User clicks "Show Mockup" button
2. Fetch all files from database: `GET /api/files/:userId`
3. Display files in preview grid
4. User removes files they don't want to load
5. User clicks "Apply"
6. Selected files loaded into workspace
7. Files removed in modal are NOT deleted from database

**Key Difference from Manager:**
- Manager: Permanent deletion from database
- Show Mockup: Load into workspace, files remain in database

**Code:**
```typescript
const handleModalNext = async (remainingFiles: ImageFile[]) => {
  const remainingDbFiles = remainingFiles.filter(f => !!f.isFromDatabase)
  const remainingStagedFiles = remainingFiles.filter(f => !f.isFromDatabase)

  // Load database files
  const loadedImages: HTMLImageElement[] = []
  for (const file of remainingDbFiles) {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject()
      img.src = file.url
    })
    loadedImages.push(img)
  }

  // Combine with staged files
  setMockupFiles([...remainingDbFiles, ...remainingStagedFiles])
  setMockupImages([...loadedImages, ...stagedImages])
  setHiddenMockupIndices(new Set())
}
```

## UI Implementation

### Save Button
- Location: Left sidebar under "Save & Export"
- Shows unsaved changes count (only new files)
- Disabled when no new files to save
- Yellow "Unsaved Changes" badge when pending

### Visual Indicators
```
Save & Export
┌─────────────────────┐
│  Save Changes       │  <- Blue button (disabled if no new files)
└─────────────────────┘

Unsaved Changes:         <- Yellow badge (only shown when new files exist)
• 3 new file(s) to upload

┌─────────────────────┐
│  Show Mockup        │  <- Load saved files into workspace
└─────────────────────┘

┌─────────────────────┐
│  Manager            │  <- Manage database files (permanent delete)
└─────────────────────┘

┌─────────────────────┐
│  Download ZIP       │  <- Export all visible mockups
└─────────────────────┘
```

## State Management

### Key State Variables
```typescript
// Main arrays
const [mockupFiles, setMockupFiles] = useState<ImageFile[]>([])
const [mockupImages, setMockupImages] = useState<HTMLImageElement[]>([])

// File lifecycle
const [hiddenMockupIndices, setHiddenMockupIndices] = useState<Set<number>>(new Set())
const [imageUploaderResetTrigger, setImageUploaderResetTrigger] = useState(0)

// Modals
const [showManagerModal, setShowManagerModal] = useState(false)
const [showMockupModal, setShowMockupModal] = useState(false)
const [managerFiles, setManagerFiles] = useState<ImageFile[]>([])
const [modalFiles, setModalFiles] = useState<ImageFile[]>([])
```

### File Upload Handler
```typescript
const handleMockupImagesLoaded = (images: HTMLImageElement[], files: ImageFile[]) => {
  // New files are appended to existing arrays
  setMockupImages(prev => [...prev, ...images])
  setMockupFiles(prev => [...prev, ...files])
}
```

### Delete Handler (New Files)
```typescript
const deleteMockup = (index: number) => {
  const file = mockupFiles[index]

  if (file && !file.isFromDatabase) {
    // Revoke object URL
    if (file.url && file.url.startsWith('blob:')) {
      URL.revokeObjectURL(file.url)
    }

    // Remove from arrays
    setMockupFiles(prev => prev.filter((_, i) => i !== index))
    setMockupImages(prev => prev.filter((_, i) => i !== index))

    // Reset ImageUploader
    setImageUploaderResetTrigger(prev => prev + 1)
  }
}
```

### Delete Handler (Saved Files)
```typescript
const deleteMockup = (index: number) => {
  const file = mockupFiles[index]

  if (file && file.isFromDatabase) {
    // Only hide from interface
    setHiddenMockupIndices(prev => new Set(prev).add(index))
  }
}
```

### Save Handler
```typescript
const handleSave = async () => {
  const newFiles = mockupFiles.filter(f => !f.isFromDatabase && f.file)

  // Upload each new file
  for (const file of newFiles) {
    const formData = new FormData()
    formData.append('file', file.file)
    await fetch(`${API_BASE}/files/${userId}`, {
      method: 'POST',
      body: formData
    })
  }

  // Mark all files as saved
  setMockupFiles(prev => prev.map(f => ({ ...f, isFromDatabase: true })))
}
```

## API Integration Points

### 1. Fetch Files from Database
```typescript
// GET /api/files/:userId
const response = await fetch(`${API_BASE}/files/${userId}`)
const serverFiles = await response.json()
// Returns: [{ id, user_id, name, data (Buffer), created_at }]
```

### 2. Upload New Files
```typescript
// POST /api/files/:userId
for (const file of newFiles) {
  if (file.file) {
    const formData = new FormData()
    formData.append('file', file.file)
    await fetch(`${API_BASE}/files/${userId}`, {
      method: 'POST',
      body: formData
    })
  }
}
```

### 3. Delete Files Permanently (Manager Modal)
```typescript
// DELETE /api/files/:userId/:filename
for (const file of filesToDelete) {
  await fetch(`${API_BASE}/files/${userId}/${encodeURIComponent(file.name)}`, {
    method: 'DELETE'
  })
}
```

## File Lifecycle Summary

### New Files (Not Saved)
- ✓ Stored in frontend state with blob URLs
- ✓ Appear immediately in interface
- ✓ Deleted completely when user clicks delete
- ✓ Object URLs revoked for memory cleanup
- ✓ ImageUploader reset to prevent re-adding
- ✗ Cannot be recovered after deletion

### Saved Files (In Database)
- ✓ Stored in SQLite database as BLOB
- ✓ Loaded into workspace via Show Mockup modal
- ✓ Hidden from interface when deleted (not removed from database)
- ✓ Can be permanently deleted via Manager modal
- ✓ Can be reloaded at any time
- ✗ Deletion from workspace does NOT affect database

## Benefits

1. **Clear Separation of Concerns**:
   - Manager modal: Permanent database deletion
   - Show Mockup modal: Load files into workspace
   - Delete button: Immediate removal (new) or hide (saved)

2. **Memory Efficiency**:
   - Blob URLs revoked when new files are deleted
   - Prevents memory leaks
   - Proper cleanup with `cleanupNewFiles()` helper

3. **User Safety**:
   - New files: User warned they cannot be recovered
   - Saved files: Can always be reloaded from database
   - Manager modal: Clear warnings about permanent deletion

4. **Flexible Workflow**:
   - Work with mix of new and saved files
   - Hide saved files without losing them
   - Permanently delete only when needed

5. **State Consistency**:
   - `isFromDatabase` flag clearly distinguishes file states
   - `hiddenMockupIndices` tracks hidden saved files
   - `imageUploaderResetTrigger` prevents re-adding deleted files
