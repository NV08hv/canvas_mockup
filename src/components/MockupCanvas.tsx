import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import JSZip from 'jszip'

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
  transform: Transform
  onTransformChange: (updates: Partial<Transform>) => void
}

function InteractivePreview({ mockupImage, designImage, transform, onTransformChange }: InteractivePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragInitial, setDragInitial] = useState({ x: 0, y: 0 })
  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(null)
  const [pinchInitialScale, setPinchInitialScale] = useState(1)

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

    // Draw design if available
    if (designImage) {
      ctx.save()
      ctx.globalAlpha = transform.opacity / 100
      ctx.translate(transform.x * scaleX, transform.y * scaleY)
      ctx.rotate((transform.rotation * Math.PI) / 180)
      ctx.scale(transform.scale * transform.scaleX * scaleX, transform.scale * transform.scaleY * scaleY)
      ctx.drawImage(
        designImage,
        -designImage.width / 2,
        -designImage.height / 2
      )
      ctx.restore()
    }
  }, [mockupImage, designImage, transform])

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!mockupImage || !designImage) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mouseX = (e.clientX - rect.left) * scaleX
    const mouseY = (e.clientY - rect.top) * scaleY

    setIsDragging(true)
    setDragStart({ x: mouseX, y: mouseY })
    setDragInitial({ x: transform.x, y: transform.y })
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

    // Update global state immediately to affect all mockups
    onTransformChange({ x: newX, y: newY })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()

    // Determine scroll direction and amount
    const delta = -e.deltaY * 0.001
    const newScale = Math.max(0.05, Math.min(3, transform.scale + delta))

    // Update global state immediately to affect all mockups
    onTransformChange({ scale: newScale })
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
        setPinchInitialScale(transform.scale)
      }
      e.preventDefault()
    } else if (e.touches.length === 1) {
      // Single touch drag
      if (!mockupImage || !designImage) return

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const touchX = (e.touches[0].clientX - rect.left) * scaleX
      const touchY = (e.touches[0].clientY - rect.top) * scaleY

      setIsDragging(true)
      setDragStart({ x: touchX, y: touchY })
      setDragInitial({ x: transform.x, y: transform.y })
    }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      // Pinch gesture
      const distance = getTouchDistance(e.touches)
      if (distance && lastPinchDistance) {
        const scaleFactor = distance / lastPinchDistance
        const newScale = Math.max(0.05, Math.min(3, pinchInitialScale * scaleFactor))

        // Update global state immediately to affect all mockups
        onTransformChange({ scale: newScale })
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

      // Update global state immediately to affect all mockups
      onTransformChange({ x: newX, y: newY })

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
            X: {transform.x.toFixed(0)} • Y: {transform.y.toFixed(0)} • Scale: {transform.scale.toFixed(2)}x • ScaleX: {transform.scaleX.toFixed(2)} • ScaleY: {transform.scaleY.toFixed(2)}
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
        Drag to move • Scroll or pinch to scale
      </p>
    </div>
  )
}

// Edit Modal Component (standalone, triggered by Edit button)
interface EditModalProps {
  mockupImage: HTMLImageElement | null
  designImage: HTMLImageElement | null
  transform: Transform
  onTransformChange: (updates: Partial<Transform>) => void
  onClose: () => void
}

function EditModal({ mockupImage, designImage, transform, onTransformChange, onClose }: EditModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragInitial, setDragInitial] = useState({ x: 0, y: 0 })
  // Local state: clone transform on open, only commit on Apply
  const [localTransform, setLocalTransform] = useState<Transform>(() => ({ ...transform }))
  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(null)
  const [pinchInitialScale, setPinchInitialScale] = useState(1)
  const [scaleAnchor, setScaleAnchor] = useState<{ x: number; y: number } | null>(null)
  const [isDraggingHandle, setIsDraggingHandle] = useState<'left' | 'right' | 'top' | 'bottom' | null>(null)
  const [handleDragStart, setHandleDragStart] = useState({ x: 0, y: 0 })
  const [handleInitialScale, setHandleInitialScale] = useState({ scaleX: 1, scaleY: 1 })

  // Helper function to snap rotation to cardinal angles (0, 90, 180, 270)
  const snapRotation = (angle: number): number => {
    const cardinalAngles = [0, 90, 180, 270, 360]
    const snapTolerance = 2 // ±2° tolerance

    for (const cardinal of cardinalAngles) {
      if (Math.abs(angle - cardinal) <= snapTolerance) {
        return cardinal % 360
      }
    }
    return angle % 360
  }

  // Block body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  // Handle keyboard shortcuts (Escape, Enter, and arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      // Enter or Ctrl+Enter to Apply
      if (e.key === 'Enter' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault()
        onTransformChange(localTransform)
        onClose()
        return
      }

      // Arrow key nudging
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()

        if (!mockupImage) return

        const nudgeAmount = e.shiftKey ? 10 : 1 // Shift for larger nudges
        let dx = 0
        let dy = 0

        switch (e.key) {
          case 'ArrowLeft':
            dx = -nudgeAmount
            break
          case 'ArrowRight':
            dx = nudgeAmount
            break
          case 'ArrowUp':
            dy = -nudgeAmount
            break
          case 'ArrowDown':
            dy = nudgeAmount
            break
        }

        const newX = localTransform.x + dx
        const newY = localTransform.y + dy

        // Update local state immediately
        setLocalTransform(prev => ({ ...prev, x: newX, y: newY }))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, onTransformChange, localTransform, mockupImage])

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

    // Draw design if available
    if (designImage) {
      ctx.save()
      ctx.globalAlpha = localTransform.opacity / 100
      ctx.translate(localTransform.x * scaleX, localTransform.y * scaleY)
      ctx.rotate((localTransform.rotation * Math.PI) / 180)
      ctx.scale(localTransform.scale * localTransform.scaleX * scaleX, localTransform.scale * localTransform.scaleY * scaleY)
      ctx.drawImage(
        designImage,
        -designImage.width / 2,
        -designImage.height / 2
      )
      ctx.restore()
    }
  }, [mockupImage, designImage, localTransform])

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!mockupImage || !designImage) return

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
    setLocalTransform(prev => ({ ...prev, x: newX, y: newY }))
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
    let newScale = Math.max(0.05, Math.min(3, localTransform.scale + delta))

    let newX = localTransform.x
    let newY = localTransform.y

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
      const scaleDiff = newScale - localTransform.scale
      const offsetX = (mockupAnchorX - localTransform.x) * (scaleDiff / localTransform.scale)
      const offsetY = (mockupAnchorY - localTransform.y) * (scaleDiff / localTransform.scale)

      newX = localTransform.x - offsetX
      newY = localTransform.y - offsetY
    }

    // Update local state immediately (keep scaleX and scaleY at 1.0 for uniform scaling)
    setLocalTransform(prev => ({ ...prev, scale: newScale, scaleX: 1.0, scaleY: 1.0, x: newX, y: newY }))
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
      if (!mockupImage || !designImage) return

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
    setHandleInitialScale({ scaleX: localTransform.scaleX, scaleY: localTransform.scaleY })
  }

  // Add global mouse move and up handlers for stretch handles
  useEffect(() => {
    if (!isDraggingHandle) return

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingHandle || !designImage) return

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

      setLocalTransform(prev => ({ ...prev, scaleX: newScaleX, scaleY: newScaleY }))
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
  }, [isDraggingHandle, handleDragStart, handleInitialScale, designImage, onTransformChange])

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        className="relative max-w-full max-h-full flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with live readouts and buttons */}
        <div className="mb-4 flex items-center gap-4 bg-gray-800 px-6 py-3 rounded-lg">
          <div className="text-sm text-gray-300">
            X: {localTransform.x.toFixed(0)} • Y: {localTransform.y.toFixed(0)} • Scale: {localTransform.scale.toFixed(2)}x • ScaleX: {localTransform.scaleX.toFixed(2)} • ScaleY: {localTransform.scaleY.toFixed(2)} • Rotation: {localTransform.rotation}°
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onTransformChange(localTransform)
              onClose()
            }}
            className="ml-auto px-4 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition"
            title="Apply changes (Enter)"
          >
            Apply
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition"
            title="Close (Esc)"
          >
            × Close
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
          {designImage && (
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

        {/* Rotation Controls */}
        <div className="mt-4 w-full max-w-md bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-4 mb-2">
            <label className="text-sm font-medium text-gray-300 whitespace-nowrap">Rotation</label>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={localTransform.rotation}
              onChange={(e) => {
                const angle = parseInt(e.target.value)
                const snappedAngle = snapRotation(angle)
                setLocalTransform(prev => ({ ...prev, rotation: snappedAngle }))
              }}
              className="flex-1"
            />
            <input
              type="number"
              min="0"
              max="360"
              value={localTransform.rotation}
              onChange={(e) => {
                let angle = parseInt(e.target.value) || 0
                angle = Math.max(0, Math.min(360, angle))
                const snappedAngle = snapRotation(angle)
                setLocalTransform(prev => ({ ...prev, rotation: snappedAngle }))
              }}
              className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white text-center"
            />
            <span className="text-sm text-gray-400">°</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setLocalTransform(prev => ({ ...prev, rotation: 0 }))
              }}
              className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded transition"
              title="Reset rotation to 0°"
            >
              Reset
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center">
            Snaps to 0°, 90°, 180°, 270° within ±2°
          </p>
        </div>

        {/* Instructions */}
        <p className="mt-4 text-xs text-gray-400 text-center">
          Drag to move • Scroll to scale • Blue handles = horizontal stretch • Green handles = vertical stretch
        </p>
        <p className="text-xs text-gray-400 text-center">
          Arrows = nudge • Shift = lock axis • Alt = scale from center • Ctrl/Shift on handles = constrain • Esc to close
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

function MockupCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mockupImages, setMockupImages] = useState<HTMLImageElement[]>([])
  const [selectedMockupIndex, setSelectedMockupIndex] = useState<number>(0)
  const [mockupImage, setMockupImage] = useState<HTMLImageElement | null>(null)
  const [imageUrl, setImageUrl] = useState<string>('')
  const [isLoadingUrl, setIsLoadingUrl] = useState(false)

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

  // Per-mockup position overrides (mockupIndex -> {x, y})
  const [mockupOffsets, setMockupOffsets] = useState<Map<number, { x: number; y: number }>>(new Map())

  // Per-mockup custom transforms (mockupIndex -> custom Transform)
  const [mockupCustomTransforms1, setMockupCustomTransforms1] = useState<Map<number, Transform>>(new Map())
  const [mockupCustomBlendModes1, setMockupCustomBlendModes1] = useState<Map<number, BlendMode>>(new Map())
  const [mockupCustomTransforms2, setMockupCustomTransforms2] = useState<Map<number, Transform>>(new Map())
  const [mockupCustomBlendModes2, setMockupCustomBlendModes2] = useState<Map<number, BlendMode>>(new Map())

  // Edit mode state
  const [editMode, setEditMode] = useState<{ active: boolean; mockupIndex: number | null }>({ active: false, mockupIndex: null })

  // Edit modal state (standalone modal, separate from edit mode)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editModalMockupIndex, setEditModalMockupIndex] = useState<number | null>(null)

  // Canvas refresh counter to force re-render of preview tiles
  const [canvasRefreshKey, setCanvasRefreshKey] = useState(0)

  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 })
  const [dragInitialPos, setDragInitialPos] = useState({ x: 0, y: 0 })
  const [dragMockupIndex, setDragMockupIndex] = useState<number | null>(null)
  const [draggedDesign, setDraggedDesign] = useState<'design1' | 'design2' | null>(null)

  // Helper function to add images to the mockup list
  const addMockupImages = (newImages: HTMLImageElement[]) => {
    setMockupImages(prev => {
      const combined = [...prev, ...newImages]
      return combined
    })
    // If this is the first image being added, select it
    if (mockupImages.length === 0 && newImages.length > 0) {
      setSelectedMockupIndex(0)
      setMockupImage(newImages[0])
    }
  }

  // Load mockup images from files
  const handleMockupFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

            // If all images are loaded, add them to the list
            if (completedCount === imageFiles.length) {
              addMockupImages(loadedImages.filter(img => img !== undefined))
            }
          }
          img.onerror = () => {
            completedCount++
            if (completedCount === imageFiles.length) {
              addMockupImages(loadedImages.filter(img => img !== undefined))
            }
          }
          img.src = event.target?.result as string
        }

        reader.onerror = () => {
          completedCount++
          if (completedCount === imageFiles.length) {
            addMockupImages(loadedImages.filter(img => img !== undefined))
          }
        }

        reader.readAsDataURL(file)
      })
    }
  }

  // Load mockup images from folder
  const handleMockupFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleMockupFilesUpload(e)
  }

  // Load mockup image from URL
  const handleAddImageUrl = () => {
    if (!imageUrl.trim()) return

    setIsLoadingUrl(true)
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      addMockupImages([img])
      setImageUrl('')
      setIsLoadingUrl(false)
    }

    img.onerror = () => {
      alert('Failed to load image from URL. Please check the URL and try again.')
      setIsLoadingUrl(false)
    }

    img.src = imageUrl.trim()
  }

  // Update mockup when selection changes
  useEffect(() => {
    if (mockupImages.length > 0) {
      setMockupImage(mockupImages[selectedMockupIndex])
    }
  }, [selectedMockupIndex, mockupImages])

  // Load design 1 image
  const handleDesignUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  const getEffectiveTransform = (mockupIndex: number): Transform => {
    // Check if this mockup has custom transforms
    const customTransform = mockupCustomTransforms1.get(mockupIndex)
    if (customTransform) {
      return customTransform
    }

    // Otherwise use global transform
    return design1.transform
  }

  // Get effective blend mode for a design on a specific mockup
  const getEffectiveBlendMode = (mockupIndex: number): BlendMode => {
    const customBlendMode = mockupCustomBlendModes1.get(mockupIndex)
    if (customBlendMode) {
      return customBlendMode
    }

    return design1.blendMode
  }

  // Helper function to draw both designs with per-mockup offsets and custom transforms
  const drawDesign = (
    ctx: CanvasRenderingContext2D,
    mockupIndex: number
  ) => {
    // Draw design1
    if (design1.image && design1.visible) {
      const pos = getEffectivePosition(mockupIndex)
      const transform = getEffectiveTransform(mockupIndex)
      const blendMode = getEffectiveBlendMode(mockupIndex)

      ctx.save()
      ctx.globalCompositeOperation = blendMode
      ctx.globalAlpha = transform.opacity / 100
      ctx.translate(pos.x, pos.y)
      ctx.rotate((transform.rotation * Math.PI) / 180)
      ctx.scale(transform.scale * transform.scaleX, transform.scale * transform.scaleY)
      ctx.drawImage(
        design1.image,
        -design1.image.width / 2,
        -design1.image.height / 2
      )
      ctx.restore()
    }

    // Draw design2
    if (design2.image && design2.visible) {
      const customTransform2 = mockupCustomTransforms2.get(mockupIndex)
      const customBlendMode2 = mockupCustomBlendModes2.get(mockupIndex)

      const transform2 = customTransform2 || design2.transform
      const blendMode2 = customBlendMode2 || design2.blendMode

      ctx.save()
      ctx.globalCompositeOperation = blendMode2
      ctx.globalAlpha = transform2.opacity / 100
      ctx.translate(transform2.x, transform2.y)
      ctx.rotate((transform2.rotation * Math.PI) / 180)
      ctx.scale(transform2.scale * transform2.scaleX, transform2.scale * transform2.scaleY)
      ctx.drawImage(
        design2.image,
        -design2.image.width / 2,
        -design2.image.height / 2
      )
      ctx.restore()
    }
  }

  // Delete mockup image
  const deleteMockup = (index: number) => {
    // Remove from mockup images array
    setMockupImages(prev => prev.filter((_, i) => i !== index))

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

    // Draw both designs
    drawDesign(ctx, selectedMockupIndex)
  }, [mockupImage, design1, design2, selectedMockupIndex, mockupOffsets, mockupCustomTransforms1, mockupCustomBlendModes1, mockupCustomTransforms2, mockupCustomBlendModes2])

  // Get effective position for a design on a specific mockup
  const getEffectivePosition = (mockupIndex: number): { x: number; y: number } => {
    // Priority 1: Check custom transforms (edit mode)
    const customTransform = mockupCustomTransforms1.get(mockupIndex)
    if (customTransform) {
      return { x: customTransform.x, y: customTransform.y }
    }

    // Priority 2: Check offsets (drag without edit mode)
    const offset = mockupOffsets.get(mockupIndex)
    if (offset) {
      return offset
    }

    // Priority 3: Fall back to global transform
    return { x: design1.transform.x, y: design1.transform.y }
  }

  // Check if point is inside design's bounding box
  // Returns which design was hit: 'design1', 'design2', or null
  const hitTestDesign = (
    mockupIndex: number,
    mouseX: number,
    mouseY: number
  ): 'design1' | 'design2' | null => {
    // Check design2 first (it has higher order, so it's on top)
    if (design2.image && design2.visible) {
      const customTransform2 = mockupCustomTransforms2.get(mockupIndex)
      const transform2 = customTransform2 || design2.transform

      const halfWidth2 = (design2.image.width * transform2.scale * transform2.scaleX) / 2
      const halfHeight2 = (design2.image.height * transform2.scale * transform2.scaleY) / 2

      if (
        mouseX >= transform2.x - halfWidth2 &&
        mouseX <= transform2.x + halfWidth2 &&
        mouseY >= transform2.y - halfHeight2 &&
        mouseY <= transform2.y + halfHeight2
      ) {
        return 'design2'
      }
    }

    // Check design1 (lower order, behind design2)
    if (design1.image && design1.visible) {
      const pos = getEffectivePosition(mockupIndex)
      const transform = getEffectiveTransform(mockupIndex)

      const halfWidth = (design1.image.width * transform.scale * transform.scaleX) / 2
      const halfHeight = (design1.image.height * transform.scale * transform.scaleY) / 2

      if (
        mouseX >= pos.x - halfWidth &&
        mouseX <= pos.x + halfWidth &&
        mouseY >= pos.y - halfHeight &&
        mouseY <= pos.y + halfHeight
      ) {
        return 'design1'
      }
    }

    return null
  }

  // Mouse drag handlers for canvas
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>, mockupIndex: number) => {
    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mouseX = (e.clientX - rect.left) * scaleX
    const mouseY = (e.clientY - rect.top) * scaleY

    // Check which design was clicked
    const designHit = hitTestDesign(mockupIndex, mouseX, mouseY)

    if (designHit) {
      let pos: { x: number; y: number }

      if (designHit === 'design2') {
        const customTransform2 = mockupCustomTransforms2.get(mockupIndex)
        const transform2 = customTransform2 || design2.transform
        pos = { x: transform2.x, y: transform2.y }
      } else {
        pos = getEffectivePosition(mockupIndex)
      }

      setIsDragging(true)
      setDragStartPos({ x: mouseX, y: mouseY })
      setDragInitialPos(pos)
      setDragMockupIndex(mockupIndex)
      setDraggedDesign(designHit)
      e.preventDefault()
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || dragMockupIndex === null || !draggedDesign) return

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

    if (draggedDesign === 'design2') {
      // Update design2's position
      setMockupCustomTransforms2(prev => {
        const newMap = new Map(prev)
        const currentTransform = mockupCustomTransforms2.get(dragMockupIndex) || design2.transform
        newMap.set(dragMockupIndex, { ...currentTransform, x: newX, y: newY })
        return newMap
      })
    } else {
      // Update design1's position (existing logic)
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
  }

  const handleCanvasMouseUp = () => {
    if (isDragging) {
      setCanvasRefreshKey(prev => prev + 1)
    }
    setIsDragging(false)
    setDragMockupIndex(null)
    setDraggedDesign(null)
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
    return design1
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

      setMockupCustomTransforms1(prev => {
        const newMap = new Map(prev)
        const currentTransform = getEffectiveTransform(idx)
        newMap.set(idx, { ...currentTransform, ...updates })
        return newMap
      })
      // Force canvas refresh
      setCanvasRefreshKey(prev => prev + 1)
    } else {
      // Update global transform
      setDesign1(prev => ({
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

      setMockupCustomBlendModes1(prev => {
        const newMap = new Map(prev)
        newMap.set(idx, mode)
        return newMap
      })
      setCanvasRefreshKey(prev => prev + 1)
    } else {
      // Update global blend mode
      setDesign1(prev => ({ ...prev, blendMode: mode }))
      setCanvasRefreshKey(prev => prev + 1)
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

        // Draw design
        drawDesign(ctx, index)

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
          <h2 className="text-xl font-semibold mb-4">Upload Images</h2>

          <div className="space-y-4">
            {/* Mockup Images Section */}
            <div className="bg-gray-700 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">Mockup Images</h3>

              {/* 1. Files Upload */}
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-300">
                  1️⃣ Upload Files
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleMockupFilesUpload}
                  className="block w-full text-sm border border-gray-600 rounded px-3 py-2 bg-gray-600 hover:bg-gray-500 cursor-pointer file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
                />
              </div>

              {/* 2. Folder Upload */}
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-300">
                  2️⃣ Upload Folder
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  // @ts-ignore - webkitdirectory is not in React types but works in browsers
                  webkitdirectory="true"
                  directory="true"
                  onChange={handleMockupFolderUpload}
                  className="block w-full text-sm border border-gray-600 rounded px-3 py-2 bg-gray-600 hover:bg-gray-500 cursor-pointer file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
                  style={{ color: 'transparent' }}
                />
              </div>

              {/* 3. Image URL */}
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-300">
                  3️⃣ Image URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddImageUrl()
                      }
                    }}
                    placeholder="https://example.com/image.png"
                    className="flex-1 bg-gray-600 border border-gray-500 rounded px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoadingUrl}
                  />
                  <button
                    onClick={handleAddImageUrl}
                    disabled={!imageUrl.trim() || isLoadingUrl}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-semibold rounded transition"
                  >
                    {isLoadingUrl ? 'Loading...' : 'Add'}
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-600">
                {mockupImages.length > 0
                  ? `${mockupImages.length} mockup(s) loaded`
                  : 'No images loaded yet'
                }
              </p>
            </div>

            {/* Design 1 Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Design 1 (transparent PNG)
              </label>
              <input
                type="file"
                accept=".png,image/png"
                onChange={handleDesignUpload}
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
                accept=".png,image/png"
                onChange={handleDesign2Upload}
                className="block w-full text-sm text-gray-400 border border-gray-600 rounded px-3 py-2 bg-gray-700 hover:bg-gray-600 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={mockupImages.length === 0}
              />
              {design2.image && (
                <p className="text-xs text-green-400 mt-1">
                  ✓ Design 2 loaded: {design2.image.width} x {design2.image.height}px
                </p>
              )}
            </div>
          </div>
        </div>


        {/* Design 1 Controls */}
        {design1.image && mockupImages.length > 0 && (
          <>
            <div>
              <h2 className="text-xl font-semibold mb-4">
                Design 1 Transform
                {editMode.active && editMode.mockupIndex !== null && (
                  <span className="text-sm text-blue-400 ml-2">(Mockup {editMode.mockupIndex + 1})</span>
                )}
              </h2>

              <div className="space-y-4">
                {/* Interactive Preview Box */}
                <InteractivePreview
                  mockupImage={mockupImage}
                  designImage={getActiveDesignState().image}
                  transform={getActiveEffectiveTransform()}
                  onTransformChange={updateActiveDesignTransform}
                />

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

            {/* Design 1 Blend Mode */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Design 1 Blend Mode</h2>

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
          </>
        )}

        {/* Design 2 Controls */}
        {design2.image && mockupImages.length > 0 && (
          <>
            <div>
              <h2 className="text-xl font-semibold mb-4">Design 2 Transform</h2>

              <div className="space-y-4">
                {/* Interactive Preview for Design 2 */}
                <InteractivePreview
                  mockupImage={mockupImage}
                  designImage={design2.image}
                  transform={design2.transform}
                  onTransformChange={(updates) => {
                    setDesign2(prev => ({
                      ...prev,
                      transform: { ...prev.transform, ...updates }
                    }))
                    setCanvasRefreshKey(prev => prev + 1)
                  }}
                />

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Rotation: {design2.transform.rotation}°
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={design2.transform.rotation}
                    onChange={(e) => {
                      setDesign2(prev => ({
                        ...prev,
                        transform: { ...prev.transform, rotation: parseInt(e.target.value) }
                      }))
                      setCanvasRefreshKey(prev => prev + 1)
                    }}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Opacity: {design2.transform.opacity}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={design2.transform.opacity}
                    onChange={(e) => {
                      setDesign2(prev => ({
                        ...prev,
                        transform: { ...prev.transform, opacity: parseInt(e.target.value) }
                      }))
                      setCanvasRefreshKey(prev => prev + 1)
                    }}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Design 2 Blend Mode */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Design 2 Blend Mode</h2>

              {/* Quick preset buttons */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <button
                  onClick={() => {
                    setDesign2(prev => ({ ...prev, blendMode: 'multiply' }))
                    setCanvasRefreshKey(prev => prev + 1)
                  }}
                  className={`py-1 px-2 rounded text-xs transition ${
                    design2.blendMode === 'multiply'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  Multiply
                </button>
                <button
                  onClick={() => {
                    setDesign2(prev => ({ ...prev, blendMode: 'screen' }))
                    setCanvasRefreshKey(prev => prev + 1)
                  }}
                  className={`py-1 px-2 rounded text-xs transition ${
                    design2.blendMode === 'screen'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  Screen
                </button>
                <button
                  onClick={() => {
                    setDesign2(prev => ({ ...prev, blendMode: 'overlay' }))
                    setCanvasRefreshKey(prev => prev + 1)
                  }}
                  className={`py-1 px-2 rounded text-xs transition ${
                    design2.blendMode === 'overlay'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  Overlay
                </button>
              </div>

              <select
                value={design2.blendMode}
                onChange={(e) => {
                  setDesign2(prev => ({ ...prev, blendMode: e.target.value as BlendMode }))
                  setCanvasRefreshKey(prev => prev + 1)
                }}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                {BLEND_MODES.map(mode => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>

              <p className="text-xs text-gray-400 mt-2">
                Current: <span className="text-blue-400">{design2.blendMode}</span>
              </p>
            </div>
          </>
        )}

        {/* Export */}
        {(design1.image || design2.image) && mockupImages.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Export</h2>
            <div className="space-y-3">
              <button
                onClick={handleExport}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded transition"
              >
                Download
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
                </div>
              </div>
            </div>
          </div>
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

                if (design1.image && design1.visible) {
                  const pos = getEffectivePosition(index)
                  const transform = getEffectiveTransform(index)
                  const blendMode = getEffectiveBlendMode(index)

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

                // Draw design2
                if (design2.image && design2.visible) {
                  const customTransform2 = mockupCustomTransforms2.get(index)
                  const customBlendMode2 = mockupCustomBlendModes2.get(index)

                  const transform2 = customTransform2 || design2.transform
                  const blendMode2 = customBlendMode2 || design2.blendMode

                  ctx.save()
                  ctx.globalCompositeOperation = blendMode2
                  ctx.globalAlpha = transform2.opacity / 100
                  ctx.translate(transform2.x * scaleX, transform2.y * scaleY)
                  ctx.rotate((transform2.rotation * Math.PI) / 180)
                  ctx.scale(transform2.scale * transform2.scaleX * scaleX, transform2.scale * transform2.scaleY * scaleY)
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
          designImage={design1.image}
          transform={getEffectiveTransform(editModalMockupIndex)}
          onTransformChange={(updates) => {
            const idx = editModalMockupIndex
            setMockupCustomTransforms1(prev => {
              const newMap = new Map(prev)
              const currentTransform = getEffectiveTransform(idx)
              newMap.set(idx, { ...currentTransform, ...updates })
              return newMap
            })
            setCanvasRefreshKey(prev => prev + 1)
          }}
          onClose={() => {
            setEditModalOpen(false)
            setEditModalMockupIndex(null)
          }}
        />
      )}
    </div>
  )
}

export default MockupCanvas
