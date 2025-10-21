import { useState, useRef, useEffect } from 'react'

export interface ImageFile {
  id: string
  url: string // Object URL for preview (will be revoked on cleanup)
  name: string
  source: 'file' | 'folder' | 'url'
  file: File // Always keep the original File object
  index?: number // Track the index for database synchronization
  isFromDatabase?: boolean // Track if this file came from the database
  size: number // File size in bytes
  type: string // MIME type
  ext: string // File extension (e.g., '.png', '.jpg')
}

interface ImageUploaderProps {
  onImagesLoaded: (images: HTMLImageElement[], files: ImageFile[]) => void
  accept?: string
  label?: string
  initialFiles?: ImageFile[] // Support pre-loading files from database
  resetTrigger?: number // Trigger to reset internal state
}

function ImageUploader({ onImagesLoaded, accept = 'image/*', label = 'Upload Images', initialFiles = [], resetTrigger }: ImageUploaderProps) {
  const [imageFiles, setImageFiles] = useState<ImageFile[]>(initialFiles)
  const [urlInput, setUrlInput] = useState('')
  const [isLoadingUrl, setIsLoadingUrl] = useState(false)
  const [urlError, setUrlError] = useState('')
  const [nextIndex, setNextIndex] = useState<number>(() => {
    // Calculate next index based on initial files
    if (initialFiles.length === 0) return 0
    const maxIndex = Math.max(...initialFiles.map(f => f.index ?? -1))
    return maxIndex + 1
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Reset internal state when resetTrigger changes
  useEffect(() => {
    if (resetTrigger !== undefined) {
      setImageFiles([])
      setNextIndex(0)
      console.log('ImageUploader reset triggered')
    }
  }, [resetTrigger])

  // Helper to generate unique ID
  const generateId = () => Math.random().toString(36).substring(2, 11)

  // Helper to load image from URL (data URL or external URL)
  const loadImageFromUrl = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous' // For external URLs
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = url
    })
  }

  // Process files and add to list
  const processFiles = async (files: FileList | File[], source: 'file' | 'folder') => {
    const fileArray = Array.from(files).filter(file => file.type.startsWith('image/'))

    const newImageFiles: ImageFile[] = []
    let currentIndex = nextIndex

    for (const file of fileArray) {
      // Create object URL for preview (memory efficient)
      const objectUrl = URL.createObjectURL(file)

      // Extract file extension
      const ext = file.name.substring(file.name.lastIndexOf('.'))

      newImageFiles.push({
        id: generateId(),
        url: objectUrl,
        name: file.name,
        source,
        file, // Keep original File object
        index: currentIndex,
        isFromDatabase: false,
        size: file.size,
        type: file.type,
        ext,
      })
      currentIndex++
    }

    // Update next index for future uploads
    setNextIndex(currentIndex)

    const updatedFiles = [...imageFiles, ...newImageFiles]
    setImageFiles(updatedFiles)

    // Load all images and notify parent
    await updateParentImages(updatedFiles)
  }

  // Update parent component with loaded images
  const updateParentImages = async (files: ImageFile[]) => {
    const loadedImages: HTMLImageElement[] = []

    for (const file of files) {
      try {
        const img = await loadImageFromUrl(file.url)
        loadedImages.push(img)
      } catch (error) {
        console.error(`Failed to load image: ${file.name}`, error)
      }
    }

    onImagesLoaded(loadedImages, files)
  }

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      processFiles(files, 'file')
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Handle folder upload
  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      processFiles(files, 'folder')
    }
    // Reset input
    if (folderInputRef.current) {
      folderInputRef.current.value = ''
    }
  }

  // Handle URL image fetch
  const handleAddUrl = async () => {
    if (!urlInput.trim()) {
      setUrlError('Please enter a URL')
      return
    }

    setIsLoadingUrl(true)
    setUrlError('')

    try {
      // Fetch the image and convert to File object
      const response = await fetch(urlInput)
      if (!response.ok) {
        throw new Error('Failed to fetch image')
      }

      const blob = await response.blob()
      const filename = urlInput.split('/').pop() || 'url-image.png'
      const file = new File([blob], filename, { type: blob.type || 'image/png' })

      // Create object URL for preview
      const objectUrl = URL.createObjectURL(file)

      // Extract file extension
      const ext = filename.substring(filename.lastIndexOf('.')) || '.png'

      const newImageFile: ImageFile = {
        id: generateId(),
        url: objectUrl,
        name: filename,
        source: 'url',
        file, // Keep File object
        index: nextIndex,
        isFromDatabase: false,
        size: file.size,
        type: file.type,
        ext,
      }

      setNextIndex(nextIndex + 1)

      const updatedFiles = [...imageFiles, newImageFile]
      setImageFiles(updatedFiles)
      setUrlInput('')

      // Update parent
      await updateParentImages(updatedFiles)
    } catch (error) {
      setUrlError('Failed to load image from URL. Make sure the URL is valid and CORS is enabled.')
      console.error('URL load error:', error)
    } finally {
      setIsLoadingUrl(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">{label}</label>

        {/* Upload buttons */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* File upload */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              multiple
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="block w-full text-center text-sm py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer transition"
            >
              📁 Files
            </label>
          </div>

          {/* Folder upload */}
          <div>
            <input
              ref={folderInputRef}
              type="file"
              accept={accept}
              multiple
              // @ts-ignore - webkitdirectory is not in React types but works in browsers
              webkitdirectory="true"
              directory="true"
              onChange={handleFolderUpload}
              className="hidden"
              id="folder-upload"
            />
            <label
              htmlFor="folder-upload"
              className="block w-full text-center text-sm py-2 px-3 bg-green-600 hover:bg-green-700 text-white rounded cursor-pointer transition"
            >
              📂 Folder
            </label>
          </div>
        </div>

        {/* URL input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value)
              setUrlError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddUrl()
              }
            }}
            placeholder="Enter image URL..."
            className="flex-1 text-sm px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
            disabled={isLoadingUrl}
          />
          <button
            onClick={handleAddUrl}
            disabled={isLoadingUrl || !urlInput.trim()}
            className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition"
          >
            {isLoadingUrl ? '...' : '🔗 Add'}
          </button>
        </div>

        {urlError && (
          <p className="text-xs text-red-400 mt-1">{urlError}</p>
        )}
      </div>
    </div>
  )
}

export default ImageUploader
