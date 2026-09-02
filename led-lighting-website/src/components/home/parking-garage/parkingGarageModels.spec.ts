import { describe, expect, it, vi } from 'vitest'
import { Mesh, type BufferGeometry, type Material, type Object3D } from 'three'
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

  it('contains the complete low-poly garage and reset occluders in one group', () => {
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

    model.group.traverse((object: Object3D) => {
      if (!(object instanceof Mesh)) return

      geometries.add(object.geometry)
      const meshMaterials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of meshMaterials) materials.add(material)
    })

    const geometryDisposals = [...geometries].map((geometry) => vi.spyOn(geometry, 'dispose'))
    const materialDisposals = [...materials].map((material) => vi.spyOn(material, 'dispose'))

    disposeGarageModel(model)

    for (const dispose of geometryDisposals) expect(dispose).toHaveBeenCalledTimes(1)
    for (const dispose of materialDisposals) expect(dispose).toHaveBeenCalledTimes(1)
    expect(model.fixtures).toHaveLength(0)
    expect(model.group.children).toHaveLength(0)
  })
})
