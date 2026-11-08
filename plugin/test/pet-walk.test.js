import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const { createPlacer } = require('../../pet/placement.cjs')
const source = await readFile(new URL('../../assets/dsc.js', import.meta.url), 'utf8')
const mainSource = await readFile(new URL('../../pet/main.cjs', import.meta.url), 'utf8')
const planStart = source.indexOf('      // ---------- 외부 펫 산책 경로 계산 (순수 함수')
const planEnd = source.indexOf('      // ---------- 외부 펫 산책 경로 계산 끝 ----------')
assert.ok(planStart > 0 && planEnd > planStart, 'pure walk-plan block markers must stay in assets/dsc.js')
const context = vm.createContext({})
vm.runInContext(source.slice(planStart, planEnd) + `
  globalThis.api = { walkAreaValid, walkDisplayArea, walkBodySpan, planWalkOut, walkSafePose,
    planWalkReturn, walkOutAlpha, walkInAlpha, walkClipInset };
`, context)
const api = context.api
const plain = (value) => JSON.parse(JSON.stringify(value))

// 화면 기하 mock: 실제 Electron/모니터 없이 DIP 사각형만 계산한다. 실기기 검증이 아니다.
const area = (l, t, r, b) => ({ l, t, r, b })
const spanAt = (plan, x, k, canvasW, bodyW) => plain(api.walkBodySpan({ x, k, canvasW, bodyW }))
const visible = (a, screenX, screenY, width, height) => {
  const c = plain(api.walkClipInset({ area: a, screenX, screenY, width, height }))
  return { l: screenX + c.left, r: screenX + width - c.right, t: screenY + c.top, b: screenY + height - c.bottom, c }
}

test('표시장치 workArea: 음수 원점·150% DIP·창 밖 오류를 구분한다', () => {
  assert.deepEqual(plain(api.walkDisplayArea({ workArea: { x: -1920, y: -120, width: 1920, height: 1040 } })), area(-1920, -120, 0, 920))
  assert.deepEqual(plain(api.walkDisplayArea({ workArea: { x: 0, y: 0, width: 1280, height: 680 } })), area(0, 0, 1280, 680))   // 150% 배율의 DIP 작업영역
  assert.equal(api.walkDisplayArea({ workArea: { x: 0, y: 0, width: 0, height: 680 } }), null)
  assert.equal(api.walkDisplayArea({ workArea: { x: NaN, y: 0, width: 100, height: 100 } }), null)
  assert.equal(api.walkAreaValid(area(0, 0, 100, 100)), true)
  assert.equal(api.walkAreaValid(area(100, 0, 100, 100)), false)
})

test('중앙: 기본 출발은 왼쪽이고 경계까지 실제 몸 가장자리가 닿는다', () => {
  const a = area(0, 0, 1920, 1080), canvasW = 300, bodyW = 100, k = 1, x = 810, y = 200
  const plan = plain(api.planWalkOut({ area: a, x, y, k, canvasW, bodyW }))
  assert.equal(plan.dir, -1)
  assert.equal(plan.run, 910)
  assert.equal(plan.travel, plan.run + plan.overshoot)
  assert.ok(plan.overshoot > 0)
  assert.ok(plan.fade > 0 && plan.fade <= plan.run * 0.75 && plan.fade <= 180)
  const atBoundary = spanAt(plan, x - plan.run, k, canvasW, bodyW)
  assert.equal(atBoundary.l, a.l, '경계에 닿는 순간 왼쪽 몸 가장자리 = workArea 왼쪽')
  assert.equal(api.walkOutAlpha(plan.run, plan.run, plan.fade), 0, '경계 도착 프레임은 완전 투명')
  assert.equal(api.walkOutAlpha(0, plan.run, plan.fade), 1, '출발 프레임은 불투명')
  assert.equal(api.walkOutAlpha(plan.run - plan.fade, plan.run, plan.fade), 1, 'fade는 마지막 구간 전까지 시작하지 않음')
  assert.equal(api.walkOutAlpha(plan.run + plan.overshoot, plan.run, plan.fade), 0)
})

test('왼쪽 가까움: 왼쪽 거리가 부족하면 오른쪽 경계로 방향을 바꾼다', () => {
  const a = area(0, 0, 1920, 1080), canvasW = 300, bodyW = 100, k = 1, x = 0
  const plan = plain(api.planWalkOut({ area: a, x, y: 200, k, canvasW, bodyW }))
  assert.equal(plan.left, 100)
  assert.ok(plan.left < plan.minRun)
  assert.equal(plan.dir, 1)
  assert.equal(plan.run, plan.right)
  const atBoundary = spanAt(plan, x + plan.run, k, canvasW, bodyW)
  assert.equal(atBoundary.r, a.r)
})

test('오른쪽 가까움: 기본 왼쪽 거리가 충분하면 오른쪽이 짧아도 왼쪽으로 간다', () => {
  const a = area(0, 0, 1920, 1080), canvasW = 300, bodyW = 100, k = 1, x = 1620
  const plan = plain(api.planWalkOut({ area: a, x, y: 200, k, canvasW, bodyW }))
  assert.equal(plan.right, 100)
  assert.equal(plan.left, 1720)
  assert.ok(plan.left >= plan.minRun)
  assert.equal(plan.dir, -1)
})

test('양쪽 다 부족하면 더 넓은 쪽, 큰/작은 펫 모두 같은 규칙', () => {
  const a = area(0, 0, 800, 600), canvasW = 300
  const large = plain(api.planWalkOut({ area: a, x: 200, y: 100, k: 1, canvasW, bodyW: 300 }))
  assert.ok(large.left < large.minRun && large.right < large.minRun)
  assert.ok(large.right > large.left)
  assert.equal(large.dir, 1, '둘 다 부족하면 오른쪽이 더 넓을 때 오른쪽')
  const small = plain(api.planWalkOut({ area: a, x: 200, y: 100, k: 1, canvasW, bodyW: 40 }))
  assert.ok(small.left < small.minRun && small.right < small.minRun)
  assert.ok(small.right > small.left)
  assert.equal(small.dir, 1, '작은 펫도 왼쪽이 부족하고 오른쪽이 넓으면 오른쪽')
})

test('음수 원점 모니터: 왼쪽/오른쪽 경계와 방향이 좌표 부호와 무관하게 계산된다', () => {
  const a = area(-1920, 0, 0, 1080), canvasW = 300, bodyW = 100, k = 1
  const right = plain(api.planWalkOut({ area: a, x: -1800, y: 200, k, canvasW, bodyW }))
  assert.equal(right.dir, 1)
  assert.equal(right.run, 1600)
  assert.equal(spanAt(right, -1800 + right.run, k, canvasW, bodyW).r, a.r)
  const left = plain(api.planWalkOut({ area: a, x: -300, y: 200, k, canvasW, bodyW }))
  assert.equal(left.dir, -1)
  assert.equal(left.run, 1720)
})

test('150% 작업영역: DIP 배율이 커져도 선택 경계까지 몸 가장자리만 닿고 넘지 않는다', () => {
  const a = area(0, 0, 1280, 680), canvasW = 300, bodyW = 140, k = 2, x = 500, y = 20
  const plan = plain(api.planWalkOut({ area: a, x, y, k, canvasW, bodyW }))
  assert.equal(plan.dir, -1)
  for (let t = 0; t <= plan.travel; t += 1) {
    const s = spanAt(plan, x - t, k, canvasW, bodyW)
    if (t <= plan.run) assert.ok(s.l >= a.l - 1e-9 && s.r <= a.r + 1e-9, '경계 전에는 몸이 안쪽')
  }
})

test('매 프레임 hard clip: 몸이나 캔버스가 workArea를 넘어도 보이는 픽셀은 안쪽이다', () => {
  const a = area(-1920, -120, 0, 920), canvasW = 300, bodyW = 100, k = 1, x = -2100, screenY = 0, height = 300
  for (let t = -400; t <= 2200; t += 37) {
    const v = visible(a, x + t, screenY, canvasW * k, height)
    assert.ok(v.l >= a.l && v.r <= a.r, `frame ${t}: visible horizontal must stay in workArea`)
    assert.ok(v.t >= a.t && v.b <= a.b, `frame ${t}: visible vertical must stay in workArea`)
  }
})

test('복귀: 출발의 반대 경계에서 시작해 경계에서 fade-in, 같은 workArea 안으로 들어온다', () => {
  const a = area(0, 0, 1920, 1080), canvasW = 300, bodyW = 100, k = 1, x = 810, y = 200
  const out = plain(api.planWalkOut({ area: a, x, y, k, canvasW, bodyW }))
  const back = plain(api.planWalkReturn({ area: a, dir: out.dir, x, k, canvasW, bodyW }))
  const startSpan = spanAt(out, x + back.from, k, canvasW, bodyW)
  if (out.dir < 0) {
    assert.ok(startSpan.r > a.r, '왼쪽으로 나갔으면 반대인 오른쪽 경계 밖에서 들어오기 시작')
    assert.ok(back.from > 0)
  } else {
    assert.ok(startSpan.l < a.l, '오른쪽으로 나갔으면 반대인 왼쪽 경계 밖에서 들어오기 시작')
    assert.ok(back.from < 0)
  }
  assert.equal(api.walkInAlpha(0, back.fade), 0, '복귀 시작은 완전 투명')
  assert.ok(back.fade > 0)
  assert.equal(api.walkInAlpha(back.fade, back.fade), 1, 'fade 구간 뒤에는 불투명')
  const atEntry = visible(a, x + back.from, y, canvasW * k, 300)
  assert.ok(atEntry.l >= a.l && atEntry.r <= a.r, '경계 밖 부분은 clip으로 보이지 않음')
  const home = spanAt(out, x, k, canvasW, bodyW)
  assert.ok(home.l >= a.l && home.r <= a.r)
  // 복귀 중 alpha>0인 동안에도 실제 보이는 구간은 workArea 안이다.
  for (let t = 0; t <= Math.abs(back.from); t += 23) {
    const v = visible(a, x + back.from + t, y, canvasW * k, 300)
    assert.ok(v.l >= a.l && v.r <= a.r, `return frame ${t}`)
  }
})

test('표시장치 변경 fallback: 새 workArea 안전 자리로 옮기고 완전 투명 뒤 복구할 수 있다', () => {
  const a = area(1280, 0, 3200, 1080), canvasW = 300, bodyW = 100, k = 1
  const safe = plain(api.walkSafePose({ area: a, x: -600, y: 300, k, canvasW, canvasH: 300, bodyW }))
  const s = spanAt({}, safe.x, safe.k, canvasW, bodyW)
  assert.ok(safe.x > -600)
  assert.ok(s.l >= a.l && s.r <= a.r, '옛 모니터 밖이던 홈도 새 workArea 안으로 clamp')
  assert.ok(safe.y >= a.t - 300 * k * 0.05 && safe.y + 300 * k <= a.b)
  // 유효한 workArea가 아직 없으면 복구(fade-in)하지 않고 투명 유지하는 판단 근거
  assert.equal(api.walkAreaValid(null), false)
})

test('산책 중 표시장치 제거·workArea 변경: 완전 투명 + 새 안전 자리로 복구한다', () => {
  let now = 1000, frames = []
  const ctx = vm.createContext({
    performance: { now: () => now }, W: 300, H: 300, visW: 100, PET: true, innerWidth: 300, innerHeight: 450,
    setTimeout: () => 1, clearTimeout: () => {}, requestAnimationFrame: (fn) => frames.push(fn), place: () => {},
  })
  vm.runInContext(source.slice(planStart, planEnd), ctx)
  vm.runInContext(`
    let fleeX = 0, lastPlaceKey = '';
    const shown = { k: 1, x: 100, y: 200 };
    const free = { on: true, x: 100, y: 200, k: 1, anim: null, applied: true };
    const canvas = { style: {} };
    const walk = { phase: 'out', timers: [], slideId: 0, plan: { dir: 1 }, area: { l: 0, t: 0, r: 1920, b: 1080 },
      base: { k: 1, x: 100, y: 200 }, displayId: '1', displayRequest: 1, alpha: 1, opacityApplied: false, returnFade: 0, recoverTimer: 0 };
    const petDisplay = { id: '1', area: { l: 0, t: 0, r: 1920, b: 1080 }, scaleFactor: 1, request: 1, answered: 1, at: 1000 };
  `, ctx)
  vm.runInContext(source.slice(source.indexOf('      const startRecoverFade ='), source.indexOf('      const walkBack =')) + `
    globalThis.applyDisplay = applyPetDisplay;
    globalThis.startRecoverFade = startRecoverFade;
  `, ctx)
  const run = (s) => vm.runInContext(s, ctx)
  run(`applyDisplay({ id: '2', scaleFactor: 1, workArea: { x: 1280, y: 0, width: 1920, height: 1040 } }, true)`)
  assert.equal(run('walk.phase'), 'recover', '사라진 표시장치면 산책을 이어가지 않고 복구 상태로')
  assert.equal(run('canvas.style.opacity'), '0', '복구 중에는 완전 투명')
  assert.equal(run('petDisplay.id'), '2')
  assert.equal(run('walk.area.r'), 3200)
  assert.ok(run('free.x + (W - visW) / 2 >= 1280'), '보이는 몸 왼쪽도 새 workArea 안')
  // 같은 표시장치·같은 workArea면 산책을 끊지 않는다
  run(`walk.phase = 'out'; walk.area = { l: 1280, t: 0, r: 3200, b: 1040 }; walk.displayId = '2'; petDisplay.id = '2'`)
  run(`applyDisplay({ id: '2', scaleFactor: 1, workArea: { x: 1280, y: 0, width: 1920, height: 1040 } }, true)`)
  assert.equal(run('walk.phase'), 'out')
  // 같은 표시장치라도 workArea가 바뀌면 고정 이동량을 버리고 복구한다
  run(`applyDisplay({ id: '2', scaleFactor: 1, workArea: { x: 1280, y: 0, width: 1600, height: 1040 } }, true)`)
  assert.equal(run('walk.phase'), 'recover')
  assert.equal(run('walk.area.r'), 2880)
  // 복구 fade가 끝난 뒤에도 walk.area를 유지해 clip을 계속 걸고, free pose는 지정 안전영역으로만 clamp한다.
  run('startRecoverFade()')
  now += 600; frames.splice(0).forEach((fn) => fn())
  assert.equal(run('walk.phase'), '')
  assert.equal(run('walk.safeHold'), true)
  assert.equal(run('walk.area.r'), 2880, '복구 뒤 clip 해제/안전영역 유지')
  // safeHold 중 display-added만 와도 다시 복구하지 않고 안전영역을 유지
  run(`applyDisplay({ id: '2', scaleFactor: 1, workArea: { x: 1280, y: 0, width: 1600, height: 1040 } }, true, undefined, [
    { id: '2', workArea: { x: 1280, y: 0, width: 1600, height: 1040 } },
    { id: '3', workArea: { x: 2880, y: 0, width: 1920, height: 1040 } }
  ])`)
  assert.equal(run('walk.phase'), '')
  assert.equal(run('walk.safeHold'), true)
  assert.equal(run('walk.area.r'), 2880)
})

test('새 workArea가 펫보다 작아도 clip을 유지해 옆 모니터 노출이 없다', () => {
  const tiny = area(0, 0, 80, 90), canvasW = 300, bodyW = 100, k = 1
  const safe = plain(api.walkSafePose({ area: tiny, x: 100, y: 100, k, canvasW, canvasH: 300, bodyW }))
  const s = spanAt({}, safe.x, safe.k, canvasW, bodyW)
  assert.ok(s.width > tiny.r - tiny.l, '몸이 작업영역보다 큼')
  const v = visible(tiny, safe.x, safe.y, canvasW * k, 300)
  assert.ok(v.l >= tiny.l && v.r <= tiny.r && v.t >= tiny.t && v.b <= tiny.b, '작은 작업영역에서도 보이는 픽셀은 안쪽')
})

test('PET 복귀 faceTo: 양방향 모두 실제 이동 방향을 본다 (기존 in-app 규칙과 분리)', () => {
  // source: faceTo = phase==='out' ? walk.dir : phase==='in' ? (faceDir == null ? -walk.dir : faceDir) : 0
  const faceTo = (phase, dir, faceDir = null) => phase === 'out' ? dir : phase === 'in' ? (faceDir == null ? -dir : faceDir) : 0
  for (const planDir of [-1, 1]) {
    assert.equal(faceTo('out', planDir), planDir, '출발은 이동 방향을 봄')
    // 반대 경계에서 돌아오는 실제 이동 방향 = 출발 방향. PET는 faceDir로 그대로 지정.
    assert.equal(faceTo('in', planDir, planDir), planDir, `복귀 ${planDir}: 이동 방향을 봄`)
    // 기존 in-app 규칙(walk.dir = 시작 경계 쪽, faceDir 없음)도 그대로 유지
    assert.equal(faceTo('in', -planDir, null), planDir, `in-app 복귀 ${planDir}: 기존 -walk.dir 규칙`)
  }
})

test('표시장치 추가 알림만으로는 산책 중 출발 monitor를 바꾸지 않는다 (topology 통합)', () => {
  const ctx = vm.createContext({
    performance: { now: () => 1000 }, W: 300, H: 300, visW: 100, PET: true, innerWidth: 300, innerHeight: 450,
    setTimeout: () => 1, clearTimeout: () => {}, requestAnimationFrame: () => {}, place: () => {},
  })
  vm.runInContext(source.slice(planStart, planEnd), ctx)
  vm.runInContext(`
    let fleeX = 0, lastPlaceKey = '';
    const shown = { k: 1, x: 100, y: 200 };
    const free = { on: true, x: 100, y: 200, k: 1, anim: null, applied: true };
    const canvas = { style: {} };
    const walk = { phase: 'out', timers: [], slideId: 0, plan: { dir: 1 }, area: { l: 1280, t: 0, r: 3200, b: 1040 },
      base: { k: 1, x: 100, y: 200 }, displayId: '1', displayRequest: 1, alpha: 1, opacityApplied: false, returnFade: 0, recoverTimer: 0, safeHold: false, faceDir: null, recover: null };
    const petDisplay = { id: '1', area: { l: 1280, t: 0, r: 3200, b: 1040 }, scaleFactor: 1, request: 1, answered: 1, at: 1000 };
  `, ctx)
  vm.runInContext(source.slice(source.indexOf('      const startRecoverFade ='), source.indexOf('      const walkBack =')) + `
    globalThis.applyDisplay = applyPetDisplay;
    globalThis.startRecoverFade = startRecoverFade;
  `, ctx)
  const run = (s) => vm.runInContext(s, ctx)
  // display-added: 현재 window bounds는 경계/overshoot라 nearest가 id 2로 바뀌어도, id 1이 목록에 있으면 유지
  run(`applyDisplay({ id: '2', scaleFactor: 1, workArea: { x: 3200, y: 0, width: 1920, height: 1040 } }, true, undefined, [
    { id: '1', workArea: { x: 1280, y: 0, width: 1920, height: 1040 } },
    { id: '2', workArea: { x: 3200, y: 0, width: 1920, height: 1040 } }
  ])`)
  assert.equal(run('walk.phase'), 'out')
  assert.equal(run('walk.area.r'), 3200)
  // 실제 제거: id 1이 목록에서 사라져야만 복구
  run(`applyDisplay({ id: '2', scaleFactor: 1, workArea: { x: 3200, y: 0, width: 1920, height: 1040 } }, true, undefined, [
    { id: '2', workArea: { x: 3200, y: 0, width: 1920, height: 1040 } }
  ])`)
  assert.equal(run('walk.phase'), 'recover')
  assert.equal(run('walk.area.r'), 5120)
})

test('main display → PET.on → startWalk 타이머 통합: top-level request가 answered를 갱신해 실제 출발한다', () => {
  let now = 1000, timerId = 0, seq = 0
  const timers = new Map(), frames = [], sent = []
  const ctx = vm.createContext({
    performance: { now: () => now }, W: 300, H: 300, visW: 100, WALK_BODY_W: 100, WALK_SPEED: 320, curK: 1, innerWidth: 300, innerHeight: 450,
    setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, at: now + ms }); return id },
    clearTimeout: (id) => timers.delete(id),
    requestAnimationFrame: (fn) => frames.push(fn),
    PET: { send: (m) => sent.push(m) }, SLEEP: { state: 'active' }, petPanelOpen: false,
    canvas: { style: {} }, speak() {}, hush() {}, place() {},
    walk: { phase: '', timers: [], slideId: 0, plan: null, area: null, base: null, displayId: '', displayRequest: 0, alpha: 1, opacityApplied: false, returnFade: 0, recoverTimer: 0, safeHold: false, faceDir: null, recover: null },
    petDisplay: { id: '', area: null, scaleFactor: 0, request: 0, answered: 0, at: 0 },
    shown: { k: 1, x: 100, y: 200 }, free: { on: true, x: 100, y: 200, k: 1, anim: null, applied: true },
  })
  vm.runInContext(source.slice(planStart, planEnd), ctx)
  vm.runInContext(`let fleeX = 0, lastPlaceKey = '';`, ctx)
  vm.runInContext(source.slice(source.indexOf('      const requestPetDisplay ='), source.indexOf('      let touchHold =')), ctx)
  vm.runInContext(source.slice(source.indexOf('      const WALK_SPEED'), source.indexOf('      const startWalk = () =>')), ctx)
  vm.runInContext(source.slice(source.indexOf('      const startWalk = () =>'), source.indexOf('      walkCheck = (now) =>')) + `
    globalThis.caseApi = { startWalk: () => startWalk(), applyDisplay: (d, c, r, list) => applyPetDisplay(d, c, r, list), state: () => ({ phase: walk.phase, plan: walk.plan, out: walk.out, displayId: walk.displayId, answered: petDisplay.answered, request: walk.displayRequest, at: petDisplay.at, area: petDisplay.area, now: performance.now() }) };
  `, ctx)
  const run = (s) => vm.runInContext(s, ctx)
  const advance = (ms) => {
    now += ms
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= now).sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      timers.delete(due[0]); due[1].fn()
    }
  }
  run('caseApi.startWalk()')
  assert.equal(run('caseApi.state().phase'), 'ready')
  const req = sent.find((m) => m.type === 'display')
  assert.ok(req && req.request > 0 && Number.isFinite(req.point.x), 'startWalk가 main에 display를 요청')
  // main→page 응답: request는 display가 아니라 top-level (m.request)
  run(`caseApi.applyDisplay({ id: '1', scaleFactor: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } }, false, ${req.request}, [
    { id: '1', workArea: { x: 0, y: 0, width: 1920, height: 1080 } }
  ])`)
  assert.equal(run('caseApi.state().answered'), req.request)
  advance(2300); advance(700)   // speak 대기 → 꼬마 전환 대기 → 출발
  const state = run('caseApi.state()')
  assert.equal(state.phase, 'out', 'display 응답이 answered를 갱신하지 못하면 여기서 ""로 취소된다')
  assert.ok(state.plan && state.plan.travel > 0)
  assert.ok(state.out !== 0)
  assert.equal(state.displayId, '1')
  assert.ok(frames.length > 0, 'slide가 예약되어야 한다')
})

test('in-app 산책과 상태 정리 경로는 기존 outDistance/복귀 인사를 유지한다', () => {
  const start = source.slice(source.indexOf('      const startWalk = () =>'), source.indexOf('      walkCheck = (now) =>'))
  const back = source.slice(source.indexOf('      const walkBack = () =>'), source.indexOf('      const startWalk = () =>'))
  assert.match(start, /walk\.out = outDistance\(walk\.dir\)/, '창 안 산책은 기존 경계 밖 이동을 유지')
  assert.match(start, /walkLater\(walkBack, 8000 \+ Math\.random\(\) \* 6000\)/)
  assert.match(back, /slide\(outDistance\(1\), 0,/)
  assert.match(start, /if \(PET && petPanelOpen\) return;/, '자체 펫 설정 패널이 열린 동안만 산책 금지')
  assert.match(start, /if \(!area\) \{ walk\.phase = ""; walk\.dir = -1; clearWalkVisual\(\); return; \}/, 'main display 응답이 없으면 외부 산책은 fail-closed')
  assert.match(source, /walk\.timers = \[\]; walk\.slideId\+\+; walk\.phase = ""; fleeX = 0; clearWalkVisual\(\); petBounds = null; drag\.pending = null; PET\.press\(false\);/, 'open 재진입 시 산책 상태 정리')
  assert.match(source, /if \(PET && walk\.base && \(walk\.phase === "out" \|\| walk\.phase === "away" \|\| walk\.phase === "in"\)\)/, '산책 중 제자리는 출발 시 고정')
  assert.match(source, /const fixed = list && walk\.displayId \? list\.find/, '표시장치 추가만으로 출발 monitor를 바꾸지 않음')
  assert.match(source, /if \(fixedArea\) \{[\s\S]*?recoverWalk\(fixedArea\); return;/, '출발 monitor의 workArea 변경만 복구')
  assert.match(source, /applyPetDisplay\(m\.display, !!m\.changed, m\.request, m\.displays\)/, 'main의 top-level request와 displays 목록을 page handler가 전달')
  assert.match(source, /const faceTo = walk\.phase === "out" \? walk\.dir : walk\.phase === "in" \? \(walk\.faceDir == null \? -walk\.dir : walk\.faceDir\) : 0;/)
  assert.match(back, /walk\.dir = dir; walk\.faceDir = dir;/, 'PET 복귀는 실제 이동 방향을 faceDir로 명시')
  assert.match(source, /\(walk\.safeHold && walkAreaValid\(walk\.area\)\)/, '복구 뒤에도 지정 안전영역 clip 유지')
  assert.match(source, /const limit = walkAreaValid\(walk\.area\) \? walk\.area : petDisplay\.area;/, '복구 뒤 keepIn은 안전영역 기준')
  assert.match(source, /const cancelWalk = \(\) => \{[\s\S]*?clearWalkVisual\(\)/, '출발 전 집기 취소도 산책 상태 정리')
  assert.match(source, /if \(!m\.on\) \{[\s\S]*?clearWalkVisual\(\)/, '펫 창이 숨을 때 진행 중 산책 상태 정리')
})

test('main은 DIP workArea와 실제 native bounds를 페이지에 배선한다', () => {
  assert.match(mainSource, /case 'display': sendDisplay\(false, message\.point, message\.request\)/)
  assert.match(mainSource, /screen\.getDisplayNearestPoint\(\{ x: Math\.round\(point\.x\), y: Math\.round\(point\.y\) \}\)/)
  assert.match(mainSource, /for \(const name of \['display-added', 'display-removed', 'display-metrics-changed'\]\) screen\.on/)
  assert.match(mainSource, /displays: screen\.getAllDisplays\(\)\.map\(displayView\)/, 'topology 판단용 전체 display 목록')
  assert.match(mainSource, /case 'move': placer\.place\(message\.x, message\.y, message\.walk === true\)/, 'drag tick에는 bounds IPC를 보내지 않음')
  assert.match(mainSource, /onPlace: \(w\) => toPage\(\{ type: 'bounds', bounds: w\.getBounds\(\) \}\)/)
})

test('placer onPlace는 요청값이 아니라 setBounds 뒤 실제 bounds를 알린다', () => {
  const win = { bounds: { x: 0, y: 0, width: 440, height: 540 }, calls: [], destroyed: false }
  win.isDestroyed = () => false
  win.getBounds = () => ({ ...win.bounds })
  win.setBounds = (r) => { win.calls.push({ ...r }); win.bounds = win.calls.length === 1 ? { ...r, x: r.x + 3 } : { ...r } }
  const seen = []
  let timer = null
  const placer = createPlacer(() => win, {
    width: 440, height: 540, setTimer: (fn) => (timer = fn), clearTimer: () => {}, onPlace: (w) => seen.push(w.getBounds()),
  })
  placer.place(100, 200, true)
  assert.equal(seen.length, 1)
  assert.equal(seen[0].x, 103, 'onPlace는 실제로 적용된 bounds를 읽어야 한다')
  timer?.()
  assert.equal(seen.at(-1).x, 100, 'settle 보정 뒤 실제 bounds도 다시 알린다')
  const quiet = createPlacer(() => win, { width: 440, height: 540, setTimer: () => {}, clearTimer: () => {}, onPlace: () => { throw new Error('drag tick에서 bounds IPC가 불리면 안 됨') } })
  quiet.place(10, 10); quiet.place(20, 20)   // 일반 drag tick: 기본 send=false
})
