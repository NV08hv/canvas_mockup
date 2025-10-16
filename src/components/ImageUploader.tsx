import { useState, useRef } from 'react'
import { computeImageHash, computeFileHash } from '../utils/imageHash'

export interface ImageFile {
  id: string
  url: string
  name: string
  source: 'file' | 'folder' | 'url'
  file?: File
  index?: number // Track the index for database synchronization
  isFromDatabase?: boolean // Track if this file came from the database
  hash?: string // SHA-256 hash for deduplication
  size?: number // File size in bytes
}

interface ImageUploaderProps {
  onImagesLoaded: (images: HTMLImageElement[], files: ImageFile[]) => void
  accept?: string
  label?: string
  initialFiles?: ImageFile[] // Support pre-loading files from database
}

function ImageUploader({ onImagesLoaded, accept = 'image/*', label = 'Upload Images', initialFiles = [] }: ImageUploaderProps) {
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
      const reader = new FileReader()

      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = (e) => {
          resolve(e.target?.result as string)
        }
        reader.onerror = () => resolve('')
        reader.readAsDataURL(file)
      })

      if (dataUrl) {
        // Compute hash from file
        const hash = await computeFileHash(file)

        newImageFiles.push({
          id: generateId(),
          url: dataUrl,
          name: file.name,
          source,
          file,
          index: currentIndex,
          isFromDatabase: false,
          hash,
          size: file.size,
        })
        currentIndex++
      }
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
      // Try to load the image
      const img = await loadImageFromUrl(urlInput)

      // Create a canvas to convert the image to a data URL
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0)
        const dataUrl = canvas.toDataURL('image/png')

        // Compute hash from data URL
        const hash = await computeImageHash(dataUrl)

        // Estimate size from data URL
        const base64Length = dataUrl.split(',')[1].length
        const size = Math.ceil(base64Length * 0.75)

        const newImageFile: ImageFile = {
          id: generateId(),
          url: dataUrl,
          name: urlInput.split('/').pop() || 'url-image.png',
          source: 'url',
          index: nextIndex,
          isFromDatabase: false,
          hash,
          size,
        }

        setNextIndex(nextIndex + 1)

        const updatedFiles = [...imageFiles, newImageFile]
        setImageFiles(updatedFiles)
        setUrlInput('')

        // Update parent
        await updateParentImages(updatedFiles)
      }
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
