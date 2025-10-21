# 🧩 Mockup Canvas

A web application for overlaying design images onto T-shirt mockups directly in the browser.

## Features

- ✨ Upload mockup and design images
- 🎨 Drag, scale, rotate, and adjust opacity
- 🌈 10+ blend modes for natural fabric blending
- 💾 Export high-quality PNG files
- 🗄️ SQLite database integration for persistent storage
- 📋 Manager modal for organizing and deleting saved files
- 🔍 Show Mockup modal for loading files into workspace

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- HTML5 Canvas API

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Usage

1. Upload mockup images (plain T-shirt bases)
2. Upload design images (preferably transparent PNG)
3. Use the controls to:
   - Drag the design on the canvas
   - Scale with the slider
   - Rotate to any angle
   - Adjust opacity
   - Choose a blend mode (multiply works great for most cases)
4. Save your work to the database
5. Use the **Manager** button to:
   - View all saved files in the database
   - Permanently delete files from storage
6. Use the **Show Mockup** button to:
   - Load saved files into your workspace
   - Select which files to work with
7. Export final mockups as PNG or ZIP

## Database Storage

- Files are stored persistently in an SQLite database
- Manager modal provides permanent deletion capabilities
- Show Mockup modal loads files into the editing interface without deleting them
