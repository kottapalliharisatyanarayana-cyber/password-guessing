// Canvas-based lightweight particle celebration engine
export function launchConfetti() {
  if (typeof document === 'undefined') return

  const canvas = document.createElement('canvas')
  canvas.style.position = 'fixed'
  canvas.style.top = '0'
  canvas.style.left = '0'
  canvas.style.width = '100vw'
  canvas.style.height = '100vh'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '99999'
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    document.body.removeChild(canvas)
    return
  }

  const width = (canvas.width = window.innerWidth)
  const height = (canvas.height = window.innerHeight)

  interface Particle {
    x: number
    y: number
    vx: number
    vy: number
    size: number
    color: string
    rotation: number
    vRot: number
    opacity: number
  }

  const colors = ['#00f5a0', '#00d8f6', '#ff3366', '#f59e0b', '#a855f7', '#ffffff']
  const particles: Particle[] = []

  // Create 150 particles from center-bottom
  for (let i = 0; i < 160; i++) {
    const angle = (Math.random() * Math.PI) / 2 + Math.PI / 4 // 45 to 135 deg upwards
    const speed = Math.random() * 18 + 12
    particles.push({
      x: width / 2 + (Math.random() * 200 - 100),
      y: height * 0.7,
      vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
      vy: -Math.sin(angle) * speed,
      size: Math.random() * 9 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 12,
      opacity: 1
    })
  }

  let animationFrame: number
  const startTime = Date.now()

  function render() {
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    const elapsed = Date.now() - startTime

    let alive = false
    for (const p of particles) {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.45 // gravity
      p.vx *= 0.98 // drag
      p.rotation += p.vRot
      if (elapsed > 1800) {
        p.opacity = Math.max(0, p.opacity - 0.02)
      }

      if (p.opacity > 0 && p.y < height + 50) {
        alive = true
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.globalAlpha = p.opacity
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx.restore()
      }
    }

    if (alive && elapsed < 4000) {
      animationFrame = requestAnimationFrame(render)
    } else {
      cancelAnimationFrame(animationFrame)
      if (canvas.parentNode) {
        document.body.removeChild(canvas)
      }
    }
  }

  animationFrame = requestAnimationFrame(render)
}
