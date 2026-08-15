// =============================================================================
// Kun Like 桌宠 · DSH 静态插件（Host 端）
// 标准 Cordis 插件：export { name, inject, apply }
// 运行在完整 Node 环境，通过 cordis.patch.yml 在 DSH 启动时自动加载
// =============================================================================

import { readFileSync } from 'node:fs'
import { execFile } from 'node:child_process'

const name = 'kun-like-pet'

// webServer 是硬依赖：注册资源路由必须在服务就绪后执行
const inject = ['timer', 'webServer']

// ===== 配置 =====
const SPRITE_URL = new URL('../assets/spritesheet.webp', import.meta.url)
const VOICE_URL = new URL('../assets/voice.mp3', import.meta.url)
const POLL_MS = 500
const CELEBRATE_MS = 4800
const FAILED_MS = 2600

function apply(ctx) {
  const webServer = ctx.webServer
  if (!webServer) return

  console.log('[kun-pet] Host plugin loaded')


  // ===== 资源加载 =====
  let spriteBytes = null
  let voiceBytes = null
  const disposers = []
  let disposed = false

  try {
    spriteBytes = readFileSync(SPRITE_URL)
    console.log('[kun-pet] Sprite loaded:', spriteBytes.length, 'bytes')
  } catch (err) {
    console.error('[kun-pet] Sprite load failed:', err.message)
  }
  try {
    voiceBytes = readFileSync(VOICE_URL)
    console.log('[kun-pet] Voice loaded:', voiceBytes.length, 'bytes')
  } catch (err) {
    console.error('[kun-pet] Voice load failed:', err.message)
  }

  const h = webServer.host === '0.0.0.0' ? '127.0.0.1' : webServer.host
  const base = 'http://' + h + ':' + webServer.port

  // ===== HTTP 路由 =====
  const registerRoutes = () => {
    if (spriteBytes) {
      disposers.push(webServer.register({
        kind: 'exact',
        path: '/kun-pet/sprite.webp',
        handler: (req, res) => {
          res.writeHead(200, { 'Content-Type': 'image/webp', 'Content-Length': String(spriteBytes.length) })
          res.end(spriteBytes)
        },
      }))
    }
    if (voiceBytes) {
      disposers.push(webServer.register({
        kind: 'exact',
        path: '/kun-pet/voice.mp3',
        handler: (req, res) => {
          res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': String(voiceBytes.length) })
          res.end(voiceBytes)
        },
      }))
    }
    disposers.push(webServer.register({
      kind: 'exact',
      path: '/kun-pet/state',
      handler: (req, res) => {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        })
        res.end(JSON.stringify({
          mode,
          seq,
          spriteUrl: spriteBytes ? base + '/kun-pet/sprite.webp' : null,
          voiceUrl: voiceBytes ? base + '/kun-pet/voice.mp3' : null,
        }))
      },
    }))
  }
  registerRoutes()

  // ===== 系统级声音播放（不依赖浏览器焦点） =====
  // 等待播放完成再关闭：读取 NaturalDuration 总时长，轮询 Position 直到播完
  const playSystemVoice = () => {
    try {
      const uri = VOICE_URL.href
      const cmd = `try { Add-Type -AssemblyName PresentationCore; $p = New-Object System.Windows.Media.MediaPlayer; $p.Open([uri]'${uri}'); $p.Play(); $dl = (Get-Date).AddSeconds(10); while (-not $p.NaturalDuration.HasTimeSpan -and (Get-Date) -lt $dl) { Start-Sleep -Milliseconds 100 }; $total = 0.0; if ($p.NaturalDuration.HasTimeSpan) { $total = $p.NaturalDuration.TimeSpan.TotalSeconds }; $wait = 5.0; if ($total -gt 0) { $wait = $total + 0.5 }; $end = (Get-Date).AddSeconds($wait); while ((Get-Date) -lt $end -and ($total -le 0 -or $p.Position.TotalSeconds -lt $total)) { Start-Sleep -Milliseconds 100 }; $p.Stop(); $p.Close() } catch { }`
      execFile('powershell', ['-NoProfile', '-Command', cmd], { windowsHide: true }, () => {})
    } catch (err) {}
  }

  // ===== 状态机 =====
  let mode = 'idle'
  let seq = 0
  let celebrating = false
  let celebrateTimer = null
  let failTimer = null
  let toolsInFlight = 0
  let recentTool = false
  let recentToolTimer = null
  let waitingCount = 0
  const turnFlags = new WeakMap()
  const lastStatus = new WeakMap()
  const observedAgents = new Set()

  const flagsOf = (agent) => {
    let f = turnFlags.get(agent)
    if (!f) { f = { worked: false, errored: false }; turnFlags.set(agent, f) }
    return f
  }

  const rc = () => {
    let n = 0
    for (const a of observedAgents) { if (lastStatus.get(a) === 'running') n++ }
    return n
  }

  const setMode = (next) => {
    if (next !== mode && !(celebrating && next !== 'celebrating')) { mode = next; seq++ }
  }

  const derive = (r) => {
    if (celebrating || disposed) return
    setMode(waitingCount > 0 ? 'waiting' : r > 0 ? (toolsInFlight > 0 || recentTool ? 'working' : 'review') : 'idle')
  }

  const celebrate = () => {
    if (disposed) return
    if (celebrating) {
      if (celebrateTimer) { try { celebrateTimer() } catch {} }
      celebrateTimer = ctx.timeout(() => {
        if (disposed) return
        celebrateTimer = null
        celebrating = false
        derive(rc())
      }, CELEBRATE_MS)
      return
    }
    celebrating = true
    setMode('celebrating')
    playSystemVoice()
    celebrateTimer = ctx.timeout(() => {
      if (disposed) return
      celebrateTimer = null
      celebrating = false
      derive(rc())
    }, CELEBRATE_MS)
  }

  const showFailed = () => {
    if (celebrating || disposed) return
    setMode('failed')
    if (failTimer) { try { failTimer() } catch {} }
    failTimer = ctx.timeout(() => {
      if (disposed) return
      failTimer = null
      derive(rc())
    }, FAILED_MS)
  }

  const markSettled = (wasQ) => {
    if (disposed) return
    toolsInFlight = Math.max(0, toolsInFlight - 1)
    if (wasQ) waitingCount = Math.max(0, waitingCount - 1)
    if (toolsInFlight === 0) {
      if (recentToolTimer) { try { recentToolTimer() } catch {} }
      recentToolTimer = ctx.timeout(() => {
        if (disposed) return
        recentToolTimer = null
        recentTool = false
        derive(rc())
      }, 2500)
    }
    derive(rc())
  }

  ctx.effect(() => () => {
    disposed = true
    for (const d of disposers) { try { d() } catch {} }
  })

  // ===== 轮询 Agent 状态 =====
  const agents = ctx.get('agents')
  const stopPoll = ctx.interval(() => {
    if (disposed || !agents) return
    let list
    try { list = agents.list() } catch { return }
    if (!Array.isArray(list)) return
    const rn = new Set()
    for (const a of list) {
      const s = a && a.status === 'running' ? 'running' : 'idle'
      if (s === 'running') rn.add(a)
      const prev = lastStatus.get(a)
      lastStatus.set(a, s)
      if (a && prev === undefined) observedAgents.add(a)
      if (prev === 'running' && s === 'idle' && rn.size === 0) {
        const f = turnFlags.get(a)
        if (!f || !f.errored) {
          if (waitingCount > 0) {
            // AI 结束输出但仍在等待用户（提问/审批）→ 播放提示音，保持 waiting 动画
            playSystemVoice()
          } else {
            // 任务完成 → 庆祝动画 + 语音
            celebrate()
          }
        }
        if (f) turnFlags.delete(a)
      }
    }
    derive(rn.size)
  }, POLL_MS)
  ctx.effect(() => stopPoll)

  // ===== 事件监听 =====
  ctx.on('approval/request', (req, next) => {
    if (disposed) return next()
    waitingCount++
    derive(rc())
    let p
    try { p = Promise.resolve(next()) } catch (e) { waitingCount = Math.max(0, waitingCount - 1); derive(rc()); throw e }
    p.then(() => { if (!disposed) { waitingCount = Math.max(0, waitingCount - 1); derive(rc()) } },
           () => { if (!disposed) { waitingCount = Math.max(0, waitingCount - 1); derive(rc()) } })
    return p
  })

  ctx.on('tools/execute', (exec, next) => {
    if (disposed) return next()
    let isQ = false
    if (exec && exec.agent) flagsOf(exec.agent).worked = true
    if (exec && exec.name === 'ask_user_question') { isQ = true; waitingCount++ }
    toolsInFlight++
    recentTool = true
    if (recentToolTimer) { try { recentToolTimer() } catch {} recentToolTimer = null }
    derive(rc())
    let p
    try { p = Promise.resolve(next()) } catch (e) { markSettled(isQ); throw e }
    p.then(() => markSettled(isQ), () => markSettled(isQ))
    return p
  })

  ctx.on('agent/request-error', (payload, next) => {
    if (disposed) return next()
    if (payload && payload.agent) flagsOf(payload.agent).errored = true
    showFailed()
    return next()
  })
}

export { apply, inject, name }
