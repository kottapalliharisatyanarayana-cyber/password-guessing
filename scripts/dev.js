import { spawn } from 'child_process'

console.log('🚀 [CrackVault] Launching Backend Server on port 5000...')
const backend = spawn('node', ['server/index.js'], { stdio: 'inherit', shell: true })

console.log('⚡ [CrackVault] Launching Vite Frontend on 0.0.0.0:8000...')
const frontend = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8000'], { stdio: 'inherit', shell: true })

const cleanup = () => {
  try { backend.kill() } catch {}
  try { frontend.kill() } catch {}
  process.exit(0)
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
process.on('exit', cleanup)
