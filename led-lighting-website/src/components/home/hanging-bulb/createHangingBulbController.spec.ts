import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createHangingBulbController,
  type HangingBulbControllerAdapters,
  type HangingBulbRenderer,
} from './createHangingBulbController'

describe('createHangingBulbController', () => {
  let canvas: HTMLCanvasElement
  let renderer: HangingBulbRenderer
  let render = vi.fn<HangingBulbRenderer['render']>()
  let disposeRenderer = vi.fn<() => void>()
  let disposeEnvironment = vi.fn<() => void>()
  let requestFrame = vi.fn<(callback: FrameRequestCallback) => number>()
  let cancelFrame = vi.fn<(frameId: number) => void>()
  let adapters: HangingBulbControllerAdapters

  beforeEach(() => {
    canvas = document.createElement('canvas')
    render = vi.fn<HangingBulbRenderer['render']>()
    disposeRenderer = vi.fn<() => void>()
    disposeEnvironment = vi.fn<() => void>()
    requestFrame = vi.fn<(callback: FrameRequestCallback) => number>(() => 41)
    cancelFrame = vi.fn<(frameId: number) => void>()
    renderer = {
      dispose: disposeRenderer,
      domElement: canvas,
      outputColorSpace: '',
      render,
      setClearColor: vi.fn(),
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      toneMapping: 0,
      toneMappingExposure: 0,
    }
    adapters = {
      cancelAnimationFrame: cancelFrame,
      createEnvironment: vi.fn(() => ({
        dispose: disposeEnvironment,
        texture: new THREE.Texture(),
      })),
      createRenderer: vi.fn(() => renderer),
      now: vi.fn(() => 1_000),
      requestAnimationFrame: requestFrame,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders, pauses, and disposes every owned browser and GPU resource', () => {
    const container = document.createElement('div')
    const onReady = vi.fn()
    const controller = createHangingBulbController({
      adapters,
      container,
      onFallback: vi.fn(),
      onReady,
      reducedMotion: false,
    })

    controller.start()
    expect(container.contains(canvas)).toBe(true)
    expect(render).toHaveBeenCalledOnce()
    expect(onReady).toHaveBeenCalledOnce()
    expect(requestFrame).toHaveBeenCalledOnce()

    controller.pause()
    expect(cancelFrame).toHaveBeenCalledWith(41)

    controller.dispose()
    expect(disposeEnvironment).toHaveBeenCalledOnce()
    expect(disposeRenderer).toHaveBeenCalledOnce()
    expect(container.contains(canvas)).toBe(false)
  })

  it('renders one static frame without scheduling animation for reduced motion', () => {
    const controller = createHangingBulbController({
      adapters,
      container: document.createElement('div'),
      onFallback: vi.fn(),
      onReady: vi.fn(),
      reducedMotion: true,
    })

    controller.start()

    expect(render).toHaveBeenCalledOnce()
    expect(requestFrame).not.toHaveBeenCalled()
    controller.dispose()
  })

  it('renders an opaque LED diffuser that responds to the same light as the scene', () => {
    const controller = createHangingBulbController({
      adapters,
      container: document.createElement('div'),
      onFallback: vi.fn(),
      onReady: vi.fn(),
      reducedMotion: true,
    })
    controller.start()

    const scene = render.mock.calls.at(-1)?.[0]
    const diffuser = scene?.getObjectByName('led-diffuser') as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshPhysicalMaterial
    >
    const light = scene?.getObjectByName('led-bulb-light') as THREE.PointLight
    expect(diffuser).toBeInstanceOf(THREE.Mesh)
    expect(diffuser.material.transparent).toBe(false)
    expect(diffuser.material.emissive.equals(light.color)).toBe(true)
    expect(diffuser.material.emissiveIntensity).toBeGreaterThan(0)
    expect(light.intensity).toBeGreaterThan(0)
    controller.dispose()
  })

  it('applies maximum brightness immediately while hovering in reduced-motion mode', () => {
    const container = document.createElement('div')
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      bottom: 600,
      height: 600,
      left: 0,
      right: 600,
      top: 0,
      width: 600,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    })
    const hitTest = vi
      .spyOn(THREE.Raycaster.prototype, 'intersectObject')
      .mockReturnValue([{} as THREE.Intersection])
    const controller = createHangingBulbController({
      adapters,
      container,
      onFallback: vi.fn(),
      onReady: vi.fn(),
      reducedMotion: true,
    })
    controller.start()
    const initialScene = render.mock.calls.at(-1)?.[0]
    const initialLight = initialScene?.getObjectByProperty('type', 'PointLight') as THREE.PointLight
    const initialIntensity = initialLight.intensity
    let initialDiffuser: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | undefined
    initialScene?.traverse((object) => {
      if (!initialDiffuser && object.name.startsWith('led-diffuser')) {
        initialDiffuser = object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
      }
    })
    expect(initialDiffuser).toBeDefined()
    if (!initialDiffuser) throw new Error('Expected an LED diffuser in the initial scene')
    const initialDiffuserIntensity = initialDiffuser.material.emissiveIntensity

    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: 300,
        clientY: 300,
        pointerType: 'mouse',
      }),
    )

    const renderedScene = render.mock.calls.at(-1)?.[0]
    const light = renderedScene?.getObjectByProperty('type', 'PointLight') as THREE.PointLight
    const outerHalo = renderedScene?.getObjectByName('bulb-outer-halo') as THREE.Sprite | undefined
    let diffuser: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | undefined
    renderedScene?.traverse((object) => {
      if (!diffuser && object.name.startsWith('led-diffuser')) {
        diffuser = object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
      }
    })
    expect(diffuser).toBeDefined()
    if (!diffuser) throw new Error('Expected an LED diffuser after hover')
    expect(hitTest).toHaveBeenCalled()
    expect(light.intensity).toBeGreaterThan(initialIntensity)
    expect(light.intensity).toBeGreaterThan(0)
    expect(diffuser.material.emissiveIntensity).toBeGreaterThan(initialDiffuserIntensity)
    expect(outerHalo).toBeInstanceOf(THREE.Sprite)
    if (!(outerHalo instanceof THREE.Sprite)) throw new Error('Expected an outer bulb halo')
    expect(outerHalo.material.opacity).toBeGreaterThan(0)
    controller.dispose()
    hitTest.mockRestore()
  })

  it('re-evaluates hover every frame while the bulb moves under a stationary pointer', () => {
    const container = document.createElement('div')
    let scheduledFrame: FrameRequestCallback | undefined
    requestFrame.mockImplementation((callback) => {
      scheduledFrame = callback
      return 41
    })
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      bottom: 600,
      height: 600,
      left: 0,
      right: 600,
      top: 0,
      width: 600,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    })
    const hitTest = vi
      .spyOn(THREE.Raycaster.prototype, 'intersectObject')
      .mockReturnValueOnce([{} as THREE.Intersection])
      .mockReturnValue([])
    const controller = createHangingBulbController({
      adapters,
      container,
      onFallback: vi.fn(),
      onReady: vi.fn(),
      reducedMotion: false,
    })
    controller.start()
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: 300,
        clientY: 300,
        pointerType: 'mouse',
      }),
    )

    scheduledFrame?.(1_016)

    expect(hitTest).toHaveBeenCalledTimes(2)
    controller.dispose()
    hitTest.mockRestore()
  })

  it('fully powers down every emissive layer during a mobile blackout', () => {
    const container = document.createElement('div')
    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 700 },
      clientWidth: { configurable: true, value: 390 },
    })
    let scheduledFrame: FrameRequestCallback | undefined
    requestFrame.mockImplementation((callback) => {
      scheduledFrame = callback
      return 41
    })
    const controller = createHangingBulbController({
      adapters,
      container,
      onFallback: vi.fn(),
      onReady: vi.fn(),
      reducedMotion: false,
    })
    controller.start()

    scheduledFrame?.(2_900)

    const renderedScene = render.mock.calls.at(-1)?.[0]
    const light = renderedScene?.getObjectByName('led-bulb-light') as THREE.PointLight
    const diffuser = renderedScene?.getObjectByName('led-diffuser') as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >
    const halo = renderedScene?.getObjectByName('bulb-inner-halo') as THREE.Sprite
    const outerHalo = renderedScene?.getObjectByName('bulb-outer-halo') as THREE.Sprite
    expect(light.intensity).toBe(0)
    expect(diffuser.material.emissiveIntensity).toBe(0)
    expect(halo.material.opacity).toBe(0)
    expect(outerHalo.material.opacity).toBe(0)
    expect(diffuser.material.opacity).toBe(1)
    controller.dispose()
  })

  it('cleans the renderer and reports fallback when setup fails before scene creation', () => {
    const container = document.createElement('div')
    const onFallback = vi.fn()
    vi.mocked(renderer.setClearColor).mockImplementation(() => {
      throw new Error('renderer configuration failed')
    })

    expect(() =>
      createHangingBulbController({
        adapters,
        container,
        onFallback,
        onReady: vi.fn(),
        reducedMotion: false,
      }),
    ).not.toThrow()
    expect(onFallback).toHaveBeenCalledWith('runtime')
    expect(disposeRenderer).toHaveBeenCalledOnce()
    expect(container.contains(canvas)).toBe(false)
  })

  it('transitions to a cleaned fallback when a frame throws', () => {
    const container = document.createElement('div')
    const onFallback = vi.fn()
    render.mockImplementation(() => {
      throw new Error('GPU frame failed')
    })
    const controller = createHangingBulbController({
      adapters,
      container,
      onFallback,
      onReady: vi.fn(),
      reducedMotion: false,
    })

    controller.start()

    expect(onFallback).toHaveBeenCalledWith('runtime')
    expect(disposeEnvironment).toHaveBeenCalledOnce()
    expect(disposeRenderer).toHaveBeenCalledOnce()
    expect(container.contains(canvas)).toBe(false)
  })

  it('transitions to a cleaned fallback when WebGL context is lost', () => {
    const container = document.createElement('div')
    const onFallback = vi.fn()
    createHangingBulbController({
      adapters,
      container,
      onFallback,
      onReady: vi.fn(),
      reducedMotion: false,
    })

    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))

    expect(onFallback).toHaveBeenCalledWith('context-lost')
    expect(disposeEnvironment).toHaveBeenCalledOnce()
    expect(disposeRenderer).toHaveBeenCalledOnce()
    expect(container.contains(canvas)).toBe(false)
  })
})
