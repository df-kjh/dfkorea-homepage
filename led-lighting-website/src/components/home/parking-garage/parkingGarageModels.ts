import * as THREE from 'three'
import type { QualityProfile } from './parkingGarageQuality'

const {
  BoxGeometry,
  DataTexture,
  Group,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  UnsignedByteType,
} = THREE
type BoxGeometry = InstanceType<typeof THREE.BoxGeometry>
type BufferGeometry = InstanceType<typeof THREE.BufferGeometry>
type Group = InstanceType<typeof THREE.Group>
type Material = InstanceType<typeof THREE.Material>
type Mesh = InstanceType<typeof THREE.Mesh>
type MeshStandardMaterial = InstanceType<typeof THREE.MeshStandardMaterial>
type Object3D = InstanceType<typeof THREE.Object3D>
type PointLight = InstanceType<typeof THREE.PointLight>

export type FixtureKind = 'mold-bar' | 'wall-light'

export interface Fixture {
  id: string
  kind: FixtureKind
  group: Group
  hitTarget: Mesh
  emissiveMaterial: MeshStandardMaterial
  light: PointLight
  maxLightPower: number
  currentIntensity: number
  targetIntensity: number
}

export interface GarageModel {
  group: Group
  fixtures: Fixture[]
}

const RESTING_INTENSITY = 0.5
const ACTIVE_INTENSITY = 1
const INTENSITY_TRANSITION_SECONDS = 0.18

interface GarageResources {
  boxGeometry: BoxGeometry
  concreteMaterial: MeshStandardMaterial
  darkConcreteMaterial: MeshStandardMaterial
  floorMaterial: MeshStandardMaterial
  markingMaterial: MeshStandardMaterial
  yellowMaterial: MeshStandardMaterial
  rubberMaterial: MeshStandardMaterial
  railMaterial: MeshStandardMaterial
  moldBarHousingMaterial: MeshStandardMaterial
  wallLightHousingMaterial: MeshStandardMaterial
}

const createNoiseTexture = (
  seed: number,
  minimum: number,
  maximum: number,
  repeat: readonly [number, number],
  colorTexture: boolean,
): InstanceType<typeof THREE.DataTexture> => {
  const size = 32
  const data = new Uint8Array(size * size * 4)
  let state = seed >>> 0

  for (let index = 0; index < size * size; index += 1) {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    const value = minimum + (state % (maximum - minimum + 1))
    const offset = index * 4
    data[offset] = value
    data[offset + 1] = value
    data[offset + 2] = value
    data[offset + 3] = 255
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(...repeat)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  if (colorTexture) texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

const createResources = (): GarageResources => {
  const concreteMap = createNoiseTexture(17, 194, 208, [5, 14], true)
  const concreteRoughness = createNoiseTexture(29, 148, 235, [5, 14], false)
  const floorMap = createNoiseTexture(43, 145, 165, [8, 20], true)
  const floorRoughness = createNoiseTexture(71, 118, 224, [8, 20], false)

  return {
    boxGeometry: new BoxGeometry(1, 1, 1),
    concreteMaterial: new MeshStandardMaterial({
      color: 0x8d9294,
      map: concreteMap,
      roughness: 0.88,
      roughnessMap: concreteRoughness,
      metalness: 0,
    }),
    darkConcreteMaterial: new MeshStandardMaterial({
      color: 0x4d5254,
      map: concreteMap,
      roughness: 0.94,
      roughnessMap: concreteRoughness,
      metalness: 0,
    }),
    floorMaterial: new MeshStandardMaterial({
      color: 0x4b5154,
      map: floorMap,
      roughness: 0.6,
      roughnessMap: floorRoughness,
      metalness: 0.04,
    }),
    markingMaterial: new MeshStandardMaterial({ color: 0xd7d8d2, roughness: 0.78 }),
    yellowMaterial: new MeshStandardMaterial({ color: 0xd29a18, roughness: 0.66 }),
    rubberMaterial: new MeshStandardMaterial({ color: 0x111416, roughness: 0.9 }),
    railMaterial: new MeshStandardMaterial({ color: 0x202428, roughness: 0.48, metalness: 0.35 }),
    moldBarHousingMaterial: new MeshStandardMaterial({
      color: 0xf1f2ef,
      roughness: 0.34,
      metalness: 0.08,
    }),
    wallLightHousingMaterial: new MeshStandardMaterial({
      color: 0x292d30,
      roughness: 0.46,
      metalness: 0.22,
    }),
  }
}

const createBox = (
  geometry: BoxGeometry,
  material: Material,
  name: string,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
): Mesh => {
  const mesh = new Mesh(geometry, material)
  mesh.name = name
  mesh.scale.set(...size)
  mesh.position.set(...position)
  return mesh
}

const createNamedGroup = (name: string): Group => {
  const group = new Group()
  group.name = name
  return group
}

const addParkingBays = (garage: Group, resources: GarageResources, side: -1 | 1): void => {
  const group = createNamedGroup(side < 0 ? 'left-parking-bays' : 'right-parking-bays')
  const aisleEdgeX = 4.3
  const outerEdgeX = 11.15
  const lineCenterX = side * ((aisleEdgeX + outerEdgeX) / 2)
  const lineLength = outerEdgeX - aisleEdgeX
  const boundaryZ =
    side < 0 ? [14, 8.4, 2.8, -2.8, -8.4, -14, -19.6] : [14, 8.4, 2.8, -2.8, -8.4, -14]

  for (const z of boundaryZ) {
    group.add(
      createBox(
        resources.boxGeometry,
        resources.markingMaterial,
        'parking-divider',
        [lineLength, 0.024, 0.09],
        [lineCenterX, 0.008, z],
      ),
    )
  }

  group.add(
    createBox(
      resources.boxGeometry,
      resources.markingMaterial,
      'parking-back-line',
      [0.09, 0.024, 33.6],
      [side * outerEdgeX, 0.008, -2.8],
    ),
  )

  for (let index = 0; index < boundaryZ.length - 1; index += 1) {
    const z = (boundaryZ[index]! + boundaryZ[index + 1]!) / 2
    group.add(
      createBox(
        resources.boxGeometry,
        resources.rubberMaterial,
        'wheel-stop',
        [0.32, 0.18, 1.82],
        [side * 10.25, 0.1, z],
      ),
      createBox(
        resources.boxGeometry,
        resources.yellowMaterial,
        'wheel-stop-reflector',
        [0.34, 0.04, 0.58],
        [side * 10.25, 0.205, z],
      ),
    )
  }

  garage.add(group)
}

const addGarageStructure = (
  garage: Group,
  resources: GarageResources,
  profile: QualityProfile,
): void => {
  const {
    boxGeometry,
    concreteMaterial,
    darkConcreteMaterial,
    floorMaterial,
    markingMaterial,
    rubberMaterial,
    yellowMaterial,
  } = resources

  const floor = createNamedGroup('garage-floor')
  floor.add(
    createBox(boxGeometry, floorMaterial, 'main-deck', [12.3, 0.3, 50], [-5.85, -0.2, -7]),
    createBox(
      boxGeometry,
      floorMaterial,
      'right-front-deck',
      [11.7, 0.3, 36.5],
      [6.15, -0.2, -0.25],
    ),
    createBox(
      boxGeometry,
      floorMaterial,
      'right-ramp-side-deck',
      [2.5, 0.3, 23],
      [10.75, -0.2, -30],
    ),
    createBox(boxGeometry, floorMaterial, 'lower-deck', [24, 0.3, 20], [0, -1.35, -42]),
  )
  for (const z of [14, 2, -10]) {
    floor.add(
      createBox(
        boxGeometry,
        darkConcreteMaterial,
        'floor-expansion-joint',
        [24, 0.018, 0.035],
        [0, -0.035, z],
      ),
    )
  }

  const ceiling = createNamedGroup('garage-ceiling')
  ceiling.add(
    createBox(boxGeometry, concreteMaterial, 'main-ceiling', [24, 0.35, 50], [0, 5.7, -7]),
    createBox(boxGeometry, concreteMaterial, 'lower-ceiling', [24, 0.35, 20], [0, 4.55, -42]),
  )
  for (const z of [14, 2, -10, -22]) {
    ceiling.add(
      createBox(
        boxGeometry,
        darkConcreteMaterial,
        'ceiling-joint',
        [24, 0.025, 0.045],
        [0, 5.5, z],
      ),
    )
  }

  const walls = createNamedGroup('garage-walls')
  walls.add(
    createBox(boxGeometry, concreteMaterial, 'left-wall', [0.4, 6, 72], [-12, 2.7, -19]),
    createBox(boxGeometry, concreteMaterial, 'right-wall', [0.4, 6, 72], [12, 2.7, -19]),
    createBox(
      boxGeometry,
      darkConcreteMaterial,
      'left-wall-base',
      [0.44, 0.72, 72],
      [-11.78, 0.34, -19],
    ),
    createBox(
      boxGeometry,
      darkConcreteMaterial,
      'right-wall-base',
      [0.44, 0.72, 72],
      [11.78, 0.34, -19],
    ),
  )
  for (const z of [14, 2, -10, -22, -34, -46]) {
    walls.add(
      createBox(
        boxGeometry,
        darkConcreteMaterial,
        'left-wall-joint',
        [0.025, 5.2, 0.035],
        [-11.77, 3, z],
      ),
      createBox(
        boxGeometry,
        darkConcreteMaterial,
        'right-wall-joint',
        [0.025, 5.2, 0.035],
        [11.77, 3, z],
      ),
    )
  }

  const beams = createNamedGroup('garage-beams')
  for (const z of [13, 1, -11, -23]) {
    beams.add(
      createBox(
        boxGeometry,
        darkConcreteMaterial,
        'ceiling-cross-beam',
        [24, 0.42, 0.62],
        [0, 5.28, z],
      ),
    )
  }

  const pillars = createNamedGroup('garage-pillars')
  for (const z of [11.2, -0.2, -11.4, -22.6, -35]) {
    for (const x of [-8.1, 8.1]) {
      if (x > 0 && z < -14) continue
      pillars.add(
        createBox(
          boxGeometry,
          darkConcreteMaterial,
          'garage-pillar',
          [1.05, 5.28, 1.05],
          [x, 2.49, z],
        ),
        createBox(boxGeometry, rubberMaterial, 'pillar-bumper', [1.12, 0.82, 1.12], [x, 0.38, z]),
        createBox(
          boxGeometry,
          yellowMaterial,
          'pillar-safety-band',
          [1.15, 0.16, 1.15],
          [x, 0.82, z],
        ),
      )
    }
  }

  const parkingBays = createNamedGroup('parking-bays')
  addParkingBays(parkingBays, resources, -1)
  addParkingBays(parkingBays, resources, 1)

  const aisleMarkings = createNamedGroup('aisle-markings')
  aisleMarkings.add(
    createBox(
      boxGeometry,
      markingMaterial,
      'left-aisle-edge',
      [0.08, 0.024, 34],
      [-4.3, 0.008, -2.8],
    ),
    createBox(
      boxGeometry,
      markingMaterial,
      'right-aisle-edge',
      [0.08, 0.024, 34],
      [4.3, 0.008, -2.8],
    ),
  )

  const ramp = createNamedGroup('garage-ramp')
  ramp.position.set(4.9, -0.62, -30)
  ramp.rotation.x = -0.052
  ramp.add(
    createBox(boxGeometry, floorMaterial, 'ramp-slab', [9.2, 0.3, 23], [0, 0, 0]),
    createBox(boxGeometry, concreteMaterial, 'ramp-left-curb', [0.42, 0.62, 23], [-4.4, 0.3, 0]),
    createBox(boxGeometry, concreteMaterial, 'ramp-right-curb', [0.42, 0.62, 23], [4.4, 0.3, 0]),
    createBox(boxGeometry, yellowMaterial, 'ramp-left-edge', [0.08, 0.06, 23], [-4.62, 0.18, 0]),
    createBox(boxGeometry, yellowMaterial, 'ramp-right-edge', [0.08, 0.06, 23], [4.62, 0.18, 0]),
  )

  const directionalSigns = createNamedGroup('directional-signs')
  directionalSigns.add(
    createBox(
      boxGeometry,
      darkConcreteMaterial,
      'ramp-direction-sign',
      [3.1, 0.82, 0.16],
      [4.9, 3.72, -18.5],
    ),
    createBox(
      boxGeometry,
      yellowMaterial,
      'ramp-direction-arrow',
      [1.35, 0.11, 0.06],
      [4.9, 3.72, -18.6],
    ),
  )

  const services = createNamedGroup('ceiling-services')
  services.add(
    createBox(
      boxGeometry,
      darkConcreteMaterial,
      'left-service-tray',
      [0.34, 0.24, 47],
      [-10.4, 5.12, -7],
    ),
    createBox(
      boxGeometry,
      darkConcreteMaterial,
      'right-service-tray',
      [0.34, 0.24, 47],
      [10.4, 5.12, -7],
    ),
  )

  const resetPillar = createBox(
    boxGeometry,
    darkConcreteMaterial,
    'reset-occlusion-pillar',
    [3.2, 5.8, 3.2],
    [5.2, 1.55, -48.2],
  )
  const resetWall = createBox(
    boxGeometry,
    concreteMaterial,
    'reset-occlusion-wall',
    [18, 5.8, 0.8],
    [2.5, 1.55, -52],
  )

  garage.add(
    floor,
    ceiling,
    walls,
    beams,
    pillars,
    parkingBays,
    aisleMarkings,
    ramp,
    directionalSigns,
    services,
    resetPillar,
    resetWall,
  )

  garage.traverse((object: Object3D) => {
    if (!(object instanceof Mesh)) return
    object.castShadow = profile.shadows && object.name !== 'main-deck'
    object.receiveShadow = profile.shadows
  })
}

interface FixtureOptions {
  id: string
  kind: FixtureKind
  position: readonly [number, number, number]
  housingMaterial: MeshStandardMaterial
  housingSize: readonly [number, number, number]
  diffuserSize: readonly [number, number, number]
  diffuserOffset: readonly [number, number, number]
  lightOffset: readonly [number, number, number]
  maxLightPower: number
  lightDistance: number
}

const createFixture = (
  resources: GarageResources,
  options: FixtureOptions,
  emissiveMaterial: MeshStandardMaterial,
): Fixture => {
  const group = createNamedGroup(options.id)
  group.position.set(...options.position)

  const housing = createBox(
    resources.boxGeometry,
    options.housingMaterial,
    `${options.id}-housing`,
    options.housingSize,
    [0, 0, 0],
  )
  const hitTarget = createBox(
    resources.boxGeometry,
    emissiveMaterial,
    `${options.id}-hit-target`,
    options.diffuserSize,
    options.diffuserOffset,
  )
  hitTarget.userData.fixtureId = options.id

  const light = new PointLight(0xe8f0f4, 1, options.lightDistance, 2)
  light.name = `${options.id}-light`
  light.position.set(...options.lightOffset)
  light.power = options.maxLightPower * RESTING_INTENSITY

  group.add(housing, hitTarget, light)

  return {
    id: options.id,
    kind: options.kind,
    group,
    hitTarget,
    emissiveMaterial,
    light,
    maxLightPower: options.maxLightPower,
    currentIntensity: RESTING_INTENSITY,
    targetIntensity: RESTING_INTENSITY,
  }
}

const addFixtures = (
  garage: Group,
  resources: GarageResources,
  profile: QualityProfile,
): Fixture[] => {
  const fixtureGroup = createNamedGroup('garage-fixtures')
  const moldBarRails = createNamedGroup('mold-bar-rails')
  const fixtures: Fixture[] = []
  let emissiveTemplate: MeshStandardMaterial | null = null
  const nextEmissiveMaterial = (): MeshStandardMaterial => {
    if (emissiveTemplate === null) {
      emissiveTemplate = new MeshStandardMaterial({
        color: 0xf5f7f5,
        emissive: 0xe7f0f3,
        emissiveIntensity: RESTING_INTENSITY,
        roughness: 0.28,
      })
      return emissiveTemplate
    }

    return emissiveTemplate.clone()
  }

  const moldBarLaneX = 2.72
  moldBarRails.add(
    createBox(
      resources.boxGeometry,
      resources.railMaterial,
      'left-mold-bar-rail',
      [0.18, 0.1, 46],
      [-moldBarLaneX, 5.43, -8],
    ),
    createBox(
      resources.boxGeometry,
      resources.railMaterial,
      'right-mold-bar-rail',
      [0.18, 0.1, 46],
      [moldBarLaneX, 5.43, -8],
    ),
  )

  const fixturesPerRail = Math.max(1, Math.ceil(profile.moldBarCount / 2))
  for (let index = 0; index < profile.moldBarCount; index += 1) {
    const sequence = Math.floor(index / 2)
    const progress = fixturesPerRail === 1 ? 0 : sequence / (fixturesPerRail - 1)
    const lane = index % 2 === 0 ? -moldBarLaneX : moldBarLaneX
    const fixture = createFixture(
      resources,
      {
        id: `mold-bar-${index + 1}`,
        kind: 'mold-bar',
        position: [lane, 5.31, 12 - progress * 36],
        housingMaterial: resources.moldBarHousingMaterial,
        housingSize: [0.42, 0.14, 4.7],
        diffuserSize: [0.3, 0.055, 4.28],
        diffuserOffset: [0, -0.085, 0],
        lightOffset: [0, -0.52, 0],
        maxLightPower: 820,
        lightDistance: 8.5,
      },
      nextEmissiveMaterial(),
    )
    fixtures.push(fixture)
    fixtureGroup.add(fixture.group)
  }

  const wallLightDivisor = Math.max(1, profile.wallLightCount - 1)
  for (let index = 0; index < profile.wallLightCount; index += 1) {
    const progress = index / wallLightDivisor
    const fixture = createFixture(
      resources,
      {
        id: `wall-light-${index + 1}`,
        kind: 'wall-light',
        position: [11.72, 2.35 - progress * 1.2, -19 - progress * 29],
        housingMaterial: resources.wallLightHousingMaterial,
        housingSize: [0.28, 0.74, 0.62],
        diffuserSize: [0.08, 0.48, 0.42],
        diffuserOffset: [-0.18, -0.04, 0],
        lightOffset: [-0.66, -0.2, 0],
        maxLightPower: 340,
        lightDistance: 5.5,
      },
      nextEmissiveMaterial(),
    )
    fixtures.push(fixture)
    fixtureGroup.add(fixture.group)
  }

  garage.add(moldBarRails, fixtureGroup)
  return fixtures
}

export const createParkingGarageModel = (profile: QualityProfile): GarageModel => {
  const group = createNamedGroup('parking-garage')
  const resources = createResources()

  addGarageStructure(group, resources, profile)
  const fixtures = addFixtures(group, resources, profile)

  return { group, fixtures }
}

export const setFixtureActive = (fixtures: Fixture[], activeId: string | null): void => {
  for (const fixture of fixtures) {
    fixture.targetIntensity = fixture.id === activeId ? ACTIVE_INTENSITY : RESTING_INTENSITY
  }
}

export const updateFixtureIntensity = (fixture: Fixture, deltaSeconds: number): void => {
  const direction = Math.sign(fixture.targetIntensity - fixture.currentIntensity)
  const step =
    (Math.max(0, deltaSeconds) / INTENSITY_TRANSITION_SECONDS) *
    (ACTIVE_INTENSITY - RESTING_INTENSITY)
  const nextIntensity = fixture.currentIntensity + direction * step

  fixture.currentIntensity =
    direction > 0
      ? Math.min(nextIntensity, fixture.targetIntensity)
      : Math.max(nextIntensity, fixture.targetIntensity)
  fixture.emissiveMaterial.emissiveIntensity = fixture.currentIntensity
  fixture.light.power = fixture.maxLightPower * fixture.currentIntensity
}

export const disposeGarageModel = (model: GarageModel): void => {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const textures = new Set<InstanceType<typeof THREE.Texture>>()

  model.group.traverse((object: Object3D) => {
    if (!(object instanceof Mesh)) return

    geometries.add(object.geometry)
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of meshMaterials) {
      materials.add(material)
      for (const value of Object.values(material)) {
        if (value instanceof Texture) textures.add(value)
      }
    }
  })

  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()
  for (const texture of textures) texture.dispose()

  model.group.clear()
  model.fixtures.splice(0)
}
