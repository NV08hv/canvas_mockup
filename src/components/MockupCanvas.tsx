import { useState, useRef, useEffect } from 'react'
import JSZip from 'jszip'

interface Transform {
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
}

interface DesignState {
  image: HTMLImageElement | null
  transform: Transform
  blendMode: BlendMode
  visible: boolean
  order: number // 0 = back, 1 = front
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

  // Design 1 and Design 2 states
  const [design1, setDesign1] = useState<DesignState>({
    image: null,
    transform: { x: 0, y: 0, scale: 1.0, rotation: 0, opacity: 100 },
    blendMode: 'multiply',
    visible: true,
    order: 0,
  })

  const [design2, setDesign2] = useState<DesignState>({
    image: null,
    transform: { x: 0, y: 0, scale: 1.0, rotation: 0, opacity: 100 },
    blendMode: 'multiply',
    visible: true,
    order: 1,
  })

  // Which design is currently being edited (1 or 2)
  const [activeDesign, setActiveDesign] = useState<1 | 2>(1)


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
  const handleDesignUpload = (designNum: 1 | 2) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new Image()
        img.onload = () => {
          const setDesign = designNum === 1 ? setDesign1 : setDesign2

          // Center the design on canvas if mockup is available
          if (mockupImage) {
            // Auto-scale design to fit nicely on mockup (about 30% of mockup size)
            const autoScale = Math.min(mockupImage.width, mockupImage.height) * 0.3 / Math.max(img.width, img.height)

            setDesign(prev => ({
              ...prev,
              image: img,
              transform: {
                ...prev.transform,
                x: mockupImage.width / 2,
                y: mockupImage.height / 2,
                scale: Math.max(0.1, Math.min(1.5, autoScale)), // Clamp between 0.1 and 1.5
              }
            }))
          } else {
            setDesign(prev => ({ ...prev, image: img }))
          }
        }
        img.src = event.target?.result as string
      }
      reader.readAsDataURL(file)
    }
  }

  // Helper function to draw a design
  const drawDesign = (ctx: CanvasRenderingContext2D, design: DesignState) => {
    if (!design.image || !design.visible) return

    ctx.save()
    ctx.globalCompositeOperation = design.blendMode
    ctx.globalAlpha = design.transform.opacity / 100
    ctx.translate(design.transform.x, design.transform.y)
    ctx.rotate((design.transform.rotation * Math.PI) / 180)
    ctx.scale(design.transform.scale, design.transform.scale)
    ctx.drawImage(
      design.image,
      -design.image.width / 2,
      -design.image.height / 2
    )
    ctx.restore()
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

    // Draw designs in order
    const designs = [design1, design2].sort((a, b) => a.order - b.order)
    designs.forEach(design => drawDesign(ctx, design))
  }, [mockupImage, design1, design2])

  // Mouse drag handlers (disabled for now with dual designs)
  const handleMouseDown = () => {
    // Disabled
  }

  const handleMouseMove = () => {
    // Disabled
  }

  const handleMouseUp = () => {
    // Disabled
  }

  // Get active design state and setter
  const getActiveDesignState = (): DesignState => {
    return activeDesign === 1 ? design1 : design2
  }

  const updateActiveDesignTransform = (updates: Partial<Transform>) => {
    const setDesign = activeDesign === 1 ? setDesign1 : setDesign2
    setDesign(prev => ({
      ...prev,
      transform: { ...prev.transform, ...updates }
    }))
  }

  const updateActiveDesignBlendMode = (mode: BlendMode) => {
    const setDesign = activeDesign === 1 ? setDesign1 : setDesign2
    setDesign(prev => ({ ...prev, blendMode: mode }))
  }

  const toggleActiveDesignVisibility = () => {
    const setDesign = activeDesign === 1 ? setDesign1 : setDesign2
    setDesign(prev => ({ ...prev, visible: !prev.visible }))
  }

  const swapDesignOrder = () => {
    setDesign1(prev => ({ ...prev, order: prev.order === 0 ? 1 : 0 }))
    setDesign2(prev => ({ ...prev, order: prev.order === 0 ? 1 : 0 }))
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

        // Draw designs in order
        const designs = [design1, design2].sort((a, b) => a.order - b.order)
        designs.forEach(design => drawDesign(ctx, design))

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
                {mockupImages.length} mockup(s)
                {design1.image && ` • Design 1`}
                {design2.image && ` • Design 2`}
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

                // Draw both designs in order (scaled to preview)
                const scaleX = previewWidth / mockupImg.width
                const scaleY = previewHeight / mockupImg.height

                const designs = [design1, design2].sort((a, b) => a.order - b.order)
                designs.forEach(design => {
                  if (!design.image || !design.visible) return

                  ctx.save()
                  ctx.globalCompositeOperation = design.blendMode
                  ctx.globalAlpha = design.transform.opacity / 100
                  ctx.translate(design.transform.x * scaleX, design.transform.y * scaleY)
                  ctx.rotate((design.transform.rotation * Math.PI) / 180)
                  ctx.scale(design.transform.scale * scaleX, design.transform.scale * scaleY)
                  ctx.drawImage(
                    design.image,
                    -design.image.width / 2,
                    -design.image.height / 2
                  )
                  ctx.restore()
                })

                const isSelected = selectedMockupIndex === index

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
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded text-xs font-semibold">
                          Selected
                        </div>
                      )}
                    </div>

                    <div className="mt-3 space-y-2">
                      <p className="text-center text-sm font-medium text-white">
                        Mockup {index + 1}
                      </p>
                      <p className="text-center text-xs text-gray-400">
                        {mockupImg.width} × {mockupImg.height}px
                      </p>
                      {(design1.image || design2.image) && (
                        <div className="flex justify-center space-x-2 text-xs">
                          {design1.image && design1.visible && (
                            <span className="text-green-400">✓ Design 1</span>
                          )}
                          {design2.image && design2.visible && (
                            <span className="text-blue-400">✓ Design 2</span>
                          )}
                        </div>
                      )}
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
                    <span className="text-gray-400">Designs:</span>
                    <span className="text-white ml-2">
                      {design1.image && `D1: ${design1.image.width}×${design1.image.height}px`}
                      {design1.image && design2.image && ' • '}
                      {design2.image && `D2: ${design2.image.width}×${design2.image.height}px`}
                      {!design1.image && !design2.image && 'None'}
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
                Design 1 (transparent PNG)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleDesignUpload(1)}
                className="block w-full text-sm text-gray-400 border border-gray-600 rounded px-3 py-2 bg-gray-700 hover:bg-gray-600 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={mockupImages.length === 0}
              />
              {design1.image && (
                <p className="text-xs text-green-400 mt-1">
                  ✓ Design 1 loaded: {design1.image.width} x {design1.image.height}px
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Design 2 (transparent PNG)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleDesignUpload(2)}
                className="block w-full text-sm text-gray-400 border border-gray-600 rounded px-3 py-2 bg-gray-700 hover:bg-gray-600 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={mockupImages.length === 0}
              />
              {design2.image && (
                <p className="text-xs text-blue-400 mt-1">
                  ✓ Design 2 loaded: {design2.image.width} x {design2.image.height}px
                </p>
              )}
            </div>
          </div>
        </div>


        {/* Design Controls */}
        {(design1.image || design2.image) && mockupImages.length > 0 && (
          <>
            {/* Active Design Selector */}
            <div className="bg-gray-700 rounded-lg p-4 mb-6">
              <h2 className="text-lg font-semibold mb-3">Active Design</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveDesign(1)}
                  disabled={!design1.image}
                  className={`flex-1 py-2 px-4 rounded font-semibold transition ${
                    activeDesign === 1
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed'
                  }`}
                >
                  Design 1
                </button>
                <button
                  onClick={() => setActiveDesign(2)}
                  disabled={!design2.image}
                  className={`flex-1 py-2 px-4 rounded font-semibold transition ${
                    activeDesign === 2
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed'
                  }`}
                >
                  Design 2
                </button>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={toggleActiveDesignVisibility}
                  className="flex-1 text-sm bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded transition"
                >
                  {getActiveDesignState().visible ? '👁️ Hide' : '👁️‍🗨️ Show'}
                </button>
                <button
                  onClick={swapDesignOrder}
                  className="flex-1 text-sm bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded transition"
                >
                  ↕️ Swap Order
                </button>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">
                Transform - Design {activeDesign}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Horizontal (X): {getActiveDesignState().transform.x.toFixed(0)}px
                  </label>
                  <input
                    type="range"
                    min="0"
                    max={mockupImage?.width || 1000}
                    step="1"
                    value={getActiveDesignState().transform.x}
                    onChange={(e) => updateActiveDesignTransform({ x: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Vertical (Y): {getActiveDesignState().transform.y.toFixed(0)}px
                  </label>
                  <input
                    type="range"
                    min="0"
                    max={mockupImage?.height || 1000}
                    step="1"
                    value={getActiveDesignState().transform.y}
                    onChange={(e) => updateActiveDesignTransform({ y: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Scale: {getActiveDesignState().transform.scale.toFixed(2)}x
                  </label>
                  <input
                    type="range"
                    min="0.05"
                    max="3"
                    step="0.01"
                    value={getActiveDesignState().transform.scale}
                    onChange={(e) => updateActiveDesignTransform({ scale: parseFloat(e.target.value) })}
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
                    Rotation: {getActiveDesignState().transform.rotation}°
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={getActiveDesignState().transform.rotation}
                    onChange={(e) => updateActiveDesignTransform({ rotation: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Opacity: {getActiveDesignState().transform.opacity}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={getActiveDesignState().transform.opacity}
                    onChange={(e) => updateActiveDesignTransform({ opacity: parseInt(e.target.value) })}
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
                  onClick={() => updateActiveDesignBlendMode('multiply')}
                  className={`py-1 px-2 rounded text-xs transition ${
                    getActiveDesignState().blendMode === 'multiply'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  Multiply
                </button>
                <button
                  onClick={() => updateActiveDesignBlendMode('screen')}
                  className={`py-1 px-2 rounded text-xs transition ${
                    getActiveDesignState().blendMode === 'screen'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  Screen
                </button>
                <button
                  onClick={() => updateActiveDesignBlendMode('overlay')}
                  className={`py-1 px-2 rounded text-xs transition ${
                    getActiveDesignState().blendMode === 'overlay'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  Overlay
                </button>
              </div>

              <select
                value={getActiveDesignState().blendMode}
                onChange={(e) => updateActiveDesignBlendMode(e.target.value as BlendMode)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                {BLEND_MODES.map(mode => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>

              <p className="text-xs text-gray-400 mt-2">
                Current: <span className="text-blue-400">{getActiveDesignState().blendMode}</span>
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
                    {design1.image && (
                      <p>• Design 1: {design1.image.width}×{design1.image.height}px {design1.visible ? '' : '(hidden)'}</p>
                    )}
                    {design2.image && (
                      <p>• Design 2: {design2.image.width}×{design2.image.height}px {design2.visible ? '' : '(hidden)'}</p>
                    )}
                    <p>• Layer order: {design1.order === 0 ? 'Design 1 back, Design 2 front' : 'Design 2 back, Design 1 front'}</p>
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
