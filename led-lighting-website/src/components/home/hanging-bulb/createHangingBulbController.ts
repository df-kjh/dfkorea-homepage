import * as THREE from 'three'
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
  filamentBloomMaterial: THREE.MeshBasicMaterial
  filamentCoreMaterial: THREE.MeshBasicMaterial
  filamentMaterial: THREE.MeshStandardMaterial
  globe: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>
  globeMaterial: THREE.MeshPhysicalMaterial
  haloMaterial: THREE.SpriteMaterial
  innerGlassMaterial: THREE.MeshPhysicalMaterial
  lightVolumeMaterial: THREE.MeshBasicMaterial
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

const createRadialGlowTexture = (): THREE.DataTexture => {
  const size = 64
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const normalizedX = (x / (size - 1)) * 2 - 1
      const normalizedY = (y / (size - 1)) * 2 - 1
      const distance = Math.min(1, Math.hypot(normalizedX, normalizedY))
      const alpha = Math.round((1 - distance) ** 2.8 * 255)
      const offset = (y * size + x) * 4
      data[offset] = 255
      data[offset + 1] = 184
      data[offset + 2] = 92
      data[offset + 3] = alpha
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

const createSocketGeometry = (radialSegments: number): THREE.LatheGeometry => {
  const points = [
    [0.11, 0.08],
    [0.15, 0.04],
    [0.19, -0.02],
    [0.215, -0.1],
    [0.22, -0.38],
    [0.2, -0.48],
    [0.16, -0.56],
  ].map(([radius, y]) => new THREE.Vector2(radius!, y!))
  return new THREE.LatheGeometry(points, radialSegments)
}

const createGlobeGeometry = (radialSegments: number): THREE.LatheGeometry => {
  const controlPoints = [
    [0.15, -0.54],
    [0.17, -0.58],
    [0.23, -0.63],
    [0.34, -0.69],
    [0.47, -0.78],
    [0.58, -0.9],
    [0.66, -1.04],
    [0.71, -1.2],
    [0.73, -1.38],
    [0.72, -1.55],
    [0.68, -1.7],
    [0.61, -1.84],
    [0.51, -1.97],
    [0.39, -2.08],
    [0.25, -2.16],
    [0.12, -2.21],
    [0.04, -2.23],
    [0, -2.23],
  ].map(([radius, y]) => new THREE.Vector2(radius!, y!))
  const points = new THREE.SplineCurve(controlPoints)
    .getPoints(96)
    .map((point) => new THREE.Vector2(Math.max(0, point.x), point.y))
  return new THREE.LatheGeometry(points, radialSegments)
}

const createCylinderBetween = (
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  radialSegments = 8,
): THREE.Mesh => {
  const direction = end.clone().sub(start)
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), radialSegments),
    material,
  )
  mesh.position.copy(start).add(end).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
  return mesh
}

const createHangingBulbModel = (compactProfile: boolean): HangingBulbModel => {
  const radialSegments = compactProfile ? 64 : 96
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

    const darkMetal = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.28,
      color: 0x202427,
      metalness: 0.72,
      roughness: 0.32,
    })
    const brass = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.36,
      clearcoatRoughness: 0.18,
      color: 0xb48a52,
      metalness: 0.88,
      roughness: 0.24,
    })
    const ceramic = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.68,
      clearcoatRoughness: 0.12,
      color: 0xf1e8d8,
      metalness: 0.02,
      roughness: 0.2,
    })

    const strainRelief = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.12, 0.22, radialSegments),
      darkMetal,
    )
    strainRelief.position.y = -0.04
    bulbGroup.add(strainRelief)

    const socket = new THREE.Mesh(createSocketGeometry(radialSegments), brass)
    bulbGroup.add(socket)
    for (const [index, y] of [-0.12, -0.22, -0.32, -0.42].entries()) {
      const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.218, 0.012, 8, radialSegments), brass)
      ridge.position.y = y
      ridge.rotation.x = Math.PI / 2
      bulbGroup.add(ridge)

      const groove = new THREE.Mesh(
        new THREE.TorusGeometry(0.205, 0.007, 8, radialSegments),
        darkMetal,
      )
      groove.name = `socket-groove-${index}`
      groove.position.y = y + 0.034
      groove.rotation.x = Math.PI / 2
      bulbGroup.add(groove)
    }

    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.225, 0.17, 0.18, radialSegments),
      ceramic,
    )
    collar.position.y = -0.54
    bulbGroup.add(collar)

    const globeMaterial = new THREE.MeshPhysicalMaterial({
      attenuationColor: new THREE.Color(0xffd9a8),
      attenuationDistance: 3.8,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      color: 0xfff7e8,
      depthWrite: false,
      emissive: 0xffa63d,
      emissiveIntensity: 0.06,
      envMapIntensity: 1.62,
      ior: 1.48,
      opacity: 0.21,
      roughness: 0.035,
      side: THREE.DoubleSide,
      thickness: 0.12,
      transmission: 0.985,
      transparent: true,
    })
    const globe = new THREE.Mesh(createGlobeGeometry(radialSegments), globeMaterial)
    globe.name = 'bulb-glass'
    globe.renderOrder = 2
    bulbGroup.add(globe)

    const innerGlassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffc77a,
      depthWrite: false,
      emissive: 0xff8c2b,
      emissiveIntensity: 0.05,
      opacity: 0.045,
      roughness: 0.08,
      side: THREE.BackSide,
      thickness: 0.16,
      transmission: 0.96,
      transparent: true,
    })
    const innerGlass = new THREE.Mesh(globe.geometry, innerGlassMaterial)
    innerGlass.name = 'bulb-inner-glass'
    innerGlass.renderOrder = 1
    innerGlass.scale.setScalar(0.972)
    bulbGroup.add(innerGlass)

    const glassHighlightMaterial = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0xe9f7ff,
      depthWrite: false,
      opacity: 0.24,
      toneMapped: false,
      transparent: true,
    })
    const createGlassHighlight = (
      name: string,
      points: Array<[number, number, number]>,
    ): THREE.Mesh => {
      const curve = new THREE.CatmullRomCurve3(
        points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
        false,
        'centripetal',
      )
      const highlight = new THREE.Mesh(
        new THREE.TubeGeometry(curve, compactProfile ? 24 : 40, 0.01, 6, false),
        glassHighlightMaterial,
      )
      highlight.name = name
      highlight.renderOrder = 3
      return highlight
    }
    bulbGroup.add(
      createGlassHighlight('glass-highlight-left', [
        [-0.36, -0.8, 0.58],
        [-0.56, -1.06, 0.6],
        [-0.6, -1.43, 0.61],
        [-0.48, -1.78, 0.58],
        [-0.28, -2.02, 0.48],
      ]),
      createGlassHighlight('glass-highlight-right', [
        [0.39, -0.86, 0.55],
        [0.53, -1.1, 0.59],
        [0.52, -1.38, 0.6],
        [0.43, -1.61, 0.58],
      ]),
    )

    const lightVolumeMaterial = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0xff8c32,
      depthWrite: false,
      opacity: 0.04,
      side: THREE.BackSide,
      toneMapped: false,
      transparent: true,
    })
    const lightVolume = new THREE.Mesh(
      new THREE.SphereGeometry(0.56, compactProfile ? 32 : 48, compactProfile ? 20 : 32),
      lightVolumeMaterial,
    )
    lightVolume.name = 'bulb-light-volume'
    lightVolume.position.set(0, -1.47, 0.03)
    lightVolume.scale.set(1.04, 1.28, 1.04)
    lightVolume.renderOrder = 1
    bulbGroup.add(lightVolume)

    const stemMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xfff2d5,
      depthWrite: false,
      opacity: 0.24,
      roughness: 0.08,
      thickness: 0.08,
      transmission: 0.95,
      transparent: true,
    })
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.085, 0.86, 20), stemMaterial)
    stem.position.y = -1.54
    bulbGroup.add(stem)

    const filamentMaterial = new THREE.MeshStandardMaterial({
      color: 0xffc16e,
      emissive: 0xff6412,
      emissiveIntensity: 8.2,
      metalness: 0.02,
      roughness: 0.34,
    })
    const filamentCoreMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe2a4,
      opacity: 0.82,
      toneMapped: false,
      transparent: true,
    })
    const filamentBloomMaterial = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0xff8a26,
      depthWrite: false,
      opacity: 0.12,
      toneMapped: false,
      transparent: true,
    })
    const wireMaterial = new THREE.MeshStandardMaterial({
      color: 0x6f5842,
      metalness: 0.72,
      roughness: 0.42,
    })
    const filamentCount = 6
    for (let index = 0; index < filamentCount; index += 1) {
      const angle = (index / filamentCount) * Math.PI * 2 + Math.PI / 6
      const directionX = Math.cos(angle)
      const directionZ = Math.sin(angle)
      const curve = new THREE.CatmullRomCurve3(
        [
          [0.11, -1.82],
          [0.21, -1.68],
          [0.235, -1.46],
          [0.21, -1.23],
          [0.11, -1.08],
        ].map(([radius, y]) => new THREE.Vector3(directionX * radius!, y!, directionZ * radius!)),
        false,
        'centripetal',
      )
      const filament = new THREE.Mesh(
        new THREE.TubeGeometry(curve, compactProfile ? 28 : 40, 0.021, 10, false),
        filamentMaterial,
      )
      filament.name = `warm-filament-${index}`
      const filamentBloom = new THREE.Mesh(
        new THREE.TubeGeometry(curve, compactProfile ? 28 : 40, 0.038, 8, false),
        filamentBloomMaterial,
      )
      filamentBloom.name = `filament-bloom-${index}`
      filament.add(filamentBloom)
      filament.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(curve, compactProfile ? 28 : 40, 0.008, 8, false),
          filamentCoreMaterial,
        ),
      )
      bulbGroup.add(filament)
      bulbGroup.add(
        createCylinderBetween(
          new THREE.Vector3(0, -1.92, 0),
          new THREE.Vector3(directionX * 0.11, -1.82, directionZ * 0.11),
          0.007,
          wireMaterial,
          6,
        ),
      )
      bulbGroup.add(
        createCylinderBetween(
          new THREE.Vector3(0, -1.03, 0),
          new THREE.Vector3(directionX * 0.11, -1.08, directionZ * 0.11),
          0.007,
          wireMaterial,
          6,
        ),
      )
    }

    for (const y of [-1.04, -1.91]) {
      const supportRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.115, 0.008, 6, compactProfile ? 28 : 40),
        wireMaterial,
      )
      supportRing.position.y = y
      supportRing.rotation.x = Math.PI / 2
      bulbGroup.add(supportRing)
    }

    const haloMaterial = new THREE.SpriteMaterial({
      blending: THREE.AdditiveBlending,
      color: 0xff9a32,
      depthTest: false,
      depthWrite: false,
      map: createRadialGlowTexture(),
      opacity: 0.22,
      transparent: true,
    })
    const halo = new THREE.Sprite(haloMaterial)
    halo.name = 'bulb-inner-halo'
    halo.position.set(0, -1.42, 0.34)
    halo.scale.set(3.35, 3.35, 1)
    halo.renderOrder = 1
    bulbGroup.add(halo)

    const outerHaloMaterial = new THREE.SpriteMaterial({
      blending: THREE.AdditiveBlending,
      color: 0xff7620,
      depthTest: false,
      depthWrite: false,
      map: createRadialGlowTexture(),
      opacity: 0.08,
      transparent: true,
    })
    const outerHalo = new THREE.Sprite(outerHaloMaterial)
    outerHalo.name = 'bulb-outer-halo'
    outerHalo.position.set(0, -1.42, 0.2)
    outerHalo.scale.set(5.9, 5.9, 1)
    bulbGroup.add(outerHalo)

    const bulbLight = new THREE.PointLight(0xffad4d, 2.8, 8, 2)
    bulbLight.name = 'warm-bulb-light'
    bulbLight.position.set(0, -1.42, 0.28)
    bulbGroup.add(bulbLight)

    return {
      bulbGroup,
      bulbLight,
      cord,
      filamentBloomMaterial,
      filamentCoreMaterial,
      filamentMaterial,
      globe,
      globeMaterial,
      haloMaterial,
      innerGlassMaterial,
      lightVolumeMaterial,
      outerHaloMaterial,
      physics,
      root,
    }
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
  model.filamentMaterial.emissiveIntensity =
    power * (4.2 + brightness * 10.4 + hoverBoost * 10)
  model.filamentBloomMaterial.opacity =
    power * (0.05 + brightness * 0.12 + hoverBoost * 0.16)
  model.filamentCoreMaterial.opacity = power * (0.38 + brightness * 0.62)
  model.bulbLight.intensity = power * (0.8 + brightness * 3.4 + hoverBoost * 5.9)
  model.haloMaterial.opacity = power * (0.1 + brightness * 0.38 + hoverBoost * 0.22)
  model.outerHaloMaterial.opacity = power * (0.045 + brightness * 0.18 + hoverBoost * 0.22)
  model.lightVolumeMaterial.opacity =
    power * (0.018 + brightness * 0.04 + hoverBoost * 0.055)
  model.globeMaterial.emissiveIntensity =
    power * (0.02 + brightness * 0.07 + hoverBoost * 0.05)
  model.innerGlassMaterial.emissiveIntensity =
    power * (0.015 + brightness * 0.065 + hoverBoost * 0.055)
  model.globeMaterial.envMapIntensity = 1.4 + brightness * 0.42
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
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => {
    if (material instanceof THREE.SpriteMaterial) material.map?.dispose()
    material.dispose()
  })
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
    camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50)
    camera.position.set(0, 0.1, 8.5)
    const initialWidth = container.clientWidth || window.innerWidth
    model = createHangingBulbModel(initialWidth < 540 || window.innerWidth < 768)
    scene.add(model.root)
    scene.add(new THREE.HemisphereLight(0xfff0d5, 0x05080a, 0.9))
    const keyLight = new THREE.DirectionalLight(0xfff4df, 3.05)
    keyLight.position.set(4, 5, 7)
    scene.add(keyLight)
    const rimLight = new THREE.DirectionalLight(0xa8d9e5, 0.92)
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
