import test from 'node:test'
import assert from 'node:assert/strict'
import { createLogger, DEBUG_KEY } from '../../character/log.ts'

/** 기록을 모으는 가짜 콘솔 */
const fakeConsole = () => { const lines = []; return { lines, warn: (...args) => lines.push(['warn', ...args]), log: (...args) => lines.push(['log', ...args]) } }

test('warnOnce: 접두어를 붙이고 같은 key는 한 번만 남긴다', () => {
  const output = fakeConsole()
  const logger = createLogger(output, () => null)
  logger.warnOnce('a', '첫 경고', 1); logger.warnOnce('a', '다른 내용'); logger.warnOnce('b', '둘째')
  assert.deepEqual(output.lines, [['warn', '[deepseek-chan-plugin-for-dsh]', '첫 경고', 1], ['warn', '[deepseek-chan-plugin-for-dsh]', '둘째']])
})

test('debug: localStorage 스위치가 "1"일 때만 남기고, 스위치는 만들 때 한 번만 읽는다', () => {
  let reads = 0
  const storage = (value) => () => ({ getItem: (key) => { reads++; return key === DEBUG_KEY ? value : null } })
  const on = fakeConsole(), off = fakeConsole()
  const loggerOn = createLogger(on, storage('1'))
  loggerOn.debug('보임'); loggerOn.debug('보임')
  createLogger(off, storage('0')).debug('안 보임')
  assert.deepEqual(on.lines, [['log', '[deepseek-chan-plugin-for-dsh]', '보임'], ['log', '[deepseek-chan-plugin-for-dsh]', '보임']])
  assert.deepEqual(off.lines, [])
  assert.equal(reads, 2)
  const blocked = fakeConsole()
  createLogger(blocked, () => { throw new Error('SecurityError') }).debug('막힘')   // 저장소 접근 예외는 꺼진 것으로
  assert.deepEqual(blocked.lines, [])
})
