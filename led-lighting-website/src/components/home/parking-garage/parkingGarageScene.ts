import * as THREE from 'three'
import { PARKING_GARAGE_LOOP_MS, sampleParkingGaragePath } from './parkingGaragePath'
import {
  createParkingGarageModel,
  disposeGarageModel,
  setFixtureActive,
  updateFixtureIntensity,
  type GarageModel,
} from './parkingGarageModels'
import { selectParkingGarageQuality } from './parkingGarageQuality'

type Camera = InstanceType<typeof THREE.Camera>
type DirectionalLight = InstanceType<typeof THREE.DirectionalLight>
type Object3D = InstanceType<typeof THREE.Object3D>
type PerspectiveCamera = InstanceType<typeof THREE.PerspectiveCamera>
type Scene = InstanceType<typeof THREE.Scene>
type Vector2 = InstanceType<typeof THREE.Vector2>

export type FallbackReason = 'renderer' | 'context-lost' | 'performance' | 'runtime'

export interface ParkingGarageRenderer {
  domElement: HTMLCanvasElement
  outputColorSpace: string
  shadowMap: {
    enabled: boolean
    type: number
  }
  dispose(): void
  render(scene: Scene, camera: Camera): void
  setPixelRatio(pixelRatio: number): void
  setSize(width: number, height: number, updateStyle?: boolean): void
}

export interface ParkingGarageIntersection {
  distance: number
  object: Object3D
}

export interface ParkingGarageRaycaster {
  intersectObjects(objects: Object3D[], recursive?: boolean): ParkingGarageIntersection[]
  setFromCamera(coordinates: Vector2, camera: Camera): void
}

export interface ControllerAdapters {
  cancelAnimationFrame(frameId: number): void
  createRaycaster(): ParkingGarageRaycaster
  createRenderer(parameters: THREE.WebGLRendererParameters): ParkingGarageRenderer
  now(): number
  requestAnimationFrame(callback: FrameRequestCallback): number
}

export interface ControllerOptions {
  adapters?: Partial<ControllerAdapters>
  container: HTMLElement
  onFallback(reason: FallbackReason): void
  onReady(): void
  reducedMotion: boolean
}

export interface ParkingGarageController {
  dispose(): void
  pause(): void
  start(): void
}

const REDUCED_MOTION_POSE_MS = 7_000
const TOUCH_MOVE_THRESHOLD_PX = 8
const PERFORMANCE_WARMUP_FRAMES = 30
const PERFORMANCE_SAMPLE_FRAMES = 60
const MINIMUM_STARTUP_FPS = 24

const createDefaultAdapters = (): ControllerAdapters => ({
  cancelAnimationFrame: (frameId) => window.cancelAnimationFrame(frameId),
  createRaycaster: () => new THREE.Raycaster(),
  createRenderer: (parameters) => new THREE.WebGLRenderer(parameters),
  now: () => performance.now(),
  requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
})

const createFailedController = (
  onFallback: (reason: FallbackReason) => void,
  reason: FallbackReason,
): ParkingGarageController => {
  onFallback(reason)
  return {
    dispose: () => undefined,
    pause: () => undefined,
    start: () => undefined,
  }
}

export const createParkingGarageController = (
  options: ControllerOptions,
): ParkingGarageController => {
  const adapters = { ...createDefaultAdapters(), ...options.adapters }
  const { container, onFallback, onReady, reducedMotion } = options
  const profile = selectParkingGarageQuality({
    devicePixelRatio: window.devicePixelRatio,
    viewportWidth: window.innerWidth,
    webglAvailable: true,
  })

  let renderer: ParkingGarageRenderer
  // Renderer construction is the WebGL capability boundary, so it has a distinct
  // fallback reason from later scene/model setup failures.
  try {
    renderer = adapters.createRenderer({
      antialias: profile.mode === 'desktop',
      powerPreference: 'high-performance',
    })
  } catch {
    return createFailedController(onFallback, 'renderer')
  }

  let camera: PerspectiveCamera | null = null
  let directionalLight: DirectionalLight | null = null
  let disposed = false
  let failed = false
  let frameId: number | null = null
  let lastFrameTime: number | null = null
  let listenersAttached = false
  let model: GarageModel | null = null
  let ready = false
  let resourcesDisposed = false
  let runningRequested = false
  let scene: Scene | null = null
  let elapsedLoopMs = 0
  let renderedFrames = 0
  let performanceCheckComplete = false
  const performanceDurations: number[] = []
  const pointer = new THREE.Vector2()
  let raycaster: ParkingGarageRaycaster | null = null
  let activeTouch: { pointerId: number; startX: number; startY: number } | null = null

  const cancelFrame = (): void => {
    if (frameId === null) return
    adapters.cancelAnimationFrame(frameId)
    frameId = null
    lastFrameTime = null
  }

  const resize = (): void => {
    if (!camera || resourcesDisposed) return
    const width = Math.max(1, container.clientWidth)
    const height = Math.max(1, container.clientHeight)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
  }

  const selectFixtureAt = (clientX: number, clientY: number): void => {
    if (!camera || !model || !raycaster || failed || disposed) return
    const rectangle = renderer.domElement.getBoundingClientRect()
    if (rectangle.width <= 0 || rectangle.height <= 0) {
      setFixtureActive(model.fixtures, null)
      return
    }

    pointer.set(
      ((clientX - rectangle.left) / rectangle.width) * 2 - 1,
      -((clientY - rectangle.top) / rectangle.height) * 2 + 1,
    )
    raycaster.setFromCamera(pointer, camera)
    const hitTargets = model.fixtures.map(({ hitTarget }) => hitTarget)
    const nearest = raycaster
      .intersectObjects(hitTargets, false)
      .reduce<ParkingGarageIntersection | null>(
        (closest, intersection) =>
          closest === null || intersection.distance < closest.distance ? intersection : closest,
        null,
      )
    const fixtureId = nearest?.object.userData.fixtureId
    setFixtureActive(model.fixtures, typeof fixtureId === 'string' ? fixtureId : null)
  }

  const clearFixture = (): void => {
    if (model) setFixtureActive(model.fixtures, null)
  }

  const handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch') {
      selectFixtureAt(event.clientX, event.clientY)
      return
    }
    if (!activeTouch || activeTouch.pointerId !== event.pointerId) return

    const distance = Math.hypot(event.clientX - activeTouch.startX, event.clientY - activeTouch.startY)
    if (distance > TOUCH_MOVE_THRESHOLD_PX) {
      // Release the decorative press state without preventing the pointer event;
      // the browser must remain free to turn this gesture into page scrolling.
      activeTouch = null
      clearFixture()
    }
  }

  const handlePointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch') return
    activeTouch = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY }
    selectFixtureAt(event.clientX, event.clientY)
  }

  const handlePointerEnd = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch') return
    if (!activeTouch || activeTouch.pointerId !== event.pointerId) return
    activeTouch = null
    clearFixture()
  }

  const handlePointerLeave = (): void => {
    activeTouch = null
    clearFixture()
  }

  const disposeResources = (): void => {
    if (resourcesDisposed) return
    resourcesDisposed = true
    if (model) disposeGarageModel(model)
    model = null
    directionalLight?.shadow.dispose()
    directionalLight = null
    scene?.clear()
    scene = null
    camera = null
    renderer.dispose()
    renderer.domElement.remove()
  }

  const removeListeners = (): void => {
    if (!listenersAttached) return
    listenersAttached = false
    window.removeEventListener('resize', resize)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    container.removeEventListener('pointermove', handlePointerMove)
    container.removeEventListener('pointerdown', handlePointerDown)
    container.removeEventListener('pointerup', handlePointerEnd)
    container.removeEventListener('pointercancel', handlePointerEnd)
    container.removeEventListener('pointerleave', handlePointerLeave)
    renderer.domElement.removeEventListener('webglcontextlost', handleContextLost)
  }

  const transitionToFallback = (reason: FallbackReason): void => {
    // A failed controller is terminal for the session. This guard also makes
    // concurrent context/runtime failures report to the host exactly once.
    if (failed || disposed) return
    failed = true
    runningRequested = false
    cancelFrame()
    removeListeners()
    disposeResources()
    onFallback(reason)
  }

  function handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden') {
      cancelFrame()
      return
    }
    lastFrameTime = null
    scheduleFrame()
  }

  function handleContextLost(event: Event): void {
    event.preventDefault()
    transitionToFallback('context-lost')
  }

  const hasFailedPerformanceCheck = (deltaMs: number): boolean => {
    renderedFrames += 1
    if (renderedFrames <= PERFORMANCE_WARMUP_FRAMES) return false
    if (performanceCheckComplete) return false
    // The first frame after visibility resume intentionally has no elapsed time;
    // counting it would inflate measured FPS and hide genuinely slow startup.
    if (deltaMs <= 0) return false

    performanceDurations.push(deltaMs)
    if (performanceDurations.length < PERFORMANCE_SAMPLE_FRAMES) return false
    performanceCheckComplete = true

    const averageDuration =
      performanceDurations.reduce((total, duration) => total + duration, 0) /
      performanceDurations.length
    return averageDuration > 1_000 / MINIMUM_STARTUP_FPS
  }

  const renderFrame = (): void => {
    frameId = null
    if (!runningRequested || failed || disposed || document.visibilityState === 'hidden') return

    try {
      const currentTime = adapters.now()
      const deltaMs = lastFrameTime === null ? 0 : Math.max(0, currentTime - lastFrameTime)
      lastFrameTime = currentTime
      elapsedLoopMs = (elapsedLoopMs + deltaMs) % PARKING_GARAGE_LOOP_MS
      const pose = sampleParkingGaragePath(reducedMotion ? REDUCED_MOTION_POSE_MS : elapsedLoopMs)

      camera!.position.set(pose.position.x, pose.position.y, pose.position.z)
      camera!.lookAt(pose.target.x, pose.target.y, pose.target.z)
      for (const fixture of model!.fixtures) updateFixtureIntensity(fixture, deltaMs / 1_000)
      renderer.render(scene!, camera!)

      if (!ready) {
        ready = true
        onReady()
      }
      if (hasFailedPerformanceCheck(deltaMs)) {
        transitionToFallback('performance')
        return
      }
    } catch {
      transitionToFallback('runtime')
      return
    }

    scheduleFrame()
  }

  function scheduleFrame(): void {
    if (
      frameId !== null ||
      !runningRequested ||
      failed ||
      disposed ||
      document.visibilityState === 'hidden'
    ) {
      return
    }

    try {
      frameId = adapters.requestAnimationFrame(renderFrame)
    } catch {
      transitionToFallback('runtime')
    }
  }

  const attachListeners = (): void => {
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerdown', handlePointerDown)
    container.addEventListener('pointerup', handlePointerEnd)
    container.addEventListener('pointercancel', handlePointerEnd)
    container.addEventListener('pointerleave', handlePointerLeave)
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost)
    listenersAttached = true
  }

  try {
    raycaster = adapters.createRaycaster()
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0xb8bec2)
    camera = new THREE.PerspectiveCamera(58, 1, 0.1, 120)
    const ambientLight = new THREE.AmbientLight(0xdce5ea, 1.4)
    directionalLight = new THREE.DirectionalLight(0xf5f8ff, 2.2)
    directionalLight.position.set(-4, 8, 10)
    directionalLight.castShadow = profile.shadows
    directionalLight.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize)
    scene.add(ambientLight, directionalLight)

    model = createParkingGarageModel(profile)
    scene.add(model.group)

    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = profile.shadows
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.setPixelRatio(profile.pixelRatio)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.width = '100%'
    container.append(renderer.domElement)
    resize()
    attachListeners()
  } catch {
    transitionToFallback('runtime')
  }

  return {
    dispose: () => {
      if (disposed) return
      disposed = true
      runningRequested = false
      cancelFrame()
      removeListeners()
      disposeResources()
    },
    pause: () => {
      if (disposed || failed) return
      runningRequested = false
      cancelFrame()
    },
    start: () => {
      if (disposed || failed) return
      runningRequested = true
      scheduleFrame()
    },
  }
}
