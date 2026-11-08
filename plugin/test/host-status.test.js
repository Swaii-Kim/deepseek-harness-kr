import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createStatusHandler, iconProblem } from '../host.js'

const response = () => ({
  headers: null, body: '',
  writeHead(code, headers) { this.status = code; this.headers = headers ?? null },
  end(body = '') { this.body = body; this.ended = true },
})

test('앱 아이콘 결과: Windows 아님·실행 경로 없음·성공은 알리지 않고 실패만 사유와 함께', () => {
  assert.equal(iconProblem(undefined), null)
  assert.equal(iconProblem({ changed: 2 }), null)
  assert.equal(iconProblem({ skipped: 'platform' }), null)
  assert.equal(iconProblem({ skipped: 'no-exec-path' }), null)
  assert.deepEqual(iconProblem({ skipped: 'spawn-failed', message: 'powershell.exe ENOENT' }), { reason: 'spawn-failed', message: 'powershell.exe ENOENT' })
  assert.deepEqual(iconProblem({ skipped: 'spawn-failed' }), { reason: 'spawn-failed' })
})

test('진단 상태 경로: 인증을 먼저 확인하고, GET만 JSON으로 응답', async () => {
  let reads = 0
  const read = () => { reads++; return { appIcon: { reason: 'spawn-failed' } } }
  const denied = response()
  await createStatusHandler(read, () => 401)({ method: 'GET' }, denied)
  assert.equal(denied.status, 401); assert.equal(reads, 0)
  const post = response()
  await createStatusHandler(read, () => undefined)({ method: 'POST' }, post)
  assert.equal(post.status, 405); assert.equal(reads, 0)
  const ok = response()
  await createStatusHandler(read, () => undefined)({ method: 'GET' }, ok)
  assert.equal(ok.status, 200)
  assert.equal(ok.headers['cache-control'], 'no-store')
  assert.deepEqual(JSON.parse(ok.body), { appIcon: { reason: 'spawn-failed' } })
})

test('설정 화면은 시작하고 잠시 뒤 한 번만 상태를 읽고, 실패는 같은 내용당 한 번 경고', async () => {
  const source = await readFile(new URL('../client.ts', import.meta.url), 'utf8')
  assert.match(source, /life\.timeout\(\(\) => \{ void reportHostStatus\(\) \}, HOST_STATUS_DELAY_MS\)/)
  assert.match(source, /fetchImpl\('\/deepseek-harness-kr\/status'/)
  assert.match(source, /log\.warnOnce\('app-icon:' \+ problem\.reason/)
})
