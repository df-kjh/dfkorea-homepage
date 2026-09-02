import { describe, expect, it } from 'vitest'
import { selectParkingGarageQuality, shouldUseReducedMotion } from './parkingGarageQuality'

describe('selectParkingGarageQuality', () => {
  it('caps desktop rendering at a 1.5 pixel ratio with shadows', () => {
    expect(
      selectParkingGarageQuality({
        webglAvailable: true,
        viewportWidth: 1440,
        devicePixelRatio: 3,
      }),
    ).toMatchObject({ mode: 'desktop', pixelRatio: 1.5, shadows: true })
  })

  it('uses the reduced mobile profile below 768 CSS pixels', () => {
    expect(
      selectParkingGarageQuality({
        webglAvailable: true,
        viewportWidth: 390,
        devicePixelRatio: 3,
      }),
    ).toMatchObject({ mode: 'mobile', pixelRatio: 1, shadows: false })

    expect(
      selectParkingGarageQuality({
        webglAvailable: true,
        viewportWidth: 768,
        devicePixelRatio: 1,
      }).mode,
    ).toBe('desktop')
  })

  it('selects fallback mode when WebGL is unavailable', () => {
    expect(
      selectParkingGarageQuality({
        webglAvailable: false,
        viewportWidth: 1440,
        devicePixelRatio: 2,
      }).mode,
    ).toBe('fallback')
  })
})

describe('shouldUseReducedMotion', () => {
  it('preserves the media-query match as a pure motion policy', () => {
    expect(shouldUseReducedMotion(true)).toBe(true)
    expect(shouldUseReducedMotion(false)).toBe(false)
  })
})
