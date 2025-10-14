import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import JSZip from 'jszip'
import ImageUploader, { ImageFile } from './ImageUploader'

interface Transform {
  x: number
  y: number
  scale: number
  scaleX: number
  scaleY: number
  rotation: number
  opacity: number
}

// Interactive Preview Component
interface InteractivePreviewProps {
  mockupImage: HTMLImageElement | null
  designImage: HTMLImageElement | null
  design2Image: HTMLImageElement | null
  design1Transform: Transform
  design2Transform: Transform
  design1BlendMode: BlendMode
  design2BlendMode: BlendMode
  activeLayer: 'design1' | 'design2'
  onDesign1TransformChange: (updates: Partial<Transform>) => void
  onDesign2TransformChange: (updates: Partial<Transform>) => void
}

const API_BASE = 'http://mockupai.supover.com/api'
const FILE_BASE = 'http://mockupai.supover.com'

// Try loading a static file from FILE_BASE first, then fall back to API_BASE
async function loadImageWithFallback(relativePath: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    let triedFallback = false

    const tryLoad = (base: string) => {
      const fullUrl = `${base}${relativePath}`
      img.src = fullUrl
    }

    img.onload = () => resolve(img)
    img.onerror = () => {
      if (!triedFallback) {
        triedFallback = true
        tryLoad(API_BASE)
      } else {
        reject(new Error('Failed to load image from both paths'))
      }
    }

    tryLoad(FILE_BASE)
  })
}

function InteractivePreview({
  mockupImage,
  designImage,
  design2Image,
  design1Transform,
  design2Transform,
  design1BlendMode,
  design2BlendMode,
  activeLayer,
  onDesign1TransformChange,
  onDesign2TransformChange
}: InteractivePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragInitial, setDragInitial] = useState({ x: 0, y: 0 })
  const rafRef = useRef<number | null>(null)
  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(null)
  const [pinchInitialScale, setPinchInitialScale] = useState(1)

  // Get active layer's properties
  const currentTransform = activeLayer === 'design1' ? design1Transform : design2Transform
  const currentImage = activeLayer === 'design1' ? designImage : design2Image
  const onTransformChange = activeLayer === 'design1' ? onDesign1TransformChange : onDesign2TransformChange

  // Local transform for smooth updates
  const [localTransform, setLocalTransform] = useState(currentTransform)

  // Update local transform when active layer or props change
  useEffect(() => {
    setLocalTransform(currentTransform)
  }, [currentTransform, activeLayer])

  // Draw preview
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !mockupImage) return

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    // Set canvas size to a fixed preview size
    const previewSize = 400
    const aspectRatio = mockupImage.width / mockupImage.height
    let width = previewSize
    let height = previewSize / aspectRatio

    if (aspectRatio < 1) {
      width = previewSize * aspectRatio
      height = previewSize
    }

    canvas.width = width
    canvas.height = height

    // Scale factors
    const scaleX = width / mockupImage.width
    const scaleY = height / mockupImage.height

    // Clear and draw mockup
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(mockupImage, 0, 0, width, height)

    // Draw design 1 if available
    if (designImage) {
      ctx.save()
      ctx.globalCompositeOperation = design1BlendMode
      ctx.globalAlpha = design1Transform.opacity / 100
      ctx.translate(design1Transform.x * scaleX, design1Transform.y * scaleY)
      ctx.rotate((design1Transform.rotation * Math.PI) / 180)
      ctx.scale(design1Transform.scale * design1Transform.scaleX * scaleX, design1Transform.scale * design1Transform.scaleY * scaleY)
      ctx.drawImage(
        designImage,
        -designImage.width / 2,
        -designImage.height / 2
      )
      ctx.restore()
    }

    // Draw design 2 if available
    if (design2Image) {
      ctx.save()
      ctx.globalCompositeOperation = design2BlendMode
      ctx.globalAlpha = design2Transform.opacity / 100
      ctx.translate(design2Transform.x * scaleX, design2Transform.y * scaleY)
      ctx.rotate((design2Transform.rotation * Math.PI) / 180)
      ctx.scale(design2Transform.scale * design2Transform.scaleX * scaleX, design2Transform.scale * design2Transform.scaleY * scaleY)
      ctx.drawImage(
        design2Image,
        -design2Image.width / 2,
        -design2Image.height / 2
      )
      ctx.restore()
    }

    // Draw active layer highlight
    if (currentImage) {
      ctx.save()
      ctx.strokeStyle = activeLayer === 'design1' ? '#10b981' : '#f97316' // green for design1, orange for design2
      ctx.lineWidth = 3
      ctx.setLineDash([5, 5])
      ctx.translate(localTransform.x * scaleX, localTransform.y * scaleY)
      ctx.rotate((localTransform.rotation * Math.PI) / 180)
      const w = currentImage.width * localTransform.scale * localTransform.scaleX * scaleX
      const h = currentImage.height * localTransform.scale * localTransform.scaleY * scaleY
      ctx.strokeRect(-w / 2, -h / 2, w, h)
      ctx.restore()
    }
  }, [mockupImage, designImage, design2Image, design1Transform, design2Transform, design1BlendMode, design2BlendMode, localTransform, activeLayer, currentImage])

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!mockupImage || !currentImage) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mouseX = (e.clientX - rect.left) * scaleX
    const mouseY = (e.clientY - rect.top) * scaleY

    setIsDragging(true)
    setDragStart({ x: mouseX, y: mouseY })
    setDragInitial({ x: localTransform.x, y: localTransform.y })
    e.preventDefault()
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !mockupImage) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mouseX = (e.clientX - rect.left) * scaleX
    const mouseY = (e.clientY - rect.top) * scaleY

    // Calculate delta in canvas space
    const dx = mouseX - dragStart.x
    const dy = mouseY - dragStart.y

    // Convert back to mockup space
    const mockupScaleX = mockupImage.width / canvas.width
    const mockupScaleY = mockupImage.height / canvas.height

    const newX = dragInitial.x + (dx * mockupScaleX)
    const newY = dragInitial.y + (dy * mockupScaleY)

    // Update local state immediately for smooth rendering
    setLocalTransform(prev => ({ ...prev, x: newX, y: newY }))

    // Cancel previous RAF
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }

    // Debounce parent update using RAF
    rafRef.current = requestAnimationFrame(() => {
      onTransformChange({ x: newX, y: newY })
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()

    // Determine scroll direction and amount
    const delta = -e.deltaY * 0.001
    const newScale = Math.max(0.05, Math.min(3, localTransform.scale + delta))

    // Update local state immediately
    setLocalTransform(prev => ({ ...prev, scale: newScale }))

    // Cancel previous RAF
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }

    // Debounce parent update using RAF
    rafRef.current = requestAnimationFrame(() => {
      onTransformChange({ scale: newScale })
    })
  }

  // Touch handlers for pinch-to-zoom
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return null
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      // Pinch gesture
      const distance = getTouchDistance(e.touches)
      if (distance) {
        setLastPinchDistance(distance)
        setPinchInitialScale(localTransform.scale)
      }
      e.preventDefault()
    } else if (e.touches.length === 1) {
      // Single touch drag
      if (!mockupImage || !currentImage) return

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const touchX = (e.touches[0].clientX - rect.left) * scaleX
      const touchY = (e.touches[0].clientY - rect.top) * scaleY

      setIsDragging(true)
      setDragStart({ x: touchX, y: touchY })
      setDragInitial({ x: localTransform.x, y: localTransform.y })
    }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      // Pinch gesture
      const distance = getTouchDistance(e.touches)
      if (distance && lastPinchDistance) {
        const scaleFactor = distance / lastPinchDistance
        const newScale = Math.max(0.05, Math.min(3, pinchInitialScale * scaleFactor))

        // Update local state immediately
        setLocalTransform(prev => ({ ...prev, scale: newScale }))

        // Cancel previous RAF
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current)
        }

        // Debounce parent update using RAF
        rafRef.current = requestAnimationFrame(() => {
          onTransformChange({ scale: newScale })
        })
      }
      e.preventDefault()
    } else if (e.touches.length === 1 && isDragging) {
      // Single touch drag
      if (!mockupImage) return

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const touchX = (e.touches[0].clientX - rect.left) * scaleX
      const touchY = (e.touches[0].clientY - rect.top) * scaleY

      // Calculate delta in canvas space
      const dx = touchX - dragStart.x
      const dy = touchY - dragStart.y

      // Convert back to mockup space
      const mockupScaleX = mockupImage.width / canvas.width
      const mockupScaleY = mockupImage.height / canvas.height

      const newX = dragInitial.x + (dx * mockupScaleX)
      const newY = dragInitial.y + (dy * mockupScaleY)

      // Update local state immediately for smooth rendering
      setLocalTransform(prev => ({ ...prev, x: newX, y: newY }))

      // Cancel previous RAF
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }

      // Debounce parent update using RAF
      rafRef.current = requestAnimationFrame(() => {
        onTransformChange({ x: newX, y: newY })
      })

      e.preventDefault()
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    setLastPinchDistance(null)
  }

  return (
    <div className="bg-gray-700 rounded-lg p-4">
      <div className="mb-2 flex justify-between items-center">
        <label className="text-sm font-medium">Interactive Preview</label>
        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-400">
            X: {localTransform.x.toFixed(0)} • Y: {localTransform.y.toFixed(0)} • Scale: {localTransform.scale.toFixed(2)}x
          </div>
        </div>
      </div>

      <div className="relative bg-gray-800 rounded overflow-hidden" style={{ touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          className="w-full h-auto cursor-move"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Drag to move • Scroll or pinch to scale • {activeLayer === 'design1' ? 'Green' : 'Orange'} outline = active layer
      </p>
    </div>
  )
}

// Expanded Transform Modal Component (batch transform for all non-edited mockups)
interface ExpandedTransformModalProps {
  mockupImage: HTMLImageElement | null
  designImage: HTMLImageElement | null
  design2Image: HTMLImageElement | null
  design1Transform: Transform
  design2Transform: Transform
  activeLayer: 'design1' | 'design2'
  onApply: (design1Updates: Partial<Transform>, design2Updates: Partial<Transform>) => void
  onClose: () => void
}

function ExpandedTransformModal({
  mockupImage,
  designImage,
  design2Image,
  design1Transform,
  design2Transform,
  activeLayer: initialActiveLayer,
  onApply,
  onClose
}: ExpandedTransformModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragInitial, setDragInitial] = useState({ x: 0, y: 0 })
  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(null)
  const [pinchInitialScale, setPinchInitialScale] = useState(1)

  // Active layer state (can be switched by tabs)
  const [activeLayer, setActiveLayer] = useState<'design1' | 'design2'>(initialActiveLayer)

  // Independent local transform state for each design - initialize with current values
  const [localDesign1Transform, setLocalDesign1Transform] = useState<Transform>(() => ({ ...design1Transform }))
  const [localDesign2Transform, setLocalDesign2Transform] = useState<Transform>(() => ({ ...design2Transform }))

  // Get active layer's properties
  const currentTransform = activeLayer === 'design1' ? localDesign1Transform : localDesign2Transform
  const setCurrentTransform = activeLayer === 'design1' ? setLocalDesign1Transform : setLocalDesign2Transform
  const currentImage = activeLayer === 'design1' ? designImage : design2Image

  // Block body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  // Helper function to snap rotation to cardinal angles
  const snapRotation = (rotation: number): number => {
    const snapAngles = [0, 90, 180, 270, 360]
    const snapThreshold = 2

    for (const angle of snapAngles) {
      if (Math.abs(rotation - angle) <= snapThreshold) {
        return angle % 360
      }
    }
    return rotation
  }

  // Handle Apply button
  const handleApply = () => {
    // Calculate which properties have changed for Design 1
    const design1Updates: Partial<Transform> = {}
    if (localDesign1Transform.x !== design1Transform.x) design1Updates.x = localDesign1Transform.x
    if (localDesign1Transform.y !== design1Transform.y) design1Updates.y = localDesign1Transform.y
    if (localDesign1Transform.scale !== design1Transform.scale) design1Updates.scale = localDesign1Transform.scale
    if (localDesign1Transform.rotation !== design1Transform.rotation) design1Updates.rotation = localDesign1Transform.rotation

    // Calculate which properties have changed for Design 2
    const design2Updates: Partial<Transform> = {}
    if (localDesign2Transform.x !== design2Transform.x) design2Updates.x = localDesign2Transform.x
    if (localDesign2Transform.y !== design2Transform.y) design2Updates.y = localDesign2Transform.y
    if (localDesign2Transform.scale !== design2Transform.scale) design2Updates.scale = localDesign2Transform.scale
    if (localDesign2Transform.rotation !== design2Transform.rotation) design2Updates.rotation = localDesign2Transform.rotation

    onApply(design1Updates, design2Updates)
    onClose()
  }

  // Handle Close button (discard changes)
  const handleClose = () => {
    onClose()
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+Enter = Apply
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleApply()
        return
      }

      // Escape = Close (discard)
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
        return
      }

      // Arrow key nudging
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        if (!mockupImage) return

        const nudgeAmount = e.shiftKey ? 10 : 1
        let dx = 0
        let dy = 0

        switch (e.key) {
          case 'ArrowLeft': dx = -nudgeAmount; break
          case 'ArrowRight': dx = nudgeAmount; break
          case 'ArrowUp': dy = -nudgeAmount; break
          case 'ArrowDown': dy = nudgeAmount; break
        }

        setCurrentTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mockupImage, currentTransform, setCurrentTransform])

  // Draw preview
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !mockupImage) return

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    // Use 80% of viewport for canvas size
    const maxWidth = window.innerWidth * 0.8
    const maxHeight = window.innerHeight * 0.8
    const aspectRatio = mockupImage.width / mockupImage.height

    let width = maxWidth
    let height = maxWidth / aspectRatio

    if (height > maxHeight) {
      height = maxHeight
      width = maxHeight * aspectRatio
    }

    canvas.width = width
    canvas.height = height

    // Scale factors
    const scaleX = width / mockupImage.width
    const scaleY = height / mockupImage.height

    // Clear and draw mockup
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(mockupImage, 0, 0, width, height)

    // Draw design 1 if available
    if (designImage) {
      ctx.save()
      ctx.globalAlpha = localDesign1Transform.opacity / 100
      ctx.translate(localDesign1Transform.x * scaleX, localDesign1Transform.y * scaleY)
      ctx.rotate((localDesign1Transform.rotation * Math.PI) / 180)
      ctx.scale(localDesign1Transform.scale * localDesign1Transform.scaleX * scaleX, localDesign1Transform.scale * localDesign1Transform.scaleY * scaleY)
      ctx.drawImage(
        designImage,
        -designImage.width / 2,
        -designImage.height / 2
      )
      ctx.restore()
    }

    // Draw design 2 if available
    if (design2Image) {
      ctx.save()
      ctx.globalAlpha = localDesign2Transform.opacity / 100
      ctx.translate(localDesign2Transform.x * scaleX, localDesign2Transform.y * scaleY)
      ctx.rotate((localDesign2Transform.rotation * Math.PI) / 180)
      ctx.scale(localDesign2Transform.scale * localDesign2Transform.scaleX * scaleX, localDesign2Transform.scale * localDesign2Transform.scaleY * scaleY)
      ctx.drawImage(
        design2Image,
        -design2Image.width / 2,
        -design2Image.height / 2
      )
      ctx.restore()
    }

    // Draw active layer outline (with local transform)
    if (currentImage) {
      ctx.save()
      ctx.strokeStyle = activeLayer === 'design1' ? '#10b981' : '#f97316'
      ctx.lineWidth = 3
      ctx.setLineDash([5, 5])
      ctx.translate(currentTransform.x * scaleX, currentTransform.y * scaleY)
      ctx.rotate((currentTransform.rotation * Math.PI) / 180)
      const w = currentImage.width * currentTransform.scale * currentTransform.scaleX * scaleX
      const h = currentImage.height * currentTransform.scale * currentTransform.scaleY * scaleY
      ctx.strokeRect(-w / 2, -h / 2, w, h)
      ctx.restore()
    }
  }, [mockupImage, designImage, design2Image, localDesign1Transform, localDesign2Transform, currentTransform, activeLayer, currentImage])

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!mockupImage || !currentImage) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mouseX = (e.clientX - rect.left) * scaleX
    const mouseY = (e.clientY - rect.top) * scaleY

    setIsDragging(true)
    setDragStart({ x: mouseX, y: mouseY })
    setDragInitial({ x: currentTransform.x, y: currentTransform.y })
    e.preventDefault()
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !mockupImage) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mouseX = (e.clientX - rect.left) * scaleX
    const mouseY = (e.clientY - rect.top) * scaleY

    // Calculate delta in canvas space
    let dx = mouseX - dragStart.x
    let dy = mouseY - dragStart.y

    // Shift to lock axis
    if (e.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) {
        dy = 0
      } else {
        dx = 0
      }
    }

    // Convert back to mockup space
    const mockupScaleX = mockupImage.width / canvas.width
    const mockupScaleY = mockupImage.height / canvas.height

    const newX = dragInitial.x + (dx * mockupScaleX)
    const newY = dragInitial.y + (dy * mockupScaleY)

    setCurrentTransform(prev => ({ ...prev, x: newX, y: newY }))
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()

    // Determine scroll direction and amount
    const delta = -e.deltaY * 0.001
    const newScale = Math.max(0.05, Math.min(3, currentTransform.scale + delta))

    setCurrentTransform(prev => ({ ...prev, scale: newScale }))
  }

  // Touch handlers for pinch-to-zoom
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return null
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      // Pinch gesture
      const distance = getTouchDistance(e.touches)
      if (distance) {
        setLastPinchDistance(distance)
        setPinchInitialScale(currentTransform.scale)
      }
      e.preventDefault()
    } else if (e.touches.length === 1) {
      // Single touch drag
      if (!mockupImage || !currentImage) return

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const touchX = (e.touches[0].clientX - rect.left) * scaleX
      const touchY = (e.touches[0].clientY - rect.top) * scaleY

      setIsDragging(true)
      setDragStart({ x: touchX, y: touchY })
      setDragInitial({ x: currentTransform.x, y: currentTransform.y })
    }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      // Pinch gesture
      const distance = getTouchDistance(e.touches)
      if (distance && lastPinchDistance) {
        const scaleFactor = distance / lastPinchDistance
        const newScale = Math.max(0.05, Math.min(3, pinchInitialScale * scaleFactor))

        setCurrentTransform(prev => ({ ...prev, scale: newScale }))
      }
      e.preventDefault()
    } else if (e.touches.length === 1 && isDragging) {
      // Single touch drag
      if (!mockupImage) return

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const touchX = (e.touches[0].clientX - rect.left) * scaleX
      const touchY = (e.touches[0].clientY - rect.top) * scaleY

      // Calculate delta in canvas space
      const dx = touchX - dragStart.x
      const dy = touchY - dragStart.y

      // Convert back to mockup space
      const mockupScaleX = mockupImage.width / canvas.width
      const mockupScaleY = mockupImage.height / canvas.height

      const newX = dragInitial.x + (dx * mockupScaleX)
      const newY = dragInitial.y + (dy * mockupScaleY)

      setCurrentTransform(prev => ({ ...prev, x: newX, y: newY }))

      e.preventDefault()
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    setLastPinchDistance(null)
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
      onClick={handleClose}
    >
      <div
        className="relative max-w-full max-h-full flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Layer Selector, Stats, Apply and Close buttons */}
        <div className="mb-4 flex items-center gap-4 bg-gray-800 px-6 py-3 rounded-lg w-full">
          {/* Layer Selector Buttons */}
          <div className="flex gap-2">
            {designImage && (
              <button
                onClick={() => setActiveLayer('design1')}
                className={`px-3 py-2 text-sm font-medium rounded transition ${
                  activeLayer === 'design1'
                    ? 'bg-green-600 text-white ring-2 ring-green-400'
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
                title="Edit Design 1"
              >
                Design 1
              </button>
            )}
            {design2Image && (
              <button
                onClick={() => setActiveLayer('design2')}
                className={`px-3 py-2 text-sm font-medium rounded transition ${
                  activeLayer === 'design2'
                    ? 'bg-orange-600 text-white ring-2 ring-orange-400'
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
                title="Edit Design 2"
              >
                Design 2
              </button>
            )}
          </div>

          <div className="text-sm text-gray-300 flex-1">
            X: {currentTransform.x.toFixed(0)} • Y: {currentTransform.y.toFixed(0)} • Scale: {currentTransform.scale.toFixed(2)}x •
            Rotation: {currentTransform.rotation}°
          </div>
          <button
            onClick={handleApply}
            className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white font-semibold rounded transition"
            title="Apply changes and close (Cmd/Ctrl+Enter)"
          >
            Apply
          </button>
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded transition"
            title="Close without saving (Esc)"
          >
            Close
          </button>
        </div>

        {/* Canvas */}
        <div className="relative bg-gray-900 rounded-lg overflow-visible shadow-2xl" style={{ touchAction: 'none' }}>
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full cursor-move"
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
        </div>

        {/* Rotation Control */}
        <div className="mt-4 bg-gray-800 rounded-lg p-4 w-full max-w-md">
          <div className="mb-3">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">Rotation: {currentTransform.rotation}°</label>
              <button
                onClick={() => setCurrentTransform(prev => ({ ...prev, rotation: 0 }))}
                className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 rounded transition"
              >
                Reset to 0°
              </button>
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={currentTransform.rotation}
                onChange={(e) => {
                  const rawValue = parseInt(e.target.value)
                  const snappedValue = snapRotation(rawValue)
                  setCurrentTransform(prev => ({ ...prev, rotation: snappedValue }))
                }}
                className="flex-1"
              />
              <input
                type="number"
                min="0"
                max="360"
                value={currentTransform.rotation}
                onChange={(e) => {
                  const rawValue = parseInt(e.target.value) || 0
                  const clampedValue = Math.max(0, Math.min(360, rawValue))
                  const snappedValue = snapRotation(clampedValue)
                  setCurrentTransform(prev => ({ ...prev, rotation: snappedValue }))
                }}
                className="w-16 px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Snaps at 0°, 90°, 180°, 270° (±2°)
            </p>
          </div>
        </div>

        {/* Instructions */}
        <p className="mt-4 text-xs text-gray-400 text-center max-w-md">
          Drag to move • Scroll or pinch to scale • Arrows = nudge • Shift = lock axis
        </p>
        <p className="text-xs text-gray-400 text-center max-w-md">
          <kbd className="bg-gray-700 px-1 rounded">Cmd/Ctrl+Enter</kbd> = Apply • <kbd className="bg-gray-700 px-1 rounded">Esc</kbd> = Close
        </p>
      </div>
    </div>,
    document.body
  )
}

// Edit Modal Component (standalone, triggered by Edit button)
interface EditModalProps {
  mockupImage: HTMLImageElement | null
  design1Image: HTMLImageElement | null
  design2Image: HTMLImageElement | null
  design1Transform: Transform
  design2Transform: Transform
  onDesign1TransformChange: (transform: Transform) => void
  onDesign2TransformChange: (transform: Transform) => void
  onClose: () => void
}

function EditModal({ mockupImage, design1Image, design2Image, design1Transform, design2Transform, onDesign1TransformChange, onDesign2TransformChange, onClose }: EditModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragInitial, setDragInitial] = useState({ x: 0, y: 0 })

  // Active layer state
  const [activeLayer, setActiveLayer] = useState<'design1' | 'design2'>('design1')

  // Local state: clone transforms on open, only commit on Apply
  const [localDesign1Transform, setLocalDesign1Transform] = useState<Transform>(() => ({ ...design1Transform }))
  const [localDesign2Transform, setLocalDesign2Transform] = useState<Transform>(() => ({ ...design2Transform }))

  // Get active layer's properties
  const currentTransform = activeLayer === 'design1' ? localDesign1Transform : localDesign2Transform
  const setCurrentTransform = activeLayer === 'design1' ? setLocalDesign1Transform : setLocalDesign2Transform
  const currentImage = activeLayer === 'design1' ? design1Image : design2Image

  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(null)
  const [pinchInitialScale, setPinchInitialScale] = useState(1)
  const [scaleAnchor, setScaleAnchor] = useState<{ x: number; y: number } | null>(null)
  const [isDraggingHandle, setIsDraggingHandle] = useState<'left' | 'right' | 'top' | 'bottom' | null>(null)
  const [handleDragStart, setHandleDragStart] = useState({ x: 0, y: 0 })
  const [handleInitialScale, setHandleInitialScale] = useState({ scaleX: 1, scaleY: 1 })

  // Block body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  // Helper function to snap rotation to cardinal angles
  const snapRotation = (rotation: number): number => {
    const snapAngles = [0, 90, 180, 270, 360]
    const snapThreshold = 2

    for (const angle of snapAngles) {
      if (Math.abs(rotation - angle) <= snapThreshold) {
        return angle % 360
      }
    }
    return rotation
  }

  // Handle Apply button
  const handleApply = () => {
    onDesign1TransformChange(localDesign1Transform)
    onDesign2TransformChange(localDesign2Transform)
    onClose()
  }

  // Handle Close button (discard changes)
  const handleClose = () => {
    onClose()
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+Enter = Apply
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleApply()
        return
      }

      // Escape = Close (discard)
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
        return
      }

      // Arrow key nudging
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        if (!mockupImage) return

        const nudgeAmount = e.shiftKey ? 10 : 1
        let dx = 0
        let dy = 0

        switch (e.key) {
          case 'ArrowLeft': dx = -nudgeAmount; break
          case 'ArrowRight': dx = nudgeAmount; break
          case 'ArrowUp': dy = -nudgeAmount; break
          case 'ArrowDown': dy = nudgeAmount; break
        }

        setCurrentTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mockupImage, currentTransform, setCurrentTransform])

  // Draw preview
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !mockupImage) return

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    // Use 80% of viewport for canvas size
    const maxWidth = window.innerWidth * 0.8
    const maxHeight = window.innerHeight * 0.8
    const aspectRatio = mockupImage.width / mockupImage.height

    let width = maxWidth
    let height = maxWidth / aspectRatio

    if (height > maxHeight) {
      height = maxHeight
      width = maxHeight * aspectRatio
    }

    canvas.width = width
    canvas.height = height

    // Scale factors
    const scaleX = width / mockupImage.width
    const scaleY = height / mockupImage.height

    // Clear and draw mockup
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(mockupImage, 0, 0, width, height)

    // Draw design 1 if available
    if (design1Image) {
      ctx.save()
      ctx.globalAlpha = localDesign1Transform.opacity / 100
      ctx.translate(localDesign1Transform.x * scaleX, localDesign1Transform.y * scaleY)
      ctx.rotate((localDesign1Transform.rotation * Math.PI) / 180)
      ctx.scale(localDesign1Transform.scale * localDesign1Transform.scaleX * scaleX, localDesign1Transform.scale * localDesign1Transform.scaleY * scaleY)
      ctx.drawImage(
        design1Image,
        -design1Image.width / 2,
        -design1Image.height / 2
      )
      ctx.restore()
    }

    // Draw design 2 if available
    if (design2Image) {
      ctx.save()
      ctx.globalAlpha = localDesign2Transform.opacity / 100
      ctx.translate(localDesign2Transform.x * scaleX, localDesign2Transform.y * scaleY)
      ctx.rotate((localDesign2Transform.rotation * Math.PI) / 180)
      ctx.scale(localDesign2Transform.scale * localDesign2Transform.scaleX * scaleX, localDesign2Transform.scale * localDesign2Transform.scaleY * scaleY)
      ctx.drawImage(
        design2Image,
        -design2Image.width / 2,
        -design2Image.height / 2
      )
      ctx.restore()
    }

    // Draw active layer outline
    if (currentImage) {
      ctx.save()
      ctx.strokeStyle = activeLayer === 'design1' ? '#10b981' : '#f97316' // green for design1, orange for design2
      ctx.lineWidth = 3
      ctx.setLineDash([5, 5])
      ctx.translate(currentTransform.x * scaleX, currentTransform.y * scaleY)
      ctx.rotate((currentTransform.rotation * Math.PI) / 180)
      const w = currentImage.width * currentTransform.scale * currentTransform.scaleX * scaleX
      const h = currentImage.height * currentTransform.scale * currentTransform.scaleY * scaleY
      ctx.strokeRect(-w / 2, -h / 2, w, h)
      ctx.restore()
    }
  }, [mockupImage, design1Image, design2Image, localDesign1Transform, localDesign2Transform, activeLayer, currentImage, currentTransform])

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!mockupImage || !currentImage) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mouseX = (e.clientX - rect.left) * scaleX
    const mouseY = (e.clientY - rect.top) * scaleY

    setIsDragging(true)
    setDragStart({ x: mouseX, y: mouseY })
    setDragInitial({ x: currentTransform.x, y: currentTransform.y })

    // Set scale anchor for Alt+scroll
    if (e.altKey) {
      setScaleAnchor({ x: mouseX, y: mouseY })
    }

    e.preventDefault()
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !mockupImage) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mouseX = (e.clientX - rect.left) * scaleX
    const mouseY = (e.clientY - rect.top) * scaleY

    // Calculate delta in canvas space
    let dx = mouseX - dragStart.x
    let dy = mouseY - dragStart.y

    // Shift to lock axis
    if (e.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) {
        dy = 0
      } else {
        dx = 0
      }
    }

    // Convert back to mockup space
    const mockupScaleX = mockupImage.width / canvas.width
    const mockupScaleY = mockupImage.height / canvas.height

    const newX = dragInitial.x + (dx * mockupScaleX)
    const newY = dragInitial.y + (dy * mockupScaleY)

    // Update local state immediately for smooth rendering
    setCurrentTransform(prev => ({ ...prev, x: newX, y: newY }))
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setScaleAnchor(null)
  }

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()

    if (!mockupImage) return

    const canvas = canvasRef.current
    if (!canvas) return

    // Determine scroll direction and amount
    const delta = -e.deltaY * 0.001
    let newScale = Math.max(0.05, Math.min(3, currentTransform.scale + delta))

    let newX = currentTransform.x
    let newY = currentTransform.y

    // Alt key: scale from center
    if (e.altKey || scaleAnchor) {
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height

      const anchorX = scaleAnchor ? scaleAnchor.x : (e.clientX - rect.left) * scaleX
      const anchorY = scaleAnchor ? scaleAnchor.y : (e.clientY - rect.top) * scaleY

      // Convert anchor to mockup space
      const mockupScaleX = mockupImage.width / canvas.width
      const mockupScaleY = mockupImage.height / canvas.height
      const mockupAnchorX = anchorX * mockupScaleX
      const mockupAnchorY = anchorY * mockupScaleY

      // Calculate offset needed to keep anchor point fixed
      const scaleDiff = newScale - currentTransform.scale
      const offsetX = (mockupAnchorX - currentTransform.x) * (scaleDiff / currentTransform.scale)
      const offsetY = (mockupAnchorY - currentTransform.y) * (scaleDiff / currentTransform.scale)

      newX = currentTransform.x - offsetX
      newY = currentTransform.y - offsetY
    }

    // Update local state immediately (keep scaleX and scaleY at 1.0 for uniform scaling)
    setCurrentTransform(prev => ({ ...prev, scale: newScale, scaleX: 1.0, scaleY: 1.0, x: newX, y: newY }))
  }

  // Touch handlers for pinch-to-zoom
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return null
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      // Pinch gesture
      const distance = getTouchDistance(e.touches)
      if (distance) {
        setLastPinchDistance(distance)
        setPinchInitialScale(currentTransform.scale)
      }
      e.preventDefault()
    } else if (e.touches.length === 1) {
      // Single touch drag
      if (!mockupImage || !currentImage) return

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const touchX = (e.touches[0].clientX - rect.left) * scaleX
      const touchY = (e.touches[0].clientY - rect.top) * scaleY

      setIsDragging(true)
      setDragStart({ x: touchX, y: touchY })
      setDragInitial({ x: currentTransform.x, y: currentTransform.y })
    }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      // Pinch gesture
      const distance = getTouchDistance(e.touches)
      if (distance && lastPinchDistance) {
        const scaleFactor = distance / lastPinchDistance
        const newScale = Math.max(0.05, Math.min(3, pinchInitialScale * scaleFactor))

        // Update local state immediately
        setCurrentTransform(prev => ({ ...prev, scale: newScale }))
      }
      e.preventDefault()
    } else if (e.touches.length === 1 && isDragging) {
      // Single touch drag
      if (!mockupImage) return

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const touchX = (e.touches[0].clientX - rect.left) * scaleX
      const touchY = (e.touches[0].clientY - rect.top) * scaleY

      // Calculate delta in canvas space
      const dx = touchX - dragStart.x
      const dy = touchY - dragStart.y

      // Convert back to mockup space
      const mockupScaleX = mockupImage.width / canvas.width
      const mockupScaleY = mockupImage.height / canvas.height

      const newX = dragInitial.x + (dx * mockupScaleX)
      const newY = dragInitial.y + (dy * mockupScaleY)

      // Update local state immediately for smooth rendering
      setCurrentTransform(prev => ({ ...prev, x: newX, y: newY }))

      e.preventDefault()
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    setLastPinchDistance(null)
  }

  // Handle stretch handle dragging
  const handleStretchMouseDown = (e: React.MouseEvent, handle: 'left' | 'right' | 'top' | 'bottom') => {
    e.stopPropagation()
    e.preventDefault()
    setIsDraggingHandle(handle)
    setHandleDragStart({ x: e.clientX, y: e.clientY })
    setHandleInitialScale({ scaleX: currentTransform.scaleX, scaleY: currentTransform.scaleY })
  }

  // Add global mouse move and up handlers for stretch handles
  useEffect(() => {
    if (!isDraggingHandle) return

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingHandle || !currentImage) return

      const dx = e.clientX - handleDragStart.x
      const dy = e.clientY - handleDragStart.y

      const sensitivity = 0.003

      let newScaleX = handleInitialScale.scaleX
      let newScaleY = handleInitialScale.scaleY

      const horizontalOnly = e.ctrlKey || e.metaKey
      const verticalOnly = e.shiftKey

      if (isDraggingHandle === 'left' || isDraggingHandle === 'right') {
        const direction = isDraggingHandle === 'right' ? 1 : -1
        if (!verticalOnly) {
          newScaleX = Math.max(0.1, Math.min(3, handleInitialScale.scaleX + dx * direction * sensitivity))
        }
      } else {
        const direction = isDraggingHandle === 'bottom' ? 1 : -1
        if (!horizontalOnly) {
          newScaleY = Math.max(0.1, Math.min(3, handleInitialScale.scaleY + dy * direction * sensitivity))
        }
      }

      setCurrentTransform(prev => ({ ...prev, scaleX: newScaleX, scaleY: newScaleY }))
    }

    const handleGlobalMouseUp = () => {
      setIsDraggingHandle(null)
    }

    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', handleGlobalMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDraggingHandle, handleDragStart, handleInitialScale, currentImage])

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
      onClick={handleClose}
    >
      <div
        className="relative max-w-full max-h-full flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Layer Selector, Apply and Close buttons */}
        <div className="mb-4 flex items-center gap-4 bg-gray-800 px-6 py-3 rounded-lg w-full">
          {/* Layer Selector Buttons */}
          <div className="flex gap-2">
            {design1Image && (
              <button
                onClick={() => setActiveLayer('design1')}
                className={`px-3 py-2 text-sm font-medium rounded transition ${
                  activeLayer === 'design1'
                    ? 'bg-green-600 text-white ring-2 ring-green-400'
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
                title="Edit Design 1"
              >
                Design 1
              </button>
            )}
            {design2Image && (
              <button
                onClick={() => setActiveLayer('design2')}
                className={`px-3 py-2 text-sm font-medium rounded transition ${
                  activeLayer === 'design2'
                    ? 'bg-orange-600 text-white ring-2 ring-orange-400'
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
                title="Edit Design 2"
              >
                Design 2
              </button>
            )}
          </div>

          <div className="text-sm text-gray-300 flex-1">
            X: {currentTransform.x.toFixed(0)} • Y: {currentTransform.y.toFixed(0)} • Scale: {currentTransform.scale.toFixed(2)}x •
            Rotation: {currentTransform.rotation}°
          </div>
          <button
            onClick={handleApply}
            className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white font-semibold rounded transition"
            title="Apply changes and close (Cmd/Ctrl+Enter)"
          >
            Apply
          </button>
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded transition"
            title="Close without saving (Esc)"
          >
            Close
          </button>
        </div>

        {/* Canvas with Stretch Handles */}
        <div className="relative bg-gray-900 rounded-lg overflow-visible shadow-2xl" style={{ touchAction: 'none' }}>
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full cursor-move"
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />

          {/* Stretch Handles Overlay */}
          {currentImage && (
            <>
              {/* Left Handle */}
              <div
                className="absolute w-3 h-12 bg-blue-500 hover:bg-blue-400 rounded cursor-ew-resize"
                style={{
                  left: '-6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
                onMouseDown={(e) => handleStretchMouseDown(e, 'left')}
                title="Drag to stretch horizontally (Shift = vertical only)"
              />

              {/* Right Handle */}
              <div
                className="absolute w-3 h-12 bg-blue-500 hover:bg-blue-400 rounded cursor-ew-resize"
                style={{
                  right: '-6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
                onMouseDown={(e) => handleStretchMouseDown(e, 'right')}
                title="Drag to stretch horizontally (Shift = vertical only)"
              />

              {/* Top Handle */}
              <div
                className="absolute w-12 h-3 bg-green-500 hover:bg-green-400 rounded cursor-ns-resize"
                style={{
                  top: '-6px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                }}
                onMouseDown={(e) => handleStretchMouseDown(e, 'top')}
                title="Drag to stretch vertically (Ctrl = horizontal only)"
              />

              {/* Bottom Handle */}
              <div
                className="absolute w-12 h-3 bg-green-500 hover:bg-green-400 rounded cursor-ns-resize"
                style={{
                  bottom: '-6px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                }}
                onMouseDown={(e) => handleStretchMouseDown(e, 'bottom')}
                title="Drag to stretch vertically (Ctrl = horizontal only)"
              />
            </>
          )}
        </div>

        {/* Rotation Control */}
        <div className="mt-4 bg-gray-800 rounded-lg p-4 w-full max-w-md">
          <div className="mb-3">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">Rotation: {currentTransform.rotation}°</label>
              <button
                onClick={() => setCurrentTransform(prev => ({ ...prev, rotation: 0 }))}
                className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 rounded transition"
              >
                Reset to 0°
              </button>
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={currentTransform.rotation}
                onChange={(e) => {
                  const rawValue = parseInt(e.target.value)
                  const snappedValue = snapRotation(rawValue)
                  setCurrentTransform(prev => ({ ...prev, rotation: snappedValue }))
                }}
                className="flex-1"
              />
              <input
                type="number"
                min="0"
                max="360"
                value={currentTransform.rotation}
                onChange={(e) => {
                  const rawValue = parseInt(e.target.value) || 0
                  const clampedValue = Math.max(0, Math.min(360, rawValue))
                  const snappedValue = snapRotation(clampedValue)
                  setCurrentTransform(prev => ({ ...prev, rotation: snappedValue }))
                }}
                className="w-16 px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Snaps at 0°, 90°, 180°, 270° (±2°)
            </p>
          </div>
        </div>

        {/* Instructions */}
        <p className="mt-4 text-xs text-gray-400 text-center max-w-md">
          Drag to move • Scroll to scale • Arrows = nudge • Shift = lock axis
        </p>
        <p className="text-xs text-gray-400 text-center max-w-md">
          <kbd className="bg-gray-700 px-1 rounded">Cmd/Ctrl+Enter</kbd> = Apply • <kbd className="bg-gray-700 px-1 rounded">Esc</kbd> = Close
        </p>
      </div>
    </div>,
    document.body
  )
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

interface MockupCanvasProps {
  sessionId: string
  sellerId: string
}

function MockupCanvas({ sessionId, sellerId }: MockupCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mockupImages, setMockupImages] = useState<HTMLImageElement[]>([])
  const [mockupFiles, setMockupFiles] = useState<ImageFile[]>([]) // Track file metadata with indices
  const [deletedFileNames, setDeletedFileNames] = useState<string[]>([]) // Track files to delete on save
  const [selectedMockupIndex, setSelectedMockupIndex] = useState<number>(0)
  const [mockupImage, setMockupImage] = useState<HTMLImageElement | null>(null)
  const [isLoadingFiles, setIsLoadingFiles] = useState(false) // Changed to false - load on button click

  // Design state
  const [design1, setDesign1] = useState<DesignState>({
    image: null,
    transform: { x: 0, y: 0, scale: 1.0, scaleX: 1.0, scaleY: 1.0, rotation: 0, opacity: 100 },
    blendMode: 'multiply',
    visible: true,
    order: 0,
  })

  const [design2, setDesign2] = useState<DesignState>({
    image: null,
    transform: { x: 0, y: 0, scale: 1.0, scaleX: 1.0, scaleY: 1.0, rotation: 0, opacity: 100 },
    blendMode: 'multiply',
    visible: true,
    order: 1,
  })

  // Active design selector (1 or 2) for main controls panel
  const [activeDesignNumber, setActiveDesignNumber] = useState<1 | 2>(1)

  // Per-mockup position overrides (mockupIndex -> {x, y})
  const [mockupOffsets, setMockupOffsets] = useState<Map<number, { x: number; y: number }>>(new Map())

  // Per-mockup custom transforms (mockupIndex -> custom Transform)
  const [mockupCustomTransforms1, setMockupCustomTransforms1] = useState<Map<number, Transform>>(new Map())
  const [mockupCustomBlendModes1, setMockupCustomBlendModes1] = useState<Map<number, BlendMode>>(new Map())

  const [mockupCustomTransforms2] = useState<Map<number, Transform>>(new Map())
  const [mockupCustomBlendModes2] = useState<Map<number, BlendMode>>(new Map())
  // TODO: These will be used when design selector UI is added

  // Edit mode state
  const [editMode, setEditMode] = useState<{ active: boolean; mockupIndex: number | null }>({ active: false, mockupIndex: null })

  // Edit modal state (standalone modal, separate from edit mode)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editModalMockupIndex, setEditModalMockupIndex] = useState<number | null>(null)

  // Expanded Transform modal state (batch transform for all non-edited mockups)
  const [expandedTransformOpen, setExpandedTransformOpen] = useState(false)

  // Canvas refresh counter to force re-render of preview tiles
  const [canvasRefreshKey, setCanvasRefreshKey] = useState(0)

  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 })
  const [dragInitialPos, setDragInitialPos] = useState({ x: 0, y: 0 })
  const [dragMockupIndex, setDragMockupIndex] = useState<number | null>(null)

  // Load saved files for specific seller (manual trigger)
  const loadSellerMockups = async () => {
    setIsLoadingFiles(true)
    try {
      const response = await fetch(`${API_BASE}/files/${sellerId}/${sessionId}`)
      if (!response.ok) {
        console.log('No server running or no saved files')
        alert('No files found for this session')
        setIsLoadingFiles(false)
        return
      }

      const savedFiles = await response.json()
      if (savedFiles.length === 0) {
        console.log('No saved files found for session')
        alert('No files found for this session')
        setIsLoadingFiles(false)
        return
      }

      // Convert saved files to ImageFile format with full URLs
      const loadedFiles: ImageFile[] = []
      const loadedImages: HTMLImageElement[] = []

      for (const savedFile of savedFiles) {
        try {
          // Load image from public folder
          const img = new Image()
          img.crossOrigin = 'anonymous'

          // Load with fallback between FILE_BASE and API_BASE
          await loadImageWithFallback(`/tmp/${sellerId}/${sessionId}/${savedFile.name}`)

          // Convert to data URL for consistency
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0)
            const dataUrl = canvas.toDataURL('image/png')

            loadedFiles.push({
              id: Math.random().toString(36).substring(2, 11),
              url: dataUrl,
              name: savedFile.name,
              source: 'file',
              index: savedFile.index,
              isFromDatabase: true
            })

            loadedImages.push(img)
          }
        } catch (error) {
          console.error(`Error loading file ${savedFile.name}:`, error)
        }
      }

      if (loadedFiles.length > 0) {
        setMockupFiles(loadedFiles)
        setMockupImages(loadedImages)
        setSelectedMockupIndex(0)
        setMockupImage(loadedImages[0])
        console.log(`Loaded ${loadedFiles.length} saved mockup files for seller ${sellerId}`)
        alert(`Loaded ${loadedFiles.length} mockup(s) for seller ${sellerId}`)
      }
    } catch (error) {
      console.error('Error loading saved files:', error)
      alert('Error loading mockups: ' + (error as Error).message)
    } finally {
      setIsLoadingFiles(false)
    }
  }

  // Handle mockup images loaded from ImageUploader
  const handleMockupImagesLoaded = (images: HTMLImageElement[], files: ImageFile[]) => {
    // Merge with existing files (don't replace)
    const existingFiles = [...mockupFiles]
    const existingImages = [...mockupImages]

    // Calculate next index based on existing files
    const maxIndex = existingFiles.length > 0
      ? Math.max(...existingFiles.map(f => f.index ?? -1))
      : -1

    // Update indices for new files
    const updatedFiles = files.map((file, idx) => ({
      ...file,
      index: maxIndex + 1 + idx,
      isFromDatabase: false
    }))

    setMockupFiles([...existingFiles, ...updatedFiles])
    setMockupImages([...existingImages, ...images])

    // If this is the first upload, select the first image
    if (existingImages.length === 0 && images.length > 0) {
      setSelectedMockupIndex(0)
      setMockupImage(images[0])
    }
  }

  // Update mockup when selection changes
  useEffect(() => {
    if (mockupImages.length > 0) {
      setMockupImage(mockupImages[selectedMockupIndex])
    }
  }, [selectedMockupIndex, mockupImages])

  // Load design 1 image
  const handleDesign1Upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new Image()
        img.onload = () => {
          // Center the design on canvas if mockup is available
          if (mockupImage) {
            // Auto-scale design to fit nicely on mockup (about 30% of mockup size)
            const autoScale = Math.min(mockupImage.width, mockupImage.height) * 0.3 / Math.max(img.width, img.height)

            setDesign1(prev => ({
              ...prev,
              image: img,
              transform: {
                ...prev.transform,
                x: mockupImage.width / 2,
                y: mockupImage.height / 2,
                scale: Math.max(0.1, Math.min(1.5, autoScale)), // Clamp between 0.1 and 1.5
                scaleX: 1.0,
                scaleY: 1.0,
              }
            }))
          } else {
            setDesign1(prev => ({ ...prev, image: img }))
          }
        }
        img.src = event.target?.result as string
      }
      reader.readAsDataURL(file)
    }
  }

  // Load design 2 image
  const handleDesign2Upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new Image()
        img.onload = () => {
          // Center the design on canvas if mockup is available
          if (mockupImage) {
            // Auto-scale design to fit nicely on mockup (about 30% of mockup size)
            const autoScale = Math.min(mockupImage.width, mockupImage.height) * 0.3 / Math.max(img.width, img.height)

            setDesign2(prev => ({
              ...prev,
              image: img,
              transform: {
                ...prev.transform,
                x: mockupImage.width / 2,
                y: mockupImage.height / 2,
                scale: Math.max(0.1, Math.min(1.5, autoScale)), // Clamp between 0.1 and 1.5
                scaleX: 1.0,
                scaleY: 1.0,
              }
            }))
          } else {
            setDesign2(prev => ({ ...prev, image: img }))
          }
        }
        img.src = event.target?.result as string
      }
      reader.readAsDataURL(file)
    }
  }

  // Get effective transform for a design on a specific mockup (considers custom overrides)
  const getEffectiveTransform = (mockupIndex: number, designNum: 1 | 2 = activeDesignNumber): Transform => {
    const customTransforms = designNum === 1 ? mockupCustomTransforms1 : mockupCustomTransforms2
    const design = designNum === 1 ? design1 : design2

    // Check if this mockup has custom transforms
    const customTransform = customTransforms.get(mockupIndex)
    if (customTransform) {
      return customTransform
    }

    // Otherwise use global transform
    return design.transform
  }

  // Get effective blend mode for a design on a specific mockup
  const getEffectiveBlendMode = (mockupIndex: number, designNum: 1 | 2 = activeDesignNumber): BlendMode => {
    const customBlendModes = designNum === 1 ? mockupCustomBlendModes1 : mockupCustomBlendModes2
    const design = designNum === 1 ? design1 : design2

    const customBlendMode = customBlendModes.get(mockupIndex)
    if (customBlendMode) {
      return customBlendMode
    }

    return design.blendMode
  }

  // Helper function to draw a design with per-mockup offsets and custom transforms
  const drawDesign = (
    ctx: CanvasRenderingContext2D,
    mockupIndex: number,
    designNum: 1 | 2
  ) => {
    const design = designNum === 1 ? design1 : design2

    if (!design.image || !design.visible) return

    const pos = getEffectivePosition(mockupIndex, designNum)
    const transform = getEffectiveTransform(mockupIndex, designNum)
    const blendMode = getEffectiveBlendMode(mockupIndex, designNum)

    ctx.save()
    ctx.globalCompositeOperation = blendMode
    ctx.globalAlpha = transform.opacity / 100
    ctx.translate(pos.x, pos.y)
    ctx.rotate((transform.rotation * Math.PI) / 180)
    ctx.scale(transform.scale * transform.scaleX, transform.scale * transform.scaleY)
    ctx.drawImage(
      design.image,
      -design.image.width / 2,
      -design.image.height / 2
    )
    ctx.restore()
  }

  // Delete mockup image
  const deleteMockup = (index: number) => {
    // Check if this file is from the database
    const fileToDelete = mockupFiles[index]
    if (fileToDelete && fileToDelete.isFromDatabase) {
      // Add to deleted files list for batch deletion on save
      setDeletedFileNames(prev => [...prev, fileToDelete.name])
    }

    // Remove from mockup images array
    setMockupImages(prev => prev.filter((_, i) => i !== index))

    // Remove from mockup files array
    setMockupFiles(prev => prev.filter((_, i) => i !== index))

    // Clean up custom transforms for this mockup
    setMockupCustomTransforms1(prev => {
      const newMap = new Map(prev)
      newMap.delete(index)
      // Re-index remaining items
      const reindexed = new Map<number, Transform>()
      Array.from(newMap.entries()).forEach(([idx, transform]) => {
        if (idx > index) {
          reindexed.set(idx - 1, transform)
        } else {
          reindexed.set(idx, transform)
        }
      })
      return reindexed
    })

    setMockupCustomBlendModes1(prev => {
      const newMap = new Map(prev)
      newMap.delete(index)
      const reindexed = new Map<number, BlendMode>()
      Array.from(newMap.entries()).forEach(([idx, blendMode]) => {
        if (idx > index) {
          reindexed.set(idx - 1, blendMode)
        } else {
          reindexed.set(idx, blendMode)
        }
      })
      return reindexed
    })

    setMockupOffsets(prev => {
      const newMap = new Map(prev)
      newMap.delete(index)
      const reindexed = new Map<number, { x: number; y: number }>()
      Array.from(newMap.entries()).forEach(([idx, offset]) => {
        if (idx > index) {
          reindexed.set(idx - 1, offset)
        } else {
          reindexed.set(idx, offset)
        }
      })
      return reindexed
    })

    // Update selected index
    if (selectedMockupIndex >= index && selectedMockupIndex > 0) {
      setSelectedMockupIndex(prev => Math.max(0, prev - 1))
    }

    // Exit edit mode if editing this mockup
    if (editMode.active && editMode.mockupIndex === index) {
      setEditMode({ active: false, mockupIndex: null })
    } else if (editMode.active && editMode.mockupIndex !== null && editMode.mockupIndex > index) {
      setEditMode(prev => ({ ...prev, mockupIndex: prev.mockupIndex! - 1 }))
    }

    setCanvasRefreshKey(prev => prev + 1)
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

    // Draw both designs (order matters - design1 first, then design2 on top)
    drawDesign(ctx, selectedMockupIndex, 1)
    drawDesign(ctx, selectedMockupIndex, 2)
  }, [mockupImage, design1, design2, selectedMockupIndex, mockupOffsets, mockupCustomTransforms1, mockupCustomBlendModes1, mockupCustomTransforms2, mockupCustomBlendModes2])

  // Get effective position for a design on a specific mockup
  const getEffectivePosition = (mockupIndex: number, designNum: 1 | 2 = activeDesignNumber): { x: number; y: number } => {
    const customTransforms = designNum === 1 ? mockupCustomTransforms1 : mockupCustomTransforms2
    const design = designNum === 1 ? design1 : design2

    // Priority 1: Check custom transforms (edit mode)
    const customTransform = customTransforms.get(mockupIndex)
    if (customTransform) {
      return { x: customTransform.x, y: customTransform.y }
    }

    // Priority 2: Check offsets (drag without edit mode)
    const offset = mockupOffsets.get(mockupIndex)
    if (offset) {
      return offset
    }

    // Priority 3: Fall back to global transform
    return { x: design.transform.x, y: design.transform.y }
  }

  // Check if point is inside design's bounding box
  const hitTestDesign = (
    mockupIndex: number,
    mouseX: number,
    mouseY: number
  ): boolean => {
    if (!design1.image || !design1.visible) return false

    const pos = getEffectivePosition(mockupIndex)
    const transform = getEffectiveTransform(mockupIndex)

    // Simple bounding box hit test (ignoring rotation for simplicity)
    const halfWidth = (design1.image.width * transform.scale * transform.scaleX) / 2
    const halfHeight = (design1.image.height * transform.scale * transform.scaleY) / 2

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

    // Check if clicking on design
    const designHit = hitTestDesign(mockupIndex, mouseX, mouseY)

    if (designHit) {
      const pos = getEffectivePosition(mockupIndex)
      setIsDragging(true)
      setDragStartPos({ x: mouseX, y: mouseY })
      setDragInitialPos(pos)
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
      // Update design's custom transform
      setMockupCustomTransforms1(prev => {
        const newMap = new Map(prev)
        const currentTransform = getEffectiveTransform(dragMockupIndex)
        newMap.set(dragMockupIndex, { ...currentTransform, x: newX, y: newY })
        return newMap
      })
    } else {
      // Update position offsets for non-edit-mode drag
      setMockupOffsets(prev => {
        const newMap = new Map(prev)
        newMap.set(dragMockupIndex, { x: newX, y: newY })
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
  }

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDragging) {
        setIsDragging(false)
        setDragMockupIndex(null)
        // Restore original position
        if (dragMockupIndex !== null) {
          setMockupOffsets(prev => {
            const newMap = new Map(prev)
            newMap.delete(dragMockupIndex)
            return newMap
          })
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDragging, dragMockupIndex])

  // Get active design state and setter
  const getActiveDesignState = (): DesignState => {
    return activeDesignNumber === 1 ? design1 : design2
  }

  // Get effective transform and blend mode for the active design (considering edit mode)
  const getActiveEffectiveTransform = (): Transform => {
    if (editMode.active && editMode.mockupIndex !== null) {
      return getEffectiveTransform(editMode.mockupIndex)
    }
    return getActiveDesignState().transform
  }

  const getActiveEffectiveBlendMode = (): BlendMode => {
    if (editMode.active && editMode.mockupIndex !== null) {
      return getEffectiveBlendMode(editMode.mockupIndex)
    }
    return getActiveDesignState().blendMode
  }

  const updateActiveDesignTransform = (updates: Partial<Transform>) => {
    if (editMode.active && editMode.mockupIndex !== null) {
      // Update custom transform for this specific mockup
      const idx = editMode.mockupIndex

      if (activeDesignNumber === 1) {
        setMockupCustomTransforms1(prev => {
          const newMap = new Map(prev)
          const currentTransform = getEffectiveTransform(idx, 1)
          newMap.set(idx, { ...currentTransform, ...updates })
          return newMap
        })
      } else {
        // TODO: Implement Design 2 custom transforms
        // For now, update Design 2 global transform
        setDesign2(prev => ({
          ...prev,
          transform: { ...prev.transform, ...updates }
        }))
      }
      // Force canvas refresh
      setCanvasRefreshKey(prev => prev + 1)
    } else {
      // Update global transform based on active design
      if (activeDesignNumber === 1) {
        setDesign1(prev => ({
          ...prev,
          transform: { ...prev.transform, ...updates }
        }))
      } else {
        setDesign2(prev => ({
          ...prev,
          transform: { ...prev.transform, ...updates }
        }))
      }
      // Force canvas refresh for global changes too
      setCanvasRefreshKey(prev => prev + 1)
    }
  }

  const updateActiveDesignBlendMode = (mode: BlendMode) => {
    if (editMode.active && editMode.mockupIndex !== null) {
      // Update custom blend mode for this specific mockup
      const idx = editMode.mockupIndex

      if (activeDesignNumber === 1) {
        setMockupCustomBlendModes1(prev => {
          const newMap = new Map(prev)
          newMap.set(idx, mode)
          return newMap
        })
      } else {
        // TODO: Implement Design 2 custom blend modes
        // For now, update Design 2 global blend mode
        setDesign2(prev => ({ ...prev, blendMode: mode }))
      }
      setCanvasRefreshKey(prev => prev + 1)
    } else {
      // Update global blend mode based on active design
      if (activeDesignNumber === 1) {
        setDesign1(prev => ({ ...prev, blendMode: mode }))
      } else {
        setDesign2(prev => ({ ...prev, blendMode: mode }))
      }
      setCanvasRefreshKey(prev => prev + 1)
    }
  }

  // Save changes to local public folder (seller-specific)
  const handleSave = async () => {
    // Get newly uploaded files (not from database)
    const newFiles = mockupFiles.filter(file => !file.isFromDatabase)

    try {
      // 1. Upload new files to session folder
      for (const file of newFiles) {
        if (file.file) {
          const formData = new FormData()
          formData.append('file', file.file)
          formData.append('sessionId', sessionId)
          formData.append('sellerId', sellerId)

          const response = await fetch(`${API_BASE}/files/upload`, {
            method: 'POST',
            body: formData
          })

          if (!response.ok) {
            throw new Error(`Failed to upload ${file.name}`)
          }

          const result = await response.json()
          console.log('Uploaded:', result)
        } else {
          // Handle URL-based images - convert data URL to blob
          const response = await fetch(file.url)
          const blob = await response.blob()
          const uploadFile = new File([blob], file.name, { type: blob.type })

          const formData = new FormData()
          formData.append('file', uploadFile)
          formData.append('sessionId', sessionId)
          formData.append('sellerId', sellerId)

          const uploadResponse = await fetch(`${API_BASE}/files/upload`, {
            method: 'POST',
            body: formData
          })

          if (!uploadResponse.ok) {
            throw new Error(`Failed to upload ${file.name}`)
          }

          const result = await uploadResponse.json()
          console.log('Uploaded:', result)
        }
      }

      // 2. Delete files from session folder
      for (const fileName of deletedFileNames) {
        const response = await fetch(`${API_BASE}/files/${sellerId}/${sessionId}/${fileName}`, {
          method: 'DELETE'
        })

        if (!response.ok) {
          throw new Error(`Failed to delete ${fileName}`)
        }

        const result = await response.json()
        console.log('Deleted:', result)
      }

      // After successful save, update state
      setMockupFiles(prev => prev.map(file => ({ ...file, isFromDatabase: true })))
      setDeletedFileNames([])

      alert('Changes saved successfully!\n\n' +
            'New files uploaded: ' + newFiles.length + '\n' +
            'Files deleted: ' + deletedFileNames.length)
    } catch (error) {
      console.error('Save error:', error)
      alert('Error saving files: ' + (error as Error).message + '\n\nMake sure the server is running: npm run server')
    }
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

        // Draw both designs
        drawDesign(ctx, index, 1)
        drawDesign(ctx, index, 2)

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
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Controls Panel - Left Sidebar */}
      <div className="lg:w-96 bg-gray-800 rounded-lg p-6 space-y-6 lg:sticky lg:top-6 lg:self-start">
        {/* File Uploads */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Upload Images</h2>
            <div className="text-sm text-gray-400">
              Seller ID: <span className="text-blue-400 font-semibold">{sellerId}</span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Action Buttons Row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Show Mockup Button */}
              <button
                onClick={loadSellerMockups}
                disabled={isLoadingFiles}
                className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded transition text-sm"
              >
                {isLoadingFiles ? 'Loading...' : `Show Mockup`}
              </button>

              {/* Save Changes Button */}
              <button
                onClick={handleSave}
                disabled={mockupFiles.filter(f => !f.isFromDatabase).length === 0 && deletedFileNames.length === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded transition text-sm"
              >
                Save Changes
              </button>
            </div>

            {/* Unsaved Changes Info */}
            {(mockupFiles.filter(f => !f.isFromDatabase).length > 0 || deletedFileNames.length > 0) && (
              <div className="bg-gray-700 rounded-lg p-3">
                <h4 className="text-sm font-semibold mb-2 text-yellow-400">Unsaved Changes:</h4>
                <div className="text-xs text-gray-400 space-y-1">
                  {mockupFiles.filter(f => !f.isFromDatabase).length > 0 && (
                    <p>• {mockupFiles.filter(f => !f.isFromDatabase).length} new file(s) to upload</p>
                  )}
                  {deletedFileNames.length > 0 && (
                    <p>• {deletedFileNames.length} file(s) to delete</p>
                  )}
                </div>
              </div>
            )}

            {/* Mockup Image Uploader */}
            <ImageUploader
              onImagesLoaded={handleMockupImagesLoaded}
              label="Mockup Images"
              accept="image/*"
            />

            {/* Design 1 Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Design 1 (transparent PNG)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleDesign1Upload}
                className="block w-full text-sm text-gray-400 border border-gray-600 rounded px-3 py-2 bg-gray-700 hover:bg-gray-600 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={mockupImages.length === 0}
              />
              {design1.image && (
                <p className="text-xs text-green-400 mt-1">
                  ✓ Design 1 loaded: {design1.image.width} x {design1.image.height}px
                </p>
              )}
            </div>

            {/* Design 2 Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Design 2 (transparent PNG)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleDesign2Upload}
                className="block w-full text-sm text-gray-400 border border-gray-600 rounded px-3 py-2 bg-gray-700 hover:bg-gray-600 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-orange-600 file:text-white hover:file:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={mockupImages.length === 0}
              />
              {design2.image && (
                <p className="text-xs text-orange-400 mt-1">
                  ✓ Design 2 loaded: {design2.image.width} x {design2.image.height}px
                </p>
              )}
            </div>
          </div>
        </div>


        {/* Design Controls */}
        {design1.image && mockupImages.length > 0 && (
          <>
            <div>
              <h2 className="text-xl font-semibold mb-4">
                Transform
                {editMode.active && editMode.mockupIndex !== null && (
                  <span className="text-sm text-blue-400 ml-2">(Mockup {editMode.mockupIndex + 1})</span>
                )}
              </h2>

              <div className="space-y-4">
                {/* Design Selector Buttons */}
                {(design1.image || design2.image) && (
                  <div className="flex gap-2">
                    {design1.image && (
                      <button
                        onClick={() => setActiveDesignNumber(1)}
                        className={`flex-1 py-2 px-3 rounded text-sm font-medium transition ${
                          activeDesignNumber === 1
                            ? 'bg-green-600 text-white ring-2 ring-green-400'
                            : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                        }`}
                      >
                        Design 1
                      </button>
                    )}
                    {design2.image && (
                      <button
                        onClick={() => setActiveDesignNumber(2)}
                        className={`flex-1 py-2 px-3 rounded text-sm font-medium transition ${
                          activeDesignNumber === 2
                            ? 'bg-orange-600 text-white ring-2 ring-orange-400'
                            : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                        }`}
                      >
                        Design 2
                      </button>
                    )}
                  </div>
                )}

                {/* Interactive Preview Box */}
                <InteractivePreview
                  mockupImage={mockupImage}
                  designImage={design1.image}
                  design2Image={design2.image}
                  design1Transform={getActiveEffectiveTransform()}
                  design2Transform={design2.transform}
                  design1BlendMode={getActiveEffectiveBlendMode()}
                  design2BlendMode={design2.blendMode}
                  activeLayer={activeDesignNumber === 1 ? 'design1' : 'design2'}
                  onDesign1TransformChange={updateActiveDesignTransform}
                  onDesign2TransformChange={updateActiveDesignTransform}
                />

                {/* Expand Button */}
                <div>
                  <button
                    onClick={() => setExpandedTransformOpen(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition"
                    title="Open expanded Transform window"
                  >
                    Expand Transform
                  </button>
                  <p className="text-xs text-gray-400 mt-1">
                    Apply transform to all non-edited mockups
                  </p>
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
                {/* Export Button */}
                <button
                  onClick={handleExport}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded transition"
                >
                  Download ZIP
                </button>

                <div className="bg-gray-700 rounded-lg p-3">
                  <h4 className="text-sm font-semibold mb-2">Export Info:</h4>
                  <div className="text-xs text-gray-400 space-y-1">
                    <p>• {mockupImages.length} mockup images</p>
                    {design1.image && (
                      <p>• Design: {design1.image.width}×{design1.image.height}px {design1.visible ? '' : '(hidden)'}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Mockup Grid Area - Right Column (Fluid) */}
      <div className="flex-1 bg-gray-800 rounded-lg p-6">
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
                {design1.image && ` • Design loaded`}
              </p>
            </div>

            {/* Edit Mode Header */}
            {editMode.active && editMode.mockupIndex !== null && (
              <div className="bg-blue-900 rounded-lg p-4">
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
                    setMockupCustomBlendModes1(prev => {
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

            {/* Mockup grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" key={`grid-${canvasRefreshKey}`}>
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

                // Draw design (scaled to preview with per-mockup offsets)
                const scaleX = previewWidth / mockupImg.width
                const scaleY = previewHeight / mockupImg.height

                // Draw design 1
                if (design1.image && design1.visible) {
                  const pos = getEffectivePosition(index, 1)
                  const transform = getEffectiveTransform(index, 1)
                  const blendMode = getEffectiveBlendMode(index, 1)

                  ctx.save()
                  ctx.globalCompositeOperation = blendMode
                  ctx.globalAlpha = transform.opacity / 100
                  ctx.translate(pos.x * scaleX, pos.y * scaleY)
                  ctx.rotate((transform.rotation * Math.PI) / 180)
                  ctx.scale(transform.scale * transform.scaleX * scaleX, transform.scale * transform.scaleY * scaleY)
                  ctx.drawImage(
                    design1.image,
                    -design1.image.width / 2,
                    -design1.image.height / 2
                  )
                  ctx.restore()
                }

                // Draw design 2
                if (design2.image && design2.visible) {
                  const pos = getEffectivePosition(index, 2)
                  const transform = getEffectiveTransform(index, 2)
                  const blendMode = getEffectiveBlendMode(index, 2)

                  ctx.save()
                  ctx.globalCompositeOperation = blendMode
                  ctx.globalAlpha = transform.opacity / 100
                  ctx.translate(pos.x * scaleX, pos.y * scaleY)
                  ctx.rotate((transform.rotation * Math.PI) / 180)
                  ctx.scale(transform.scale * transform.scaleX * scaleX, transform.scale * transform.scaleY * scaleY)
                  ctx.drawImage(
                    design2.image,
                    -design2.image.width / 2,
                    -design2.image.height / 2
                  )
                  ctx.restore()
                }

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
                      {!isDragging && (mockupCustomTransforms1.has(index) || mockupCustomBlendModes1.has(index)) && (
                        <div className="absolute top-2 left-2 bg-yellow-500 text-black px-2 py-1 rounded text-xs font-semibold pointer-events-none">
                          Edited
                        </div>
                      )}
                      {isDragging && dragMockupIndex === index && (
                        <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs font-mono pointer-events-none">
                          Moving Design
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
                      {design1.image && (
                        <div className="flex justify-center space-x-2 text-xs">
                          {design1.image && design1.visible && (
                            <span className="text-green-400">✓ Design</span>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2">
                        {design1.image && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditModalMockupIndex(index)
                              setEditModalOpen(true)
                              setSelectedMockupIndex(index)
                            }}
                            className="flex-1 text-xs py-2 rounded transition bg-gray-600 hover:bg-gray-500 text-white"
                          >
                            ✏️ Edit
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm(`Delete Mockup ${index + 1}?`)) {
                              deleteMockup(index)
                            }
                          }}
                          className="px-3 text-xs py-2 rounded transition bg-red-600 hover:bg-red-700 text-white"
                          title="Delete mockup"
                        >
                          🗑️
                        </button>
                      </div>
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
                      {design1.image ? `${design1.image.width}×${design1.image.height}px` : 'None'}
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

      {/* Edit Modal - Standalone popup triggered by Edit button */}
      {editModalOpen && editModalMockupIndex !== null && (
        <EditModal
          mockupImage={mockupImages[editModalMockupIndex]}
          design1Image={design1.image}
          design2Image={design2.image}
          design1Transform={getEffectiveTransform(editModalMockupIndex, 1)}
          design2Transform={getEffectiveTransform(editModalMockupIndex, 2)}
          onDesign1TransformChange={(transform: Transform) => {
            const idx = editModalMockupIndex
            setMockupCustomTransforms1(prev => {
              const newMap = new Map(prev)
              newMap.set(idx, transform)
              return newMap
            })
            setCanvasRefreshKey(prev => prev + 1)
          }}
          onDesign2TransformChange={(transform: Transform) => {
            // TODO: Implement Design 2 custom transforms per mockup
            // For now, update Design 2 global transform
            setDesign2(prev => ({
              ...prev,
              transform
            }))
            setCanvasRefreshKey(prev => prev + 1)
          }}
          onClose={() => {
            setEditModalOpen(false)
            setEditModalMockupIndex(null)
          }}
        />
      )}

      {/* Expanded Transform Modal - Batch transform for all non-edited mockups */}
      {expandedTransformOpen && mockupImage && (
        <ExpandedTransformModal
          mockupImage={mockupImage}
          designImage={design1.image}
          design2Image={design2.image}
          design1Transform={design1.transform}
          design2Transform={design2.transform}
          activeLayer={activeDesignNumber === 1 ? 'design1' : 'design2'}
          onApply={(design1Updates: Partial<Transform>, design2Updates: Partial<Transform>) => {
            // Apply to all mockups that haven't been individually edited
            // Individually edited mockups are those in mockupCustomTransforms map

            // Update Design 1 global transform if there are changes
            if (Object.keys(design1Updates).length > 0) {
              setDesign1(prev => ({
                ...prev,
                transform: { ...prev.transform, ...design1Updates }
              }))
            }

            // Update Design 2 global transform if there are changes
            if (Object.keys(design2Updates).length > 0) {
              setDesign2(prev => ({
                ...prev,
                transform: { ...prev.transform, ...design2Updates }
              }))
            }

            // DO NOT update custom transforms - those are individually edited
            // and should be excluded from batch transform

            setCanvasRefreshKey(prev => prev + 1)
          }}
          onClose={() => setExpandedTransformOpen(false)}
        />
      )}
    </div>
  )
}

export default MockupCanvas
