// Express server with session-based file management
import express from 'express'
import multer from 'multer'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Enable CORS with credentials support
app.use(cors({
  origin: true,
  credentials: true
}))
app.use(express.json())

// Session configuration
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT) || 15 * 60 * 1000 // 15 minutes in milliseconds
const CLEANUP_CHECK_INTERVAL = parseInt(process.env.CLEANUP_CHECK_INTERVAL) || 10 * 60 * 1000 // Check every 10 minutes
const TMP_DIR = path.join(__dirname, 'tmp')

// In-memory session storage (persisted to filesystem)
const sessions = new Map()

// Ensure tmp directory exists
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true })
}

// Load existing sessions from filesystem on startup
function loadSessions() {
  try {
    const sessionFile = path.join(TMP_DIR, 'sessions.json')
    if (fs.existsSync(sessionFile)) {
      const data = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'))
      data.forEach(session => {
        sessions.set(session.sessionId, {
          ...session,
          lastActivity: new Date(session.lastActivity)
        })
      })
      console.log(`Loaded ${sessions.size} sessions from disk`)
    }
  } catch (error) {
    console.error('Error loading sessions:', error)
  }
}

// Batch file writing with debouncing
let saveTimeout = null
const SAVE_DEBOUNCE_DELAY = parseInt(process.env.SAVE_DEBOUNCE_DELAY) || 2000 // Save after 2 seconds of inactivity

// Save sessions to filesystem (async with debouncing)
async function saveSessions() {
  try {
    const sessionFile = path.join(TMP_DIR, 'sessions.json')
    const data = Array.from(sessions.values())
    await fs.promises.writeFile(sessionFile, JSON.stringify(data, null, 2))
    console.log(`Saved ${sessions.size} sessions to disk`)
  } catch (error) {
    console.error('Error saving sessions:', error)
  }
}

// Debounced save function - batches multiple updates
function scheduleSaveSessions() {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }
  saveTimeout = setTimeout(saveSessions, SAVE_DEBOUNCE_DELAY)
}

// Generate unique session ID
function generateSessionId() {
  return crypto.randomBytes(16).toString('hex')
}

// Update session activity
function updateSessionActivity(sessionId) {
  const session = sessions.get(sessionId)
  if (session) {
    session.lastActivity = new Date()
    scheduleSaveSessions() // Use debounced save instead of immediate save
  }
}

// Cleanup expired sessions
async function cleanupExpiredSessions() {
  const now = Date.now()
  let cleanedCount = 0

  sessions.forEach((session, sessionId) => {
    const timeSinceActivity = now - session.lastActivity.getTime()
    if (timeSinceActivity > SESSION_TIMEOUT) {
      // Delete session files
      const sessionDir = path.join(TMP_DIR, session.sellerId, sessionId)
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true })
        console.log(`Cleaned up session: ${sessionId} (seller: ${session.sellerId})`)
      }
      sessions.delete(sessionId)
      cleanedCount++
    }
  })

  if (cleanedCount > 0) {
    await saveSessions() // Use async save for cleanup
  }
}

// Start cleanup interval
setInterval(cleanupExpiredSessions, CLEANUP_CHECK_INTERVAL)

// Load sessions on startup
loadSessions()

// Configure multer to use temporary directory first
const tempUpload = multer({
  dest: path.join(TMP_DIR, 'uploads'),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
})

// Ensure temp upload directory exists
const tempUploadDir = path.join(TMP_DIR, 'uploads')
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true })
}

// Create or retrieve session
app.post('/api/session/create', (req, res) => {
  try {
    const { sellerId, sessionId } = req.body

    if (!sellerId) {
      return res.status(400).json({ error: 'Seller ID is required' })
    }

    // If sessionId provided, validate it exists
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)
      // Verify it belongs to the same seller
      if (session.sellerId === sellerId) {
        updateSessionActivity(sessionId)
        return res.json({
          sessionId: session.sessionId,
          sellerId: session.sellerId,
          restored: true
        })
      }
    }

    // Create new session
    const newSessionId = generateSessionId()
    const session = {
      sessionId: newSessionId,
      sellerId: sellerId,
      createdAt: new Date(),
      lastActivity: new Date()
    }

    sessions.set(newSessionId, session)
    scheduleSaveSessions()

    console.log(`Created new session: ${newSessionId} for seller: ${sellerId}`)

    res.json({
      sessionId: newSessionId,
      sellerId: sellerId,
      restored: false
    })
  } catch (error) {
    console.error('Error creating session:', error)
    res.status(500).json({ error: 'Failed to create session' })
  }
})

// Heartbeat to keep session alive
app.post('/api/session/heartbeat', (req, res) => {
  try {
    const { sessionId } = req.body

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' })
    }

    const session = sessions.get(sessionId)
    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    updateSessionActivity(sessionId)
    res.json({ message: 'Session updated', sessionId })
  } catch (error) {
    console.error('Error updating session:', error)
    res.status(500).json({ error: 'Failed to update session' })
  }
})

// End session manually
app.post('/api/session/end', (req, res) => {
  try {
    const { sessionId } = req.body

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' })
    }

    const session = sessions.get(sessionId)
    if (session) {
      // Delete session files
      const sessionDir = path.join(TMP_DIR, session.sellerId, sessionId)
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true })
        console.log(`Manually ended session: ${sessionId}`)
      }
      sessions.delete(sessionId)
      saveSessions()
    }

    res.json({ message: 'Session ended', sessionId })
  } catch (error) {
    console.error('Error ending session:', error)
    res.status(500).json({ error: 'Failed to end session' })
  }
})

// Get all files for a session
app.get('/api/files/:sellerId/:sessionId', (req, res) => {
  try {
    const { sellerId, sessionId } = req.params

    const session = sessions.get(sessionId)
    if (!session || session.sellerId !== sellerId) {
      return res.status(404).json({ error: 'Session not found' })
    }

    updateSessionActivity(sessionId)

    const sessionDir = path.join(TMP_DIR, sellerId, sessionId)

    // Check if directory exists
    if (!fs.existsSync(sessionDir)) {
      return res.json([])
    }

    const files = fs.readdirSync(sessionDir)
      .filter(file => {
        const filePath = path.join(sessionDir, file)
        return fs.statSync(filePath).isFile()
      })
      .map((file, index) => ({
        name: file,
        index: index
      }))

    res.json(files)
  } catch (error) {
    console.error('Error reading session files:', error)
    res.status(500).json({ error: 'Failed to read files' })
  }
})

// Check which hashes are unknown (need upload)
app.post('/api/files/check-hashes', (req, res) => {
  try {
    const { sellerId, sessionId, files } = req.body

    if (!sessionId || !sellerId || !files || !Array.isArray(files)) {
      return res.status(400).json({ error: 'Invalid request' })
    }

    const session = sessions.get(sessionId)
    if (!session || session.sellerId !== sellerId) {
      return res.status(404).json({ error: 'Session not found' })
    }

    updateSessionActivity(sessionId)

    const sessionDir = path.join(TMP_DIR, sellerId, sessionId)
    const hashIndexFile = path.join(sessionDir, '.hash-index.json')

    // Load existing hash index
    let hashIndex = {}
    if (fs.existsSync(hashIndexFile)) {
      try {
        hashIndex = JSON.parse(fs.readFileSync(hashIndexFile, 'utf-8'))
      } catch (error) {
        console.error('Error reading hash index:', error)
      }
    }

    // Check which hashes are unknown
    const unknownHashes = []
    let skippedCount = 0

    files.forEach(file => {
      if (file.hash && !hashIndex[file.hash]) {
        unknownHashes.push(file.hash)
      } else if (file.hash && hashIndex[file.hash]) {
        skippedCount++
      }
    })

    res.json({
      unknownHashes,
      skippedCount
    })
  } catch (error) {
    console.error('Error checking hashes:', error)
    res.status(500).json({ error: 'Failed to check hashes' })
  }
})

// Upload file to session
app.post('/api/files/upload', tempUpload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const { sellerId, sessionId, hash, index } = req.body

    if (!sessionId || !sellerId) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: 'Session ID and Seller ID are required' })
    }

    const session = sessions.get(sessionId)
    if (!session || session.sellerId !== sellerId) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path)
      return res.status(404).json({ error: 'Session not found' })
    }

    // Create session directory
    const sessionDir = path.join(TMP_DIR, sellerId, sessionId)
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true })
    }

    const hashIndexFile = path.join(sessionDir, '.hash-index.json')

    // Load existing hash index
    let hashIndex = {}
    if (fs.existsSync(hashIndexFile)) {
      try {
        hashIndex = JSON.parse(fs.readFileSync(hashIndexFile, 'utf-8'))
      } catch (error) {
        console.error('Error reading hash index:', error)
      }
    }

    // Check if hash already exists (duplicate detection)
    if (hash && hashIndex[hash]) {
      // File with same hash already exists, skip upload
      fs.unlinkSync(req.file.path)
      return res.json({
        message: 'File already exists (duplicate)',
        file: hashIndex[hash],
        duplicate: true
      })
    }

    // Move file from temp to session directory with proper name
    const timestamp = Date.now()
    const ext = path.extname(req.file.originalname)
    const basename = path.basename(req.file.originalname, ext)
    const newFilename = `${basename}_${timestamp}${ext}`
    const finalPath = path.join(sessionDir, newFilename)

    fs.renameSync(req.file.path, finalPath)

    // Update hash index
    if (hash) {
      hashIndex[hash] = {
        name: newFilename,
        size: req.file.size,
        index: index || 0,
        uploadedAt: new Date().toISOString()
      }
      fs.writeFileSync(hashIndexFile, JSON.stringify(hashIndex, null, 2))
    }

    updateSessionActivity(sessionId)

    res.json({
      message: 'File uploaded successfully',
      file: {
        name: newFilename,
        size: req.file.size,
        hash
      }
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    // Clean up temp file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    res.status(500).json({ error: 'Failed to upload file' })
  }
})

// Delete file from session
app.delete('/api/files/:sellerId/:sessionId/:filename', (req, res) => {
  try {
    const { sellerId, sessionId, filename } = req.params

    const session = sessions.get(sessionId)
    if (!session || session.sellerId !== sellerId) {
      return res.status(404).json({ error: 'Session not found' })
    }

    updateSessionActivity(sessionId)

    const filePath = path.join(TMP_DIR, sellerId, sessionId, filename)

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    fs.unlinkSync(filePath)
    res.json({ message: 'File deleted successfully', filename })
  } catch (error) {
    console.error('Error deleting file:', error)
    res.status(500).json({ error: 'Failed to delete file' })
  }
})

// Health check endpoint
app.get('/api/health', (req, res) => {
  try {
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      sessions: sessions.size
    })
  } catch (error) {
    console.error('Health check error:', error)
    res.status(500).json({ 
      status: 'unhealthy', 
      error: 'Health check failed' 
    })
  }
})

// Serve files from tmp directory
app.use('/tmp', express.static(TMP_DIR))

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Session files will be saved to: tmp/<sellerId>/<sessionId>/`)
  console.log(`Session timeout: ${SESSION_TIMEOUT / 1000 / 60} minutes`)
  console.log(`Cleanup check interval: ${CLEANUP_CHECK_INTERVAL / 1000} seconds`)
})
