import assert from 'node:assert/strict'
import test from 'node:test'
import { createPlacer } from '../../pet/placement.cjs'

const W = 440, H = 540

/** 시험용 창: setBounds가 받은 값을 model(요청, 몇 번째 호출)이 정한 대로 어긋나게 적용함 */
const fakeWindow = (model = (r) => r, start = { x: 0, y: 0, width: W, height: H }) => {
  const win = { bounds: { ...start }, calls: [], destroyed: false }
  win.isDestroyed = () => win.destroyed
  win.getBounds = () => ({ ...win.bounds })
  win.setBounds = (r) => { win.calls.push({ ...r }); win.bounds = { ...model(r, win.calls.length) } }
  return win
}

/** 시험용 시간: 예약된 확인 하나를 직접 실행함 */
const fakeClock = () => {
  const clock = { pending: null, cleared: 0 }
  clock.setTimer = (fn) => (clock.pending = fn)
  clock.clearTimer = () => { clock.cleared++; clock.pending = null }
  clock.flush = () => { const fn = clock.pending; clock.pending = null; fn?.() }
  clock.drain = (max = 50) => { for (let i = 0; i < max && clock.pending; i++) clock.flush() }
  return clock
}

const placerFor = (win, clock, extra = {}) => createPlacer(() => win, { width: W, height: H, setTimer: clock.setTimer, clearTimer: clock.clearTimer, ...extra })

test('제대로 놓이면 위치와 크기를 한 번 지시하고, 확인 뒤에는 다시 지시하지 않는다', () => {
  const win = fakeWindow(), clock = fakeClock(), placer = placerFor(win, clock)
  placer.place(1503, 753)
  assert.deepEqual(win.calls, [{ x: 1503, y: 753, width: W, height: H }])
  clock.drain()
  assert.equal(win.calls.length, 1)
})

test('배율이 다른 모니터에서 첫 지시가 엉뚱한 자리에 놓여도, 확인 뒤 다시 지시해 제자리에 놓는다', () => {
  // 첫 번째 지시만 옆 모니터 배율(1.5배)로 해석됨
  const win = fakeWindow((r, n) => (n === 1 ? { x: r.x * 1.5, y: r.y * 1.5, width: r.width * 1.5, height: r.height * 1.5 } : r))
  const clock = fakeClock(), placer = placerFor(win, clock)
  placer.place(2000, 300)
  assert.notDeepEqual(win.bounds, { x: 2000, y: 300, width: W, height: H })
  clock.drain()
  assert.deepEqual(win.bounds, { x: 2000, y: 300, width: W, height: H })
})

test('모니터를 넘으며 커진 창 크기도 원래 크기로 되돌린다', () => {
  const win = fakeWindow((r, n) => (n === 1 ? { ...r, width: 660, height: 810 } : r))
  const clock = fakeClock(), placer = placerFor(win, clock)
  placer.place(100, 100)
  clock.drain()
  assert.equal(win.bounds.width, W)
  assert.equal(win.bounds.height, H)
})

test('같은 값을 다시 지시해도 안 맞으면, 어긋난 만큼 반대로 보정해 지시한다', () => {
  const win = fakeWindow((r) => ({ ...r, x: r.x + 37, y: r.y - 12 }))   // 늘 (+37, -12)만큼 밀려 놓임
  const clock = fakeClock(), placer = placerFor(win, clock)
  placer.place(800, 400)
  clock.drain()
  assert.deepEqual(win.bounds, { x: 800, y: 400, width: W, height: H })
})

test('끝내 안 맞으면 정해진 횟수만 다시 지시하고 포기한다', () => {
  const win = fakeWindow((r) => ({ ...r, x: 0 }))   // 어떤 지시도 x가 0으로 놓임
  const clock = fakeClock(), placer = placerFor(win, clock, { tries: 5 })
  placer.place(700, 50)
  clock.drain(100)
  assert.equal(win.calls.length, 1 + 5)
  assert.equal(clock.pending, null)
})

test('옮기는 중에는 확인하지 않고, 멈춘 뒤 마지막 자리만 확인한다 (예전 자리로 되돌리지 않음)', () => {
  const win = fakeWindow(), clock = fakeClock(), placer = placerFor(win, clock)
  for (let x = 0; x <= 300; x += 100) placer.place(x, 10)   // 산책·끌기 중 프레임마다 지시
  assert.equal(win.calls.length, 4)
  assert.ok(clock.cleared >= 3, '새 지시마다 이전 확인 예약을 취소함')
  clock.drain()
  assert.deepEqual(win.bounds, { x: 300, y: 10, width: W, height: H })
  assert.equal(win.calls.length, 4)
})

test('산책: 경계 너머로 나가 있던 창에 제자리를 지시하면, 어긋나 놓여도 원래 자리로 돌아온다', () => {
  // 경계(x=2560) 오른쪽에 있던 창이 왼쪽 모니터로 돌아오는 지시는 첫 번째에 한해 오른쪽 배율(0.75배)로 해석됨
  let misfired = false
  const win = fakeWindow((r) => {
    if (r.x < 2560 && win.bounds.x >= 2560 && !misfired) { misfired = true; return { x: Math.round(r.x * 0.75), y: r.y, width: Math.round(r.width * 1.25), height: r.height } }
    return r
  })
  const clock = fakeClock(), placer = placerFor(win, clock)
  const home = { x: 2100, y: 600 }
  placer.place(home.x, home.y); clock.drain()
  for (let x = home.x; x <= 2900; x += 60) placer.place(x, home.y)   // 나감 (경계 넘음)
  clock.drain()
  placer.place(home.x, home.y)   // 산책이 끝나 제자리로 (이 한 번이 마지막 지시)
  assert.notDeepEqual(win.bounds, { x: home.x, y: home.y, width: W, height: H }, '시험 전제: 마지막 지시가 어긋나 놓임')
  clock.drain()
  assert.deepEqual(win.bounds, { x: home.x, y: home.y, width: W, height: H })
})

test('-0과 숫자가 아닌 값: 정수로만 지시하고, 잘못된 값은 무시한다', () => {
  const win = fakeWindow(), clock = fakeClock(), placer = placerFor(win, clock)
  placer.place(-0.4, 12.6)
  assert.ok(Object.is(win.calls[0].x, 0), '-0이면 Electron이 정수로 받지 못해 오류 창을 띄움')
  assert.equal(win.calls[0].y, 13)
  placer.place(NaN, 5); placer.place(5, undefined)
  assert.equal(win.calls.length, 1)
})

test('창이 없거나 닫힌 뒤에는 던지지 않는다', () => {
  const win = fakeWindow(), clock = fakeClock(), placer = placerFor(win, clock)
  placer.place(10, 10)
  win.destroyed = true
  assert.doesNotThrow(() => { clock.drain(); placer.place(20, 20); placer.cancel() })
  assert.equal(win.calls.length, 1)
  const none = createPlacer(() => null, { width: W, height: H, setTimer: clock.setTimer, clearTimer: clock.clearTimer })
  assert.doesNotThrow(() => none.place(1, 1))
})

test('fit 으로 바꾼 창 크기는 이후 이동에도 유지한다 (고정 크기로 되돌리지 않음)', () => {
  const win = fakeWindow(), clock = fakeClock(), placer = placerFor(win, clock)
  placer.place(100, 200)
  placer.resize(600, 900)   // 캐릭터를 키우거나 설정 패널을 열어 창이 커짐
  assert.deepEqual(win.calls.at(-1), { x: 100, y: 200, width: 600, height: 900 })   // 왼쪽 위는 그대로
  placer.place(150, 250)
  assert.deepEqual(win.calls.at(-1), { x: 150, y: 250, width: 600, height: 900 })
  clock.drain()
  assert.deepEqual(win.getBounds(), { x: 150, y: 250, width: 600, height: 900 })
})

test('크기 바꾸기도 배율이 다른 모니터에서 어긋나면 확인해 다시 맞추고, 이미 그 크기면 지시하지 않는다', () => {
  const win = fakeWindow((r, n) => (n === 2 ? { ...r, width: r.width * 1.5, height: r.height * 1.5 } : r))   // 두 번째 지시(resize)만 커져서 놓임
  const clock = fakeClock(), placer = placerFor(win, clock)
  placer.place(100, 200)
  placer.resize(600, 900)
  clock.drain()
  assert.deepEqual(win.getBounds(), { x: 100, y: 200, width: 600, height: 900 })
  const calls = win.calls.length
  placer.resize(600, 900)
  assert.equal(win.calls.length, calls)
})
