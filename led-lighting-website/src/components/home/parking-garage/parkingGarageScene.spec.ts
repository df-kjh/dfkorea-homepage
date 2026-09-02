import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import {
  AmbientLight,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  SRGBColorSpace,
} from 'three'
import { sampleParkingGaragePath } from './parkingGaragePath'
import {
  createParkingGarageController,
  type ControllerAdapters,
  type FallbackReason,
  type ParkingGarageRaycaster,
  type ParkingGarageRenderer,
} from './parkingGarageScene'

interface Harness {
  advanceTime: (milliseconds: number) => void
  adapters: ControllerAdapters
  canvas: HTMLCanvasElement
  container: HTMLDivElement
  fallbackReasons: FallbackReason[]
  frameCount: () => number
  onReady: Mock<() => void>
  raycaster: ParkingGarageRaycaster
  renderer: ParkingGarageRenderer
  runNextFrame: (milliseconds?: number) => void
  setViewport: (width: number, devicePixelRatio: number) => void
  setVisibility: (state: DocumentVisibilityState) => void
}

const createHarness = (): Harness => {
  const container = document.createElement('div')
  Object.defineProperties(container, {
    clientWidth: { configurable: true, value: 1_200 },
    clientHeight: { configurable: true, value: 600 },
  })
  document.body.append(container)

  const canvas = document.createElement('canvas')
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    bottom: 600,
    height: 600,
    left: 0,
    right: 1_200,
    top: 0,
    width: 1_200,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })

  const renderer: ParkingGarageRenderer = {
    domElement: canvas,
    outputColorSpace: '',
    shadowMap: { enabled: false, type: 0 },
    dispose: vi.fn(),
    render: vi.fn(),
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
  }
  const raycaster: ParkingGarageRaycaster = {
    intersectObjects: vi.fn(() => []),
    setFromCamera: vi.fn(),
  }

  let nextFrameId = 0
  let now = 0
  let visibilityState: DocumentVisibilityState = 'visible'
  const frames = new Map<number, FrameRequestCallback>()
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilityState)

  const adapters: ControllerAdapters = {
    cancelAnimationFrame: vi.fn((frameId: number) => {
      frames.delete(frameId)
    }),
    createRenderer: vi.fn(() => renderer),
    createRaycaster: () => raycaster,
    now: () => now,
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      const frameId = ++nextFrameId
      frames.set(frameId, callback)
      return frameId
    }),
  }

  const fallbackReasons: FallbackReason[] = []
  const onReady = vi.fn<() => void>()

  return {
    advanceTime: (milliseconds) => {
      now += milliseconds
    },
    adapters,
    canvas,
    container,
    fallbackReasons,
    frameCount: () => frames.size,
    onReady,
    raycaster,
    renderer,
    runNextFrame: (milliseconds = 16) => {
      const entry = frames.entries().next().value as [number, FrameRequestCallback] | undefined
      if (!entry) throw new Error('No animation frame is scheduled')
      const [frameId, callback] = entry
      frames.delete(frameId)
      now += milliseconds
      callback(now)
    },
    setViewport: (width, devicePixelRatio) => {
      vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(width)
      vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(devicePixelRatio)
    },
    setVisibility: (state) => {
      visibilityState = state
      document.dispatchEvent(new Event('visibilitychange'))
    },
  }
}

const createController = (
  harness: Harness,
  overrides: Partial<{ reducedMotion: boolean }> = {},
) =>
  createParkingGarageController({
    adapters: harness.adapters,
    container: harness.container,
    onFallback: (reason) => harness.fallbackReasons.push(reason),
    onReady: harness.onReady,
    reducedMotion: overrides.reducedMotion ?? false,
  })

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('parking garage controller lifecycle', () => {
  it('keeps exactly one animation frame scheduled while running', () => {
    const harness = createHarness()
    const controller = createController(harness)

    controller.start()
    controller.start()
    expect(harness.frameCount()).toBe(1)

    harness.runNextFrame()
    expect(harness.renderer.render).toHaveBeenCalledTimes(1)
    expect(harness.onReady).toHaveBeenCalledTimes(1)
    expect(harness.frameCount()).toBe(1)

    harness.runNextFrame()
    expect(harness.renderer.render).toHaveBeenCalledTimes(2)
    expect(harness.onReady).toHaveBeenCalledTimes(1)
    expect(harness.frameCount()).toBe(1)

    controller.dispose()
  })

  it('pauses while the document is hidden and resumes only when visible', () => {
    const harness = createHarness()
    const controller = createController(harness)

    controller.start()
    harness.setVisibility('hidden')
    expect(harness.frameCount()).toBe(0)

    harness.setVisibility('visible')
    expect(harness.frameCount()).toBe(1)

    controller.pause()
    harness.setVisibility('hidden')
    harness.setVisibility('visible')
    expect(harness.frameCount()).toBe(0)

    controller.dispose()
  })

  it('does not add hidden-tab time to the camera loop after resuming', () => {
    const harness = createHarness()
    const controller = createController(harness)
    controller.start()
    harness.runNextFrame()
    harness.runNextFrame(1_000)
    const cameraBeforePause = vi.mocked(harness.renderer.render).mock.calls.at(-1)![1]
    const positionBeforePause = cameraBeforePause.position.clone()

    harness.setVisibility('hidden')
    harness.advanceTime(10_000)
    harness.setVisibility('visible')
    harness.runNextFrame()

    const cameraAfterResume = vi.mocked(harness.renderer.render).mock.calls.at(-1)![1]
    expect(cameraAfterResume.position.toArray()).toEqual(positionBeforePause.toArray())
    controller.dispose()
  })

  it('disposes its frame, renderer, canvas, and all browser listeners', () => {
    const harness = createHarness()
    const controller = createController(harness)
    controller.start()

    harness.container.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 200, clientY: 200, pointerType: 'mouse' }),
    )
    expect(harness.raycaster.intersectObjects).toHaveBeenCalledTimes(1)

    const initialSizeCalls = vi.mocked(harness.renderer.setSize).mock.calls.length
    controller.dispose()

    expect(harness.frameCount()).toBe(0)
    expect(harness.renderer.dispose).toHaveBeenCalledTimes(1)
    expect(harness.container.contains(harness.canvas)).toBe(false)

    window.dispatchEvent(new Event('resize'))
    harness.setVisibility('hidden')
    harness.setVisibility('visible')
    harness.container.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 200, clientY: 200, pointerType: 'mouse' }),
    )
    harness.container.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 200,
        clientY: 200,
        pointerId: 4,
        pointerType: 'touch',
      }),
    )
    harness.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))

    expect(harness.renderer.setSize).toHaveBeenCalledTimes(initialSizeCalls)
    expect(harness.raycaster.intersectObjects).toHaveBeenCalledTimes(1)
    expect(harness.frameCount()).toBe(0)
    expect(harness.fallbackReasons).toEqual([])

    controller.dispose()
    expect(harness.renderer.dispose).toHaveBeenCalledTimes(1)
  })
})

describe('parking garage renderer and camera', () => {
  it('configures desktop rendering, shadows, lighting, and the container size', () => {
    const harness = createHarness()
    harness.setViewport(1_440, 2)
    const controller = createController(harness)

    expect(harness.adapters.createRenderer).toHaveBeenCalledWith({
      antialias: true,
      powerPreference: 'high-performance',
    })
    expect(harness.renderer.outputColorSpace).toBe(SRGBColorSpace)
    expect(harness.renderer.shadowMap).toMatchObject({ enabled: true, type: PCFSoftShadowMap })
    expect(harness.renderer.setPixelRatio).toHaveBeenCalledWith(1.5)
    expect(harness.renderer.setSize).toHaveBeenCalledWith(1_200, 600, false)

    controller.start()
    harness.runNextFrame()
    const scene = vi.mocked(harness.renderer.render).mock.calls[0]![0]
    const ambient = scene.children.find((child) => child instanceof AmbientLight)
    const directional = scene.children.find((child) => child instanceof DirectionalLight)
    expect(ambient).toBeInstanceOf(AmbientLight)
    expect(directional).toBeInstanceOf(DirectionalLight)
    expect((directional as DirectionalLight).castShadow).toBe(true)
    expect((directional as DirectionalLight).shadow.mapSize.toArray()).toEqual([1_024, 1_024])
    controller.dispose()
  })

  it('disables antialiasing and shadows for the mobile quality profile', () => {
    const harness = createHarness()
    harness.setViewport(390, 3)
    const controller = createController(harness)

    expect(harness.adapters.createRenderer).toHaveBeenCalledWith({
      antialias: false,
      powerPreference: 'high-performance',
    })
    expect(harness.renderer.shadowMap.enabled).toBe(false)
    expect(harness.renderer.setPixelRatio).toHaveBeenCalledWith(1)
    controller.dispose()
  })

  it('keeps reduced-motion rendering at the 7-second representative pose', () => {
    const harness = createHarness()
    const controller = createController(harness, { reducedMotion: true })
    const expectedPose = sampleParkingGaragePath(7_000)
    controller.start()

    harness.runNextFrame()
    let camera = vi.mocked(harness.renderer.render).mock.calls.at(-1)![1]
    expect(camera.position.toArray()).toEqual([
      expectedPose.position.x,
      expectedPose.position.y,
      expectedPose.position.z,
    ])

    harness.runNextFrame(5_000)
    camera = vi.mocked(harness.renderer.render).mock.calls.at(-1)![1]
    expect(camera.position.toArray()).toEqual([
      expectedPose.position.x,
      expectedPose.position.y,
      expectedPose.position.z,
    ])
    controller.dispose()
  })
})

describe('parking garage fixture interaction', () => {
  it('raycasts fixture targets in canvas coordinates and activates only the nearest hover hit', () => {
    const harness = createHarness()
    vi.mocked(harness.raycaster.intersectObjects).mockImplementation((objects) => [
      { distance: 9, object: objects[1]! },
      { distance: 2, object: objects[0]! },
    ])
    const controller = createController(harness)
    controller.start()
    harness.runNextFrame()

    harness.container.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 300, clientY: 150, pointerType: 'mouse' }),
    )
    const hitTargets = vi.mocked(harness.raycaster.intersectObjects).mock.calls[0]![0]
    expect(hitTargets).toHaveLength(20)
    expect(hitTargets.every((target) => typeof target.userData.fixtureId === 'string')).toBe(true)
    const coordinates = vi.mocked(harness.raycaster.setFromCamera).mock.calls[0]![0]
    expect(coordinates.toArray()).toEqual([-0.5, 0.5])

    harness.runNextFrame(180)
    const nearestMaterial = (hitTargets[0] as Mesh).material as MeshStandardMaterial
    const fartherMaterial = (hitTargets[1] as Mesh).material as MeshStandardMaterial
    expect(nearestMaterial.emissiveIntensity).toBe(1)
    expect(fartherMaterial.emissiveIntensity).toBe(0.5)

    harness.container.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }))
    harness.runNextFrame(180)
    expect(nearestMaterial.emissiveIntensity).toBe(0.5)
    controller.dispose()
  })

  it('keeps a coarse-pointer fixture active until pointer up or cancel', () => {
    const harness = createHarness()
    vi.mocked(harness.raycaster.intersectObjects).mockImplementation((objects) => [
      { distance: 1, object: objects[0]! },
    ])
    const controller = createController(harness)
    controller.start()
    harness.runNextFrame()

    harness.container.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100,
        pointerId: 7,
        pointerType: 'touch',
      }),
    )
    const target = vi.mocked(harness.raycaster.intersectObjects).mock.calls[0]![0][0] as Mesh
    const material = target.material as MeshStandardMaterial
    harness.runNextFrame(180)
    expect(material.emissiveIntensity).toBe(1)

    harness.container.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 103,
        clientY: 103,
        pointerId: 7,
        pointerType: 'touch',
      }),
    )
    harness.runNextFrame(16)
    expect(material.emissiveIntensity).toBe(1)

    harness.container.dispatchEvent(
      new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch' }),
    )
    harness.runNextFrame(180)
    expect(material.emissiveIntensity).toBe(0.5)

    harness.container.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100,
        pointerId: 8,
        pointerType: 'touch',
      }),
    )
    harness.runNextFrame(180)
    expect(material.emissiveIntensity).toBe(1)
    harness.container.dispatchEvent(
      new PointerEvent('pointercancel', { pointerId: 8, pointerType: 'touch' }),
    )
    harness.runNextFrame(180)
    expect(material.emissiveIntensity).toBe(0.5)
    controller.dispose()
  })

  it('releases touch activation after a scroll-sized move without preventing the gesture', () => {
    const harness = createHarness()
    vi.mocked(harness.raycaster.intersectObjects).mockImplementation((objects) => [
      { distance: 1, object: objects[0]! },
    ])
    const controller = createController(harness)
    controller.start()
    harness.runNextFrame()
    harness.container.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100,
        pointerId: 9,
        pointerType: 'touch',
      }),
    )
    const target = vi.mocked(harness.raycaster.intersectObjects).mock.calls[0]![0][0] as Mesh
    const material = target.material as MeshStandardMaterial
    harness.runNextFrame(180)
    expect(material.emissiveIntensity).toBe(1)

    const scrollMove = new PointerEvent('pointermove', {
      cancelable: true,
      clientX: 101,
      clientY: 112,
      pointerId: 9,
      pointerType: 'touch',
    })
    harness.container.dispatchEvent(scrollMove)
    harness.runNextFrame(180)

    expect(scrollMove.defaultPrevented).toBe(false)
    expect(material.emissiveIntensity).toBe(0.5)
    controller.dispose()
  })
})

describe('parking garage startup performance fallback', () => {
  it('ignores 30 slow warm-up frames before measuring 60 healthy frames', () => {
    const harness = createHarness()
    const controller = createController(harness)
    controller.start()

    for (let frame = 0; frame < 30; frame += 1) harness.runNextFrame(100)
    for (let frame = 0; frame < 60; frame += 1) harness.runNextFrame(16)

    expect(harness.fallbackReasons).toEqual([])
    expect(harness.frameCount()).toBe(1)
    controller.dispose()
  })

  it('falls back once after 60 measured frames average below 24 FPS', () => {
    const harness = createHarness()
    const controller = createController(harness)
    controller.start()

    for (let frame = 0; frame < 89; frame += 1) harness.runNextFrame(50)
    expect(harness.fallbackReasons).toEqual([])
    expect(harness.frameCount()).toBe(1)

    harness.runNextFrame(50)
    controller.start()

    expect(harness.fallbackReasons).toEqual(['performance'])
    expect(harness.onReady).toHaveBeenCalledTimes(1)
    expect(harness.frameCount()).toBe(0)
  })

  it('does not count the zero-duration resume frame among the 60 samples', () => {
    const harness = createHarness()
    const controller = createController(harness)
    controller.start()

    for (let frame = 0; frame < 30; frame += 1) harness.runNextFrame(16)
    harness.setVisibility('hidden')
    harness.advanceTime(5_000)
    harness.setVisibility('visible')
    harness.runNextFrame()
    for (let frame = 0; frame < 60; frame += 1) harness.runNextFrame(42)

    expect(harness.fallbackReasons).toEqual(['performance'])
    expect(harness.frameCount()).toBe(0)
  })

  it('stops performance monitoring after a healthy startup sample', () => {
    const harness = createHarness()
    const controller = createController(harness)
    controller.start()

    for (let frame = 0; frame < 30; frame += 1) harness.runNextFrame(16)
    for (let frame = 0; frame < 60; frame += 1) harness.runNextFrame(16)
    for (let frame = 0; frame < 200 && harness.frameCount() > 0; frame += 1) {
      harness.runNextFrame(50)
    }

    expect(harness.fallbackReasons).toEqual([])
    expect(harness.frameCount()).toBe(1)
    controller.dispose()
  })
})

describe('parking garage controller fallback', () => {
  it('fails closed when renderer creation throws', () => {
    const harness = createHarness()
    harness.adapters.createRenderer = vi.fn(() => {
      throw new Error('WebGL unavailable')
    })

    const controller = createController(harness)
    controller.start()
    controller.start()

    expect(harness.fallbackReasons).toEqual(['renderer'])
    expect(harness.frameCount()).toBe(0)

    controller.dispose()
    expect(harness.fallbackReasons).toEqual(['renderer'])
  })

  it('falls back once on context loss and cannot restart afterward', () => {
    const harness = createHarness()
    const controller = createController(harness)
    controller.start()

    const firstLoss = new Event('webglcontextlost', { cancelable: true })
    harness.canvas.dispatchEvent(firstLoss)
    harness.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    controller.start()

    expect(firstLoss.defaultPrevented).toBe(true)
    expect(harness.fallbackReasons).toEqual(['context-lost'])
    expect(harness.frameCount()).toBe(0)
  })

  it('falls back once when a render frame throws and schedules no replacement', () => {
    const harness = createHarness()
    vi.mocked(harness.renderer.render).mockImplementation(() => {
      throw new Error('render failed')
    })
    const controller = createController(harness)
    controller.start()

    harness.runNextFrame()
    controller.start()

    expect(harness.fallbackReasons).toEqual(['runtime'])
    expect(harness.onReady).not.toHaveBeenCalled()
    expect(harness.frameCount()).toBe(0)
  })

  it('converts non-renderer setup errors into a runtime fallback', () => {
    const harness = createHarness()
    harness.adapters.createRaycaster = () => {
      throw new Error('raycaster setup failed')
    }

    expect(() => createController(harness)).not.toThrow()
    expect(harness.fallbackReasons).toEqual(['runtime'])
    expect(harness.renderer.dispose).toHaveBeenCalledTimes(1)
    expect(harness.frameCount()).toBe(0)
  })
})
