import * as THREE from 'three'
import { createLedBulbModel } from './createLedBulbModel'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import {
  applyCordImpulse,
  createHangingBulbPhysics,
  getBulbPosition,
  resolveBulbBrightness,
  stepHangingBulbPhysics,
  type HangingBulbPhysicsState,
} from './hangingBulbPhysics'

type Camera = InstanceType<typeof THREE.Camera>
type Scene = InstanceType<typeof THREE.Scene>

export type HangingBulbFallbackReason = 'renderer' | 'context-lost' | 'runtime'

export interface HangingBulbController {
  dispose(): void
  pause(): void
  start(): void
}

export interface HangingBulbRenderer {
  dispose(): void
  domElement: HTMLCanvasElement
  outputColorSpace: string
  render(scene: Scene, camera: Camera): void
  setClearColor(color: THREE.ColorRepresentation, alpha?: number): void
  setPixelRatio(pixelRatio: number): void
  setSize(width: number, height: number, updateStyle?: boolean): void
  toneMapping: number
  toneMappingExposure: number
}

interface StudioEnvironment {
  dispose(): void
  texture: THREE.Texture
}

export interface HangingBulbControllerAdapters {
  cancelAnimationFrame(frameId: number): void
  createEnvironment(renderer: HangingBulbRenderer): StudioEnvironment
  createRenderer(parameters: THREE.WebGLRendererParameters): HangingBulbRenderer
  now(): number
  requestAnimationFrame(callback: FrameRequestCallback): number
}

interface ControllerOptions {
  adapters?: Partial<HangingBulbControllerAdapters>
  container: HTMLElement
  onFallback(reason: HangingBulbFallbackReason): void
  onReady(): void
  reducedMotion: boolean
}

interface HangingBulbModel {
  bulbGroup: THREE.Group
  bulbLight: THREE.PointLight
  cord: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshPhysicalMaterial>
  globe: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>
  globeMaterial: THREE.MeshPhysicalMaterial
  haloMaterial: THREE.SpriteMaterial
  outerHaloMaterial: THREE.SpriteMaterial
  physics: HangingBulbPhysicsState
  root: THREE.Group
}

const createStudioEnvironment = (renderer: HangingBulbRenderer): StudioEnvironment => {
  const generator = new THREE.PMREMGenerator(renderer as THREE.WebGLRenderer)
  const roomEnvironment = new RoomEnvironment()
  try {
    const target = generator.fromScene(roomEnvironment, 0.04)
    return {
      dispose: () => target.dispose(),
      texture: target.texture,
    }
  } finally {
    roomEnvironment.dispose()
    generator.dispose()
  }
}

const createDefaultAdapters = (): HangingBulbControllerAdapters => ({
  cancelAnimationFrame: (frameId) => window.cancelAnimationFrame(frameId),
  createEnvironment: createStudioEnvironment,
  createRenderer: (parameters) => new THREE.WebGLRenderer(parameters),
  now: () => performance.now(),
  requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
})

const createFailedController = (): HangingBulbController => ({
  dispose: () => undefined,
  pause: () => undefined,
  start: () => undefined,
})

const createHangingBulbModel = (compactProfile: boolean): HangingBulbModel => {
  const physics = createHangingBulbPhysics({
    anchor: { x: 0, y: 2.86 },
    cordLength: 2.22,
  })

  const root = new THREE.Group()
  root.position.y = 0.04
  root.scale.setScalar(compactProfile ? 1.06 : 0.98)

  try {
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 1, 10, 1),
      new THREE.MeshPhysicalMaterial({
        clearcoat: 0.08,
        color: 0x171b1d,
        metalness: 0.04,
        roughness: 0.88,
      }),
    )
    cord.name = 'pendant-cord'
    root.add(cord)

    const bulbGroup = new THREE.Group()
    root.add(bulbGroup)

    const led = createLedBulbModel(bulbGroup, compactProfile)
    return { bulbGroup, cord, physics, root, ...led }
  } catch (error) {
    // Model creation is transactional so partially-added GPU resources never survive a failed setup.
    disposeObject(root)
    throw error
  }
}

const cordDirection = new THREE.Vector3()
const cordMidpoint = new THREE.Vector3()
const upAxis = new THREE.Vector3(0, 1, 0)

const updateModelPose = (model: HangingBulbModel): void => {
  const { anchor, angle } = model.physics
  const bulbPosition = getBulbPosition(model.physics)
  cordDirection.set(bulbPosition.x - anchor.x, bulbPosition.y - anchor.y, 0)
  const cordLength = Math.max(cordDirection.length(), 0.0001)
  cordMidpoint.set((anchor.x + bulbPosition.x) * 0.5, (anchor.y + bulbPosition.y) * 0.5, 0)
  model.cord.position.copy(cordMidpoint)
  model.cord.quaternion.setFromUnitVectors(upAxis, cordDirection.normalize())
  model.cord.scale.set(1, cordLength, 1)

  model.bulbGroup.position.set(bulbPosition.x, bulbPosition.y, 0)
  model.bulbGroup.rotation.z = angle
}

const updateModelBrightness = (model: HangingBulbModel, brightness: number): void => {
  const power = THREE.MathUtils.smoothstep(brightness, 0, 0.18)
  const hoverBoost = THREE.MathUtils.clamp((brightness - 0.82) / 0.18, 0, 1)
  model.globeMaterial.emissiveIntensity = power * (0.3 + brightness * 0.9 + hoverBoost * 0.5)
  model.bulbLight.intensity = power * (1.4 + brightness * 3.2 + hoverBoost * 2)
  model.haloMaterial.opacity = power * (0.2 + brightness * 0.38 + hoverBoost * 0.18)
  model.outerHaloMaterial.opacity = power * (0.06 + brightness * 0.13 + hoverBoost * 0.08)
}

const disposeObject = (root: THREE.Object3D): void => {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  root.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) {
      geometries.add(child.geometry)
    }
    if (
      child instanceof THREE.Mesh ||
      child instanceof THREE.InstancedMesh ||
      child instanceof THREE.Sprite
    ) {
      const childMaterials = Array.isArray(child.material) ? child.material : [child.material]
      childMaterials.forEach((material) => materials.add(material))
    }
  })
  const textures = new Set<THREE.Texture>()
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => {
    // Materials can share maps (including future product markings); release each owned map once.
    Object.values(material).forEach((value) => {
      if (value instanceof THREE.Texture) textures.add(value)
    })
    material.dispose()
  })
  textures.forEach((texture) => texture.dispose())
}

export const createHangingBulbController = (options: ControllerOptions): HangingBulbController => {
  const adapters = { ...createDefaultAdapters(), ...options.adapters }
  const { container, onFallback, onReady, reducedMotion } = options

  let renderer: HangingBulbRenderer | null = null
  try {
    renderer = adapters.createRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.86
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    container.appendChild(renderer.domElement)
  } catch {
    const fallbackReason: HangingBulbFallbackReason = renderer ? 'runtime' : 'renderer'
    renderer?.dispose()
    renderer?.domElement.remove()
    onFallback(fallbackReason)
    return createFailedController()
  }
  const activeRenderer = renderer

  let camera: THREE.PerspectiveCamera | null = null
  let disposed = false
  let environment: StudioEnvironment | null = null
  let failed = false
  let frameId: number | null = null
  let hovered = false
  let lastFrameTime: number | null = null
  let listenersAttached = false
  let model: HangingBulbModel | null = null
  let mobilePresentation = false
  let pointerInside = false
  let previousPointerWorld: THREE.Vector3 | null = null
  let ready = false
  let resourcesDisposed = false
  let resizeObserver: ResizeObserver | null = null
  let running = false
  let scene: THREE.Scene | null = null
  const startedAt = adapters.now()
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const pointerPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
  const pointerWorld = new THREE.Vector3()

  const cancelFrame = (): void => {
    if (frameId === null) return
    adapters.cancelAnimationFrame(frameId)
    frameId = null
    lastFrameTime = null
  }

  const resize = (): void => {
    if (!camera || resourcesDisposed) return
    const width = Math.max(container.clientWidth, 1)
    const height = Math.max(container.clientHeight, 1)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    const compactProfile = width < 540 || window.innerWidth < 768
    mobilePresentation = width < 640 || window.innerWidth < 640
    activeRenderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, compactProfile ? 1.2 : 1.65),
    )
    activeRenderer.setSize(width, height, false)
  }

  const removeListeners = (): void => {
    if (!listenersAttached) return
    listenersAttached = false
    window.removeEventListener('resize', resize)
    container.removeEventListener('pointermove', handlePointerMove)
    container.removeEventListener('pointerleave', handlePointerLeave)
    activeRenderer.domElement.removeEventListener('webglcontextlost', handleContextLost)
    resizeObserver?.disconnect()
    resizeObserver = null
  }

  const disposeResources = (): void => {
    if (resourcesDisposed) return
    resourcesDisposed = true
    cancelFrame()
    removeListeners()
    if (model) disposeObject(model.root)
    model = null
    environment?.dispose()
    environment = null
    scene?.clear()
    scene = null
    camera = null
    activeRenderer.dispose()
    activeRenderer.domElement.remove()
  }

  const transitionToFallback = (reason: HangingBulbFallbackReason): void => {
    if (failed || disposed) return
    failed = true
    running = false
    disposeResources()
    onFallback(reason)
  }

  const scheduleFrame = (): void => {
    if (!running || reducedMotion || failed || disposed || frameId !== null) return
    frameId = adapters.requestAnimationFrame(renderFrame)
  }

  const refreshHoverState = (): void => {
    if (!pointerInside || !camera || !model) {
      hovered = false
      return
    }
    raycaster.setFromCamera(pointer, camera)
    model.root.updateMatrixWorld(true)
    hovered = raycaster.intersectObject(model.globe, false).length > 0
  }

  function renderFrame(time: number): void {
    frameId = null
    if (!scene || !camera || !model || failed || disposed) return
    try {
      const deltaSeconds =
        lastFrameTime === null ? 1 / 60 : Math.min((time - lastFrameTime) / 1_000, 1 / 30)
      lastFrameTime = time
      if (!reducedMotion) stepHangingBulbPhysics(model.physics, deltaSeconds)
      updateModelPose(model)
      refreshHoverState()
      const targetBrightness = resolveBulbBrightness({
        elapsedMs: time - startedAt,
        hovered,
        mobile: mobilePresentation,
        reducedMotion,
      })
      updateModelBrightness(model, targetBrightness)
      activeRenderer.render(scene, camera)
      if (!ready) {
        ready = true
        onReady()
      }
      scheduleFrame()
    } catch {
      transitionToFallback('runtime')
    }
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!camera || !model || failed || disposed || event.pointerType === 'touch') return
    const bounds = activeRenderer.domElement.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) return
    pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    )
    pointerInside = true
    refreshHoverState()

    if (raycaster.ray.intersectPlane(pointerPlane, pointerWorld)) {
      if (!reducedMotion && previousPointerWorld) {
        const localPointer = model.root.worldToLocal(pointerWorld.clone())
        const localPrevious = model.root.worldToLocal(previousPointerWorld.clone())
        applyCordImpulse(
          model.physics,
          { x: localPointer.x, y: localPointer.y },
          {
            x: THREE.MathUtils.clamp(localPointer.x - localPrevious.x, -0.18, 0.18),
            y: THREE.MathUtils.clamp(localPointer.y - localPrevious.y, -0.18, 0.18),
          },
          0.2,
        )
      }
      previousPointerWorld = pointerWorld.clone()
    }
    if (reducedMotion) renderFrame(adapters.now())
  }

  function handlePointerLeave(): void {
    pointerInside = false
    hovered = false
    previousPointerWorld = null
    if (reducedMotion) renderFrame(adapters.now())
  }

  function handleContextLost(event: Event): void {
    event.preventDefault()
    transitionToFallback('context-lost')
  }

  const addListeners = (): void => {
    if (listenersAttached) return
    listenersAttached = true
    window.addEventListener('resize', resize)
    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerleave', handlePointerLeave)
    activeRenderer.domElement.addEventListener('webglcontextlost', handleContextLost)
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(container)
    }
  }

  try {
    environment = adapters.createEnvironment(activeRenderer)
    scene = new THREE.Scene()
    scene.environment = environment.texture
    scene.environmentIntensity = 0.7
    camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50)
    camera.position.set(0, 0.1, 8.5)
    const initialWidth = container.clientWidth || window.innerWidth
    model = createHangingBulbModel(initialWidth < 540 || window.innerWidth < 768)
    scene.add(model.root)
    scene.add(new THREE.HemisphereLight(0xf3f6ff, 0x1b2229, 0.65))
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4)
    keyLight.position.set(4, 5, 7)
    scene.add(keyLight)
    const rimLight = new THREE.DirectionalLight(0xd9e7ff, 1.3)
    rimLight.position.set(-4, 2, 4)
    scene.add(rimLight)
    resize()
    addListeners()
    updateModelPose(model)
    updateModelBrightness(model, 0.58)
  } catch {
    transitionToFallback('runtime')
    return createFailedController()
  }

  return {
    dispose: () => {
      if (disposed) return
      disposed = true
      running = false
      disposeResources()
    },
    pause: () => {
      running = false
      cancelFrame()
    },
    start: () => {
      if (disposed || failed || running) return
      running = true
      renderFrame(adapters.now())
    },
  }
}
