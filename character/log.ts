// DSH 창(또는 펫 창) DevTools 콘솔에 남기는 진단 기록. 사용자가 볼 수 있는 출력은 이 콘솔뿐이다.
// warnOnce는 항상 켜져 있고 같은 key는 한 번만, debug는 localStorage 스위치("1")가 켜진 때만 (시작할 때 한 번 읽음)
const PREFIX = "[deepseek-chan-plugin-for-dsh]";
/** 디버그 기록을 켜는 localStorage 키 (값 "1"이면 켜짐) */
export const DEBUG_KEY = "deepseek-chan-plugin-for-dsh:debug";

/** 진단 기록 통로 */
export interface Logger { warnOnce(key: string, ...args: unknown[]): void; debug(...args: unknown[]): void }

/** 저장소의 디버그 스위치 값 (접근 예외는 꺼진 것으로) */
const switchOn = (storage: () => Pick<Storage, "getItem"> | null | undefined): boolean => {
  try { return storage()?.getItem(DEBUG_KEY) === "1"; } catch { return false; }
};

/**
 * 진단 기록 통로 생성 (디버그 스위치는 여기서 한 번만 읽음)
 * @param output 기록을 남길 콘솔 (호출할 때마다 메서드를 찾아 바꿔 끼운 콘솔도 따름)
 * @param storage 디버그 스위치를 읽을 저장소
 */
export function createLogger(output: Pick<Console, "warn" | "log"> = console, storage = (): Pick<Storage, "getItem"> | undefined => globalThis.localStorage): Logger {
  const seen = new Set<string>();
  const debugOn = switchOn(storage);
  return {
    warnOnce(key, ...args) { if (seen.has(key)) return; seen.add(key); output.warn(PREFIX, ...args); },
    // console.debug는 DevTools 기본 수준(Verbose 꺼짐)에서 안 보여 log로 남김
    debug(...args) { if (debugOn) output.log(PREFIX, ...args); },
  };
}

/** 이 화면에서 함께 쓰는 진단 기록 통로 */
export const log = createLogger();
