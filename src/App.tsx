import { useState, useEffect } from 'react'
import MockupCanvas from './components/MockupCanvas'
import sessionManager from './utils/sessionManager'
import { ToastProvider } from './components/Toast'

function App() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sellerId, setSellerId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Get sellerId from URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    const sellerIdParam = urlParams.get('user_id') || 'default'

    setSellerId(sellerIdParam)

    // Initialize session
    sessionManager
      .initializeSession(sellerIdParam)
      .then((sessionData) => {
        setSessionId(sessionData.sessionId)
        setIsLoading(false)
      })
      .catch((err) => {
        console.error('Failed to initialize session:', err)
        setError('Failed to initialize session. Please refresh the page.')
        setIsLoading(false)
      })

    // Cleanup on unmount
    return () => {
      // Note: endSession is automatically handled by sessionManager on page unload
      // We don't call it here to allow page reloads to restore session
    }
  }, [])

  if (isLoading) {
    return (
      <ToastProvider>
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-gray-400">Initializing session...</p>
          </div>
        </div>
      </ToastProvider>
    )
  }

  if (error) {
    return (
      <ToastProvider>
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 text-xl mb-4">⚠️ Error</div>
            <p className="text-gray-400">{error}</p>
          </div>
        </div>
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-900 text-white">
        <header className="bg-gray-800 shadow-lg">
          <div className="container mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold">🧩 Dragon Media AI Mockup</h1>
            <p className="text-gray-400 mt-2">
              Session-based file editing • Auto-cleanup on exit
            </p>
            {sellerId && (
              <p className="text-xs text-gray-500 mt-2">
                Seller: {sellerId} | Session: {sessionId?.substring(0, 8)}...
              </p>
            )}
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          {sessionId && sellerId ? (
            <MockupCanvas sessionId={sessionId} sellerId={sellerId} />
          ) : (
            <div className="text-center text-gray-400">
              <p>Session not initialized</p>
            </div>
          )}
        </main>

        <footer className="bg-gray-800 mt-12 py-4">
          <div className="container mx-auto px-4 text-center text-gray-400">
            <p>Session-based storage • Files auto-deleted on exit</p>
          </div>
        </footer>
      </div>
    </ToastProvider>
  )
}

export default App
