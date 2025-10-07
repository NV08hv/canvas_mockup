import { useState, useRef, useEffect } from 'react'

interface Transform {
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
}

const BLEND_MODES = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
] as const

type BlendMode = typeof BLEND_MODES[number]

function MockupCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mockupImage, setMockupImage] = useState<HTMLImageElement | null>(null)
  const [designImage, setDesignImage] = useState<HTMLImageElement | null>(null)
  const [transform, setTransform] = useState<Transform>({
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    opacity: 100,
  })
  const [blendMode, setBlendMode] = useState<BlendMode>('multiply')
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Load mockup image
  const handleMockupUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new Image()
        img.onload = () => setMockupImage(img)
        img.src = event.target?.result as string
      }
      reader.readAsDataURL(file)
    }
  }

  // Load design image
  const handleDesignUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new Image()
        img.onload = () => {
          setDesignImage(img)
          // Center the design on canvas
          if (canvasRef.current) {
            setTransform(prev => ({
              ...prev,
              x: canvasRef.current!.width / 2,
              y: canvasRef.current!.height / 2,
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

  // Export PNG
  const handleExport = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'mockup_final.png'
        a.click()
        URL.revokeObjectURL(url)
      }
    }, 'image/png')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Canvas Area */}
      <div className="lg:col-span-2 bg-gray-800 rounded-lg p-6">
        <div className="bg-gray-700 rounded overflow-auto">
          <canvas
            ref={canvasRef}
            className="max-w-full h-auto cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>
        {!mockupImage && (
          <div className="text-center text-gray-400 mt-4">
            Upload a mockup to get started
          </div>
        )}
      </div>

      {/* Controls Panel */}
      <div className="bg-gray-800 rounded-lg p-6 space-y-6">
        {/* File Uploads */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Upload Images</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Mockup (T-shirt base)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleMockupUpload}
                className="block w-full text-sm text-gray-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-600 file:text-white
                  hover:file:bg-blue-700 file:cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Design (transparent PNG)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleDesignUpload}
                className="block w-full text-sm text-gray-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded file:border-0
                  file:text-sm file:font-semibold
                  file:bg-green-600 file:text-white
                  hover:file:bg-green-700 file:cursor-pointer"
                disabled={!mockupImage}
              />
            </div>
          </div>
        </div>

        {/* Transform Controls */}
        {designImage && (
          <>
            <div>
              <h2 className="text-xl font-semibold mb-4">Transform</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Scale: {transform.scale.toFixed(2)}x
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.01"
                    value={transform.scale}
                    onChange={(e) => setTransform(prev => ({ ...prev, scale: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Rotation: {transform.rotation}°
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={transform.rotation}
                    onChange={(e) => setTransform(prev => ({ ...prev, rotation: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Opacity: {transform.opacity}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={transform.opacity}
                    onChange={(e) => setTransform(prev => ({ ...prev, opacity: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Blend Mode */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Blend Mode</h2>
              <select
                value={blendMode}
                onChange={(e) => setBlendMode(e.target.value as BlendMode)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                {BLEND_MODES.map(mode => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>

            {/* Export */}
            <div>
              <button
                onClick={handleExport}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded transition"
              >
                Export PNG
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default MockupCanvas
