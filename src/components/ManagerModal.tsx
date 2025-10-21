import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ImageFile } from './ImageUploader'

interface ManagerModalProps {
  mockupFiles: ImageFile[]
  userId: string
  apiBase: string
  onClose: () => void
  onDeleted: () => void
}

export default function ManagerModal({
  mockupFiles,
  userId,
  apiBase,
  onClose,
  onDeleted
}: ManagerModalProps) {
  const [filesToDelete, setFilesToDelete] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteClick = (fileId: string) => {
    setFilesToDelete((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(fileId)) {
        newSet.delete(fileId)
      } else {
        newSet.add(fileId)
      }
      return newSet
    })
  }

  const handleDeleteSelected = async () => {
    if (filesToDelete.size === 0) return

    setIsDeleting(true)

    try {
      // Get files to delete
      const filesToRemove = mockupFiles.filter((file) => filesToDelete.has(file.id))

      // Delete each file from server/database
      for (const file of filesToRemove) {
        try {
          const response = await fetch(`${apiBase}/files/${userId}/${encodeURIComponent(file.name)}`, {
            method: 'DELETE'
          })

          if (!response.ok) {
            console.error(`Failed to delete ${file.name}: ${response.status}`)
          }
        } catch (error) {
          console.error(`Error deleting ${file.name}:`, error)
        }
      }

      // Notify parent component that files were deleted
      onDeleted()
      onClose()
    } catch (error) {
      console.error('Error during deletion:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteAll = async () => {
    if (mockupFiles.length === 0) return

    setIsDeleting(true)

    try {
      // Delete all files from server/database
      for (const file of mockupFiles) {
        try {
          const response = await fetch(`${apiBase}/files/${userId}/${encodeURIComponent(file.name)}`, {
            method: 'DELETE'
          })

          if (!response.ok) {
            console.error(`Failed to delete ${file.name}: ${response.status}`)
          }
        } catch (error) {
          console.error(`Error deleting ${file.name}:`, error)
        }
      }

      // Notify parent component that all files were deleted
      onDeleted()
      onClose()
    } catch (error) {
      console.error('Error during deletion:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const hasImages = mockupFiles.length > 0

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white">Manage Database Files</h2>
            <p className="text-gray-400 text-sm mt-1">
              {mockupFiles.length === 0
                ? 'No files in database'
                : `${mockupFiles.length} file${mockupFiles.length !== 1 ? 's' : ''} in database`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition text-2xl font-bold w-10 h-10 flex items-center justify-center rounded hover:bg-gray-700"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!hasImages ? (
            // Empty state
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-gray-400">
              <svg
                className="w-24 h-24 mb-4 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-xl font-semibold mb-2">No files in database</p>
              <p className="text-sm">Upload some files first</p>
            </div>
          ) : (
            // Grid layout - 4 images per row
            <div className="grid grid-cols-4 gap-4">
              {mockupFiles.map((file) => {
                const isMarkedForDeletion = filesToDelete.has(file.id)
                return (
                  <div
                    key={file.id}
                    className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                      isMarkedForDeletion
                        ? 'border-red-500 opacity-50'
                        : 'border-gray-700 hover:border-blue-500'
                    }`}
                  >
                    {/* Image */}
                    <div className="aspect-square bg-gray-900 flex items-center justify-center">
                      <img
                        src={file.url}
                        alt={file.name}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Delete/Undo button */}
                    <button
                      onClick={() => handleDeleteClick(file.id)}
                      className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                        isMarkedForDeletion
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-black bg-opacity-50 text-white hover:bg-red-600 hover:bg-opacity-100'
                      }`}
                      aria-label={isMarkedForDeletion ? 'Undo delete' : 'Mark for deletion'}
                      title={isMarkedForDeletion ? 'Click to keep this file' : 'Click to permanently delete this file'}
                    >
                      {isMarkedForDeletion ? '↺' : '×'}
                    </button>

                    {/* Image info */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 p-2">
                      <p className="text-white text-xs truncate" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-gray-400 text-xs">
                        Database • {file.source}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex justify-between items-center">
          <div className="text-sm">
            {filesToDelete.size > 0 ? (
              <span className="text-red-400 font-semibold">
                ⚠️ {filesToDelete.size} file{filesToDelete.size !== 1 ? 's' : ''} will be PERMANENTLY deleted from database
              </span>
            ) : (
              <span className="text-gray-400">Click × on any file to mark it for permanent deletion</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded transition"
            >
              Cancel
            </button>
            {hasImages && (
              <button
                onClick={handleDeleteAll}
                disabled={isDeleting}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded transition"
              >
                {isDeleting ? 'Deleting...' : 'Delete All'}
              </button>
            )}
            <button
              onClick={handleDeleteSelected}
              disabled={!hasImages || filesToDelete.size === 0 || isDeleting}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded transition"
            >
              {isDeleting ? 'Deleting...' : `Delete Selected (${filesToDelete.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
