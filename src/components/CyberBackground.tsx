import React, { useEffect, useRef } from 'react'

export const CyberBackground: React.FC = React.memo(() => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let isRunning = true
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }

    window.addEventListener('resize', handleResize)

    // Floating cyber data particles
    interface Particle {
      x: number
      y: number
      size: number
      speedY: number
      speedX: number
      opacity: number
      color: string
    }

    const particleColors = [
      'rgba(0, 245, 160, ', // Mint
      'rgba(0, 216, 246, ', // Cyan
      'rgba(168, 85, 247, '  // Violet
    ]

    const particles: Particle[] = Array.from({ length: 36 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 0.8,
      speedY: -(Math.random() * 0.4 + 0.15),
      speedX: (Math.random() - 0.5) * 0.2,
      opacity: Math.random() * 0.5 + 0.2,
      color: particleColors[Math.floor(Math.random() * particleColors.length)]
    }))

    let laserY = 0

    const render = () => {
      if (!isRunning) return
      ctx.clearRect(0, 0, width, height)

      // Draw subtle scanner laser sweep
      laserY = (laserY + 0.5) % (height + 100)
      const grad = ctx.createLinearGradient(0, laserY - 25, 0, laserY + 25)
      grad.addColorStop(0, 'rgba(0, 245, 160, 0)')
      grad.addColorStop(0.5, 'rgba(0, 245, 160, 0.03)')
      grad.addColorStop(1, 'rgba(0, 245, 160, 0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, laserY - 25, width, 50)

      // Update and draw particles with zero-overhead GPU-friendly double-circle glow
      for (const p of particles) {
        p.y += p.speedY
        p.x += p.speedX

        if (p.y < -10) {
          p.y = height + 10
          p.x = Math.random() * width
        }
        if (p.x < 0) p.x = width
        if (p.x > width) p.x = 0

        // Soft outer glow halo (zero CPU blur computation)
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2)
        ctx.fillStyle = `${p.color}${(p.opacity * 0.18).toFixed(3)})`
        ctx.fill()

        // Crisp high-intensity particle core
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `${p.color}${p.opacity})`
        ctx.fill()
      }

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    const handleVisibilityChange = () => {
      if (document.hidden) {
        isRunning = false
        cancelAnimationFrame(animationFrameId)
      } else {
        if (!isRunning) {
          isRunning = true
          animationFrameId = requestAnimationFrame(render)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isRunning = false
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden'
      }}
      aria-hidden="true"
    >
      {/* Ambient Glowing Cyber Orbs */}
      <div className="cyber-ambient-orb orb-mint" />
      <div className="cyber-ambient-orb orb-cyan" />
      <div className="cyber-ambient-orb orb-violet" />

      {/* Cyber Grid Perspective Floor */}
      <div className="cyber-grid-overlay" />

      {/* Canvas Particle Field & Laser Sweep */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0.85
        }}
      />
    </div>
  )
})
