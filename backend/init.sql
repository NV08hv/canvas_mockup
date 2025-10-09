-- Create database if not exists
CREATE DATABASE IF NOT EXISTS mockup_canvas;
USE mockup_canvas;

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mockup images table
CREATE TABLE IF NOT EXISTS mockup_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    image_url TEXT NOT NULL,
    image_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project_id (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Designs table
CREATE TABLE IF NOT EXISTS designs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    design_name VARCHAR(255) NOT NULL,
    image_url TEXT NOT NULL,
    transform_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project_id (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Text layers table
CREATE TABLE IF NOT EXISTS text_layers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    text_content TEXT,
    properties JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project_id (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample data (optional)
INSERT INTO projects (user_id, project_name) VALUES
    ('user_001', 'Sample T-Shirt Mockup'),
    ('user_001', 'Brand Campaign 2024');

INSERT INTO mockup_images (project_id, image_url, image_order) VALUES
    (1, 'https://example.com/mockup1.jpg', 0),
    (1, 'https://example.com/mockup2.jpg', 1);

INSERT INTO designs (project_id, design_name, image_url, transform_data) VALUES
    (1, 'Logo Design', 'https://example.com/logo.png', '{"x": 400, "y": 400, "scale": 1.0, "rotation": 0, "opacity": 100}');

INSERT INTO text_layers (project_id, text_content, properties) VALUES
    (1, 'Sample Text', '{"id": "text-1", "text": "Sample Text", "x": 400, "y": 500, "fontSize": 48, "fontFamily": "Arial", "color": "#000000", "bold": false, "italic": false, "align": "center", "rotation": 0, "visible": true, "order": 0}');
