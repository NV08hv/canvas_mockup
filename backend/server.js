const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for image uploads (memory storage)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'mockup_canvas',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection
pool.getConnection()
  .then(connection => {
    console.log('✓ Database connected successfully');
    connection.release();
  })
  .catch(err => {
    console.error('✗ Database connection failed:', err.message);
  });

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend server is running' });
});

// Save user project (mockup images and designs)
app.post('/api/projects', async (req, res) => {
  try {
    const { userId, projectName, mockupImages, designs, textLayers } = req.body;

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Insert project
      const [projectResult] = await connection.execute(
        'INSERT INTO projects (user_id, project_name) VALUES (?, ?)',
        [userId || 'anonymous', projectName || 'Untitled Project']
      );

      const projectId = projectResult.insertId;

      // Insert mockup images
      if (mockupImages && mockupImages.length > 0) {
        for (const mockup of mockupImages) {
          await connection.execute(
            'INSERT INTO mockup_images (project_id, image_url, image_order) VALUES (?, ?, ?)',
            [projectId, mockup.url, mockup.order]
          );
        }
      }

      // Insert designs
      if (designs && designs.length > 0) {
        for (const design of designs) {
          await connection.execute(
            'INSERT INTO designs (project_id, design_name, image_url, transform_data) VALUES (?, ?, ?, ?)',
            [projectId, design.name, design.url, JSON.stringify(design.transform)]
          );
        }
      }

      // Insert text layers
      if (textLayers && textLayers.length > 0) {
        for (const textLayer of textLayers) {
          await connection.execute(
            'INSERT INTO text_layers (project_id, text_content, properties) VALUES (?, ?, ?)',
            [projectId, textLayer.text, JSON.stringify(textLayer)]
          );
        }
      }

      await connection.commit();

      res.json({
        success: true,
        projectId,
        message: 'Project saved successfully'
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error saving project:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save project',
      error: error.message
    });
  }
});

// Get user projects
app.get('/api/projects/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const [projects] = await pool.execute(
      'SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    res.json({
      success: true,
      projects
    });

  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch projects',
      error: error.message
    });
  }
});

// Get project details
app.get('/api/projects/detail/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const connection = await pool.getConnection();

    try {
      // Get project info
      const [projects] = await connection.execute(
        'SELECT * FROM projects WHERE id = ?',
        [projectId]
      );

      if (projects.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      const project = projects[0];

      // Get mockup images
      const [mockupImages] = await connection.execute(
        'SELECT * FROM mockup_images WHERE project_id = ? ORDER BY image_order',
        [projectId]
      );

      // Get designs
      const [designs] = await connection.execute(
        'SELECT * FROM designs WHERE project_id = ?',
        [projectId]
      );

      // Get text layers
      const [textLayers] = await connection.execute(
        'SELECT * FROM text_layers WHERE project_id = ?',
        [projectId]
      );

      res.json({
        success: true,
        project: {
          ...project,
          mockupImages,
          designs: designs.map(d => ({
            ...d,
            transform: JSON.parse(d.transform_data)
          })),
          textLayers: textLayers.map(t => JSON.parse(t.properties))
        }
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error fetching project details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch project details',
      error: error.message
    });
  }
});

// Delete project
app.delete('/api/projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Delete related data
      await connection.execute('DELETE FROM mockup_images WHERE project_id = ?', [projectId]);
      await connection.execute('DELETE FROM designs WHERE project_id = ?', [projectId]);
      await connection.execute('DELETE FROM text_layers WHERE project_id = ?', [projectId]);
      await connection.execute('DELETE FROM projects WHERE id = ?', [projectId]);

      await connection.commit();

      res.json({
        success: true,
        message: 'Project deleted successfully'
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete project',
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Server is running on port ${PORT}`);
});
