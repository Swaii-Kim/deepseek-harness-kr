// 캐릭터 모듈이 함께 쓰는 모양 (타입 검사 전용, 빌드 결과에는 없음)

/** 화면 사각형 (CSS px, 뷰포트 기준) */
export interface Rect { left: number; top: number; right: number; bottom: number }
/** 배치에 쓰는 뷰포트 (모바일은 시각 뷰포트, 데스크톱은 창) */
export interface Viewport { w: number; h: number; top: number; left: number }
/** 캔버스 왼쪽 위 (x, y)와 배율 k */
export interface Pose { k: number; x: number; y: number }
/** 스프링 상태: 위치 x, 속도 v */
export interface Spring { x: number; v: number }

/** 플러그인 설정에서 온 값 (plugin/client.ts characterPrefs가 만든다) */
export interface CharacterPrefs {
  outfit?: Record<string, any>   // 소품·옷은 boolean, bodyType은 문자열
  sleep?: { enabled?: boolean; minutes?: number }
  intro?: { enabled?: boolean }
  mobile?: { enabled?: boolean }
  drag?: { key?: string }
  pageHidden?: boolean
}

/** 펫 창 preload가 넣어 주는 window.dscPet */
export interface PetBridge {
  on(fn: (message: any) => void): void
  send(message: unknown): void
  move(x: number, y: number): void
  press(on: boolean): void
  menu(): void
}

/** 한 프레임 동안 단계 사이에 넘기는 고개·몸·표정 누적값 (character/index.ts 절차 애니메이션) */
export type Motion = Record<"yaw" | "pitch" | "roll" | "swayYaw" | "swayPitch" | "bodyX" | "bodyY" | "bodyZ" | "lean" | "smile" | "eyeSmileAdd" | "eyeClose" | "mouthAdd", number>

/** createCharacter가 돌려주는 API (플러그인 화면이 쓰는 유일한 통로) */
export interface CharacterApi {
  setPrefs(next: CharacterPrefs): void
  readonly togglePet: (() => void) | null
  readonly toggleCanvas: (() => boolean) | null
  canvasHidden(): boolean
}