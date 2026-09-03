import { describe, expect, it, vi } from 'vitest'
import {
  Box3,
  Group,
  Mesh,
  MeshStandardMaterial,
  Texture,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three'
import {
  createParkingGarageModel,
  disposeGarageModel,
  setFixtureActive,
  updateFixtureIntensity,
} from './parkingGarageModels'
import { selectParkingGarageQuality } from './parkingGarageQuality'

const desktopProfile = selectParkingGarageQuality({
  webglAvailable: true,
  viewportWidth: 1_440,
  devicePixelRatio: 2,
})

const mobileProfile = selectParkingGarageQuality({
  webglAvailable: true,
  viewportWidth: 390,
  devicePixelRatio: 3,
})

const getRequiredObject = <T extends Object3D>(
  model: ReturnType<typeof createParkingGarageModel>,
  name: string,
): T => {
  const object = model.group.getObjectByName(name)
  if (!object) throw new Error(`Expected garage object \"${name}\"`)
  return object as T
}

describe('createParkingGarageModel', () => {
  it('uses the different real desktop and mobile fixture budgets', () => {
    const desktopModel = createParkingGarageModel(desktopProfile)
    const mobileModel = createParkingGarageModel(mobileProfile)

    expect(desktopModel.fixtures).toHaveLength(20)
    expect(desktopModel.fixtures.filter(({ kind }) => kind === 'mold-bar')).toHaveLength(12)
    expect(desktopModel.fixtures.filter(({ kind }) => kind === 'wall-light')).toHaveLength(8)

    expect(mobileModel.fixtures).toHaveLength(12)
    expect(mobileModel.fixtures.filter(({ kind }) => kind === 'mold-bar')).toHaveLength(8)
    expect(mobileModel.fixtures.filter(({ kind }) => kind === 'wall-light')).toHaveLength(4)
  })

  it('exposes a uniquely addressable hit target for every fixture', () => {
    const model = createParkingGarageModel(desktopProfile)

    expect(new Set(model.fixtures.map(({ id }) => id)).size).toBe(model.fixtures.length)
    for (const fixture of model.fixtures) {
      expect(fixture.hitTarget.userData.fixtureId).toBe(fixture.id)
      expect(fixture.group.children).toContain(fixture.hitTarget)
      expect(fixture.group.children).toContain(fixture.light)
    }
  })

  it('contains the complete garage and reset occluders in one group', () => {
    const model = createParkingGarageModel(desktopProfile)
    const names = new Set<string>()
    model.group.traverse((object: Object3D) => names.add(object.name))

    expect([...names]).toEqual(
      expect.arrayContaining([
        'garage-floor',
        'garage-ceiling',
        'garage-walls',
        'garage-pillars',
        'aisle-markings',
        'parking-bays',
        'garage-ramp',
        'directional-signs',
        'reset-occlusion-pillar',
        'reset-occlusion-wall',
      ]),
    )
  })

  it('builds two parallel mold-bar rails with thin white linear fixtures', () => {
    const model = createParkingGarageModel(desktopProfile)
    const rails = [
      getRequiredObject<Mesh>(model, 'left-mold-bar-rail'),
      getRequiredObject<Mesh>(model, 'right-mold-bar-rail'),
    ]

    expect(rails.map(({ position }) => Math.sign(position.x))).toEqual([-1, 1])
    for (const rail of rails) {
      expect(rail.scale.x).toBeLessThanOrEqual(0.22)
      expect(rail.scale.z).toBeGreaterThanOrEqual(42)
    }

    const moldBarFixtures = model.fixtures.filter(({ kind }) => kind === 'mold-bar')
    expect(new Set(moldBarFixtures.map(({ group }) => Math.sign(group.position.x)))).toEqual(
      new Set([-1, 1]),
    )
    for (const fixture of moldBarFixtures) {
      const housing = fixture.group.getObjectByName(`${fixture.id}-housing`) as Mesh
      const material = housing.material as MeshStandardMaterial
      const { l: lightness } = material.color.getHSL({ h: 0, s: 0, l: 0 })

      expect(housing.scale.x).toBeLessThanOrEqual(0.5)
      expect(housing.scale.y).toBeLessThanOrEqual(0.2)
      expect(housing.scale.z).toBeGreaterThanOrEqual(3.8)
      expect(lightness).toBeGreaterThanOrEqual(0.82)
    }
  })

  it('creates complete marked parking stalls and wheel stops on both sides of the aisle', () => {
    const model = createParkingGarageModel(desktopProfile)
    const leftBays = getRequiredObject<Group>(model, 'left-parking-bays')
    const rightBays = getRequiredObject<Group>(model, 'right-parking-bays')
    const countNamedChildren = (group: Group, name: string) =>
      group.children.filter((child) => child.name === name).length

    expect(countNamedChildren(leftBays, 'parking-divider')).toBeGreaterThanOrEqual(6)
    expect(countNamedChildren(rightBays, 'parking-divider')).toBeGreaterThanOrEqual(6)
    expect(countNamedChildren(leftBays, 'wheel-stop')).toBeGreaterThanOrEqual(5)
    expect(countNamedChildren(rightBays, 'wheel-stop')).toBeGreaterThanOrEqual(5)
    expect(leftBays.children.every(({ position }) => position.x < 0)).toBe(true)
    expect(rightBays.children.every(({ position }) => position.x > 0)).toBe(true)
  })

  it('uses a dark textured floor material instead of bright flat concrete', () => {
    const model = createParkingGarageModel(desktopProfile)
    const mainDeck = getRequiredObject<Mesh>(model, 'main-deck')
    const material = mainDeck.material as MeshStandardMaterial
    const { l: lightness } = material.color.getHSL({ h: 0, s: 0, l: 0 })

    expect(lightness).toBeLessThanOrEqual(0.24)
    expect(lightness).toBeGreaterThanOrEqual(0.06)
    expect(material.roughness).toBeGreaterThanOrEqual(0.55)
    expect(material.roughness).toBeLessThanOrEqual(0.64)
    expect(material.map).not.toBeNull()
    expect(material.roughnessMap).not.toBeNull()
  })

  it('opens the main deck for one consistently sloped ramp assembly', () => {
    const model = createParkingGarageModel(desktopProfile)
    const floor = getRequiredObject<Group>(model, 'garage-floor')
    const ramp = getRequiredObject<Group>(model, 'garage-ramp')
    const rampParts = [
      'ramp-slab',
      'ramp-left-curb',
      'ramp-right-curb',
      'ramp-left-edge',
      'ramp-right-edge',
    ]

    model.group.updateMatrixWorld(true)
    const rampCenterAtDeckHeight = new Vector3(4.9, -0.2, -30)
    const blocksRampCenter = floor.children
      .filter(({ name }) => name !== 'lower-deck')
      .some((deck) => new Box3().setFromObject(deck).containsPoint(rampCenterAtDeckHeight))

    expect(blocksRampCenter).toBe(false)
    expect(ramp.rotation.x).toBeLessThan(-0.04)
    for (const name of rampParts) {
      const part = getRequiredObject<Mesh>(model, name)
      expect(part.parent).toBe(ramp)
      expect(part.rotation.x).toBe(0)
    }

    const rightBays = getRequiredObject<Group>(model, 'right-parking-bays')
    const deepestRightDivider = Math.min(
      ...rightBays.children
        .filter(({ name }) => name === 'parking-divider')
        .map(({ position }) => position.z),
    )
    expect(deepestRightDivider).toBeGreaterThanOrEqual(-14)
  })
})

describe('fixture intensity', () => {
  it('activates only the selected fixture', () => {
    const model = createParkingGarageModel(desktopProfile)
    const first = model.fixtures[0]!
    const second = model.fixtures[1]!

    expect(first.currentIntensity).toBe(0.5)
    expect(first.emissiveMaterial).not.toBe(second.emissiveMaterial)
    setFixtureActive(model.fixtures, first.id)

    expect(first.targetIntensity).toBe(1)
    expect(second.targetIntensity).toBe(0.5)
  })

  it('reaches its target in 180ms and updates emissive and physical light output', () => {
    const model = createParkingGarageModel(desktopProfile)
    const first = model.fixtures[0]!
    const second = model.fixtures[1]!
    const restingPower = first.light.power

    setFixtureActive(model.fixtures, first.id)
    updateFixtureIntensity(first, 0.18)

    expect(first.currentIntensity).toBeCloseTo(1, 2)
    expect(first.emissiveMaterial.emissiveIntensity).toBeCloseTo(1, 2)
    expect(first.light.power).toBeCloseTo(restingPower * 2, 2)
    expect(second.emissiveMaterial.emissiveIntensity).toBe(0.5)
  })
})

describe('disposeGarageModel', () => {
  it('disposes every unique resource once and clears owned references', () => {
    const model = createParkingGarageModel(desktopProfile)
    const geometries = new Set<BufferGeometry>()
    const materials = new Set<Material>()
    const textures = new Set<Texture>()

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

    const geometryDisposals = [...geometries].map((geometry) => vi.spyOn(geometry, 'dispose'))
    const materialDisposals = [...materials].map((material) => vi.spyOn(material, 'dispose'))
    const textureDisposals = [...textures].map((texture) => vi.spyOn(texture, 'dispose'))

    disposeGarageModel(model)

    for (const dispose of geometryDisposals) expect(dispose).toHaveBeenCalledTimes(1)
    for (const dispose of materialDisposals) expect(dispose).toHaveBeenCalledTimes(1)
    for (const dispose of textureDisposals) expect(dispose).toHaveBeenCalledTimes(1)
    expect(model.fixtures).toHaveLength(0)
    expect(model.group.children).toHaveLength(0)
  })
})
