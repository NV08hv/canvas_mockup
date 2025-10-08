import { useState, useRef, useEffect } from 'react'
import JSZip from 'jszip'

interface Transform {
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
}

const BLEND_MODES: GlobalCompositeOperation[] = [
  'source-over',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
]

type BlendMode = GlobalCompositeOperation

function MockupCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mockupImages, setMockupImages] = useState<HTMLImageElement[]>([])
  const [selectedMockupIndex, setSelectedMockupIndex] = useState<number>(0)
  const [mockupImage, setMockupImage] = useState<HTMLImageElement | null>(null)
  const [designImage, setDesignImage] = useState<HTMLImageElement | null>(null)
  const [transform, setTransform] = useState<Transform>({
    x: 0,
    y: 0,
    scale: 1.0,
    rotation: 0,
    opacity: 100,
  })
  const [blendMode, setBlendMode] = useState<BlendMode>('multiply')
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Per-mockup custom transforms (index -> transform)
  const [customTransforms, setCustomTransforms] = useState<Map<number, Transform>>(new Map())
  const [customBlendModes, setCustomBlendModes] = useState<Map<number, BlendMode>>(new Map())

  // Editing mode - when a mockup is selected for editing
  const [isEditMode, setIsEditMode] = useState(false)

  // Load mockup images from folder
  const handleMockupUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      // Filter out non-image files (like .DS_Store on macOS)
      const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'))

      if (imageFiles.length === 0) return

      const loadedImages: HTMLImageElement[] = []
      let completedCount = 0

      imageFiles.forEach((file, index) => {
        const reader = new FileReader()
        
        reader.onload = (event) => {
          const img = new Image()
          img.onload = () => {
            loadedImages[index] = img
            completedCount++

            // If all images are loaded, update state
            if (completedCount === imageFiles.length) {
              setMockupImages(loadedImages)
              setSelectedMockupIndex(0)
              setMockupImage(loadedImages[0])
            }
          }
          img.onerror = () => {
            completedCount++
            if (completedCount === imageFiles.length) {
              setMockupImages(loadedImages)
              if (loadedImages.length > 0) {
                setSelectedMockupIndex(0)
                setMockupImage(loadedImages[0])
              }
            }
          }
          img.src = event.target?.result as string
        }
        
        reader.onerror = () => {
          completedCount++
          if (completedCount === imageFiles.length) {
            setMockupImages(loadedImages)
            if (loadedImages.length > 0) {
              setSelectedMockupIndex(0)
              setMockupImage(loadedImages[0])
            }
          }
        }
        
        reader.readAsDataURL(file)
      })
    }
  }

  // Update mockup when selection changes
  useEffect(() => {
    if (mockupImages.length > 0) {
      setMockupImage(mockupImages[selectedMockupIndex])
    }
  }, [selectedMockupIndex, mockupImages])

  // Load design image
  const handleDesignUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new Image()
        img.onload = () => {
          setDesignImage(img)
          // Center the design on canvas if mockup is available
          if (mockupImage) {
            // Auto-scale design to fit nicely on mockup (about 30% of mockup size)
            const autoScale = Math.min(mockupImage.width, mockupImage.height) * 0.3 / Math.max(img.width, img.height)
            
            setTransform(prev => ({
              ...prev,
              x: mockupImage.width / 2,
              y: mockupImage.height / 2,
              scale: Math.max(0.1, Math.min(1.5, autoScale)) // Clamp between 0.1 and 1.5
            }))
          }
        }
        img.src = event.target?.result as string
      }
      reader.readAsDataURL(file)
    }
  }

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !mockupImage) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to mockup image size
    canvas.width = mockupImage.width
    canvas.height = mockupImage.height

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw mockup
    ctx.drawImage(mockupImage, 0, 0)

    // Draw design if available
    if (designImage) {
      ctx.save()

      // Set blend mode
      ctx.globalCompositeOperation = blendMode

      // Set opacity
      ctx.globalAlpha = transform.opacity / 100

      // Apply transformations
      ctx.translate(transform.x, transform.y)
      ctx.rotate((transform.rotation * Math.PI) / 180)
      ctx.scale(transform.scale, transform.scale)

      // Draw design centered
      ctx.drawImage(
        designImage,
        -designImage.width / 2,
        -designImage.height / 2
      )

      ctx.restore()
    }
  }, [mockupImage, designImage, transform, blendMode])

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!designImage) return
    setIsDragging(true)
    setDragStart({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return
    const dx = e.nativeEvent.offsetX - dragStart.x
    const dy = e.nativeEvent.offsetY - dragStart.y
    setTransform(prev => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy,
    }))
    setDragStart({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Edit mode functions
  const enterEditMode = (index: number) => {
    setSelectedMockupIndex(index)
    setIsEditMode(true)
  }

  const exitEditMode = () => {
    setIsEditMode(false)
  }

  const applyCustomEdit = () => {
    // Save current transform and blend mode as custom for selected mockup
    const currentTransform = getTransformForMockup(selectedMockupIndex)
    const currentBlendMode = getBlendModeForMockup(selectedMockupIndex)

    setCustomTransforms(prev => new Map(prev).set(selectedMockupIndex, currentTransform))
    setCustomBlendModes(prev => new Map(prev).set(selectedMockupIndex, currentBlendMode))
    setIsEditMode(false)
  }

  const resetCustomEdit = () => {
    // Remove custom settings for selected mockup
    setCustomTransforms(prev => {
      const newMap = new Map(prev)
      newMap.delete(selectedMockupIndex)
      return newMap
    })
    setCustomBlendModes(prev => {
      const newMap = new Map(prev)
      newMap.delete(selectedMockupIndex)
      return newMap
    })
  }

  // Update transform - affects selected mockup in edit mode, or global otherwise
  const updateTransform = (updates: Partial<Transform>) => {
    if (isEditMode) {
      // Update custom transform for selected mockup
      const current = customTransforms.get(selectedMockupIndex) || transform
      const updated = { ...current, ...updates }
      setCustomTransforms(prev => new Map(prev).set(selectedMockupIndex, updated))
    } else {
      // Update global transform
      setTransform(prev => ({ ...prev, ...updates }))
    }
  }

  const updateBlendModeForEdit = (mode: BlendMode) => {
    if (isEditMode) {
      setCustomBlendModes(prev => new Map(prev).set(selectedMockupIndex, mode))
    } else {
      setBlendMode(mode)
    }
  }

  // Get current editing values
  const getCurrentTransform = (): Transform => {
    if (isEditMode) {
      return customTransforms.get(selectedMockupIndex) || transform
    }
    return transform
  }

  const getCurrentBlendMode = (): BlendMode => {
    if (isEditMode) {
      return customBlendModes.get(selectedMockupIndex) || blendMode
    }
    return blendMode
  }

  // Helper to get transform for a specific mockup
  const getTransformForMockup = (index: number): Transform => {
    return customTransforms.get(index) || transform
  }

  const getBlendModeForMockup = (index: number): BlendMode => {
    return customBlendModes.get(index) || blendMode
  }

  // Export all mockups as ZIP
  const handleExport = async () => {
    if (mockupImages.length === 0) return

    const zip = new JSZip()
    const folder = zip.folder('mockups')

    // Create promises for all canvas conversions
    const promises = mockupImages.map((mockupImg, index) => {
      return new Promise<void>((resolve) => {
        const tempCanvas = document.createElement('canvas')
        const ctx = tempCanvas.getContext('2d')
        if (!ctx) {
          resolve()
          return
        }

        tempCanvas.width = mockupImg.width
        tempCanvas.height = mockupImg.height

        // Draw mockup
        ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height)
        ctx.drawImage(mockupImg, 0, 0)

        // Draw design if available
        if (designImage) {
          const mockupTransform = getTransformForMockup(index)
          const mockupBlendMode = getBlendModeForMockup(index)

          ctx.save()
          ctx.globalCompositeOperation = mockupBlendMode
          ctx.globalAlpha = mockupTransform.opacity / 100
          ctx.translate(mockupTransform.x, mockupTransform.y)
          ctx.rotate((mockupTransform.rotation * Math.PI) / 180)
          ctx.scale(mockupTransform.scale, mockupTransform.scale)
          ctx.drawImage(
            designImage,
            -designImage.width / 2,
            -designImage.height / 2
          )
          ctx.restore()
        }

        // Convert to blob and add to zip
        tempCanvas.toBlob((blob) => {
          if (blob && folder) {
            folder.file(`mockup_${index + 1}.png`, blob)
          }
          resolve()
        }, 'image/png')
      })
    })

    // Wait for all images to be processed
    await Promise.all(promises)

    // Generate and download zip
    zip.generateAsync({ type: 'blob' }).then((content) => {
      const url = URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = url
      a.download = 'mockups.zip'
      a.click()
      URL.revokeObjectURL(url)
    })
  }


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Canvas Area */}
      <div className="lg:col-span-2 bg-gray-800 rounded-lg p-6">
        {mockupImages.length === 0 ? (
          <div className="text-center text-gray-400 py-20">
            <div className="mb-4">
              <p className="text-lg font-semibold mb-2">Upload mockup files to get started</p>
              <p className="text-sm">1. Click "Choose Files" to select mockup images</p>
              <p className="text-sm">2. Then upload your design file</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header with summary */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Mockup Preview</h3>
              <p className="text-sm text-gray-400">
                {mockupImages.length} mockup(s) with design overlay
                {designImage && ` • Design: ${designImage.width}×${designImage.height}px`}
              </p>
            </div>

            {/* Mockup grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockupImages.map((mockupImg, index) => {
                const tempCanvas = document.createElement('canvas')
                const ctx = tempCanvas.getContext('2d')
                if (!ctx) return null

                // Create a smaller preview canvas for better performance
                const previewSize = 400
                const aspectRatio = mockupImg.width / mockupImg.height
                let previewWidth = previewSize
                let previewHeight = previewSize / aspectRatio
                
                if (aspectRatio > 1) {
                  previewHeight = previewSize / aspectRatio
                } else {
                  previewWidth = previewSize * aspectRatio
                }

                tempCanvas.width = previewWidth
                tempCanvas.height = previewHeight
                ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height)
                
                // Draw mockup scaled to preview size
                ctx.drawImage(mockupImg, 0, 0, previewWidth, previewHeight)

                if (designImage) {
                  const mockupTransform = getTransformForMockup(index)
                  const mockupBlendMode = getBlendModeForMockup(index)

                  ctx.save()
                  ctx.globalCompositeOperation = mockupBlendMode
                  ctx.globalAlpha = mockupTransform.opacity / 100

                  // Scale transform coordinates to preview size
                  const scaleX = previewWidth / mockupImg.width
                  const scaleY = previewHeight / mockupImg.height

                  ctx.translate(mockupTransform.x * scaleX, mockupTransform.y * scaleY)
                  ctx.rotate((mockupTransform.rotation * Math.PI) / 180)
                  ctx.scale(mockupTransform.scale * scaleX, mockupTransform.scale * scaleY)
                  ctx.drawImage(
                    designImage,
                    -designImage.width / 2,
                    -designImage.height / 2
                  )
                  ctx.restore()
                }

                const isSelected = selectedMockupIndex === index
                const isEdited = customTransforms.has(index) || customBlendModes.has(index)

                return (
                  <div 
                    key={index} 
                    className={`bg-gray-700 rounded-lg p-3 cursor-pointer transition-all duration-200 ${
                      isSelected ? 'ring-2 ring-blue-500 bg-gray-600' : 'hover:bg-gray-600'
                    }`}
                    onClick={() => setSelectedMockupIndex(index)}
                  >
                    <div className="relative">
                      <img
                        src={tempCanvas.toDataURL('image/png')}
                        alt={`Mockup ${index + 1}`}
                        className="w-full h-auto rounded shadow-lg"
                      />
                      <div className="absolute top-2 right-2 flex gap-2">
                        {isEdited && (
                          <div className="bg-orange-500 text-white px-2 py-1 rounded text-xs font-semibold">
                            Edited
                          </div>
                        )}
                        {isSelected && (
                          <div className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-semibold">
                            Selected
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <p className="text-center text-sm font-medium text-white">
                        Mockup {index + 1}
                      </p>
                      <p className="text-center text-xs text-gray-400">
                        {mockupImg.width} × {mockupImg.height}px
                      </p>
                      {designImage && (
                        <div className="flex justify-center space-x-2 text-xs">
                          <span className="text-green-400">✓ Design Applied</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-blue-400">{getBlendModeForMockup(index)}</span>
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          enterEditMode(index)
                        }}
                        className={`w-full ${
                          isEditMode && isSelected
                            ? 'bg-orange-600 hover:bg-orange-700'
                            : 'bg-purple-600 hover:bg-purple-700'
                        } text-white text-xs font-semibold py-2 px-3 rounded transition`}
                      >
                        {isEditMode && isSelected ? '✏️ Editing...' : '✏️ Edit'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Controls for selected mockup */}
            {mockupImages.length > 0 && (
              <div className="bg-gray-700 rounded-lg p-4">
                <h4 className="text-md font-semibold mb-3">
                  Selected: Mockup {selectedMockupIndex + 1}
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Dimensions:</span>
                    <span className="text-white ml-2">
                      {mockupImages[selectedMockupIndex]?.width} × {mockupImages[selectedMockupIndex]?.height}px
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Design:</span>
                    <span className="text-white ml-2">
                      {designImage ? `${designImage.width}×${designImage.height}px` : 'None'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hidden canvas for export */}
        <canvas 
          ref={canvasRef} 
          className="hidden"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      {/* Controls Panel */}
      <div className="bg-gray-800 rounded-lg p-6 space-y-6">
        {/* File Uploads */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Upload Images</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Mockup Folder
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                // @ts-ignore - webkitdirectory is not in React types but works in browsers
                webkitdirectory="true"
                directory="true"
                onChange={handleMockupUpload}
                className="block w-full text-sm border border-gray-600 rounded px-3 py-2 bg-gray-700 hover:bg-gray-600 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer [&::file-selector-button]:mr-4"
                style={{ color: 'transparent' }}
              />
              <p className="text-xs text-gray-400 mt-1">
                {mockupImages.length > 0
                  ? `${mockupImages.length} mockup(s) loaded - all displayed in grid`
                  : 'No files selected'
                }
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Design (transparent PNG)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleDesignUpload}
                className="block w-full text-sm text-gray-400 border border-gray-600 rounded px-3 py-2 bg-gray-700 hover:bg-gray-600 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={mockupImages.length === 0}
              />
              {mockupImages.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Upload mockup images first to enable design upload
                </p>
              )}
              {mockupImages.length > 0 && (
                <p className="text-xs text-green-400 mt-1">
                  ✓ Ready to upload design ({mockupImages.length} mockups loaded)
                </p>
              )}
              {designImage && (
                <p className="text-xs text-green-400 mt-1">
                  ✓ Design loaded: {designImage.width} x {designImage.height}px
                </p>
              )}
              
            </div>
          </div>
        </div>


        {/* Transform Controls */}
        {designImage && mockupImages.length > 0 && (
          <>
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  {isEditMode ? `Editing Mockup ${selectedMockupIndex + 1}` : 'Transform (Global)'}
                </h2>
                {isEditMode && (
                  <span className="text-xs bg-orange-500 text-white px-2 py-1 rounded">
                    Edit Mode
                  </span>
                )}
              </div>

              {isEditMode && (
                <div className="mb-4 p-3 bg-orange-900 bg-opacity-30 border border-orange-500 rounded text-sm">
                  <p className="text-orange-200">
                    Changes apply only to Mockup {selectedMockupIndex + 1}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={exitEditMode}
                      className="text-xs bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded"
                    >
                      Exit Edit Mode
                    </button>
                    <button
                      onClick={resetCustomEdit}
                      className="text-xs bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded"
                    >
                      Reset to Global
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Horizontal (X): {getCurrentTransform().x.toFixed(0)}px
                  </label>
                  <input
                    type="range"
                    min="0"
                    max={mockupImage?.width || 1000}
                    step="1"
                    value={getCurrentTransform().x}
                    onChange={(e) => updateTransform({ x: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Vertical (Y): {getCurrentTransform().y.toFixed(0)}px
                  </label>
                  <input
                    type="range"
                    min="0"
                    max={mockupImage?.height || 1000}
                    step="1"
                    value={getCurrentTransform().y}
                    onChange={(e) => updateTransform({ y: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Scale: {getCurrentTransform().scale.toFixed(2)}x
                  </label>
                  <input
                    type="range"
                    min="0.05"
                    max="3"
                    step="0.01"
                    value={getCurrentTransform().scale}
                    onChange={(e) => updateTransform({ scale: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>0.05x</span>
                    <span>1.5x</span>
                    <span>3.0x</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Rotation: {getCurrentTransform().rotation}°
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={getCurrentTransform().rotation}
                    onChange={(e) => updateTransform({ rotation: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Opacity: {getCurrentTransform().opacity}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={getCurrentTransform().opacity}
                    onChange={(e) => updateTransform({ opacity: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Blend Mode */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Blend Mode</h2>

              {/* Quick preset buttons */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <button
                  onClick={() => updateBlendModeForEdit('multiply')}
                  className={`py-1 px-2 rounded text-xs transition ${
                    getCurrentBlendMode() === 'multiply'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  Multiply
                </button>
                <button
                  onClick={() => updateBlendModeForEdit('screen')}
                  className={`py-1 px-2 rounded text-xs transition ${
                    getCurrentBlendMode() === 'screen'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  Screen
                </button>
                <button
                  onClick={() => updateBlendModeForEdit('overlay')}
                  className={`py-1 px-2 rounded text-xs transition ${
                    getCurrentBlendMode() === 'overlay'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  Overlay
                </button>
              </div>

              <select
                value={getCurrentBlendMode()}
                onChange={(e) => updateBlendModeForEdit(e.target.value as BlendMode)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                {BLEND_MODES.map(mode => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>

              <p className="text-xs text-gray-400 mt-2">
                Current: <span className="text-blue-400">{getCurrentBlendMode()}</span>
              </p>
            </div>

            {/* Export */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Export</h2>
              <div className="space-y-3">
                <button
                  onClick={handleExport}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded transition"
                >
                  📦 Export as ZIP ({mockupImages.length} files)
                </button>
                
                <div className="bg-gray-700 rounded-lg p-3">
                  <h4 className="text-sm font-semibold mb-2">Export Info:</h4>
                  <div className="text-xs text-gray-400 space-y-1">
                    <p>• {mockupImages.length} mockup images</p>
                    <p>• Design: {designImage ? `${designImage.width}×${designImage.height}px` : 'None'}</p>
                    <p>• Blend mode: {blendMode}</p>
                    <p>• Scale: {transform.scale.toFixed(2)}x</p>
                    <p>• Opacity: {transform.opacity}%</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default MockupCanvas
