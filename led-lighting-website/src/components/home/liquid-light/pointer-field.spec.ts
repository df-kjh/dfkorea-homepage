import { it as test } from 'vitest'
import assert from 'node:assert/strict'
import { createPointerField } from './pointer-field'

function advance(field: ReturnType<typeof createPointerField>, seconds: number, fps = 60) {
  for (let frame = 0; frame < seconds * fps; frame++) field.advance(1 / fps)
  return field.snapshot()
}

test('hover targets need no pressed button and develop a localized spring response', () => {
  const field = createPointerField()
  field.setTarget(0.8, -0.4)
  const first = advance(field, 0.1)
  assert.ok(first.x > 0 && first.x < 0.8)
  assert.ok(first.y < 0 && first.y > -0.4)
  assert.ok(first.strength > 0.4)
  const settled = advance(field, 0.8)
  assert.ok(Math.abs(settled.x - 0.8) < 0.03)
  assert.ok(Math.abs(settled.y + 0.4) < 0.03)
})

test('invalid/extreme input stays finite, bounded and cannot create unbounded wakes', () => {
  const field = createPointerField()
  field.setTarget(999, -999)
  let state = advance(field, 1)
  assert.ok(state.x > 0.9 && state.y < -0.9)
  assert.ok(state.x <= 1 && state.y >= -1)
  for (let step = 0; step < 200; step++) {
    field.setTarget(step % 2 ? 1 : -1, step % 3 ? 0.5 : -0.5)
    state = advance(field, 0.1)
    assert.ok(state.wakes.length <= 4)
    assert.ok(Number.isFinite(state.x + state.y + state.strength))
  }
  field.setTarget(NaN, Infinity)
  state = advance(field, 1)
  assert.ok(Math.abs(state.x) < 0.03 && Math.abs(state.y) < 0.03)
})

test('pointer leave settles strength and all short wakes disappear', () => {
  const field = createPointerField()
  field.setTarget(0.9, -0.7)
  const active = advance(field, 0.3)
  assert.ok(active.strength > 0.8)
  assert.ok(active.wakes.length > 0)
  field.release()
  const state = advance(field, 1.2)
  assert.ok(state.strength < 0.01)
  assert.equal(state.wakes.length, 0)
  assert.ok(Math.abs(state.x) < 0.03 && Math.abs(state.y) < 0.03)
})

test('spring response remains close across 30Hz and 120Hz frame rates', () => {
  const slow = createPointerField()
  const fast = createPointerField()
  slow.setTarget(0.7, 0.4)
  fast.setTarget(0.7, 0.4)
  const a = advance(slow, 0.6, 30)
  const b = advance(fast, 0.6, 120)
  assert.ok(a.x > 0.6 && b.x > 0.6)
  assert.ok(Math.abs(a.x - b.x) < 0.035)
  assert.ok(Math.abs(a.strength - b.strength) < 0.015)
})

test('a click ripple is bounded and expires without continuous input', () => {
  const field = createPointerField()
  field.addRipple(8, -8)
  let state = field.snapshot()
  assert.equal(state.ripple.x, 1)
  assert.equal(state.ripple.y, -1)
  assert.equal(state.ripple.age, 0)
  state = advance(field, 1.5)
  assert.equal(state.ripple.strength, 0)
})
