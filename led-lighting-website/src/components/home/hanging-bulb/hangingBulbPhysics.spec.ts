import { describe, expect, it } from 'vitest'
import {
  applyCordImpulse,
  createHangingBulbPhysics,
  getBulbPosition,
  resolveBulbBrightness,
  stepHangingBulbPhysics,
} from './hangingBulbPhysics'

const ELEVEN_DEGREES = (11 * Math.PI) / 180
const THIRTEEN_DEGREES = (13 * Math.PI) / 180
const FOURTEEN_DEGREES = (14 * Math.PI) / 180
const EIGHTEEN_DEGREES = (18 * Math.PI) / 180

describe('hangingBulbPhysics', () => {
  const createState = () =>
    createHangingBulbPhysics({
      anchor: { x: 0, y: 2 },
      cordLength: 2.4,
    })

  const simulate = (framesPerSecond: number, seconds: number) => {
    const state = createState()
    applyCordImpulse(state, { x: 0.04, y: 0.8 }, { x: 0.2, y: 0.02 }, 0.22)
    for (let frame = 0; frame < framesPerSecond * seconds; frame += 1) {
      stepHangingBulbPhysics(state, 1 / framesPerSecond)
    }
    return state
  }

  it('accepts a brush only near the vertical cord and caps the resulting angular speed', () => {
    const state = createState()

    expect(applyCordImpulse(state, { x: 0.04, y: 0.8 }, { x: 0.8, y: -0.4 }, 0.22)).toBe(true)
    expect(state.angularVelocity).toBeGreaterThan(0)
    expect(state.angularVelocity).toBeLessThanOrEqual(0.92)

    const velocityAfterHit = state.angularVelocity
    expect(applyCordImpulse(state, { x: 1.2, y: 0.8 }, { x: 1, y: 1 }, 0.22)).toBe(false)
    expect(state.angularVelocity).toBe(velocityAfterHit)
  })

  it('lets a small brush reach thirteen degrees and settles without cable waves or uncontrolled rotation', () => {
    const state = createState()
    applyCordImpulse(state, { x: 0.03, y: 0.5 }, { x: 0.16, y: 0 }, 0.22)
    let peakAngle = 0

    for (let frame = 0; frame < 120 * 6; frame += 1) {
      stepHangingBulbPhysics(state, 1 / 120)
      peakAngle = Math.max(peakAngle, Math.abs(state.angle))
    }

    expect(peakAngle).toBeGreaterThanOrEqual(ELEVEN_DEGREES)
    expect(peakAngle).toBeLessThanOrEqual(THIRTEEN_DEGREES)
    expect(Math.abs(state.angle)).toBeLessThan(0.004)
    expect(Math.abs(state.angularVelocity)).toBeLessThan(0.012)
  })

  it('preserves cord length while allowing up to eighteen degrees in both directions', () => {
    for (const direction of [-1, 1]) {
      const state = createState()
      applyCordImpulse(state, { x: 0, y: 1 }, { x: direction * 4, y: 0 }, 0.22)
      let peakAngle = 0

      for (let frame = 0; frame < 240; frame += 1) {
        stepHangingBulbPhysics(state, 1 / 120)
        peakAngle = Math.max(peakAngle, Math.abs(state.angle))
      }

      const bulb = getBulbPosition(state)
      expect(Math.hypot(bulb.x - state.anchor.x, bulb.y - state.anchor.y)).toBeCloseTo(
        state.cordLength,
        8,
      )
      expect(peakAngle).toBeGreaterThan(FOURTEEN_DEGREES)
      expect(peakAngle).toBeLessThanOrEqual(EIGHTEEN_DEGREES)
    }
  })

  it('produces the same pendulum motion over equal wall-clock time at 30, 60, and 120 Hz', () => {
    const states = [30, 60, 120].map((rate) => simulate(rate, 1.5))
    const reference = states[1]!

    states.forEach((state) => {
      expect(state.angle).toBeCloseTo(reference.angle, 7)
      expect(state.angularVelocity).toBeCloseTo(reference.angularVelocity, 7)
      expect(getBulbPosition(state).x).toBeCloseTo(getBulbPosition(reference).x, 7)
      expect(getBulbPosition(state).y).toBeCloseTo(getBulbPosition(reference).y, 7)
    })
  })

  it('uses an irregular safe idle range, a static reduced-motion value, and full hover brightness', () => {
    const idleSamples = Array.from({ length: 120 }, (_, index) =>
      resolveBulbBrightness({ elapsedMs: index * 83, hovered: false, reducedMotion: false }),
    )

    expect(Math.min(...idleSamples)).toBeGreaterThanOrEqual(0.35)
    expect(Math.max(...idleSamples)).toBeLessThanOrEqual(0.82)
    expect(new Set(idleSamples.map((sample) => sample.toFixed(3))).size).toBeGreaterThan(30)
    expect(resolveBulbBrightness({ elapsedMs: 500, hovered: true, reducedMotion: false })).toBe(1)
    expect(resolveBulbBrightness({ elapsedMs: 500, hovered: false, reducedMotion: true })).toBe(
      0.58,
    )
  })

  it('repeats a twelve-second mobile cycle with irregular full-blackout windows', () => {
    const sample = (elapsedMs: number) =>
      resolveBulbBrightness({
        elapsedMs,
        hovered: false,
        mobile: true,
        reducedMotion: false,
      })
    const blackoutTimes = [1_900, 4_250, 6_800, 9_300, 10_900]
    const litTimes = [500, 3_000, 5_200, 8_200, 11_600]

    blackoutTimes.forEach((elapsedMs) => expect(sample(elapsedMs)).toBe(0))
    litTimes.forEach((elapsedMs) => expect(sample(elapsedMs)).toBeGreaterThan(0.3))
    ;[500, 1_900, 4_250, 8_200, 10_900].forEach((elapsedMs) => {
      expect(sample(elapsedMs + 12_000)).toBeCloseTo(sample(elapsedMs), 8)
    })
    expect(
      resolveBulbBrightness({
        elapsedMs: 1_900,
        hovered: false,
        mobile: true,
        reducedMotion: true,
      }),
    ).toBe(0.58)
  })
})
