# 🧩 Mockup Canvas Frontend — Technical Documentation

## 1. Objective

Develop a web application that allows users to **overlay design images onto blank T-shirt mockups** directly in the browser, **without any backend**.  
Users can:
- Upload a mockup image (plain T-shirt base).  
- Upload a design image (transparent background).  
- Drag, scale, rotate, and adjust the opacity of the design.  
- Choose a blend mode to make the design naturally blend with the fabric.  
- Export the final mockup as a high-quality PNG file.

---

## 2. Scope

- **Frontend-only processing**, no data stored on the server.  
- No authentication or database required.  
- Can be extended later with a backend (Node.js + Sharp or Python + Pillow).  

---

## 3. Architecture & Technologies

| Component | Technology | Description |
|------------|-------------|--------------|
| UI & Logic | **React + TypeScript** | Manages image states, user interactions, and export |
| Image Processing | **HTML5 Canvas API** | Renders overlays using transforms and blend modes |
| Styling | **Tailwind CSS** | Dark, responsive interface |
| Bundler | **Vite** | Fast development and build system |
| Output | **PNG (base64)** | Final mockup export format |

---

## 4. Main Processing Flow

```text
User uploads mockup.png + design.png
          │
          ▼
Canvas displays mockup
          │
User drags, rotates, scales, adjusts opacity & blend
          │
Canvas re-renders in real time
          │
Export → Canvas.toDataURL('image/png')
          │
Browser downloads mockup_final.png
