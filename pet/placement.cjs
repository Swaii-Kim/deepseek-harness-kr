// 펫 창을 지정한 자리·크기에 놓고, 놓인 결과를 확인해 어긋났으면 다시 맞춘다.
// 배율(DPI)이 다른 모니터 사이를 넘나들면 Electron(Windows)은 setPosition 좌표를 창이 있던 모니터의 배율로 해석해 엉뚱한 자리에 놓거나
// 창 크기를 키운 채 되돌리지 않는다 (electron/electron#10862). 한 번만 지시하면 산책으로 모니터 경계를 넘었다 돌아올 때 제자리에 못 돌아온다.
// 그래서 (1) 위치와 크기를 함께 지시하고 (2) 움직임이 멈춘 뒤 실제 자리를 읽어, 어긋났으면 다시 지시한다.
// 옮기는 동안(끌기·산책)에는 확인 없이 계속 지시만 해 끊기지 않게 한다.

const same = (a, b) => Math.abs(a - b) <= 1

/**
 * @param getWin 지금 펫 창을 돌려주는 함수 (창이 없거나 닫혔으면 null/undefined)
 * @param opts.width opts.height 처음 창 크기 (DIP). 모니터를 넘으며 커진 크기를 되돌리려고 매번 함께 지시함. resize로 바꾸면 이후 지시도 그 크기를 씀
 * @param opts.delay 움직임이 멈춘 뒤 확인까지, 그리고 다시 지시한 뒤 다음 확인까지의 간격(ms). OS가 모니터를 판정할 시간
 * @param opts.tries 한 번 놓은 뒤 다시 지시하는 최대 횟수. 그래도 어긋나면 포기 (끝없이 다시 지시하지 않음)
 * @param opts.setTimer opts.clearTimer 시간 예약 (시험용으로 바꿔 끼움)
 */
function createPlacer(getWin, { width, height, delay = 60, tries = 8, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let size = { width, height }, target = null, applied = null, timer = null, attempt = 0
  const live = () => { const w = getWin(); return w && !w.isDestroyed() ? w : null }
  const arm = () => { clearTimer(timer); timer = setTimer(settle, delay) }
  // 지금 크기로 (x, y)에 지시하고 확인을 예약함. | 0: Math.round 결과가 -0이면 Electron이 정수로 받지 못해 오류 창을 띄움
  const order = (win, x, y) => { target = applied = { x: Math.round(x) | 0, y: Math.round(y) | 0, ...size }; attempt = 0; win.setBounds(target); arm() }

  function settle() {
    timer = null
    const win = live()
    if (!win || !target) return
    const now = win.getBounds()
    if (same(now.x, target.x) && same(now.y, target.y) && same(now.width, target.width) && same(now.height, target.height)) return
    if (++attempt > tries) return
    // 처음 두 번은 같은 값을 다시 지시 (놓은 직후엔 OS가 아직 모니터를 판정하지 못했을 수 있음).
    // 그래도 어긋나면 지시한 값과 실제 값의 차이만큼 반대로 보정해 지시
    applied = attempt <= 2 ? target : { ...target, x: target.x - (now.x - applied.x), y: target.y - (now.y - applied.y) }
    win.setBounds(applied)
    arm()
  }

  return {
    /** 창 왼쪽 위를 (x, y)에 놓음. 이전에 예약된 확인은 새 자리 기준으로 대체됨 */
    place(x, y) {
      const win = live()
      if (!win || !Number.isFinite(x) || !Number.isFinite(y)) return
      order(win, x, y)
    },
    /** 창 크기를 바꿈 (왼쪽 위는 마지막으로 지시한 자리 그대로). 이후 place 도 이 크기로 지시함. 이미 그 크기면 지시하지 않음 */
    resize(w, h) {
      const win = live()
      if (!win || !Number.isFinite(w) || !Number.isFinite(h)) return
      size = { width: Math.round(w), height: Math.round(h) }
      const now = win.getBounds()
      if (same(now.width, size.width) && same(now.height, size.height)) return
      order(win, target ? target.x : now.x, target ? target.y : now.y)
    },
    /** 예약된 확인을 그만둠 (창이 닫힐 때) */
    cancel() { clearTimer(timer); timer = null; target = null },
  }
}

module.exports = { createPlacer }
