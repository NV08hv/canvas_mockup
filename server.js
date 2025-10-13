// Simple Express server for handling file uploads/deletes
import express from 'express'
import multer from 'multer'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3001

// Enable CORS
app.use(cors())
app.use(express.json())

// Configure multer for file uploads with seller-specific folders
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Get sellerId from request body (default to 10)
    const sellerId = req.body.sellerId || 10
    const sellerDir = path.join(__dirname, 'public', `mockup_${sellerId}`)

    // Create seller-specific directory if it doesn't exist
    if (!fs.existsSync(sellerDir)) {
      fs.mkdirSync(sellerDir, { recursive: true })
      console.log(`Created directory: ${sellerDir}`)
    }

    cb(null, sellerDir)
  },
  filename: (req, file, cb) => {
    // Use original filename or generate one based on index
    const index = req.body.index || Date.now()
    const ext = path.extname(file.originalname)
    const basename = path.basename(file.originalname, ext)
    cb(null, `${basename}_${index}${ext}`)
  }
})

const upload = multer({ storage })

// Get all mockup files for specific seller
app.get('/api/mockups/:sellerId', (req, res) => {
  try {
    const sellerId = req.params.sellerId || 10
    const sellerDir = path.join(__dirname, 'public', `mockup_${sellerId}`)

    // Check if directory exists
    if (!fs.existsSync(sellerDir)) {
      return res.json([]) // Return empty array if no folder exists
    }

    const files = fs.readdirSync(sellerDir)
      .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
      .map((file, index) => ({
        name: file,
        path: `/mockup_${sellerId}/${file}`,
        index: index,
        isFromDatabase: true
      }))
    res.json(files)
  } catch (error) {
    console.error('Error reading mockups directory:', error)
    res.status(500).json({ error: 'Failed to read mockups' })
  }
})

// Upload new mockup file
app.post('/api/mockups', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const sellerId = req.body.sellerId || 10

    res.json({
      message: 'File uploaded successfully',
      file: {
        name: req.file.filename,
        path: `/mockup_${sellerId}/${req.file.filename}`,
        index: req.body.index,
        sellerId: sellerId
      }
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    res.status(500).json({ error: 'Failed to upload file' })
  }
})

// Delete mockup file from seller-specific folder
app.delete('/api/mockups/:sellerId/:filename', (req, res) => {
  try {
    const { sellerId, filename } = req.params
    const sellerDir = path.join(__dirname, 'public', `mockup_${sellerId}`)
    const filePath = path.join(sellerDir, filename)

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    fs.unlinkSync(filePath)
    res.json({ message: 'File deleted successfully', filename, sellerId })
  } catch (error) {
    console.error('Error deleting file:', error)
    res.status(500).json({ error: 'Failed to delete file' })
  }
})

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')))

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Mockups will be saved to: public/mockup_<sellerId>/`)
})
