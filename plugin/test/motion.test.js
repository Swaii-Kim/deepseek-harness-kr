import test from 'node:test'
import assert from 'node:assert/strict'
import { addGesture, blinkClose, clamp, coverForearm, holdCurve, noise, S, seg, spring, sstep } from '../../character/motion.js'

const zero = () => ({ yaw: 0, pitch: 0, roll: 0, bodyX: 0, bodyY: 0, bodyZ: 0, lean: 0, smile: 0, eyeSmile: 0, eyeClose: 0, mouth: 0 })

test('스프링은 8ms 단위로 나눠 계산해 긴 프레임에서도 목표로 수렴한다', () => {
  const s = S()
  for (let i = 0; i < 200; i++) spring(s, 1, 1 / 60, 90, 19)
  assert.ok(Math.abs(s.x - 1) < 1e-3)
  const a = S(), b = S()
  spring(a, 1, 0.05, 90, 19)                               // 50ms 한 번
  for (let i = 0; i < 5; i++) spring(b, 1, 0.01, 90, 19)   // 10ms 다섯 번
  assert.ok(Math.abs(a.x - b.x) < 0.05, '프레임 간격이 달라도 거의 같은 곳에 있다')
})

test('곡선: sstep·holdCurve·seg는 0~1 밖으로 나가지 않고 끝점이 맞다', () => {
  assert.equal(sstep(-1), 0); assert.equal(sstep(0), 0); assert.equal(sstep(1), 1); assert.equal(sstep(2), 1)
  assert.equal(holdCurve(0), 0); assert.equal(holdCurve(0.5), 1); assert.equal(holdCurve(1), 0)
  assert.equal(seg(0.25, 0.45, 0.1), 0); assert.ok(Math.abs(seg(0.25, 0.45, 0.35) - 0.5) < 1e-9); assert.equal(seg(0.25, 0.45, 0.9), 1)
  assert.equal(clamp(5, -1, 1), 1)
  for (let t = 0; t < 20; t += 0.37) assert.ok(Math.abs(noise(t, 3)) <= 1)
})

test('몸짓: 처음·끝에는 출력이 없고, 방향(d)이 갸웃·흔들기 방향을 바꾼다', () => {
  for (const name of ['nod', 'tilt', 'sway', 'bounce', 'droop']) {
    const start = zero(); addGesture(start, name, 0, 1)
    assert.ok(Object.values(start).every((v) => Math.abs(v) < 1e-9), `${name} 시작`)
  }
  const left = zero(), right = zero()
  addGesture(left, 'tilt', 0.5, -1); addGesture(right, 'tilt', 0.5, 1)
  assert.equal(left.roll, -right.roll)
  assert.ok(right.roll > 0 && right.smile > 0)
  const laugh = zero(); addGesture(laugh, 'laugh', 0.5, 1)
  assert.ok(laugh.eyeSmile > 0 && laugh.mouth > 0 && laugh.lean < 0)
  const none = zero(); addGesture(none, 'unknown', 0.5, 1)
  assert.deepEqual(none, zero())
})

test('깜빡임: 0.07초에 다 감고 0.1초까지 유지, 0.22초에 다 뜬다', () => {
  assert.equal(blinkClose(0), 0); assert.equal(blinkClose(0.07), 1); assert.equal(blinkClose(0.09), 1)
  assert.ok(blinkClose(0.16) > 0 && blinkClose(0.16) < 1); assert.equal(blinkClose(0.22), 0); assert.equal(blinkClose(5), 0)
})

test('가슴 가리기 팔: 바깥 구간(0.15→0.7)을 빠르게 지나 가슴에서 살짝 넘쳤다 자리 잡는다', () => {
  assert.equal(coverForearm(0), 0)
  assert.ok(Math.abs(coverForearm(0.25) - 0.15) < 1e-9)
  assert.ok(Math.abs(coverForearm(0.45) - 0.7) < 1e-9)
  assert.ok(Math.abs(coverForearm(0.8) - 0.89) < 1e-9)
  assert.ok(Math.abs(coverForearm(1) - 0.86) < 1e-9)
})
