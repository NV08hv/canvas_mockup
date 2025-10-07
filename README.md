# 🧩 Mockup Canvas

A web application for overlaying design images onto T-shirt mockups directly in the browser.

## Features

- ✨ Upload mockup and design images
- 🎨 Drag, scale, rotate, and adjust opacity
- 🌈 10+ blend modes for natural fabric blending
- 💾 Export high-quality PNG files
- 🔒 Frontend-only processing (no backend required)

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

1. Upload a mockup image (plain T-shirt base)
2. Upload a design image (preferably transparent PNG)
3. Use the controls to:
   - Drag the design on the canvas
   - Scale with the slider
   - Rotate to any angle
   - Adjust opacity
   - Choose a blend mode (multiply works great for most cases)
4. Export the final mockup as PNG

## No Backend Required

All image processing happens in your browser using the Canvas API. No images are uploaded to any server.
