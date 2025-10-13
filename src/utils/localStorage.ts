// Local storage utility for persisting mockup files

export interface StoredImageFile {
  id: string
  url: string // Data URL
  name: string
  source: 'file' | 'folder' | 'url'
  index: number
  isFromDatabase: boolean
}

const STORAGE_KEY = 'mockup_files'

/**
 * Save files to localStorage
 */
export const saveFilesToLocal = (files: StoredImageFile[]): boolean => {
  try {
    const data = JSON.stringify(files)
    localStorage.setItem(STORAGE_KEY, data)
    console.log(`Saved ${files.length} files to localStorage`)
    return true
  } catch (error) {
    console.error('Error saving files to localStorage:', error)
    // Handle quota exceeded error
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      alert('Storage quota exceeded. Please delete some files.')
    }
    return false
  }
}

/**
 * Load files from localStorage
 */
export const loadFilesFromLocal = (): StoredImageFile[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) {
      console.log('No saved files found in localStorage')
      return []
    }
    const files = JSON.parse(data) as StoredImageFile[]
    console.log(`Loaded ${files.length} files from localStorage`)
    return files
  } catch (error) {
    console.error('Error loading files from localStorage:', error)
    return []
  }
}

/**
 * Clear all saved files from localStorage
 */
export const clearLocalFiles = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY)
    console.log('Cleared all files from localStorage')
  } catch (error) {
    console.error('Error clearing localStorage:', error)
  }
}

/**
 * Get storage usage information
 */
export const getStorageInfo = (): { used: number; available: number } => {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    const used = data ? new Blob([data]).size : 0
    // localStorage typically has ~5-10MB limit
    const available = 5 * 1024 * 1024 // Assume 5MB
    return { used, available }
  } catch (error) {
    return { used: 0, available: 0 }
  }
}

/**
 * Format bytes to human readable format
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}
