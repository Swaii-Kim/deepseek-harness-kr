// @ts-check
// 펫 창을 지정한 자리·크기에 놓고, 놓인 결과를 확인해 어긋났으면 다시 맞춘다.
// 배율(DPI)이 다른 모니터 사이를 넘나들면 Electron(Windows)은 setPosition 좌표를 창이 있던 모니터의 배율로 해석해 엉뚱한 자리에 놓거나
// 창 크기를 키운 채 되돌리지 않는다 (electron/electron#10862). 한 번만 지시하면 산책으로 모니터 경계를 넘었다 돌아올 때 제자리에 못 돌아온다.
// 그래서 (1) 위치와 크기를 함께 지시하고 (2) 움직임이 멈춘 뒤 실제 자리를 읽어, 어긋났으면 다시 지시한다.
// 옮기는 동안(끌기·산책)에는 확인 없이 계속 지시만 해 끊기지 않게 한다.

/** @typedef {{ x: number, y: number, width: number, height: number }} Bounds */
/** @typedef {{ width: number, height: number }} Size */
/**
 * 이 모듈이 쓰는 펫 창(Electron BrowserWindow)의 범위
 * @typedef {object} PetWindow
 * @property {() => boolean} isDestroyed
 * @property {() => Bounds} getBounds
 * @property {(bounds: Bounds) => void} setBounds
 */

/** 1 이하 차이의 같은 값 여부 (DIP 반올림 오차 허용) @param {number} actual @param {number} expected */
const same = (actual, expected) => Math.abs(actual - expected) <= 1

/**
 * 펫 창 배치기 생성: 위치·크기 지시, 멈춘 뒤 실제 자리 확인과 어긋남 보정
 * @param {() => PetWindow | null | undefined} getWin 지금 펫 창을 돌려주는 함수 (창이 없거나 닫혔으면 null/undefined)
 * @param {object} [options]
 * @param {number} [options.width] 처음 창 너비 (DIP). 모니터를 넘으며 커진 크기를 되돌리려고 매번 함께 지시함. resize로 바꾸면 이후 지시도 그 크기를 씀
 * @param {number} [options.height] 처음 창 높이 (DIP)
 * @param {number} [options.delay] 움직임이 멈춘 뒤 확인까지, 그리고 다시 지시한 뒤 다음 확인까지의 간격(ms). OS가 모니터를 판정할 시간
 * @param {number} [options.tries] 한 번 놓은 뒤 다시 지시하는 최대 횟수. 그래도 어긋나면 포기 (끝없이 다시 지시하지 않음)
 * @param {(fn: () => void, ms: number) => unknown} [options.setTimer] 시간 예약 (시험용으로 바꿔 끼움)
 * @param {(id: any) => void} [options.clearTimer] 예약 취소
 * @param {(win: PetWindow, bounds: Bounds) => void} [options.onPlace] setBounds를 실제로 지시한 직후 불림 (native 창 bounds를 페이지에 알려 clip 기준으로 쓰기 위함)
 */
function createPlacer(getWin, { width, height, delay = 60, tries = 8, setTimer = setTimeout, clearTimer = clearTimeout, onPlace = () => {} } = {}) {
  // size: 부르는 쪽(main.cjs·시험)은 width·height를 늘 넘김
  let size = /** @type {Size} */ ({ width, height }), target = /** @type {Bounds | null} */ (null), applied = /** @type {Bounds | null} */ (null), timer = /** @type {unknown} */ (null), attempt = 0
  let notify = false   // 이번 이동의 실제 bounds를 onPlace로 알릴지 (산책 중에만 true)
  /** 살아 있는 펫 창 (없거나 닫혔으면 null) */
  const live = () => { const win = getWin(); return win && !win.isDestroyed() ? win : null }
  /** 확인 다시 예약 (이전 예약은 취소, delay ms 뒤) */
  const arm = () => { clearTimer(timer); timer = setTimer(settle, delay) }
  /**
   * 지금 크기로 (x, y)에 지시하고 확인 예약. 다시 지시 횟수 초기화
   * | 0: Math.round 결과가 -0이면 Electron이 정수로 받지 못해 오류 창을 띄움
   * @param {PetWindow} win @param {number} x @param {number} y @param {boolean} send true면 이번 이동의 실제 bounds를 onPlace로 알림
   */
  const order = (win, x, y, send) => {
    target = applied = { x: Math.round(x) | 0, y: Math.round(y) | 0, ...size }; attempt = 0; notify = send
    win.setBounds(target)
    if (notify) onPlace(win, target)
    arm()
  }

  /** 실제 자리 확인: 지시와 맞으면 끝, 어긋났으면 tries 번까지 다시 지시하고 확인 재예약 */
  function settle() {
    timer = null
    const win = live()
    if (!win || !target) return
    const current = win.getBounds()
    if (same(current.x, target.x) && same(current.y, target.y) && same(current.width, target.width) && same(current.height, target.height)) return
    if (++attempt > tries) return
    // 처음 두 번은 같은 값을 다시 지시 (놓은 직후엔 OS가 아직 모니터를 판정하지 못했을 수 있음).
    // 그래도 어긋나면 지시한 값과 실제 값의 차이만큼 반대로 보정해 지시
    applied = attempt <= 2 ? target : { ...target, x: target.x - (current.x - /** @type {Bounds} */ (applied).x), y: target.y - (current.y - /** @type {Bounds} */ (applied).y) }
    win.setBounds(applied)
    if (notify) onPlace(win, applied)
    arm()
  }

  return {
    /**
     * 창 왼쪽 위를 화면 좌표 (x, y)에 놓기. 이전에 예약된 확인은 새 자리 기준으로 대체됨
     * @param {number} x @param {number} y @param {boolean} [send] true면 실제 bounds를 onPlace로 알림 (산책 중에만, 끌기 4ms 틱마다 IPC가 늘지 않게)
     */
    place(x, y, send = false) {
      const win = live()
      if (!win || !Number.isFinite(x) || !Number.isFinite(y)) return
      order(win, x, y, send)
    },
    /** 창 크기 바꾸기 (왼쪽 위는 마지막으로 지시한 자리 그대로). 이후 place 도 이 크기로 지시함. 이미 그 크기면 지시하지 않음 @param {number} w @param {number} h */
    resize(w, h) {
      const win = live()
      if (!win || !Number.isFinite(w) || !Number.isFinite(h)) return
      size = { width: Math.round(w), height: Math.round(h) }
      const current = win.getBounds()
      if (same(current.width, size.width) && same(current.height, size.height)) return
      order(win, target ? target.x : current.x, target ? target.y : current.y, false)
    },
    /** 예약된 확인 그만두기 (창이 닫힐 때) */
    cancel() { clearTimer(timer); timer = null; target = null },
  }
}

module.exports = { createPlacer }
