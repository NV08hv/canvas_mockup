import { useState, useRef, useEffect } from 'react'
import MockupCanvas from './components/MockupCanvas'

function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">🧩 Mockup Canvas</h1>
          <p className="text-gray-400 mt-2">Overlay designs onto T-shirt mockups</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <MockupCanvas />
      </main>

      <footer className="bg-gray-800 mt-12 py-4">
        <div className="container mx-auto px-4 text-center text-gray-400">
          <p>Frontend-only processing • No data stored</p>
        </div>
      </footer>
    </div>
  )
}

export default App
