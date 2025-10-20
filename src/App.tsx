import { useState, useEffect } from 'react'
import MockupCanvas from './components/MockupCanvas'
import { ToastProvider } from './components/Toast'

function App() {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    // Get userId from URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    const userIdParam = urlParams.get('user_id') || 'default'

    setUserId(userIdParam)
  }, [])

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-900 text-white">
        <header className="bg-gray-800 shadow-lg">
          <div className="container mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold">🧩 Dragon Media AI Mockup</h1>
            <p className="text-gray-400 mt-2">
              Database-backed file management
            </p>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          {userId ? (
            <MockupCanvas userId={userId} />
          ) : (
            <div className="text-center text-gray-400">
              <p>Loading...</p>
            </div>
          )}
        </main>

        <footer className="bg-gray-800 mt-12 py-4">
          <div className="container mx-auto px-4 text-center text-gray-400">
            <p>Database-backed storage</p>
          </div>
        </footer>
      </div>
    </ToastProvider>
  )
}

export default App
