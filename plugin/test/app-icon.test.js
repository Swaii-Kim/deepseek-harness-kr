import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sameInstall, shortcutIconValue, isWindows, isMac, appBundleOf, installIconFile, applyShortcutIcon } from '../app-icon.js'

test('sameInstall: 같은 설치 폴더만 인정한다', () => {
  const exe = 'C:\\Users\\me\\AppData\\Local\\Programs\\DeepSeek Harness\\DeepSeek Harness.exe'
  // 같은 폴더
  assert.equal(sameInstall('C:\\Users\\me\\AppData\\Local\\Programs\\DeepSeek Harness\\DeepSeek Harness.exe', exe), true)
  // 다른 이름의 exe라도 같은 폴더면 같은 설치
  assert.equal(sameInstall('C:\\Users\\me\\AppData\\Local\\Programs\\DeepSeek Harness\\Launcher.exe', exe), true)
  // 포터블: 상위 폴더의 런처
  assert.equal(sameInstall('C:\\Portable\\DSH\\DeepSeek-Harness.exe', 'C:\\Portable\\DSH\\Harness\\DeepSeek Harness.exe'), true)
  // 내부 exe
  assert.equal(sameInstall('C:\\Portable\\DSH\\Harness\\DeepSeek Harness.exe', 'C:\\Portable\\DSH\\DeepSeek-Harness.exe'), true)
  // 다른 앱
  assert.equal(sameInstall('C:\\Users\\me\\AppData\\Local\\Programs\\Other\\Other.exe', exe), false)
  // 이름만 비슷한 남의 폴더
  assert.equal(sameInstall('C:\\Apps\\DSH2\\App.exe', 'C:\\Apps\\DSH\\App.exe'), false)
  // 드라이브 루트처럼 얕은 공유는 인정하지 않는다
  assert.equal(sameInstall('C:\\Other\\App.exe', 'C:\\Apps\\DSH\\App.exe'), false)
  // 잘못된 입력
  assert.equal(sameInstall('', exe), false)
  assert.equal(sameInstall(exe, undefined), false)
})

test('shortcutIconValue: 아이콘 경로에 ,0 을 붙인다', () => {
  assert.equal(shortcutIconValue('C:\\icons\\app.ico'), 'C:\\icons\\app.ico,0')
  assert.equal(shortcutIconValue('C:\\Program Files\\App\\App.exe'), 'C:\\Program Files\\App\\App.exe,0')
})

test('isWindows: 플랫폼 판정', () => {
  assert.equal(isWindows('win32'), true)
  assert.equal(isWindows('darwin'), false)
  assert.equal(isWindows('linux'), false)
})

test('installIconFile: 안정된 경로로 아이콘을 복사한다', async () => {
  const assets = await mkdtemp(join(tmpdir(), 'dsh-icon-assets-'))
  const local = await mkdtemp(join(tmpdir(), 'dsh-icon-local-'))
  try {
    await writeFile(join(assets, 'app-icon.ico'), Buffer.from([0, 0, 1, 0, 1, 0]))
    const target = await installIconFile(assets, { LOCALAPPDATA: local })
    assert.equal(target, join(local, 'deepseek-harness-kr', 'app-icon.ico'))
    assert.deepEqual([...await readFile(target)], [0, 0, 1, 0, 1, 0])
  } finally {
    await rm(assets, { recursive: true, force: true })
    await rm(local, { recursive: true, force: true })
  }
})

test('applyShortcutIcon: Windows·macOS가 아니면 아무 것도 하지 않는다', async () => {
  let calls = 0
  const r = await applyShortcutIcon({ assetsDir: '/none', enabled: true, platform: 'linux', exePath: '/usr/bin/x', runner: async () => { calls++; return { stdout: '' } } })
  assert.deepEqual(r, { skipped: 'platform' })
  assert.equal(calls, 0)
})

test('appBundleOf: 실행 파일이 번들 안쪽 깊은 곳(도우미 앱 등)에 있어도 가장 바깥 .app', () => {
  assert.equal(appBundleOf('/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness'), '/Applications/DeepSeek Harness.app')
  assert.equal(appBundleOf('/Applications/DeepSeek Harness.app/Contents/Frameworks/DeepSeek Harness Helper.app/Contents/MacOS/DeepSeek Harness Helper'), '/Applications/DeepSeek Harness.app')
  assert.equal(appBundleOf('/usr/local/bin/node'), null)
  assert.equal(appBundleOf(''), null)
  assert.equal(isMac('darwin'), true); assert.equal(isMac('win32'), false)
})

test('applyShortcutIcon(macOS): 켜면 아이콘을 붙이고, 끄면 떼며, 실패는 사유로 돌려줌', async () => {
  const calls = []
  const exePath = '/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness'
  const runner = (stdout) => async (file, args) => { calls.push({ file, args }); return { stdout } }
  const on = await applyShortcutIcon({ assetsDir: '/plugin/assets', enabled: true, platform: 'darwin', exePath, runner: runner('1\n') })
  assert.deepEqual(on, { changed: 1 })
  assert.equal(calls[0].file, 'osascript')
  assert.deepEqual(calls[0].args.slice(-2), ['/Applications/DeepSeek Harness.app', 'apply'])
  assert.ok(calls[0].args.at(-3).endsWith('app-icon.ico'))
  const off = await applyShortcutIcon({ assetsDir: '/plugin/assets', enabled: false, platform: 'darwin', exePath, runner: runner('0\n') })
  assert.deepEqual(off, { changed: 0 })
  assert.equal(calls[1].args.at(-1), 'restore')
  assert.deepEqual(await applyShortcutIcon({ assetsDir: '/a', enabled: true, platform: 'darwin', exePath, runner: runner('no-image') }), { skipped: 'icon-failed', message: 'no-image' })
  assert.deepEqual(await applyShortcutIcon({ assetsDir: '/a', enabled: true, platform: 'darwin', exePath: '/usr/bin/node', runner: runner('1') }), { skipped: 'no-app-bundle' })
  const fail = await applyShortcutIcon({ assetsDir: '/a', enabled: true, platform: 'darwin', exePath, runner: async () => { throw new Error('boom') } })
  assert.equal(fail.skipped, 'spawn-failed')
})

test('applyShortcutIcon: 켜기/끄기에 따라 인자와 실행 결과를 처리한다', async () => {
  const assets = await mkdtemp(join(tmpdir(), 'dsh-icon-assets-'))
  const local = await mkdtemp(join(tmpdir(), 'dsh-icon-local-'))
  const calls = []
  const runner = async (file, args) => { calls.push({ file, args }); return { stdout: '2\n' } }
  try {
    await writeFile(join(assets, 'app-icon.ico'), Buffer.from([0, 0, 1, 0, 1, 0]))
    const on = await applyShortcutIcon({
      assetsDir: assets, enabled: true, platform: 'win32',
      exePath: 'C:\\Apps\\DSH\\DeepSeek Harness.exe', env: { LOCALAPPDATA: local }, runner,
    })
    assert.equal(on.changed, 2)
    const first = calls[0]
    assert.equal(first.file, 'powershell.exe')
    assert.ok(first.args.includes('-Exe'))
    assert.ok(first.args.includes('C:\\Apps\\DSH\\DeepSeek Harness.exe'))
    assert.ok(first.args.some((a) => String(a).endsWith('app-icon.ico')))
    assert.ok(!first.args.includes('-Restore'), '켤 때는 되돌리지 않는다')

    const off = await applyShortcutIcon({
      assetsDir: assets, enabled: false, platform: 'win32',
      exePath: 'C:\\Apps\\DSH\\DeepSeek Harness.exe', env: { LOCALAPPDATA: local }, runner,
    })
    assert.equal(off.changed, 2)
    assert.ok(calls[1].args.includes('-Restore'), '끌 때는 되돌린다')

    // 스크립트 실행이 실패해도 예외를 던지지 않는다(캐릭터 동작을 막지 않음)
    const fail = await applyShortcutIcon({
      assetsDir: assets, enabled: true, platform: 'win32',
      exePath: 'C:\\Apps\\DSH\\DeepSeek Harness.exe', env: { LOCALAPPDATA: local },
      runner: async () => { throw new Error('boom') },
    })
    assert.equal(fail.skipped, 'spawn-failed')
  } finally {
    await rm(assets, { recursive: true, force: true })
    await rm(local, { recursive: true, force: true })
  }
})
