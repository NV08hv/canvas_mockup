// SQLite database module for file management
import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Initialize database
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'uploads', 'database.sqlite')
const db = new Database(DB_PATH)

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL')

// Create tables
function initializeDatabase() {
  // Images table
  db.exec(`
    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id);
    CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at);
  `)

  console.log('Database initialized successfully')
}

// Initialize database on module load
initializeDatabase()

// Image operations
export const imageDb = {
  // Add image
  add(userId, fileName, fileUrl) {
    const stmt = db.prepare(`
      INSERT INTO images (user_id, file_name, file_url)
      VALUES (?, ?, ?)
    `)
    const result = stmt.run(userId, fileName, fileUrl)
    return result.lastInsertRowid
  },

  // Get all images for a user
  getByUserId(userId) {
    const stmt = db.prepare('SELECT * FROM images WHERE user_id = ? ORDER BY created_at ASC')
    return stmt.all(userId)
  },

  // Get image by ID
  getById(id) {
    const stmt = db.prepare('SELECT * FROM images WHERE id = ?')
    return stmt.get(id)
  },

  // Get image by user and filename
  getByUserAndFilename(userId, fileName) {
    const stmt = db.prepare('SELECT * FROM images WHERE user_id = ? AND file_name = ?')
    return stmt.get(userId, fileName)
  },

  // Delete image by ID
  deleteById(id) {
    const stmt = db.prepare('DELETE FROM images WHERE id = ?')
    stmt.run(id)
  },

  // Delete image by user and filename
  delete(userId, fileName) {
    const stmt = db.prepare('DELETE FROM images WHERE user_id = ? AND file_name = ?')
    stmt.run(userId, fileName)
  },

  // Delete all images for a user
  deleteAllByUserId(userId) {
    const stmt = db.prepare('DELETE FROM images WHERE user_id = ?')
    stmt.run(userId)
  },

  // Get image count for a user
  countByUserId(userId) {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM images WHERE user_id = ?')
    return stmt.get(userId).count
  }
}

// Transaction helper
export function transaction(callback) {
  const txn = db.transaction(callback)
  return txn()
}

// Close database connection (for graceful shutdown)
export function closeDatabase() {
  db.close()
  console.log('Database connection closed')
}

// Export database instance for direct access if needed
export default db
