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

  it('renders one vertical cord and a transparent warm filament bulb at rest', () => {
    const controller = createHangingBulbController({
      adapters,
      container: document.createElement('div'),
      onFallback: vi.fn(),
      onReady: vi.fn(),
      reducedMotion: true,
    })
    controller.start()

    const renderedScene = render.mock.calls.at(-1)?.[0]
    const cord = renderedScene?.getObjectByName('pendant-cord') as THREE.Mesh
    const glass = renderedScene?.getObjectByName('bulb-glass') as THREE.Mesh<
      THREE.LatheGeometry,
      THREE.MeshPhysicalMaterial
    >
    const filament = renderedScene?.getObjectByName('warm-filament-0') as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >
    const bulbLight = renderedScene?.getObjectByName('warm-bulb-light') as THREE.PointLight
    const innerGlass = renderedScene?.getObjectByName('bulb-inner-glass') as THREE.Mesh
    const lightVolume = renderedScene?.getObjectByName('bulb-light-volume') as THREE.Mesh
    const leftHighlight = renderedScene?.getObjectByName('glass-highlight-left') as THREE.Mesh
    const rightHighlight = renderedScene?.getObjectByName('glass-highlight-right') as THREE.Mesh
    const socketGrooves: THREE.Object3D[] = []
    const filaments: THREE.Object3D[] = []
    renderedScene?.traverse((object) => {
      if (object.name.startsWith('warm-filament-')) filaments.push(object)
      if (object.name.startsWith('socket-groove-')) socketGrooves.push(object)
    })

    expect(cord).toBeInstanceOf(THREE.Mesh)
    expect(renderedScene?.getObjectByProperty('type', 'InstancedMesh')).toBeUndefined()
    const cordDirection = new THREE.Vector3(0, 1, 0).applyQuaternion(cord.quaternion)
    expect(Math.abs(cordDirection.x)).toBeCloseTo(0, 8)
    expect(Math.abs(cordDirection.y)).toBeCloseTo(1, 8)
    expect(glass.material.transmission).toBeGreaterThanOrEqual(0.88)
    expect(glass.material.opacity).toBeLessThanOrEqual(0.55)
    expect(glass.geometry.parameters.segments).toBeGreaterThanOrEqual(96)
    expect(innerGlass).toBeInstanceOf(THREE.Mesh)
    expect(lightVolume).toBeInstanceOf(THREE.Mesh)
    expect(leftHighlight).toBeInstanceOf(THREE.Mesh)
    expect(rightHighlight).toBeInstanceOf(THREE.Mesh)
    expect(socketGrooves).toHaveLength(4)
    expect(filaments).toHaveLength(6)
    expect(filament.material.emissive.r).toBeGreaterThan(filament.material.emissive.g)
    expect(filament.material.emissive.g).toBeGreaterThan(filament.material.emissive.b)
    expect(bulbLight.color.r).toBeGreaterThan(bulbLight.color.g)
    expect(bulbLight.color.g).toBeGreaterThan(bulbLight.color.b)
    expect(bulbLight.intensity).toBeGreaterThan(2.5)
    expect(bulbLight.distance).toBeGreaterThanOrEqual(7.5)
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
    let initialFilament: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | undefined
    initialScene?.traverse((object) => {
      if (!initialFilament && object.name.startsWith('warm-filament')) {
        initialFilament = object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
      }
    })
    expect(initialFilament).toBeDefined()
    if (!initialFilament) throw new Error('Expected a warm filament in the initial scene')
    const initialFilamentIntensity = initialFilament.material.emissiveIntensity

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
    let filament: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | undefined
    renderedScene?.traverse((object) => {
      if (!filament && object.name.startsWith('warm-filament')) {
        filament = object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
      }
    })
    expect(filament).toBeDefined()
    if (!filament) throw new Error('Expected a warm filament after hover')
    expect(hitTest).toHaveBeenCalled()
    expect(light.intensity).toBeGreaterThan(initialIntensity * 2.2)
    expect(light.intensity).toBeGreaterThan(9)
    expect(filament.material.emissiveIntensity).toBeGreaterThan(initialFilamentIntensity * 1.75)
    expect(outerHalo).toBeInstanceOf(THREE.Sprite)
    if (!(outerHalo instanceof THREE.Sprite)) throw new Error('Expected an outer bulb halo')
    expect(outerHalo.material.opacity).toBeGreaterThan(0.35)
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
    const light = renderedScene?.getObjectByName('warm-bulb-light') as THREE.PointLight
    const filament = renderedScene?.getObjectByName('warm-filament-0') as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >
    const halo = renderedScene?.getObjectByName('bulb-inner-halo') as THREE.Sprite
    const outerHalo = renderedScene?.getObjectByName('bulb-outer-halo') as THREE.Sprite
    const lightVolume = renderedScene?.getObjectByName('bulb-light-volume') as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshBasicMaterial
    >
    expect(light.intensity).toBe(0)
    expect(filament.material.emissiveIntensity).toBe(0)
    expect(halo.material.opacity).toBe(0)
    expect(outerHalo.material.opacity).toBe(0)
    expect(lightVolume.material.opacity).toBe(0)
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
