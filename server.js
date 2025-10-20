// Express server with file management
import express from 'express'
import multer from 'multer'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { imageDb } from './database.js'

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

// File storage configuration
const UPLOADS_DIR = path.join(__dirname, 'uploads')

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

// Configure multer to use temporary directory first
const tempUpload = multer({
  dest: path.join(UPLOADS_DIR, 'temp'),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
})

// Ensure temp upload directory exists
const tempUploadDir = path.join(UPLOADS_DIR, 'temp')
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true })
}

// Get all files for a user
app.get('/api/files/:userId', (req, res) => {
  try {
    const { userId } = req.params

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' })
    }

    // Get files from database
    const dbFiles = imageDb.getByUserId(userId)

    // Map database results to expected format
    const files = dbFiles.map((file, index) => ({
      name: file.file_name,
      index: index,
      url: file.file_url,
      id: file.id,
      created_at: file.created_at
    }))

    res.json(files)
  } catch (error) {
    console.error('Error reading user files:', error)
    res.status(500).json({ error: 'Failed to read files' })
  }
})


// Clear/reset all files for a user (for Delete All)
app.post('/api/files/clear', (req, res) => {
  try {
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' })
    }

    // Delete all files from database first
    try {
      imageDb.deleteAllByUserId(userId)
      console.log(`Cleared all files from database for user ${userId}`)
    } catch (dbError) {
      console.error('Error clearing files from database:', dbError)
      return res.status(500).json({ error: 'Failed to clear files from database' })
    }

    // Then delete all files from filesystem
    const userDir = path.join(UPLOADS_DIR, userId)
    if (fs.existsSync(userDir)) {
      const files = fs.readdirSync(userDir)
      files.forEach(file => {
        const filePath = path.join(userDir, file)
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath)
        }
      })
      console.log(`Cleared all files from filesystem for user ${userId}`)
    }

    res.json({ message: 'All files cleared successfully' })
  } catch (error) {
    console.error('Error clearing files:', error)
    res.status(500).json({ error: 'Failed to clear files' })
  }
})


// Upload file to user directory
app.post('/api/files/upload', tempUpload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const { userId, ext } = req.body

    if (!userId) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: 'User ID is required' })
    }

    // Create user directory
    const userDir = path.join(UPLOADS_DIR, userId)
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true })
    }

    // Move file from temp to user directory with proper name
    const timestamp = Date.now()
    // Use provided ext or fallback to file extension
    const fileExt = ext || path.extname(req.file.originalname) || '.png'
    const basename = path.basename(req.file.originalname, path.extname(req.file.originalname))
    const newFilename = `${basename}_${timestamp}${fileExt}`
    const finalPath = path.join(userDir, newFilename)

    fs.renameSync(req.file.path, finalPath)

    // Store file information in database
    const fileUrl = `/uploads/${userId}/${newFilename}`
    try {
      imageDb.add(userId, newFilename, fileUrl)
      console.log(`Saved to database: ${fileUrl}`)
    } catch (dbError) {
      console.error('Error saving to database:', dbError)
      // Continue even if database save fails - file is already saved to disk
    }

    res.json({
      message: 'File uploaded successfully',
      file: {
        name: newFilename,
        size: req.file.size,
        url: fileUrl
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

// Delete file from user directory
app.delete('/api/files/:userId/:filename', (req, res) => {
  try {
    const { userId, filename } = req.params

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' })
    }

    // Delete from database first
    try {
      imageDb.delete(userId, filename)
      console.log(`Deleted from database: ${filename}`)
    } catch (dbError) {
      console.error('Error deleting from database:', dbError)
      return res.status(500).json({ error: 'Failed to delete from database' })
    }

    // Then delete from filesystem
    const filePath = path.join(UPLOADS_DIR, userId, filename)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      console.log(`Deleted from filesystem: ${filename}`)
    }

    res.json({ message: 'File deleted successfully', filename })
  } catch (error) {
    console.error('Error deleting file:', error)
    res.status(500).json({ error: 'Failed to delete file' })
  }
})

// Health check endpoint
app.get('/api/health', (_req, res) => {
  try {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    })
  } catch (error) {
    console.error('Health check error:', error)
    res.status(500).json({
      status: 'unhealthy',
      error: 'Health check failed'
    })
  }
})

// Serve files from uploads directory
app.use('/uploads', express.static(UPLOADS_DIR))

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Files will be saved to: uploads/<userId>/`)
})
