# File Management Flow Documentation

## Overview
This document describes the add and delete flow for managing mockup files with database synchronization.

## Data Structure

### ImageFile Interface
```typescript
interface ImageFile {
  id: string              // Unique identifier
  url: string            // Data URL or external URL
  name: string           // File name
  source: 'file' | 'folder' | 'url'
  file?: File            // Original file object (for new uploads)
  index?: number         // Index for database tracking
  isFromDatabase?: boolean // Flag to indicate if file exists in DB
}
```

## Add Flow

### Example: Array of 5 items (indices 0,1,2,3,4)

1. **Upload 1 file**
   - File is added to array with `index: 5`
   - `isFromDatabase: false` (marks as new file)
   - Array now has 6 items with indices 0-5

2. **Upload folder of 3 files**
   - Loop through each file
   - Assign indices 6, 7, 8 sequentially
   - Each marked with `isFromDatabase: false`
   - Array now has 9 items with indices 0-8

3. **Save Button**
   - Click "Save Changes" button in UI
   - System identifies files where `isFromDatabase === false`
   - These files are uploaded to the server
   - After successful save, all files are marked `isFromDatabase: true`

## Delete Flow

### Example: Current array of 9 items (5 original DB items + 4 newly uploaded items)

1. **Delete 1 item**
   - Check the file's `index` property
   - Check if `isFromDatabase === true`

2. **If file is NOT from database (newly uploaded)**
   - Delete normally from array
   - No need to track deletion

3. **If file IS from database (original item)**
   - Delete from array (UI update)
   - Save filename to `deletedFileNames[]` temporary array
   - Example: `deletedFileNames = ["mockup_2.png"]`

4. **Click Save Button**
   - System identifies files in `deletedFileNames` array
   - Send DELETE requests to server for each filename
   - After successful deletion, clear `deletedFileNames` array

## UI Implementation

### Save Button
- Location: Left sidebar under "Save & Export" section
- Shows unsaved changes count:
  - New files to upload
  - Files marked for deletion
- Disabled when no changes to save
- Displays yellow "Unsaved Changes" badge when there are pending changes

### Visual Indicators
```
Save & Export
┌─────────────────────┐
│  Save Changes       │  <- Blue button (disabled if no changes)
└─────────────────────┘

Unsaved Changes:         <- Yellow badge (only shown when changes exist)
• 4 new file(s) to upload
• 2 file(s) to delete

┌─────────────────────┐
│  Download ZIP       │  <- Purple button (always enabled)
└─────────────────────┘
```

## State Management

### Key State Variables
```typescript
const [mockupFiles, setMockupFiles] = useState<ImageFile[]>([])
const [deletedFileNames, setDeletedFileNames] = useState<string[]>([])
```

### File Upload Handler
```typescript
const handleMockupImagesLoaded = (images: HTMLImageElement[], files: ImageFile[]) => {
  setMockupImages(images)
  setMockupFiles(files)  // Track metadata with indices
}
```

### Delete Handler
```typescript
const deleteMockup = (index: number) => {
  const fileToDelete = mockupFiles[index]
  if (fileToDelete?.isFromDatabase) {
    setDeletedFileNames(prev => [...prev, fileToDelete.name])
  }
  // Remove from arrays...
}
```

### Save Handler
```typescript
const handleSave = () => {
  const newFiles = mockupFiles.filter(f => !f.isFromDatabase)

  // Upload new files to server
  // newFiles.forEach(file => uploadToServer(file))

  // Delete marked files from server
  // deletedFileNames.forEach(name => deleteFromServer(name))

  // After success:
  setMockupFiles(prev => prev.map(f => ({ ...f, isFromDatabase: true })))
  setDeletedFileNames([])
}
```

## API Integration Points

### Upload New Files
```typescript
// Example API call for new files
newFiles.forEach(async (file) => {
  if (file.file) {
    const formData = new FormData()
    formData.append('file', file.file)
    formData.append('index', file.index.toString())
    await fetch('/api/mockups', {
      method: 'POST',
      body: formData
    })
  }
})
```

### Delete Files
```typescript
// Example API call for deleted files
deletedFileNames.forEach(async (fileName) => {
  await fetch(`/api/mockups/${fileName}`, {
    method: 'DELETE'
  })
})
```

## Benefits

1. **Batch Operations**: All changes are saved in a single click
2. **Clear Tracking**: Visual indicators show exactly what will be saved
3. **Safe Deletion**: Original files aren't deleted until "Save" is clicked
4. **Index Management**: Automatic index assignment for new uploads
5. **Rollback Capability**: Can refresh page to discard unsaved changes
