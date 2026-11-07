// 타이머·프레임·리스너·DOM 감시·정리 함수를 한데 묶어 dispose 한 번으로 모두 정리하는 수명 객체.
// 플러그인 화면은 기능마다 하나씩 만들어 끌 때 정리하고, 펫 창은 하나를 만들어 창이 닫힐 때까지 쓴다.
export function createLifetime() {
  let stopped = false
  const cleanups = []
  const timers = new Set(), intervals = new Set(), frames = new Set()
  const add = (cleanup) => { if (stopped) cleanup(); else cleanups.push(cleanup) }
  const timeout = (fn, ms, ...args) => {
    if (stopped) return 0
    const id = window.setTimeout(() => { timers.delete(id); if (!stopped) fn(...args) }, ms)
    timers.add(id); return id
  }
  const interval = (fn, ms, ...args) => {
    if (stopped) return 0
    const id = window.setInterval(() => { if (!stopped) fn(...args) }, ms)
    intervals.add(id); return id
  }
  const frame = (fn) => {
    if (stopped) return 0
    const id = window.requestAnimationFrame((time) => { frames.delete(id); if (!stopped) fn(time) })
    frames.add(id); return id
  }
  const listen = (target, type, fn, options) => {
    if (stopped) return
    target.addEventListener(type, fn, options)
    add(() => target.removeEventListener(type, fn, options))
  }
  const observe = (fn) => {
    const observer = new window.MutationObserver((...args) => { if (!stopped) fn(...args) })
    add(() => observer.disconnect())
    return observer
  }
  const own = (value, cleanup) => { add(() => cleanup(value)); return value }
  return {
    add, timeout, interval, frame, listen, observe, own,
    get stopped() { return stopped },
    dispose() {
      if (stopped) return
      stopped = true
      for (const id of timers) window.clearTimeout(id)
      for (const id of intervals) window.clearInterval(id)
      for (const id of frames) window.cancelAnimationFrame(id)
      for (const cleanup of cleanups.reverse()) {
        try { cleanup() } catch (error) { console.warn('DeepSeek짱 cleanup:', error) }
      }
    },
  }
}
