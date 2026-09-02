import * as THREE from 'three'
import type { QualityProfile } from './parkingGarageQuality'

const { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PointLight } = THREE
type BoxGeometry = InstanceType<typeof THREE.BoxGeometry>
type BufferGeometry = InstanceType<typeof THREE.BufferGeometry>
type Group = InstanceType<typeof THREE.Group>
type Material = InstanceType<typeof THREE.Material>
type Mesh = InstanceType<typeof THREE.Mesh>
type MeshBasicMaterial = InstanceType<typeof THREE.MeshBasicMaterial>
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
  markingMaterial: MeshBasicMaterial
  signMaterial: MeshStandardMaterial
  housingMaterial: MeshStandardMaterial
}

const createResources = (): GarageResources => ({
  boxGeometry: new BoxGeometry(1, 1, 1),
  concreteMaterial: new MeshStandardMaterial({ color: 0xbfc4c7, roughness: 0.92 }),
  darkConcreteMaterial: new MeshStandardMaterial({ color: 0x767d82, roughness: 0.96 }),
  markingMaterial: new MeshBasicMaterial({ color: 0xf4f5ef }),
  signMaterial: new MeshStandardMaterial({ color: 0x176b52, roughness: 0.72 }),
  housingMaterial: new MeshStandardMaterial({ color: 0xd9dde0, roughness: 0.58 }),
})

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

const addGarageStructure = (
  garage: Group,
  resources: GarageResources,
  profile: QualityProfile,
): void => {
  const { boxGeometry, concreteMaterial, darkConcreteMaterial, markingMaterial, signMaterial } = resources
  const floor = createNamedGroup('garage-floor')
  floor.add(
    createBox(boxGeometry, concreteMaterial, 'main-deck', [24, 0.3, 42], [0, -0.2, -5]),
    createBox(boxGeometry, concreteMaterial, 'lower-deck', [24, 0.3, 18], [0, -1.35, -39]),
  )

  const ceiling = createNamedGroup('garage-ceiling')
  ceiling.add(
    createBox(boxGeometry, concreteMaterial, 'main-ceiling', [24, 0.35, 42], [0, 5.7, -5]),
    createBox(boxGeometry, concreteMaterial, 'lower-ceiling', [24, 0.35, 18], [0, 4.55, -39]),
  )

  const walls = createNamedGroup('garage-walls')
  walls.add(
    createBox(boxGeometry, concreteMaterial, 'left-wall', [0.4, 6, 66], [-12, 2.7, -17]),
    createBox(boxGeometry, concreteMaterial, 'right-wall', [0.4, 6, 66], [12, 2.7, -17]),
  )

  const pillars = createNamedGroup('garage-pillars')
  for (const z of [10, -2, -14, -28, -40]) {
    for (const x of [-8, 8]) {
      pillars.add(createBox(boxGeometry, darkConcreteMaterial, 'garage-pillar', [1.1, 5.7, 1.1], [x, 2.65, z]))
    }
  }

  const aisleMarkings = createNamedGroup('aisle-markings')
  for (const z of [10, 4, -2, -8, -14, -20, -26, -34, -40]) {
    aisleMarkings.add(createBox(boxGeometry, markingMaterial, 'aisle-dash', [0.14, 0.025, 2.8], [0, 0, z]))
  }

  const parkingBays = createNamedGroup('parking-bays')
  for (const z of [10, 4, -2, -8, -14, -20, -34, -40]) {
    parkingBays.add(
      createBox(boxGeometry, markingMaterial, 'left-parking-bay', [4.5, 0.025, 0.1], [-7.2, 0, z]),
      createBox(boxGeometry, markingMaterial, 'right-parking-bay', [4.5, 0.025, 0.1], [7.2, 0, z]),
    )
  }

  const ramp = createNamedGroup('garage-ramp')
  const rampSlab = createBox(boxGeometry, concreteMaterial, 'ramp-slab', [10, 0.3, 22], [4.8, -0.7, -23])
  rampSlab.rotation.x = -0.052
  ramp.add(rampSlab)

  const directionalSigns = createNamedGroup('directional-signs')
  directionalSigns.add(
    createBox(boxGeometry, signMaterial, 'ramp-direction-sign', [3.2, 1.1, 0.18], [4.8, 3.65, -13]),
    createBox(boxGeometry, markingMaterial, 'ramp-direction-arrow', [1.5, 0.18, 0.08], [4.8, 3.65, -13.12]),
  )

  const resetPillar = createBox(
    boxGeometry,
    darkConcreteMaterial,
    'reset-occlusion-pillar',
    [3.2, 5.8, 3.2],
    [5.2, 1.55, -44.2],
  )
  const resetWall = createBox(
    boxGeometry,
    concreteMaterial,
    'reset-occlusion-wall',
    [18, 5.8, 0.8],
    [2.5, 1.55, -48],
  )

  garage.add(
    floor,
    ceiling,
    walls,
    pillars,
    aisleMarkings,
    parkingBays,
    ramp,
    directionalSigns,
    resetPillar,
    resetWall,
  )

  garage.traverse((object: Object3D) => {
    if (!(object instanceof Mesh)) return
    object.castShadow = profile.shadows
    object.receiveShadow = profile.shadows
  })
}

interface FixtureOptions {
  id: string
  kind: FixtureKind
  position: readonly [number, number, number]
  housingSize: readonly [number, number, number]
  diffuserSize: readonly [number, number, number]
  diffuserOffset: readonly [number, number, number]
  lightOffset: readonly [number, number, number]
  maxLightPower: number
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
    resources.housingMaterial,
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

  const light = new PointLight(0xe7f4ff, 1, 7, 2)
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

const addFixtures = (garage: Group, resources: GarageResources, profile: QualityProfile): Fixture[] => {
  const fixtureGroup = createNamedGroup('garage-fixtures')
  const fixtures: Fixture[] = []
  let emissiveTemplate: MeshStandardMaterial | null = null
  const nextEmissiveMaterial = (): MeshStandardMaterial => {
    if (emissiveTemplate === null) {
      emissiveTemplate = new MeshStandardMaterial({
        color: 0xeef6ff,
        emissive: 0xe4f2ff,
        emissiveIntensity: RESTING_INTENSITY,
        roughness: 0.34,
      })
      return emissiveTemplate
    }

    return emissiveTemplate.clone()
  }

  const moldBarRows = Math.max(1, Math.ceil(profile.moldBarCount / 2))
  for (let index = 0; index < profile.moldBarCount; index += 1) {
    const row = Math.floor(index / 2)
    const rowProgress = moldBarRows === 1 ? 0 : row / (moldBarRows - 1)
    const lane = index % 2 === 0 ? -3.4 : 3.4
    const fixture = createFixture(
      resources,
      {
        id: `mold-bar-${index + 1}`,
        kind: 'mold-bar',
        position: [lane, 5.38, 9 - rowProgress * 38],
        housingSize: [4.8, 0.24, 0.58],
        diffuserSize: [4.35, 0.08, 0.42],
        diffuserOffset: [0, -0.15, 0],
        lightOffset: [0, -0.6, 0],
        maxLightPower: 900,
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
        position: [11.72, 2.2 - progress * 1.15, -16 - progress * 27],
        housingSize: [0.28, 1.25, 0.82],
        diffuserSize: [0.08, 0.92, 0.58],
        diffuserOffset: [-0.18, 0, 0],
        lightOffset: [-0.72, 0, 0],
        maxLightPower: 520,
      },
      nextEmissiveMaterial(),
    )
    fixtures.push(fixture)
    fixtureGroup.add(fixture.group)
  }

  garage.add(fixtureGroup)
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
  const step = (Math.max(0, deltaSeconds) / INTENSITY_TRANSITION_SECONDS) *
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

  model.group.traverse((object: Object3D) => {
    if (!(object instanceof Mesh)) return

    geometries.add(object.geometry)
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of meshMaterials) materials.add(material)
  })

  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()

  model.group.clear()
  model.fixtures.splice(0)
}
