import { it as test } from 'vitest'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import { mountLightField } from './light-field'

function fixture({ context = true, compile = true, reduced = false, query = '' } = {}) {
  const window = new Window({ url: `http://localhost:5191/liquid-light-landing/${query}` })
  const { document } = window
  document.body.innerHTML =
    '<section data-light-hero><div class="light-fallback"></div><canvas data-light-canvas></canvas><div class="light-scrim"></div><a href="#contact">문의</a><button data-motion-control><span data-motion-label></span></button><p data-pointer-hint></p></section>'
  const hero = document.querySelector('[data-light-hero]')
  const canvas = document.querySelector('canvas')
  const control = document.querySelector('[data-motion-control]')
  const frames = new Map()
  const deleted = []
  const intersections = []
  let nextFrame = 0
  window.requestAnimationFrame = (callback) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  }
  window.cancelAnimationFrame = (id) => frames.delete(id)
  window.matchMedia = () => Object.assign(new window.EventTarget(), { matches: reduced })
  window.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback
      intersections.push(this)
    }
    observe() {}
    disconnect() {
      this.disconnected = true
    }
  }
  window.ResizeObserver = class {
    observe() {}
    disconnect() {}
  }
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    ARRAY_BUFFER: 5,
    STATIC_DRAW: 6,
    FLOAT: 7,
    TRIANGLE_STRIP: 8,
    createShader: (type) => ({ type }),
    shaderSource() {},
    compileShader() {},
    getShaderParameter: () => compile,
    getShaderInfoLog: () => 'controlled failure',
    createProgram: () => ({}),
    attachShader() {},
    linkProgram() {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    createBuffer: () => ({}),
    bindBuffer() {},
    bufferData() {},
    getAttribLocation: () => 0,
    enableVertexAttribArray() {},
    vertexAttribPointer() {},
    getUniformLocation: (_, name) => name,
    useProgram() {},
    uniform2f() {},
    uniform1f() {},
    uniform3f() {},
    uniform4f() {},
    uniform4fv() {},
    viewport() {},
    drawArrays() {},
    deleteShader: (resource) => deleted.push(resource),
    deleteProgram: (resource) => deleted.push(resource),
    deleteBuffer: (resource) => deleted.push(resource),
  }
  canvas.getContext = () => (context ? gl : null)
  hero.getBoundingClientRect = canvas.getBoundingClientRect = () => ({
    width: 1000,
    height: 800,
    left: 40,
    top: 20,
  })
  const field = mountLightField({ canvas, hero, control, document })
  function tick(now = 1000) {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(now))
  }
  function move(x = 800, y = 250, type = 'pointermove') {
    hero.dispatchEvent(
      new window.PointerEvent(type, {
        clientX: x,
        clientY: y,
        buttons: 0,
        pointerType: 'mouse',
        isPrimary: true,
        bubbles: true,
      }),
    )
  }
  function click(target = hero) {
    target.dispatchEvent(
      new window.MouseEvent('click', { clientX: 800, clientY: 250, bubbles: true }),
    )
  }
  return {
    window,
    document,
    hero,
    canvas,
    control,
    field,
    frames,
    deleted,
    intersections,
    tick,
    move,
    click,
  }
}

test('native hover without buttons increases visible field strength and records input', () => {
  const f = fixture()
  f.move()
  for (let i = 0; i < 20; i++) f.tick(1000 + i * 16)
  assert.equal(f.canvas.dataset.pointerEvents, '1')
  assert.ok(Number(f.canvas.dataset.pointerStrength) > 0.8)
  assert.ok(Number(f.canvas.dataset.pointerX) > 0.4)
  assert.ok(Number(f.canvas.dataset.pointerY) > 0.2)
  assert.equal(f.document.documentElement.dataset.pointerEvents, '1')
  f.move(0, 0, 'pointerleave')
  for (let i = 0; i < 90; i++) f.tick(1400 + i * 16)
  assert.ok(Number(f.canvas.dataset.pointerStrength) < 0.01)
  f.field.dispose()
})

test('empty Hero clicks create a ripple while links and controls do not', () => {
  const f = fixture()
  f.click()
  assert.equal(f.canvas.dataset.rippleEvents, '1')
  f.click(f.document.querySelector('a'))
  assert.equal(f.canvas.dataset.rippleEvents, '1')
  f.click(f.control)
  assert.equal(f.canvas.dataset.rippleEvents, '1')
  f.field.dispose()
})

test('touch release settles input without capture or cancelling normal scrolling', () => {
  const f = fixture()
  let capture = 0
  f.hero.setPointerCapture = () => capture++
  const start = new f.window.PointerEvent('pointerdown', {
    clientX: 800,
    clientY: 250,
    pointerType: 'touch',
    isPrimary: true,
    bubbles: true,
    cancelable: true,
  })
  f.hero.dispatchEvent(start)
  for (let i = 0; i < 20; i++) f.tick(1000 + i * 16)
  assert.ok(Number(f.canvas.dataset.pointerStrength) > 0.8)
  const end = new f.window.PointerEvent('pointerup', {
    pointerType: 'touch',
    isPrimary: true,
    bubbles: true,
    cancelable: true,
  })
  f.hero.dispatchEvent(end)
  for (let i = 0; i < 100; i++) f.tick(1400 + i * 16)
  assert.ok(Number(f.canvas.dataset.pointerStrength) < 0.01)
  assert.equal(start.defaultPrevented, false)
  assert.equal(end.defaultPrevented, false)
  assert.equal(capture, 0)
  f.field.dispose()
})

test('pause freezes time, spring and input counters through offscreen/BFCache restoration', () => {
  const f = fixture()
  f.move()
  f.tick()
  f.tick(1050)
  f.control.click()
  const frozen = { ...f.canvas.dataset }
  f.move(100, 700)
  f.click()
  f.tick(5000)
  f.intersections[0].callback([{ isIntersecting: false }])
  f.intersections[0].callback([{ isIntersecting: true }])
  const hide = new f.window.Event('pagehide')
  Object.defineProperty(hide, 'persisted', { value: true })
  f.window.dispatchEvent(hide)
  f.window.dispatchEvent(new f.window.Event('pageshow'))
  assert.equal(f.canvas.dataset.motionState, 'paused')
  for (const key of [
    'fieldTime',
    'pointerX',
    'pointerY',
    'pointerStrength',
    'pointerEvents',
    'rippleEvents',
    'renderFrames',
  ])
    assert.equal(f.canvas.dataset[key], frozen[key], key)
  assert.equal(f.frames.size, 0)
  f.control.click()
  assert.equal(f.frames.size, 1)
  f.field.dispose()
})

test('offscreen suspension stops and restoration resumes one loop', () => {
  const f = fixture()
  f.intersections[0].callback([{ isIntersecting: false }])
  assert.equal(f.canvas.dataset.motionState, 'suspended')
  assert.equal(f.frames.size, 0)
  f.intersections[0].callback([{ isIntersecting: true }])
  f.intersections[0].callback([{ isIntersecting: true }])
  assert.equal(f.frames.size, 1)
  f.field.dispose()
})

test('reduced motion has a still canvas, disabled button and a truthful static hint', () => {
  const f = fixture({ reduced: true })
  f.move()
  f.click()
  f.tick()
  assert.equal(f.canvas.dataset.motionState, 'reduced')
  assert.equal(f.canvas.dataset.fieldTime, '0.000')
  assert.equal(f.canvas.dataset.pointerEvents, '0')
  assert.equal(f.canvas.dataset.rippleEvents, '0')
  assert.equal(f.control.disabled, true)
  assert.equal(f.frames.size, 0)
  assert.match(f.document.querySelector('[data-pointer-hint]').textContent, /정적|줄이기/)
  f.field.dispose()
})

test('WebGL and compilation failure leave designed fallback with unavailable controls', () => {
  for (const options of [{ context: false }, { compile: false }, { query: '?fallback=1' }]) {
    const f = fixture(options)
    assert.equal(f.canvas.dataset.renderState, 'fallback')
    assert.equal(f.control.disabled, true)
    assert.equal(f.frames.size, 0)
    assert.match(f.document.querySelector('[data-pointer-hint]').textContent, /정적/)
    if (options.compile === false) assert.ok(f.deleted.length > 0)
    f.field.dispose()
  }
})

test('context restoration respects a manual pause and keeps truthful control state', () => {
  const f = fixture()
  f.control.click()
  f.canvas.dispatchEvent(new f.window.Event('webglcontextlost', { cancelable: true }))
  assert.equal(f.canvas.dataset.renderState, 'context-lost')
  assert.equal(f.control.disabled, true)
  f.canvas.dispatchEvent(new f.window.Event('webglcontextrestored'))
  assert.equal(f.canvas.dataset.renderState, 'ready')
  assert.equal(f.canvas.dataset.motionState, 'paused')
  assert.equal(f.control.disabled, false)
  assert.equal(f.frames.size, 0)
  f.field.dispose()
})

test('dispose frees GPU resources, observers/listeners and prevents late restart/input', () => {
  const f = fixture()
  f.field.dispose()
  assert.equal(f.canvas.dataset.renderState, 'disposed')
  assert.equal(f.deleted.length, 4)
  assert.equal(f.intersections[0].disconnected, true)
  assert.equal(f.frames.size, 0)
  f.move()
  f.click()
  f.window.dispatchEvent(new f.window.Event('resize'))
  f.window.dispatchEvent(new f.window.Event('pageshow'))
  assert.equal(f.canvas.dataset.pointerEvents, '0')
  assert.equal(f.frames.size, 0)
  f.field.dispose()
  assert.equal(f.deleted.length, 4)
})

test('SPA disposal removes owned document diagnostics without removing unrelated data', () => {
  const f = fixture()
  f.document.documentElement.dataset.siteTheme = 'paper'
  f.field.dispose()
  assert.equal(f.canvas.dataset.renderState, 'disposed')
  for (const key of Object.keys(f.canvas.dataset)) {
    if (key === 'lightCanvas') continue
    assert.equal(f.document.documentElement.dataset[key], undefined, key)
  }
  assert.equal(f.document.documentElement.dataset.siteTheme, 'paper')
})

test('disposing an older mount preserves the incoming Hero document diagnostics', () => {
  const f = fixture()
  const nextHero = f.hero.cloneNode(true)
  f.document.body.append(nextHero)
  const nextCanvas = nextHero.querySelector('canvas')
  nextCanvas.getContext = f.canvas.getContext
  nextCanvas.getBoundingClientRect = f.canvas.getBoundingClientRect
  const next = mountLightField({
    canvas: nextCanvas,
    hero: nextHero,
    control: nextHero.querySelector('button'),
    document: f.document,
  })
  f.field.dispose()
  assert.equal(f.document.documentElement.dataset.renderState, 'ready')
  assert.equal(f.document.documentElement.dataset.motionState, 'playing')
  next.dispose()
  assert.equal(f.document.documentElement.dataset.renderState, undefined)
})
