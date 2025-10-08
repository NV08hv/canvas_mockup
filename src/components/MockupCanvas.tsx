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

  // Per-mockup position overrides (mockupIndex -> { design1: {x, y}, design2: {x, y} })
  const [mockupOffsets, setMockupOffsets] = useState<Map<number, { design1?: { x: number; y: number }; design2?: { x: number; y: number } }>>(new Map())

  // Per-mockup custom transforms (mockupIndex -> custom Transform)
  const [mockupCustomTransforms1, setMockupCustomTransforms1] = useState<Map<number, Transform>>(new Map())
  const [mockupCustomTransforms2, setMockupCustomTransforms2] = useState<Map<number, Transform>>(new Map())
  const [mockupCustomBlendModes1, setMockupCustomBlendModes1] = useState<Map<number, BlendMode>>(new Map())
  const [mockupCustomBlendModes2, setMockupCustomBlendModes2] = useState<Map<number, BlendMode>>(new Map())

  // Edit mode state
  const [editMode, setEditMode] = useState<{ active: boolean; mockupIndex: number | null }>({ active: false, mockupIndex: null })

  // Canvas refresh counter to force re-render of preview tiles
  const [canvasRefreshKey, setCanvasRefreshKey] = useState(0)

  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 })
  const [dragInitialPos, setDragInitialPos] = useState({ x: 0, y: 0 })
  const [dragBothDesigns, setDragBothDesigns] = useState(false)
  const [dragMockupIndex, setDragMockupIndex] = useState<number | null>(null)

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

  // Get effective transform for a design on a specific mockup (considers custom overrides)
  const getEffectiveTransform = (designNum: 1 | 2, mockupIndex: number): Transform => {
    const design = designNum === 1 ? design1 : design2
    const customTransforms = designNum === 1 ? mockupCustomTransforms1 : mockupCustomTransforms2

    // Check if this mockup has custom transforms
    const customTransform = customTransforms.get(mockupIndex)
    if (customTransform) {
      return customTransform
    }

    // Otherwise use global transform
    return design.transform
  }

  // Get effective blend mode for a design on a specific mockup
  const getEffectiveBlendMode = (designNum: 1 | 2, mockupIndex: number): BlendMode => {
    const design = designNum === 1 ? design1 : design2
    const customBlendModes = designNum === 1 ? mockupCustomBlendModes1 : mockupCustomBlendModes2

    const customBlendMode = customBlendModes.get(mockupIndex)
    if (customBlendMode) {
      return customBlendMode
    }

    return design.blendMode
  }

  // Helper function to draw a design with per-mockup offsets and custom transforms
  const drawDesign = (
    ctx: CanvasRenderingContext2D,
    design: DesignState,
    designNum: 1 | 2,
    mockupIndex: number
  ) => {
    if (!design.image || !design.visible) return

    const pos = getEffectivePosition(designNum, mockupIndex)
    const transform = getEffectiveTransform(designNum, mockupIndex)
    const blendMode = getEffectiveBlendMode(designNum, mockupIndex)

    ctx.save()
    ctx.globalCompositeOperation = blendMode
    ctx.globalAlpha = transform.opacity / 100
    ctx.translate(pos.x, pos.y)
    ctx.rotate((transform.rotation * Math.PI) / 180)
    ctx.scale(transform.scale, transform.scale)
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

    // Draw designs in order with per-mockup offsets
    const designs = [
      { design: design1, num: 1 as 1 | 2 },
      { design: design2, num: 2 as 1 | 2 }
    ].sort((a, b) => a.design.order - b.design.order)

    designs.forEach(({ design, num }) => drawDesign(ctx, design, num, selectedMockupIndex))
  }, [mockupImage, design1, design2, selectedMockupIndex, mockupOffsets, mockupCustomTransforms1, mockupCustomTransforms2, mockupCustomBlendModes1, mockupCustomBlendModes2])

  // Get effective position for a design on a specific mockup
  const getEffectivePosition = (designNum: 1 | 2, mockupIndex: number): { x: number; y: number } => {
    const design = designNum === 1 ? design1 : design2
    const customTransforms = designNum === 1 ? mockupCustomTransforms1 : mockupCustomTransforms2

    // Priority 1: Check custom transforms (edit mode)
    const customTransform = customTransforms.get(mockupIndex)
    if (customTransform) {
      return { x: customTransform.x, y: customTransform.y }
    }

    // Priority 2: Check offsets (drag without edit mode)
    const offsets = mockupOffsets.get(mockupIndex)
    const designKey = designNum === 1 ? 'design1' : 'design2'
    if (offsets && offsets[designKey]) {
      return offsets[designKey]!
    }

    // Priority 3: Fall back to global transform
    return { x: design.transform.x, y: design.transform.y }
  }

  // Check if point is inside design's bounding box
  const hitTestDesign = (
    design: DesignState,
    mockupIndex: number,
    designNum: 1 | 2,
    mouseX: number,
    mouseY: number
  ): boolean => {
    if (!design.image || !design.visible) return false

    const pos = getEffectivePosition(designNum, mockupIndex)
    const transform = getEffectiveTransform(designNum, mockupIndex)

    // Simple bounding box hit test (ignoring rotation for simplicity)
    const halfWidth = (design.image.width * transform.scale) / 2
    const halfHeight = (design.image.height * transform.scale) / 2

    return (
      mouseX >= pos.x - halfWidth &&
      mouseX <= pos.x + halfWidth &&
      mouseY >= pos.y - halfHeight &&
      mouseY <= pos.y + halfHeight
    )
  }

  // Mouse drag handlers for canvas
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>, mockupIndex: number) => {
    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mouseX = (e.clientX - rect.left) * scaleX
    const mouseY = (e.clientY - rect.top) * scaleY

    // Check if clicking on active design or both (with Alt)
    const altPressed = e.altKey
    const activeDesignHit = hitTestDesign(
      activeDesign === 1 ? design1 : design2,
      mockupIndex,
      activeDesign,
      mouseX,
      mouseY
    )

    if (activeDesignHit) {
      const pos = getEffectivePosition(activeDesign, mockupIndex)
      setIsDragging(true)
      setDragStartPos({ x: mouseX, y: mouseY })
      setDragInitialPos(pos)
      setDragBothDesigns(altPressed)
      setDragMockupIndex(mockupIndex)
      e.preventDefault()
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || dragMockupIndex === null) return

    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mouseX = (e.clientX - rect.left) * scaleX
    const mouseY = (e.clientY - rect.top) * scaleY

    let dx = mouseX - dragStartPos.x
    let dy = mouseY - dragStartPos.y

    // Shift to lock axis
    if (e.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) {
        dy = 0
      } else {
        dx = 0
      }
    }

    const newX = dragInitialPos.x + dx
    const newY = dragInitialPos.y + dy

    // If in edit mode on this mockup, update custom transforms instead of offsets
    if (editMode.active && editMode.mockupIndex === dragMockupIndex) {
      if (dragBothDesigns) {
        // Update both designs' custom transforms
        setMockupCustomTransforms1(prev => {
          const newMap = new Map(prev)
          const currentTransform = getEffectiveTransform(1, dragMockupIndex)
          newMap.set(dragMockupIndex, { ...currentTransform, x: newX, y: newY })
          return newMap
        })
        setMockupCustomTransforms2(prev => {
          const newMap = new Map(prev)
          const currentTransform = getEffectiveTransform(2, dragMockupIndex)
          newMap.set(dragMockupIndex, { ...currentTransform, x: newX, y: newY })
          return newMap
        })
      } else {
        // Update active design's custom transform
        const setCustomTransforms = activeDesign === 1 ? setMockupCustomTransforms1 : setMockupCustomTransforms2
        setCustomTransforms(prev => {
          const newMap = new Map(prev)
          const currentTransform = getEffectiveTransform(activeDesign, dragMockupIndex)
          newMap.set(dragMockupIndex, { ...currentTransform, x: newX, y: newY })
          return newMap
        })
      }
    } else {
      // Update position offsets for non-edit-mode drag
      setMockupOffsets(prev => {
        const newMap = new Map(prev)
        const existing = newMap.get(dragMockupIndex) || {}

        if (dragBothDesigns) {
          newMap.set(dragMockupIndex, {
            ...existing,
            design1: { x: newX, y: newY },
            design2: { x: newX, y: newY }
          })
        } else {
          const designKey = activeDesign === 1 ? 'design1' : 'design2'
          newMap.set(dragMockupIndex, {
            ...existing,
            [designKey]: { x: newX, y: newY }
          })
        }

        return newMap
      })
    }
  }

  const handleCanvasMouseUp = () => {
    if (isDragging) {
      setCanvasRefreshKey(prev => prev + 1)
    }
    setIsDragging(false)
    setDragMockupIndex(null)
    setDragBothDesigns(false)
  }

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '1') setActiveDesign(1)
      if (e.key === '2') setActiveDesign(2)
      if (e.key === 'Escape' && isDragging) {
        setIsDragging(false)
        setDragMockupIndex(null)
        // Restore original position
        if (dragMockupIndex !== null) {
          setMockupOffsets(prev => {
            const newMap = new Map(prev)
            const existing = newMap.get(dragMockupIndex) || {}
            const designKey = activeDesign === 1 ? 'design1' : 'design2'

            if (dragBothDesigns) {
              delete existing.design1
              delete existing.design2
            } else {
              delete existing[designKey]
            }

            if (Object.keys(existing).length === 0) {
              newMap.delete(dragMockupIndex)
            } else {
              newMap.set(dragMockupIndex, existing)
            }

            return newMap
          })
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDragging, dragMockupIndex, activeDesign, dragBothDesigns])

  // Get active design state and setter
  const getActiveDesignState = (): DesignState => {
    return activeDesign === 1 ? design1 : design2
  }

  // Get effective transform and blend mode for the active design (considering edit mode)
  const getActiveEffectiveTransform = (): Transform => {
    if (editMode.active && editMode.mockupIndex !== null) {
      return getEffectiveTransform(activeDesign, editMode.mockupIndex)
    }
    return getActiveDesignState().transform
  }

  const getActiveEffectiveBlendMode = (): BlendMode => {
    if (editMode.active && editMode.mockupIndex !== null) {
      return getEffectiveBlendMode(activeDesign, editMode.mockupIndex)
    }
    return getActiveDesignState().blendMode
  }

  const updateActiveDesignTransform = (updates: Partial<Transform>) => {
    if (editMode.active && editMode.mockupIndex !== null) {
      // Update custom transform for this specific mockup
      const idx = editMode.mockupIndex
      const setCustomTransforms = activeDesign === 1 ? setMockupCustomTransforms1 : setMockupCustomTransforms2

      setCustomTransforms(prev => {
        const newMap = new Map(prev)
        const currentTransform = getEffectiveTransform(activeDesign, idx)
        newMap.set(idx, { ...currentTransform, ...updates })
        return newMap
      })
      // Force canvas refresh
      setCanvasRefreshKey(prev => prev + 1)
    } else {
      // Update global transform
      const setDesign = activeDesign === 1 ? setDesign1 : setDesign2
      setDesign(prev => ({
        ...prev,
        transform: { ...prev.transform, ...updates }
      }))
      // Force canvas refresh for global changes too
      setCanvasRefreshKey(prev => prev + 1)
    }
  }

  const updateActiveDesignBlendMode = (mode: BlendMode) => {
    if (editMode.active && editMode.mockupIndex !== null) {
      // Update custom blend mode for this specific mockup
      const idx = editMode.mockupIndex
      const setCustomBlendModes = activeDesign === 1 ? setMockupCustomBlendModes1 : setMockupCustomBlendModes2

      setCustomBlendModes(prev => {
        const newMap = new Map(prev)
        newMap.set(idx, mode)
        return newMap
      })
      setCanvasRefreshKey(prev => prev + 1)
    } else {
      // Update global blend mode
      const setDesign = activeDesign === 1 ? setDesign1 : setDesign2
      setDesign(prev => ({ ...prev, blendMode: mode }))
      setCanvasRefreshKey(prev => prev + 1)
    }
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

        // Draw designs in order with per-mockup offsets
        const designs = [
          { design: design1, num: 1 as 1 | 2 },
          { design: design2, num: 2 as 1 | 2 }
        ].sort((a, b) => a.design.order - b.design.order)

        designs.forEach(({ design, num }) => drawDesign(ctx, design, num, index))

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" key={`grid-${canvasRefreshKey}`}>
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

                // Draw both designs in order (scaled to preview with per-mockup offsets)
                const scaleX = previewWidth / mockupImg.width
                const scaleY = previewHeight / mockupImg.height

                const designs = [
                  { design: design1, num: 1 as 1 | 2 },
                  { design: design2, num: 2 as 1 | 2 }
                ].sort((a, b) => a.design.order - b.design.order)

                designs.forEach(({ design, num }) => {
                  if (!design.image || !design.visible) return

                  const pos = getEffectivePosition(num, index)
                  const transform = getEffectiveTransform(num, index)
                  const blendMode = getEffectiveBlendMode(num, index)

                  ctx.save()
                  ctx.globalCompositeOperation = blendMode
                  ctx.globalAlpha = transform.opacity / 100
                  ctx.translate(pos.x * scaleX, pos.y * scaleY)
                  ctx.rotate((transform.rotation * Math.PI) / 180)
                  ctx.scale(transform.scale * scaleX, transform.scale * scaleY)
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
                    className={`bg-gray-700 rounded-lg p-3 transition-all duration-200 ${
                      isSelected ? 'ring-2 ring-blue-500 bg-gray-600' : 'hover:bg-gray-600'
                    }`}
                  >
                    <div className="relative">
                      <canvas
                        key={`mockup-${index}-${canvasRefreshKey}`}
                        ref={(el) => {
                          if (el) {
                            el.width = previewWidth
                            el.height = previewHeight
                            const context = el.getContext('2d')
                            if (context) {
                              context.drawImage(tempCanvas, 0, 0)
                            }
                          }
                        }}
                        className="w-full h-auto rounded shadow-lg cursor-pointer"
                        style={{ cursor: isDragging && dragMockupIndex === index ? 'grabbing' : 'grab' }}
                        onMouseDown={(e) => {
                          handleCanvasMouseDown(e, index)
                          setSelectedMockupIndex(index)
                        }}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={handleCanvasMouseUp}
                      />
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded text-xs font-semibold pointer-events-none">
                          Selected
                        </div>
                      )}
                      {!isDragging && (mockupCustomTransforms1.has(index) || mockupCustomTransforms2.has(index) ||
                        mockupCustomBlendModes1.has(index) || mockupCustomBlendModes2.has(index)) && (
                        <div className="absolute top-2 left-2 bg-yellow-500 text-black px-2 py-1 rounded text-xs font-semibold pointer-events-none">
                          Edited
                        </div>
                      )}
                      {isDragging && dragMockupIndex === index && (
                        <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs font-mono pointer-events-none">
                          {dragBothDesigns ? 'Both' : `Design ${activeDesign}`}
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
                      {(design1.image || design2.image) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditMode({ active: true, mockupIndex: index })
                            setSelectedMockupIndex(index)
                          }}
                          className={`w-full text-xs py-2 rounded transition ${
                            editMode.active && editMode.mockupIndex === index
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'bg-gray-600 hover:bg-gray-500 text-white'
                          }`}
                        >
                          {editMode.active && editMode.mockupIndex === index ? '✏️ Editing...' : '✏️ Edit'}
                        </button>
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
          onMouseDown={(e) => handleCanvasMouseDown(e, selectedMockupIndex)}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
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
            {/* Edit Mode Header */}
            {editMode.active && editMode.mockupIndex !== null && (
              <div className="bg-blue-900 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-lg font-semibold">✏️ Editing Mockup {editMode.mockupIndex + 1}</h2>
                  <button
                    onClick={() => setEditMode({ active: false, mockupIndex: null })}
                    className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm transition"
                  >
                    Exit Edit Mode
                  </button>
                </div>
                <p className="text-sm text-gray-300">
                  Changes apply only to Mockup {editMode.mockupIndex + 1}
                </p>
                <button
                  onClick={() => {
                    const idx = editMode.mockupIndex!
                    setMockupCustomTransforms1(prev => {
                      const newMap = new Map(prev)
                      newMap.delete(idx)
                      return newMap
                    })
                    setMockupCustomTransforms2(prev => {
                      const newMap = new Map(prev)
                      newMap.delete(idx)
                      return newMap
                    })
                    setMockupCustomBlendModes1(prev => {
                      const newMap = new Map(prev)
                      newMap.delete(idx)
                      return newMap
                    })
                    setMockupCustomBlendModes2(prev => {
                      const newMap = new Map(prev)
                      newMap.delete(idx)
                      return newMap
                    })
                    setMockupOffsets(prev => {
                      const newMap = new Map(prev)
                      newMap.delete(idx)
                      return newMap
                    })
                  }}
                  className="mt-2 w-full bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm transition"
                >
                  Reset to Global Settings
                </button>
              </div>
            )}

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
                {editMode.active && editMode.mockupIndex !== null && (
                  <span className="text-sm text-blue-400 ml-2">(Mockup {editMode.mockupIndex + 1})</span>
                )}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Horizontal (X): {getActiveEffectiveTransform().x.toFixed(0)}px
                  </label>
                  <input
                    type="range"
                    min="0"
                    max={mockupImage?.width || 1000}
                    step="1"
                    value={getActiveEffectiveTransform().x}
                    onChange={(e) => updateActiveDesignTransform({ x: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Vertical (Y): {getActiveEffectiveTransform().y.toFixed(0)}px
                  </label>
                  <input
                    type="range"
                    min="0"
                    max={mockupImage?.height || 1000}
                    step="1"
                    value={getActiveEffectiveTransform().y}
                    onChange={(e) => updateActiveDesignTransform({ y: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Scale: {getActiveEffectiveTransform().scale.toFixed(2)}x
                  </label>
                  <input
                    type="range"
                    min="0.05"
                    max="3"
                    step="0.01"
                    value={getActiveEffectiveTransform().scale}
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
                    Rotation: {getActiveEffectiveTransform().rotation}°
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={getActiveEffectiveTransform().rotation}
                    onChange={(e) => updateActiveDesignTransform({ rotation: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Opacity: {getActiveEffectiveTransform().opacity}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={getActiveEffectiveTransform().opacity}
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
                    getActiveEffectiveBlendMode() === 'multiply'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  Multiply
                </button>
                <button
                  onClick={() => updateActiveDesignBlendMode('screen')}
                  className={`py-1 px-2 rounded text-xs transition ${
                    getActiveEffectiveBlendMode() === 'screen'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  Screen
                </button>
                <button
                  onClick={() => updateActiveDesignBlendMode('overlay')}
                  className={`py-1 px-2 rounded text-xs transition ${
                    getActiveEffectiveBlendMode() === 'overlay'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  Overlay
                </button>
              </div>

              <select
                value={getActiveEffectiveBlendMode()}
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
                Current: <span className="text-blue-400">{getActiveEffectiveBlendMode()}</span>
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
