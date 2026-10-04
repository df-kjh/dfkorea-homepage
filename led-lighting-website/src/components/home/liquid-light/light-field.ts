export interface LightFieldOptions {
  canvas: HTMLCanvasElement
  hero: HTMLElement
  control: HTMLButtonElement
  document?: Document
}
export interface LightFieldController {
  dispose(): void
}

import { createPointerField } from './pointer-field'
import { fragmentShader } from './light-shader'

const vertexShader = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0., 1.); }`
const interactive =
  'a,button,input,textarea,select,summary,[role="button"],[contenteditable],[data-no-ripple],h1,h2,h3,p,label'
const diagnosticOwners = new WeakMap<Document, symbol>()

/** Mount one light field. Its RAF is the only owner of time, spring and wake motion. */
export function mountLightField({
  canvas,
  hero,
  control,
  document = globalThis.document,
}: LightFieldOptions): LightFieldController {
  const browser = document.defaultView
  if (!canvas || !hero || !control || !browser)
    throw new Error('Light field requires its canvas, hero and motion control.')
  const window = browser
  // Route transitions may briefly overlap mounts. Only the current field owns
  // document diagnostics; a detached old field must never erase the new Hero.
  const diagnosticOwner = Symbol('light-field')
  diagnosticOwners.set(document, diagnosticOwner)
  const diagnosticKeys = new Set<string>()
  const label = control.querySelector('[data-motion-label]')
  const hint = hero.querySelector('[data-pointer-hint]')
  const params = new URLSearchParams(window.location.search)
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  const field = createPointerField()
  const packedWakes = new Float32Array(16)
  const removers: Array<() => void> = []
  let gl: WebGL2RenderingContext | null = null
  let vs: WebGLShader | null = null,
    fs: WebGLShader | null = null
  let program: WebGLProgram | null = null
  let buffer: WebGLBuffer | null = null
  let uniforms: Record<
    'resolution' | 'time' | 'pointer' | 'wakes' | 'ripple',
    WebGLUniformLocation | null
  > | null = null
  let ready = false,
    contextLost = false,
    disposed = false
  let reduced = params.get('reduced-motion') === '1' || media.matches
  let manualPaused = false,
    offscreen = false,
    pageSuspended = false
  let raf: number | null = null,
    lastTimestamp: number | null = null,
    frames = 0,
    pointerEvents = 0,
    rippleEvents = 0

  function diagnostic(name: string, value: string | number) {
    canvas.dataset[name] = String(value)
    diagnosticKeys.add(name)
    if (diagnosticOwners.get(document) === diagnosticOwner)
      document.documentElement.dataset[name] = String(value)
  }
  function publishInput(snapshot = field.snapshot()) {
    diagnostic('fieldTime', snapshot.time.toFixed(3))
    diagnostic('pointerX', snapshot.x.toFixed(4))
    diagnostic('pointerY', snapshot.y.toFixed(4))
    diagnostic('pointerStrength', snapshot.strength.toFixed(4))
    diagnostic('pointerEvents', pointerEvents)
    diagnostic('rippleEvents', rippleEvents)
  }
  function on<T extends Event>(
    target: EventTarget,
    event: string,
    callback: (event: T) => void,
    options?: AddEventListenerOptions,
  ) {
    target.addEventListener(event, callback as EventListener, options)
    removers.push(() => target.removeEventListener(event, callback as EventListener, options))
  }
  function stopLoop() {
    if (raf !== null) window.cancelAnimationFrame(raf)
    raf = null
    lastTimestamp = null
  }
  function releaseGPU() {
    if (!gl) return
    if (buffer) gl.deleteBuffer(buffer)
    if (program) gl.deleteProgram(program)
    if (vs) gl.deleteShader(vs)
    if (fs) gl.deleteShader(fs)
    buffer = null
    program = null
    vs = null
    fs = null
    uniforms = null
    ready = false
  }
  function motionState() {
    if (disposed) return 'disposed'
    if (!ready || contextLost) return 'unavailable'
    if (reduced) return 'reduced'
    if (manualPaused) return 'paused'
    if (document.hidden || offscreen || pageSuspended) return 'suspended'
    return 'playing'
  }
  function updateControls(motion: string) {
    const disabled = ['unavailable', 'reduced', 'disposed'].includes(motion)
    control.disabled = disabled
    control.setAttribute('aria-pressed', String(manualPaused && !disabled))
    control.setAttribute(
      'aria-label',
      motion === 'paused'
        ? '빛 움직임 재생'
        : disabled
          ? '정적 빛 표시 — 움직임 사용 불가'
          : '빛 움직임 일시정지',
    )
    if (label)
      label.textContent =
        motion === 'paused'
          ? '재생하기'
          : motion === 'reduced'
            ? '움직임 줄임'
            : disabled
              ? '정적 보기'
              : '일시정지'
    if (hint)
      hint.textContent =
        motion === 'paused'
          ? '빛의 움직임을 잠시 멈췄습니다'
          : motion === 'reduced'
            ? '움직임 줄이기 설정으로 정적 빛을 표시합니다'
            : disabled
              ? '정적 빛을 표시합니다'
              : motion === 'suspended'
                ? '화면으로 돌아오면 빛의 흐름이 이어집니다'
                : coarsePointer
                  ? '가볍게 터치해 빛의 잔광을 만나보세요'
                  : '마우스를 움직여 빛의 흐름을 느껴보세요'
  }
  function synchronize() {
    const motion = motionState()
    diagnostic('motionState', motion)
    updateControls(motion)
    if (motion === 'playing') {
      if (raf === null) raf = window.requestAnimationFrame(animate)
    } else stopLoop()
  }
  function draw() {
    if (!ready || disposed || contextLost || !gl) return
    if (!program || !buffer || !uniforms) return
    const snapshot = field.snapshot()
    packedWakes.fill(0)
    snapshot.wakes.forEach((wake, index) =>
      packedWakes.set([wake.x, wake.y, wake.strength, wake.age], index * 4),
    )
    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height)
    gl.uniform1f(uniforms.time, snapshot.time)
    gl.uniform3f(uniforms.pointer, snapshot.x, snapshot.y, snapshot.strength)
    gl.uniform4fv(uniforms.wakes, packedWakes)
    gl.uniform4f(
      uniforms.ripple,
      snapshot.ripple.x,
      snapshot.ripple.y,
      snapshot.ripple.age,
      snapshot.ripple.strength,
    )
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    diagnostic('renderFrames', ++frames)
    publishInput(snapshot)
  }
  function animate(timestamp: number) {
    raf = null
    if (motionState() !== 'playing') return
    const dt =
      lastTimestamp === null
        ? 1 / 60
        : Math.min(Math.max((timestamp - lastTimestamp) / 1000, 0), 0.05)
    lastTimestamp = timestamp
    field.advance(dt)
    try {
      draw()
    } catch (error) {
      fallback((error instanceof Error ? error.message : null) || 'render-failed')
      return
    }
    raf = window.requestAnimationFrame(animate)
  }
  function resize() {
    if (!ready || disposed || contextLost || !gl) return
    const rect = canvas.getBoundingClientRect()
    const width = Math.max(1, rect.width),
      height = Math.max(1, rect.height)
    // Native DPR is unnecessary for this soft light artwork; cap pixels as well.
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      width < 600 ? 1.25 : 1.5,
      Math.sqrt(1800000 / (width * height)),
      2304 / Math.max(width, height),
    )
    canvas.width = Math.max(1, Math.floor(width * dpr))
    canvas.height = Math.max(1, Math.floor(height * dpr))
    gl.viewport(0, 0, canvas.width, canvas.height)
    try {
      draw()
    } catch (error) {
      fallback((error instanceof Error ? error.message : null) || 'render-failed')
    }
  }
  function fallback(reason: string) {
    stopLoop()
    field.release()
    releaseGPU()
    diagnostic('renderState', 'fallback')
    diagnostic('renderReason', reason)
    synchronize()
  }
  function compile(type: number, source: string) {
    if (!gl) throw new Error('webgl-unavailable')
    const shader = gl.createShader(type)
    if (!shader) throw new Error('shader-allocation')
    // Keep partial allocations reachable so compile/link failures also clean up.
    if (type === gl.VERTEX_SHADER) vs = shader
    else fs = shader
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(`shader-compile: ${gl.getShaderInfoLog(shader) || 'unknown'}`)
    return shader
  }
  function initialize() {
    if (disposed) return
    if (params.get('fallback') === '1') return fallback('diagnostic')
    releaseGPU()
    try {
      gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'low-power',
      })
      if (!gl) return fallback('webgl-unavailable')
      const vertex = compile(gl.VERTEX_SHADER, vertexShader)
      const fragment = compile(gl.FRAGMENT_SHADER, fragmentShader)
      program = gl.createProgram()
      if (!program) throw new Error('program-allocation')
      gl.attachShader(program, vertex)
      gl.attachShader(program, fragment)
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error(`program-link: ${gl.getProgramInfoLog(program) || 'unknown'}`)
      buffer = gl.createBuffer()
      if (!buffer) throw new Error('buffer-allocation')
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
      const position = gl.getAttribLocation(program, 'position')
      if (position < 0) throw new Error('position-attribute')
      gl.enableVertexAttribArray(position)
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
      uniforms = {
        resolution: gl.getUniformLocation(program, 'resolution'),
        time: gl.getUniformLocation(program, 'time'),
        pointer: gl.getUniformLocation(program, 'pointer'),
        wakes: gl.getUniformLocation(program, 'wakes[0]'),
        ripple: gl.getUniformLocation(program, 'ripple'),
      }
      ready = true
      contextLost = false
      diagnostic('renderState', 'ready')
      diagnostic('renderReason', '')
      resize()
      synchronize()
    } catch (error) {
      fallback((error instanceof Error ? error.message : null) || 'initialization-failed')
    }
  }
  function localPoint(event: MouseEvent | PointerEvent): [number, number] {
    const rect = canvas.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1
    const y = 1 - ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2
    return [Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))]
  }
  function pointerMove(event: PointerEvent) {
    if (motionState() !== 'playing' || event.isPrimary === false) return
    // Ordinary hover needs no pressed button, capture or touch-action override.
    field.setTarget(...localPoint(event))
    pointerEvents++
    publishInput()
  }
  function settle() {
    if (motionState() === 'playing') field.release()
  }
  function dispose() {
    if (disposed) return
    disposed = true
    stopLoop()
    removers.splice(0).forEach((remove) => remove())
    intersection?.disconnect()
    resizeObserver?.disconnect()
    releaseGPU()
    diagnostic('renderState', 'disposed')
    synchronize()
    if (diagnosticOwners.get(document) === diagnosticOwner) {
      diagnosticKeys.forEach((key) => delete document.documentElement.dataset[key])
      diagnosticOwners.delete(document)
    }
  }

  diagnostic('renderState', 'initializing')
  diagnostic('renderFrames', 0)
  publishInput()
  on(control, 'click', () => {
    if (!ready || disposed || reduced) return
    manualPaused = !manualPaused
    // Current input freezes immediately. A later resume starts settling, without
    // resurrecting a pointer that may have left while the control was paused.
    field.release()
    synchronize()
  })
  on(hero, 'pointermove', pointerMove, { passive: true })
  on<PointerEvent>(
    hero,
    'pointerdown',
    (event) => {
      if (event.pointerType !== 'mouse') pointerMove(event)
    },
    { passive: true },
  )
  // Touch/pen contact can end without a separate leave event. Mouse-up preserves
  // ordinary hover, while released direct input always lets its light settle.
  on<PointerEvent>(
    hero,
    'pointerup',
    (event) => {
      if (event.pointerType !== 'mouse') settle()
    },
    { passive: true },
  )
  on(hero, 'pointerleave', settle, { passive: true })
  on(hero, 'pointercancel', settle, { passive: true })
  on<MouseEvent>(hero, 'click', (event) => {
    if (
      motionState() !== 'playing' ||
      (event.target instanceof window.Element && event.target.closest(interactive))
    )
      return
    field.addRipple(...localPoint(event))
    rippleEvents++
    publishInput()
  })
  on(document, 'visibilitychange', () => {
    field.release()
    synchronize()
  })
  on(window, 'resize', resize, { passive: true })
  on(media, 'change', () => {
    reduced = params.get('reduced-motion') === '1' || media.matches
    field.release()
    synchronize()
  })
  on<PageTransitionEvent>(window, 'pagehide', (event) => {
    if (!event.persisted) return dispose()
    pageSuspended = true
    field.release()
    synchronize()
  })
  on(window, 'pageshow', () => {
    pageSuspended = false
    synchronize()
  })
  on(canvas, 'webglcontextlost', (event) => {
    event.preventDefault()
    contextLost = true
    stopLoop()
    field.release()
    releaseGPU()
    diagnostic('renderState', 'context-lost')
    synchronize()
  })
  on(canvas, 'webglcontextrestored', initialize)
  const intersection = window.IntersectionObserver
    ? new window.IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          if (disposed || !entry) return
          offscreen = !entry.isIntersecting
          if (offscreen) field.release()
          synchronize()
        },
        { threshold: 0.01 },
      )
    : null
  intersection?.observe(hero)
  const resizeObserver = window.ResizeObserver ? new window.ResizeObserver(resize) : null
  resizeObserver?.observe(canvas)
  initialize()
  return { dispose }
}
