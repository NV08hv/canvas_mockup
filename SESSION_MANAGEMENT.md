# Session-Based File Management System

This project implements a secure, session-based file management system designed to be embedded into other websites. Files are temporarily stored per session and automatically cleaned up when users leave.

## Overview

### Key Features

- **Session Management**: Each visitor gets a unique session ID that persists on page reload
- **Seller Isolation**: Files are organized by seller ID passed from the embedding site
- **Automatic Cleanup**: Files are deleted 5 minutes after user inactivity
- **No Database Required**: All data stored locally on the filesystem
- **Persistent Sessions**: Sessions survive page reloads using localStorage
- **Heartbeat System**: Keeps sessions alive while users are active

## Architecture

### File Structure

```
tmp/
├── sessions.json          # Session metadata (persisted across restarts)
├── <sellerId>/           # Seller-specific directory
│   └── <sessionId>/      # Session-specific directory
│       ├── file1.png
│       ├── file2.jpg
│       └── ...
└── <anotherSellerId>/
    └── <sessionId>/
        └── ...
```

### Session Lifecycle

```
User visits site → Session created → sessionId generated
                                   ↓
                         localStorage stores sessionId
                                   ↓
                         Heartbeat starts (1 min interval)
                                   ↓
                         User uploads files → saved to tmp/<sellerId>/<sessionId>/
                                   ↓
                         User reloads page → Session restored from localStorage
                                   ↓
                         User closes tab → Heartbeat stops
                                   ↓
                         5 minutes pass → Session cleaned up automatically
```

## Backend API

### Session Endpoints

#### Create/Restore Session
```
POST /api/session/create
Body: {
  sellerId: string,
  sessionId?: string  // Optional, for restoring existing session
}

Response: {
  sessionId: string,
  sellerId: string,
  restored: boolean
}
```

#### Keep Session Alive
```
POST /api/session/heartbeat
Body: {
  sessionId: string
}

Response: {
  message: "Session updated",
  sessionId: string
}
```

#### End Session Manually
```
POST /api/session/end
Body: {
  sessionId: string
}

Response: {
  message: "Session ended",
  sessionId: string
}
```

### File Endpoints

#### List Session Files
```
GET /api/files/:sellerId/:sessionId

Response: [
  {
    name: string,
    index: number
  },
  ...
]
```

#### Upload File
```
POST /api/files/upload
Body: FormData {
  file: File,
  sessionId: string,
  sellerId: string
}

Response: {
  message: "File uploaded successfully",
  file: {
    name: string,
    size: number
  }
}
```

#### Delete File
```
DELETE /api/files/:sellerId/:sessionId/:filename

Response: {
  message: "File deleted successfully",
  filename: string
}
```

#### Access Files
```
GET /tmp/:sellerId/:sessionId/:filename
```
Files are served statically from the tmp directory.

## Frontend Integration

### Embedding the Application

Add the sellerId as a URL parameter when embedding:

```html
<iframe src="https://yourapp.com/?sellerId=seller123" />
```

### Session Manager Usage

The frontend automatically handles sessions via the `sessionManager` utility:

```typescript
import sessionManager from './utils/sessionManager'

// Initialize session (called automatically in App.tsx)
const session = await sessionManager.initializeSession(sellerId)

// Get current session info
const sessionId = sessionManager.getSessionId()
const sellerId = sessionManager.getSellerId()

// Manually end session (optional)
await sessionManager.endSession()
```

### Automatic Features

1. **Session Restoration**: When users reload the page, their session is restored from localStorage
2. **Heartbeat**: Sends a heartbeat every 60 seconds to keep the session alive
3. **Visibility Handling**: Pauses heartbeat when tab is hidden, resumes when visible
4. **Cleanup on Exit**: Stops heartbeat when user leaves (triggers automatic cleanup)

## Configuration

### Server Configuration (server.js)

```javascript
const SESSION_TIMEOUT = 5 * 60 * 1000 // 5 minutes
const CLEANUP_CHECK_INTERVAL = 60 * 1000 // Check every 1 minute
```

### Frontend Configuration (sessionManager.ts)

```typescript
const HEARTBEAT_INTERVAL = 60 * 1000 // 1 minute
const SESSION_STORAGE_KEY = 'file_editor_session'
```

## Security Considerations

1. **File Size Limits**: 10MB per file (configurable in multer settings)
2. **Session Validation**: All file operations validate sessionId and sellerId
3. **Automatic Cleanup**: Prevents disk space issues from abandoned sessions
4. **No Cross-Session Access**: Sessions cannot access other sessions' files
5. **Seller Isolation**: Sellers cannot access other sellers' files

## Running the Application

### Development

```bash
# Terminal 1: Start backend server
npm run server

# Terminal 2: Start frontend dev server
npm run dev
```

### Production

```bash
# Build frontend
npm run build

# Start server
npm run server

# Serve built files
npm run preview
```

### Using Docker

```bash
# Build and start
docker-compose up --build

# Access at http://localhost:5173
```

## Testing Session Management

### Test Session Creation
1. Visit `http://localhost:5173/?sellerId=test123`
2. Check browser localStorage for session ID
3. Upload some files
4. Check `tmp/test123/<sessionId>/` for uploaded files

### Test Session Persistence
1. Upload files
2. Reload the page
3. Verify files are still there
4. Check console logs to see "Session restored"

### Test Automatic Cleanup
1. Upload files
2. Close the browser tab
3. Wait 5 minutes
4. Check server logs for cleanup message
5. Verify `tmp/test123/<sessionId>/` folder is deleted

### Test Heartbeat
1. Open browser DevTools → Network tab
2. Visit the application
3. Watch for heartbeat requests every 60 seconds
4. Switch to another tab (heartbeat should pause)
5. Switch back (heartbeat should resume)

## Monitoring

### Server Logs

The server logs all important events:

```
Created new session: abc123... for seller: seller123
Loaded 2 sessions from disk
Cleaned up session: xyz789 (seller: seller456)
Session timeout: 5 minutes
Cleanup check interval: 60 seconds
```

### Browser Console

The frontend logs session operations:

```javascript
New session created { sessionId: "...", sellerId: "...", createdAt: "..." }
Session restored { sessionId: "...", sellerId: "...", createdAt: "..." }
Heartbeat failed: ...
```

## Troubleshooting

### Files not persisting after reload
- Check browser console for errors
- Verify sessionId is stored in localStorage
- Check server logs for session restoration

### Files not being cleaned up
- Verify `SESSION_TIMEOUT` is set correctly
- Check server logs for cleanup operations
- Ensure cleanup interval is running

### Upload failures
- Check file size (10MB limit)
- Verify session is valid (not expired)
- Check server logs for errors
- Ensure tmp directory has write permissions

### Session not restoring
- Clear browser localStorage and try again
- Check if sessions.json exists in tmp directory
- Verify server has been restarted after changes

## Migration from Old System

If migrating from the previous `public/mockup_<sellerId>/` system:

1. Files were stored permanently in `public/mockup_<sellerId>/`
2. Now files are stored temporarily in `tmp/<sellerId>/<sessionId>/`
3. Update any hardcoded paths to use the new structure
4. No database changes needed (system remains file-based)

## Future Enhancements

Possible improvements:

1. **Configurable Timeouts**: Allow embedding site to set custom timeout durations
2. **Session Transfer**: Allow users to download their session and restore it later
3. **Usage Analytics**: Track session statistics without user data
4. **CDN Integration**: Store files in cloud storage instead of local filesystem
5. **Webhooks**: Notify embedding site when sessions end
6. **Admin Dashboard**: View active sessions and storage usage

## License

This project is proprietary and confidential.
