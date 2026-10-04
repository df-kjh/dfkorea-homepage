export interface Wake {
  x: number
  y: number
  age: number
  strength: number
}
export interface PointerSnapshot {
  x: number
  y: number
  strength: number
  time: number
  wakes: Wake[]
  ripple: Wake
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const coordinate = (value: number) => clamp(Number.isFinite(value) ? value : 0, -1, 1)

/** Hero-local input physics. Only the renderer's single RAF advances this field. */
export function createPointerField() {
  let x = 0,
    y = 0,
    vx = 0,
    vy = 0
  let targetX = 0,
    targetY = 0,
    active = false,
    strength = 0,
    time = 0
  let wakeClock = 0,
    lastWakeX = 0,
    lastWakeY = 0
  const wakes: Wake[] = []
  let ripple = { x: 0, y: 0, age: 2, strength: 0 }

  function advance(delta: number) {
    // A stalled background tab or malformed external input cannot create a jump.
    const dt = clamp(Number.isFinite(delta) ? delta : 0, 0, 0.05)
    time += dt
    vx = (vx + (targetX - x) * 72 * dt) * Math.exp(-11.5 * dt)
    vy = (vy + (targetY - y) * 72 * dt) * Math.exp(-11.5 * dt)
    const speed = Math.hypot(vx, vy)
    if (speed > 3) {
      vx *= 3 / speed
      vy *= 3 / speed
    }
    x = coordinate(x + vx * dt)
    y = coordinate(y + vy * dt)
    strength += ((active ? 1 : 0) - strength) * (1 - Math.exp(-(active ? 9 : 4.8) * dt))
    if (!active && strength < 0.0002) strength = 0
    for (const wake of wakes) wake.age += dt
    while ((wakes[0]?.age ?? 0) >= 0.65) wakes.shift()
    wakeClock += dt
    if (active && wakeClock >= 0.075 && Math.hypot(x - lastWakeX, y - lastWakeY) > 0.035) {
      wakes.push({ x, y, age: 0, strength })
      if (wakes.length > 4) wakes.shift()
      lastWakeX = x
      lastWakeY = y
      wakeClock = 0
    }
    if (ripple.strength > 0) {
      ripple.age += dt
      ripple.strength = Math.pow(Math.max(0, 1 - ripple.age / 1.25), 1.6)
    }
  }
  return {
    setTarget(nextX: number, nextY: number) {
      targetX = coordinate(nextX)
      targetY = coordinate(nextY)
      active = true
    },
    release() {
      active = false
      targetX = 0
      targetY = 0
    },
    addRipple(nextX: number, nextY: number) {
      ripple = { x: coordinate(nextX), y: coordinate(nextY), age: 0, strength: 1 }
    },
    advance,
    snapshot(): PointerSnapshot {
      return {
        x,
        y,
        strength,
        time,
        wakes: wakes.map((wake) => ({
          ...wake,
          strength: wake.strength * Math.pow(Math.max(0, 1 - wake.age / 0.65), 2),
        })),
        ripple: { ...ripple },
      }
    },
  }
}
