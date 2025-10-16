// Session management for embedded file editing project
const API_BASE = `${import.meta.env.VITE_API_BASE_URL || 'https://mockupai.supover.com'}/api`
const HEARTBEAT_INTERVAL = import.meta.env.VITE_HEARTBEAT_INTERVAL || 10 * 60 * 1000 // 10 minutes
const SESSION_STORAGE_KEY = import.meta.env.VITE_SESSION_STORAGE_KEY || 'file_editor_session'

interface SessionData {
  sessionId: string
  userId: string
  createdAt: string
}

class SessionManager {
  private sessionId: string | null = null
  private userId: string | null = null
  private heartbeatInterval: number | null = null
  private isActive: boolean = true

  constructor() {
    // Listen for page visibility changes
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this))

    // Listen for beforeunload (user leaving)
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this))

    // Listen for unload (final cleanup attempt)
    window.addEventListener('unload', this.handleUnload.bind(this))
  }

  /**
   * Initialize or restore a session
   * @param userId - The user ID from embedding site
   * @returns Session data
   */
  async initializeSession(userId: string): Promise<SessionData> {
    this.userId = userId

    // Try to restore existing session from localStorage
    const storedSession = this.getStoredSession()

    try {
      const response = await fetch(`${API_BASE}/session/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          sessionId: storedSession?.sessionId || null
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create/restore session')
      }

      const data = await response.json()
      this.sessionId = data.sessionId

      // Store session in localStorage
      const sessionData: SessionData = {
        sessionId: data.sessionId,
        userId: data.userId,
        createdAt: new Date().toISOString()
      }
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData))

      // Start heartbeat
      this.startHeartbeat()

      return sessionData
    } catch (error) {
      console.error('Error initializing session:', error)
      throw error
    }
  }

  /**
   * Get stored session from localStorage
   */
  private getStoredSession(): SessionData | null {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (error) {
      console.error('Error reading stored session:', error)
    }
    return null
  }

  /**
   * Start sending heartbeat to keep session alive
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    this.heartbeatInterval = window.setInterval(async () => {
      if (this.isActive && this.sessionId) {
        try {
          await fetch(`${API_BASE}/session/heartbeat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessionId: this.sessionId })
          })
        } catch (error) {
          console.error('Heartbeat failed:', error)
        }
      }
    }, HEARTBEAT_INTERVAL)
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * Handle page visibility changes
   */
  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.isActive = false
      this.stopHeartbeat()
    } else {
      this.isActive = true
      this.startHeartbeat()
      // Send immediate heartbeat on return
      if (this.sessionId) {
        fetch(`${API_BASE}/session/heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId: this.sessionId })
        }).catch(error => console.error('Heartbeat failed:', error))
      }
    }
  }

  /**
   * Handle beforeunload (user is leaving)
   */
  private handleBeforeUnload(): void {
    // Stop heartbeat to allow timeout-based cleanup
    this.stopHeartbeat()
  }

  /**
   * Handle unload (final cleanup)
   */
  private handleUnload(): void {
    this.stopHeartbeat()
  }

  /**
   * Manually end session (call this if user explicitly logs out)
   */
  async endSession(): Promise<void> {
    this.stopHeartbeat()

    if (this.sessionId) {
      try {
        // Use sendBeacon for reliable delivery during page unload
        const data = JSON.stringify({ sessionId: this.sessionId })
        const blob = new Blob([data], { type: 'application/json' })
        navigator.sendBeacon(`${API_BASE}/session/end`, blob)

        // Also try regular fetch as backup
        await fetch(`${API_BASE}/session/end`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: data,
          keepalive: true
        }).catch(() => {
          // Ignore errors, sendBeacon is the primary method
        })
      } catch (error) {
        console.error('Error ending session:', error)
      }

      // Clear localStorage
      localStorage.removeItem(SESSION_STORAGE_KEY)
      this.sessionId = null
      this.userId = null
    }
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId
  }

  /**
   * Get current user ID
   */
  getUserId(): string | null {
    return this.userId
  }

  /**
   * Get API base URL
   */
  getApiBase(): string {
    return API_BASE
  }
}

// Export singleton instance
export const sessionManager = new SessionManager()
export default sessionManager
