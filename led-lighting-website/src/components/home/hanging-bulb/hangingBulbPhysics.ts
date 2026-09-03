export interface Point2D {
  x: number
  y: number
}

export interface HangingBulbPhysicsState {
  accumulatedSeconds: number
  anchor: Point2D
  angle: number
  angularVelocity: number
  cordLength: number
}

interface CreatePhysicsOptions {
  anchor: Point2D
  cordLength: number
}

interface BrightnessOptions {
  elapsedMs: number
  hovered: boolean
  mobile?: boolean
  reducedMotion: boolean
}

const FIXED_STEP_SECONDS = 1 / 120
const MAX_SUBSTEPS = 8
const GRAVITY = 9.81
const ANGULAR_DAMPING = 1.55
const MAX_ANGLE = (18 * Math.PI) / 180
const MAX_ANGULAR_VELOCITY = 0.92
const POINTER_IMPULSE_GAIN = 4.5
const MOBILE_POWER_CYCLE_MS = 12_000
const MOBILE_POWER_FADE_MS = 120
const MOBILE_BLACKOUT_WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [1_750, 2_150],
  [4_160, 4_340],
  [6_420, 7_180],
  [9_150, 9_460],
  [10_780, 11_080],
]

export const createHangingBulbPhysics = (
  options: CreatePhysicsOptions,
): HangingBulbPhysicsState => ({
  accumulatedSeconds: 0,
  anchor: { ...options.anchor },
  angle: 0,
  angularVelocity: 0,
  cordLength: Math.max(options.cordLength, 0.1),
})

export const getBulbPosition = (state: HangingBulbPhysicsState): Point2D => ({
  x: state.anchor.x + Math.sin(state.angle) * state.cordLength,
  y: state.anchor.y - Math.cos(state.angle) * state.cordLength,
})

const distanceToCord = (state: HangingBulbPhysicsState, point: Point2D): number => {
  const end = getBulbPosition(state)
  const cordX = end.x - state.anchor.x
  const cordY = end.y - state.anchor.y
  const lengthSquared = cordX * cordX + cordY * cordY
  const progress = Math.min(
    1,
    Math.max(
      0,
      ((point.x - state.anchor.x) * cordX + (point.y - state.anchor.y) * cordY) / lengthSquared,
    ),
  )
  const nearestX = state.anchor.x + cordX * progress
  const nearestY = state.anchor.y + cordY * progress
  return Math.hypot(point.x - nearestX, point.y - nearestY)
}

export const applyCordImpulse = (
  state: HangingBulbPhysicsState,
  pointer: Point2D,
  pointerDelta: Point2D,
  radius: number,
): boolean => {
  if (distanceToCord(state, pointer) > radius) return false

  const impulse = Math.max(
    -MAX_ANGULAR_VELOCITY,
    Math.min(MAX_ANGULAR_VELOCITY, pointerDelta.x * POINTER_IMPULSE_GAIN),
  )
  state.angularVelocity = Math.max(
    -MAX_ANGULAR_VELOCITY,
    Math.min(MAX_ANGULAR_VELOCITY, state.angularVelocity + impulse),
  )
  return true
}

const integrateFixedStep = (state: HangingBulbPhysicsState): void => {
  const gravityAcceleration = -(GRAVITY / state.cordLength) * Math.sin(state.angle)
  const dampingAcceleration = -ANGULAR_DAMPING * state.angularVelocity
  state.angularVelocity += (gravityAcceleration + dampingAcceleration) * FIXED_STEP_SECONDS
  state.angle += state.angularVelocity * FIXED_STEP_SECONDS

  if (Math.abs(state.angle) > MAX_ANGLE) {
    state.angle = Math.sign(state.angle) * MAX_ANGLE
    if (Math.sign(state.angularVelocity) === Math.sign(state.angle)) state.angularVelocity = 0
  }
}

export const stepHangingBulbPhysics = (
  state: HangingBulbPhysicsState,
  elapsedSeconds: number,
): void => {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return
  state.accumulatedSeconds += Math.min(elapsedSeconds, FIXED_STEP_SECONDS * MAX_SUBSTEPS)

  let substeps = 0
  while (
    state.accumulatedSeconds + Number.EPSILON >= FIXED_STEP_SECONDS &&
    substeps < MAX_SUBSTEPS
  ) {
    integrateFixedStep(state)
    state.accumulatedSeconds -= FIXED_STEP_SECONDS
    substeps += 1
  }
  if (Math.abs(state.accumulatedSeconds) < Number.EPSILON * 8) state.accumulatedSeconds = 0
}

export const resolveBulbBrightness = ({
  elapsedMs,
  hovered,
  mobile = false,
  reducedMotion,
}: BrightnessOptions): number => {
  if (hovered) return 1
  if (reducedMotion) return 0.58

  const cycleElapsedMs = mobile
    ? ((elapsedMs % MOBILE_POWER_CYCLE_MS) + MOBILE_POWER_CYCLE_MS) % MOBILE_POWER_CYCLE_MS
    : elapsedMs
  const time = cycleElapsedMs / 1_000
  const slowWave = Math.sin(time * 1.43) * 0.065
  const midWave = Math.sin(time * 4.71 + 1.2) * 0.045
  const pulsePhase = Math.sin(time * 2.17 + Math.sin(time * 0.37) * 2.1)
  const brightPulse = Math.max(0, pulsePhase) ** 14 * 0.18
  const dipPulse = Math.max(0, Math.sin(time * 3.83 + 2.4)) ** 20 * 0.12
  const idleBrightness = Math.min(
    0.82,
    Math.max(0.35, 0.55 + slowWave + midWave + brightPulse - dipPulse),
  )
  if (!mobile) return idleBrightness

  // Uneven blackout lengths and spacing create a repeatable rhythm without looking mechanical.
  for (const [startMs, endMs] of MOBILE_BLACKOUT_WINDOWS) {
    if (cycleElapsedMs >= startMs && cycleElapsedMs <= endMs) return 0
    if (cycleElapsedMs >= startMs - MOBILE_POWER_FADE_MS && cycleElapsedMs < startMs) {
      const progress = (startMs - cycleElapsedMs) / MOBILE_POWER_FADE_MS
      return idleBrightness * progress * progress * (3 - 2 * progress)
    }
    if (cycleElapsedMs > endMs && cycleElapsedMs <= endMs + MOBILE_POWER_FADE_MS) {
      const progress = (cycleElapsedMs - endMs) / MOBILE_POWER_FADE_MS
      return idleBrightness * progress * progress * (3 - 2 * progress)
    }
  }
  return idleBrightness
}
