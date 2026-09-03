import { describe, expect, it } from 'vitest'
import { PARKING_GARAGE_LOOP_MS, sampleParkingGaragePath } from './parkingGaragePath'

describe('sampleParkingGaragePath', () => {
  it('loops exactly every 25 seconds', () => {
    expect(PARKING_GARAGE_LOOP_MS).toBe(25_000)
    expect(sampleParkingGaragePath(25_000)).toEqual(sampleParkingGaragePath(0))
  })

  it('moves through the planned garage stages', () => {
    expect(sampleParkingGaragePath(2_000).stage).toBe('aisle')
    expect(sampleParkingGaragePath(12_500).stage).toBe('ramp')
    expect(sampleParkingGaragePath(18_500).stage).toBe('wall-lights')
    expect(sampleParkingGaragePath(24_000).stage).toBe('occlusion')
  })
})
