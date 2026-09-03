export interface Vec3 {
  x: number
  y: number
  z: number
}

export type ParkingGarageStage = 'aisle' | 'ramp' | 'wall-lights' | 'occlusion'

export interface CameraPose {
  position: Vec3
  target: Vec3
  stage: ParkingGarageStage
}

export const PARKING_GARAGE_LOOP_MS = 25_000

const POSITION_POINTS: readonly Vec3[] = [
  { x: 0, y: 1.7, z: 14 },
  { x: 0, y: 1.72, z: 7 },
  { x: 0.2, y: 1.7, z: -2 },
  { x: 1.2, y: 1.6, z: -11 },
  { x: 3.8, y: 1.2, z: -19 },
  { x: 6.5, y: 0.65, z: -27 },
  { x: 7.5, y: 0.35, z: -35 },
  { x: 5.5, y: 0.35, z: -42 },
]

const TARGET_POINTS: readonly Vec3[] = [
  { x: 0, y: 1.45, z: 4 },
  { x: 0, y: 1.45, z: -3 },
  { x: 0.8, y: 1.35, z: -12 },
  { x: 3.2, y: 0.95, z: -20 },
  { x: 6.2, y: 0.55, z: -28 },
  { x: 7.5, y: 0.35, z: -36 },
  { x: 6.2, y: 0.35, z: -42 },
  { x: 2.5, y: 0.4, z: -47 },
]

const catmullRom = (p0: number, p1: number, p2: number, p3: number, t: number): number => {
  const t2 = t * t
  const t3 = t2 * t

  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  )
}

const sampleCurve = (points: readonly Vec3[], progress: number): Vec3 => {
  const scaledProgress = progress * (points.length - 1)
  const segment = Math.min(Math.floor(scaledProgress), points.length - 2)
  const localProgress = scaledProgress - segment
  const p0 = points[Math.max(0, segment - 1)]!
  const p1 = points[segment]!
  const p2 = points[segment + 1]!
  const p3 = points[Math.min(points.length - 1, segment + 2)]!

  return {
    x: catmullRom(p0.x, p1.x, p2.x, p3.x, localProgress),
    y: catmullRom(p0.y, p1.y, p2.y, p3.y, localProgress),
    z: catmullRom(p0.z, p1.z, p2.z, p3.z, localProgress),
  }
}

const selectStage = (elapsedMs: number): ParkingGarageStage => {
  if (elapsedMs < 8_000) return 'aisle'
  if (elapsedMs < 15_000) return 'ramp'
  if (elapsedMs < 22_000) return 'wall-lights'
  return 'occlusion'
}

export const sampleParkingGaragePath = (elapsedMs: number): CameraPose => {
  // JavaScript's remainder keeps the sign, so normalize negative elapsed values
  // to the same forward-moving 25-second loop as positive elapsed values.
  const wrappedElapsedMs =
    ((elapsedMs % PARKING_GARAGE_LOOP_MS) + PARKING_GARAGE_LOOP_MS) % PARKING_GARAGE_LOOP_MS
  const progress = wrappedElapsedMs / PARKING_GARAGE_LOOP_MS

  return {
    position: sampleCurve(POSITION_POINTS, progress),
    target: sampleCurve(TARGET_POINTS, progress),
    stage: selectStage(wrappedElapsedMs),
  }
}
