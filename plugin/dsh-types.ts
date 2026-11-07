// plugin/client.ts가 DSH 페이지 ctx에서 실제로 쓰는 모양만 적은 타입 (타입 검사 전용, 빌드 결과에는 없음).
// DSH 쪽 전체 API가 아니라 이 플러그인이 부르는 범위만 선언한다.
import type React from 'react'

/** 붙인 것을 떼는 정리 함수 */
export type Dispose = () => void

/** remote 호출의 결과 봉투: 성공이면 value, 실패면 error */
export type RemoteResult<T> = { ok: true; value: T; error?: undefined } | { ok: false; error?: RemoteError }
export interface RemoteError { code?: string; diagnostic?: string; message?: string }

/** locale 서비스 */
export interface LocaleState { active: string; locales: Array<{ id: string }> }
export interface LocaleService {
  getLocale(): LocaleState
  subscribe(fn: () => void): Dispose
  addLanguage(language: { id: string; label: string; fallback: string }): Dispose
  register(namespace: string, locale: string, dictionary: unknown): Dispose
}

/** theme 서비스 */
export interface ThemeService { getTheme(): { active: { colorScheme?: string } } }

/** configForms.get(id)이 돌려주는 플러그인 설정 폼. V는 설정값 모양 */
export interface ConfigFormSnapshot<V> { status: string; writable?: boolean; value?: V }
export interface ConfigFormOp { op: 'set'; path: string[]; value: unknown }
export interface ConfigForm<V> {
  subscribe(fn: () => void): Dispose
  getSnapshot(): ConfigFormSnapshot<V>
  set(field: string, value: unknown): Promise<boolean>
  /** 없는 Harness 버전도 있어 확인 후 쓴다 */
  mutate?(ops: ConfigFormOp[]): Promise<boolean>
}

/** 플러그인 목록 화면 등에 끼우는 슬롯 */
export interface SlotService {
  inject(name: string, fn: () => Dispose): Dispose
  register(entry: { name: string; key: string }, component: (props: { view?: string }) => React.ReactNode): Dispose
}

/** remote.pluginManager: 설치된 플러그인 목록과 설치·제거 */
export interface BundleRow { name: string; version?: string; source?: string }
export interface InstallOutcome { application?: string; error?: RemoteError }
export interface PluginManager {
  listBundles(): Promise<RemoteResult<BundleRow[]>>
  installBundle(spec: string, options: { enabled: boolean; requestId: string }): Promise<RemoteResult<InstallOutcome>>
  removeBundle(name: string): Promise<RemoteResult<InstallOutcome>>
  /** 없는 Harness 버전도 있다 */
  waitForInstall?(requestId: string): Promise<RemoteResult<InstallOutcome>>
}

/** remote.credentials: 값은 돌려주지 않고 저장 여부만 알려 준다 */
export interface CredentialView { configured?: boolean; source?: string }
export interface CredentialService {
  describe(refs: string[]): Promise<RemoteResult<Record<string, CredentialView>>>
  set(ref: string, value: string): Promise<RemoteResult<unknown>>
}

export interface RemoteService {
  pluginManager: PluginManager
  credentials: CredentialService
  /** 없는 Harness 버전도 있어 확인 후 쓴다 */
  $on?(event: string, fn: (ref: string) => void): Dispose
}

/** layout.panelInfo: 지금 열린 패널 */
export interface PanelInfo {
  getSnapshot(): { activePanelId?: string } | undefined
  subscribe(fn: () => void): Dispose | undefined
}

/** ctx.inject 콜백이 받는 범위. 요청한 서비스만 들어 있다 (remote는 'remote'를 요청한 콜백에서만 쓴다) */
export interface InjectScope {
  effect(fn: () => Dispose, label: string): void
  layout?: { panelInfo?: PanelInfo }
  remote: RemoteService
}

/** apply(ctx)가 받는 ctx */
export interface DshContext {
  locale: LocaleService
  theme: ThemeService
  configForms: { get<V>(id: string): ConfigForm<V> }
  slots: SlotService
  effect(fn: () => Dispose, label: string): void
  /** 없는 Harness 버전도 있어 확인 후 쓴다 */
  inject?(services: string[], fn: (scope: InjectScope) => void): void
}

declare global {
  interface Window {
    /** 이전 apply가 남긴 정리 함수 (같은 페이지에서 다시 붙을 때 먼저 부른다) */
    __deepseekHarnessKrDispose?: Dispose
  }
}
