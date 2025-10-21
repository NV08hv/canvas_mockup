# 🧩 Mockup Canvas Frontend — Technical Documentation

## 1. Objective

Develop a web application that allows users to **overlay design images onto blank T-shirt mockups** directly in the browser with **persistent database storage**.
Users can:
- Upload mockup images (plain T-shirt base).
- Upload design images (transparent background).
- Drag, scale, rotate, and adjust the opacity of designs.
- Choose blend modes to make designs naturally blend with fabric.
- Save files to an SQLite database.
- Manage saved files with dedicated Manager modal (permanent deletion).
- Load saved files into workspace with Show Mockup modal.
- Export final mockups as high-quality PNG files or ZIP archives.

---

## 2. Scope

- **Fullstack application** with Express backend and SQLite database.
- **Database persistence** for mockup files.
- **Separate workflows** for file management and workspace loading.
- **Memory-efficient** file handling with proper cleanup.  

---

## 3. Architecture & Technologies

| Component | Technology | Description |
|------------|-------------|--------------|
| UI & Logic | **React + TypeScript** | Manages image states, user interactions, and export |
| Backend | **Express.js + SQLite** | Handles file storage, retrieval, and deletion |
| Image Processing | **HTML5 Canvas API** | Renders overlays using transforms and blend modes |
| Styling | **Tailwind CSS** | Dark, responsive interface |
| Bundler | **Vite** | Fast development and build system |
| Database | **SQLite** | Persistent file storage |
| Output | **PNG / ZIP** | Final mockup export formats |

---

## 4. Main Processing Flow

```text
User uploads mockup.png + design.png
          │
          ▼
Files stored in frontend state (new files)
          │
          ▼
User edits: drag, rotate, scale, adjust opacity & blend
          │
          ▼
Canvas re-renders in real time
          │
          ▼
Save to Database → Backend API → SQLite storage
          │
          ├──→ Manager Modal → View/Delete files permanently
          │
          └──→ Show Mockup Modal → Load files into workspace
          │
Export → Canvas.toDataURL('image/png') or ZIP archive
          │
Browser downloads mockup_final.png or mockups.zip
