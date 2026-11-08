// 마우스 좌우 버튼 코드(두 버튼 함께 누르기) 판정 (순수 함수). 첫 버튼을 누른 채 150ms 안에 두 번째 버튼이 오면 코드로 본다.

/** 코드 판정 상태 */
export interface Chord {
  /** 첫 버튼을 누른 시각 (ms, 없으면 null) */
  at: number | null;
  /** 첫 버튼 (0 왼쪽 · 2 오른쪽, 없으면 null) */
  button: number | null;
  /** 캐릭터 위에서 시작 여부 */
  valid: boolean;
}

export const CHORD_GRACE_MS = 150;
/**
 * 버튼 누름 반영. 첫 버튼이면 시각을 새로 기록하고, 두 번째 버튼이면 첫 버튼 시각 유지
 * @param button 누른 버튼 (PointerEvent.button: 0 왼쪽 · 2 오른쪽, 그 밖은 무시)
 * @param buttons 지금 눌린 버튼 비트 (PointerEvent.buttons: 1 왼쪽 · 2 오른쪽)
 * @param now 누른 시각 (ms)
 * @returns 새 상태 (valid는 false로 시작)
 */
export const chordDown = (chord: Chord, button: number, buttons: number, now: number): Chord => {
  if (button !== 0 && button !== 2) return chord;
  const other = button === 0 ? 2 : 1;
  if (buttons & other) return chord;   // 두 번째 버튼: 첫 버튼 누른 시각은 유지
  return { at: now, button, valid: false };
};
/**
 * 두 번째 버튼이 첫 버튼을 누른 채 유예 시간 안에 왔는지 여부
 * @param button 지금 누른 버튼 (0 왼쪽 · 2 오른쪽)
 * @param buttons 지금 눌린 버튼 비트 (1 왼쪽 · 2 오른쪽)
 * @param now 지금 시각 (ms)
 * @param graceMs 유예 시간 (ms)
 * @returns 코드로 볼 수 있으면 true
 */
export const chordWithinGrace = (chord: Chord | null, button: number, buttons: number, now: number, graceMs = CHORD_GRACE_MS): boolean => {
  if (!chord || chord.valid !== true || !Number.isFinite(chord.at)) return false;
  if (button === chord.button) return false;   // 같은 버튼 반복은 코드가 아님
  const firstBit = chord.button === 0 ? 1 : chord.button === 2 ? 2 : 0;
  const secondBit = button === 0 ? 1 : button === 2 ? 2 : 0;
  if (!firstBit || !secondBit) return false;
  if (!(buttons & firstBit) || !(buttons & secondBit)) return false;   // 첫 버튼이 아직 눌려 있어야 함
  const firstAt = chord.at as number;   // 위에서 유한한 수인지 확인함
  return now >= firstAt && now - firstAt <= graceMs;
};
/**
 * 버튼 뗌 반영. 좌우 버튼이 모두 떨어지면 상태 초기화
 * @param buttons 지금 눌린 버튼 비트 (1 왼쪽 · 2 오른쪽)
 */
export const chordUp = (chord: Chord, buttons: number): Chord => ((buttons & 3) === 0 ? { at: null, button: null, valid: false } : chord);
