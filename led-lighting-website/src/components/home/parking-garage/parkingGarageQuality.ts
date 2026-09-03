export type ParkingGarageQualityMode = 'desktop' | 'mobile' | 'fallback'

export interface QualityInput {
  webglAvailable: boolean
  viewportWidth: number
  devicePixelRatio: number
}

export interface QualityProfile {
  mode: ParkingGarageQualityMode
  pixelRatio: number
  shadows: boolean
  moldBarCount: number
  pointLightBudget: number
  wallLightCount: number
  shadowMapSize: number
}

const MOBILE_BREAKPOINT = 768

export const selectParkingGarageQuality = (input: QualityInput): QualityProfile => {
  if (!input.webglAvailable) {
    return {
      mode: 'fallback',
      pixelRatio: 1,
      shadows: false,
      moldBarCount: 0,
      pointLightBudget: 0,
      wallLightCount: 0,
      shadowMapSize: 0,
    }
  }

  if (input.viewportWidth < MOBILE_BREAKPOINT) {
    return {
      mode: 'mobile',
      pixelRatio: Math.min(input.devicePixelRatio, 1),
      shadows: false,
      moldBarCount: 8,
      pointLightBudget: 4,
      wallLightCount: 4,
      shadowMapSize: 512,
    }
  }

  return {
    mode: 'desktop',
    pixelRatio: Math.min(input.devicePixelRatio, 1.5),
    shadows: true,
    moldBarCount: 12,
    pointLightBudget: 8,
    wallLightCount: 8,
    shadowMapSize: 1_024,
  }
}

export const shouldUseReducedMotion = (matches: boolean): boolean => matches
