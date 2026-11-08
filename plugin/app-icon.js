// @ts-check
// 앱 아이콘 바꾸기 — Windows는 바로가기(.lnk) 아이콘, macOS는 앱 번들의 Finder 사용자 지정 아이콘.
//
// 설치 경로를 하드코딩하지 않는다. 호스트는 앱 안에서 돌기 때문에 process.execPath 로
// 지금 실행 중인 실행 파일을 알 수 있고, 그 실행 파일(또는 같은 설치 폴더의 런처)을
// 가리키는 바로가기만 골라 아이콘을 바꾼다. 그래서 커스텀 경로·포터블 설치에서도 동작한다.
//
// Windows에서 바뀌는 것은 바로가기 아이콘뿐이다. 실행 중인 창·작업 표시줄 아이콘은 exe 리소스에서
// 오므로 플러그인이 바꿀 수 없다(바꾸면 코드 서명이 깨진다).
// macOS는 Finder 정보로 붙는 사용자 지정 아이콘이라 실행 파일과 서명된 리소스는 그대로다
// (codesign --deep --strict 엄격 검사만 앱 폴더의 Icon 파일을 문제로 봄, 실행·공증 검사는 통과).
// 끄면 사용자 지정 아이콘을 떼어 원래 상태로 되돌린다.
import { execFile } from 'node:child_process'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

export const APP_ICON_FILE = 'app-icon.ico'
export const PROFILE_DIR = 'deepseek-harness-kr'

/** Windows 여부 */
export const isWindows = (platform = process.platform) => platform === 'win32'

/** macOS 여부 */
export const isMac = (platform = process.platform) => platform === 'darwin'

/**
 * 실행 파일 경로에서 바깥쪽 앱 번들(.app) 경로 추출. 호스트·도우미 프로세스가 번들 안쪽 깊은 곳에 있어도 가장 바깥 번들
 * @param {string} exePath 지금 실행 중인 실행 파일 경로 (예: /Applications/X.app/Contents/MacOS/X)
 * @returns {string | null} 앱 번들 경로, 번들 안이 아니면 null
 */
export function appBundleOf(exePath) {
  const parts = String(exePath || '').split('/')
  const index = parts.findIndex((part) => part.toLowerCase().endsWith('.app'))
  return index > 0 ? parts.slice(0, index + 1).join('/') : null
}

/** 경로의 소문자 세그먼트 배열 (드라이브 문자·구분자 차이 무시) @param {string} path */
const segments = (path) => resolve(String(path)).replace(/\\/g, '/').toLowerCase().split('/').filter(Boolean)

/**
 * 실행 파일과 바로가기 대상의 같은 설치 폴더 여부
 *  · 같거나, 한쪽이 다른 쪽의 상위 폴더면 같은 설치로 봄
 *    (포터블 런처 `...\Portable\App.exe` ↔ 내부 exe `...\Portable\Harness\App.exe`)
 *  · 공유 구간이 2칸 미만이면(드라이브 루트 등) 인정하지 않음
 *  · 이름이 접두어만 같은 남의 폴더(`C:\Apps\DSH` ↔ `C:\Apps\DSH2`)는 제외
 * @param {unknown} target 바로가기 대상 경로 @param {unknown} exe 지금 실행 중인 실행 파일 경로 @returns {boolean}
 */
export function sameInstall(target, exe) {
  if (typeof target !== 'string' || typeof exe !== 'string' || !target || !exe) return false
  const targetDir = segments(target).slice(0, -1)
  const exeDir = segments(exe).slice(0, -1)
  /** 세그먼트 단위 접두어 여부 (prefix 가 path 의 앞부분과 같으면 true) @param {string[]} prefix @param {string[]} path */
  const isPrefix = (prefix, path) => prefix.length <= path.length && prefix.every((segment, i) => segment === path[i])
  const shorter = Math.min(targetDir.length, exeDir.length)
  if (shorter < 2) return false
  return isPrefix(targetDir, exeDir) || isPrefix(exeDir, targetDir)
}

/** 바로가기에 넣을 IconLocation 값. bind: 아이콘 파일, restore: 원래 실행 파일 아이콘 @param {string} path */
export const shortcutIconValue = (path) => `${path},0`

/**
 * 아이콘을 안정된 경로(%LOCALAPPDATA%\deepseek-harness-kr\app-icon.ico)로 복사
 * 설치 폴더가 바뀌거나 플러그인이 업데이트돼도 바로가기가 깨지지 않게 하기 위함
 * @param {string} assetsDir @param {NodeJS.ProcessEnv} [env]
 * @returns 복사한 아이콘 파일 경로
 */
export async function installIconFile(assetsDir, env = process.env) {
  const source = join(assetsDir, APP_ICON_FILE)
  const base = env.LOCALAPPDATA || join(env.USERPROFILE || env.HOME || '.', 'AppData', 'Local')
  const target = join(base, PROFILE_DIR, APP_ICON_FILE)
  await mkdir(dirname(target), { recursive: true })
  await copyFile(source, target)
  return target
}

// 바로가기를 찾아 아이콘을 바꾸는 PowerShell. 대상은 지금 실행 중인 exe 또는 그 설치 폴더.
// 경로는 인자로만 넘겨 스크립트에 문자열을 끼워 넣지 않는다.
const SCRIPT = String.raw`param([string]$Exe, [string]$Root, [string]$Parent, [string]$Icon, [switch]$Restore)
$ErrorActionPreference = 'SilentlyContinue'
$shell = New-Object -ComObject WScript.Shell
$dirs = @(
  [Environment]::GetFolderPath('Desktop'),
  [Environment]::GetFolderPath('CommonDesktopDirectory'),
  [Environment]::GetFolderPath('StartMenu'),
  [Environment]::GetFolderPath('CommonStartMenu'),
  (Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar')
)
$changed = 0
foreach ($dir in $dirs) {
  if (-not $dir -or -not (Test-Path -LiteralPath $dir)) { continue }
  Get-ChildItem -LiteralPath $dir -Recurse -Filter '*.lnk' -File -ErrorAction SilentlyContinue | ForEach-Object {
    $shortcut = $shell.CreateShortcut($_.FullName)
    $target = $shortcut.TargetPath
    if (-not $target) { return }
    $targetDir = [System.IO.Path]::GetDirectoryName($target)
    $match = ($target -ieq $Exe) -or ($targetDir -ieq $Root) -or ($targetDir -ieq $Parent)
    if (-not $match) { return }
    $want = if ($Restore) { "$target,0" } else { "$Icon,0" }
    if ($shortcut.IconLocation -ne $want) {
      $shortcut.IconLocation = $want
      $shortcut.Save()
      $script:changed++
    }
  }
}
$changed
`

/**
 * 바로가기 아이콘 PowerShell 스크립트를 프로필 폴더에 파일로 쓰기. 스크립트는 -File 로 실행(-Command 로 param 블록을 넘기면 실패)
 * @param {NodeJS.ProcessEnv} env
 * @returns 스크립트 파일 경로
 */
async function installScriptFile(env) {
  const base = env.LOCALAPPDATA || join(env.USERPROFILE || env.HOME || '.', 'AppData', 'Local')
  const dir = join(base, PROFILE_DIR)
  await mkdir(dir, { recursive: true })
  const target = join(dir, 'shortcut-icon.ps1')
  await writeFile(target, SCRIPT, 'utf8')
  return target
}

// 앱 번들에 Finder 사용자 지정 아이콘을 붙이거나 떼는 JXA. 경로는 인자로만 넘김.
// 붙일 때는 지금 아이콘 파일을 그대로 다시 씀, 뗄 때는 붙어 있을 때만 떼고 바꾼 수(0·1) 출력
const MAC_SCRIPT = `ObjC.import('AppKit')
function run(argv) {
  const [icon, bundle, mode] = argv
  const workspace = $.NSWorkspace.sharedWorkspace
  const hasCustom = $.NSFileManager.defaultManager.fileExistsAtPath(bundle + '/Icon\\r')
  if (mode === 'restore') return hasCustom ? (workspace.setIconForFileOptions($(), bundle, 0) ? '1' : 'failed') : '0'
  const source = $.NSImage.alloc.initWithContentsOfFile(icon)
  if (!source || source.isNil()) return 'no-image'
  // macOS 아이콘 격자: 1024 캔버스에 본체 824, 둘레 100 여백. 원본(256)의 흰 둥근 사각형(13~243, 17~247)을
  // 그 본체 자리에 맞추고, 사각형 밖으로 나온 머리·귀는 여백 쪽으로 그대로 나오게 둠
  // (그리기 좌표는 왼쪽 아래 원점: 원본 전체 917 크기를 x 53, 아래에서 68 위치에)
  const image = $.NSImage.alloc.initWithSize($.NSMakeSize(1024, 1024))
  image.lockFocus
  source.drawInRectFromRectOperationFraction($.NSMakeRect(53, 68, 917, 917), $.NSMakeRect(0, 0, 0, 0), 2, 1)
  image.unlockFocus
  return workspace.setIconForFileOptions(image, bundle, 0) ? '1' : 'failed'
}`

/**
 * macOS 앱 아이콘 적용·되돌리기 (osascript JXA)
 * @param {{ assetsDir: string, enabled: boolean, exePath: string, runner: (file: string, args: string[], options: { timeout: number, windowsHide: boolean }) => Promise<{ stdout: string | Buffer }> }} options
 * @returns {Promise<{skipped?: string, changed?: number, message?: string}>}
 */
async function applyMacIcon({ assetsDir, enabled, exePath, runner }) {
  const bundle = appBundleOf(exePath)
  if (!bundle) return { skipped: 'no-app-bundle' }
  const args = ['-l', 'JavaScript', '-e', MAC_SCRIPT, join(assetsDir, APP_ICON_FILE), bundle, enabled ? 'apply' : 'restore']
  try {
    const { stdout } = await runner('osascript', args, { timeout: 20000, windowsHide: true })
    const output = String(stdout).trim()
    if (output !== '0' && output !== '1') return { skipped: 'icon-failed', message: output }
    return { changed: Number(output) }
  } catch (error) {
    return { skipped: 'spawn-failed', message: /** @type {Error | null | undefined} */ (error)?.message }
  }
}

/**
 * 앱 아이콘 적용: 설정이 켜져 있으면 플러그인 아이콘으로, 꺼져 있으면 원래대로 되돌리기
 * Windows는 바로가기(.lnk) 아이콘, macOS는 앱 번들의 Finder 사용자 지정 아이콘
 * @param {object} options
 * @param {string} options.assetsDir 아이콘 파일(app-icon.ico)이 있는 자산 폴더
 * @param {boolean} options.enabled true면 플러그인 아이콘, false면 원래 아이콘
 * @param {string} [options.exePath] 지금 실행 중인 실행 파일
 * @param {NodeJS.Platform} [options.platform]
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {(file: string, args: string[], options: { timeout: number, windowsHide: boolean }) => Promise<{ stdout: string | Buffer }>} [options.runner] PowerShell·osascript 실행 (시험용)
 * @returns {Promise<{skipped?: string, changed?: number, message?: string}>} 바꾼 바로가기 수, 또는 건너뛴 이유
 */
export async function applyShortcutIcon({ assetsDir, enabled, exePath = process.execPath, platform = process.platform, env = process.env, runner = run }) {
  if (!isWindows(platform) && !isMac(platform)) return { skipped: 'platform' }
  if (!exePath) return { skipped: 'no-exec-path' }
  if (isMac(platform)) return applyMacIcon({ assetsDir, enabled, exePath, runner })
  const icon = await installIconFile(assetsDir, env)
  const script = await installScriptFile(env)
  const root = dirname(exePath)
  const parent = dirname(root)
  const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script,
    '-Exe', exePath, '-Root', root, '-Parent', parent, '-Icon', icon]
  if (!enabled) args.push('-Restore')
  try {
    const { stdout } = await runner('powershell.exe', args, { timeout: 20000, windowsHide: true })
    const changed = Number(String(stdout).trim().split(/\s+/).pop())
    return { changed: Number.isFinite(changed) ? changed : 0 }
  } catch (error) {
    return { skipped: 'spawn-failed', message: /** @type {Error | null | undefined} */ (error)?.message }
  }
}
