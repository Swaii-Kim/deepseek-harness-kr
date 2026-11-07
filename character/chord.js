// 마우스 좌우 버튼 코드(두 버튼 함께 누르기) 판정 (순수 함수). 첫 버튼을 누른 채 150ms 안에 두 번째 버튼이 오면 코드로 본다.

export const CHORD_GRACE_MS = 150;
export const chordDown = (chord, button, buttons, now) => {
  if (button !== 0 && button !== 2) return chord;
  const other = button === 0 ? 2 : 1;
  if (buttons & other) return chord;   // 두 번째 버튼: 첫 버튼 누른 시각은 유지
  return { at: now, button, valid: false };
};
export const chordWithinGrace = (chord, button, buttons, now, graceMs = CHORD_GRACE_MS) => {
  if (!chord || chord.valid !== true || !Number.isFinite(chord.at)) return false;
  if (button === chord.button) return false;   // 같은 버튼 반복은 코드가 아님
  const firstBit = chord.button === 0 ? 1 : chord.button === 2 ? 2 : 0;
  const secondBit = button === 0 ? 1 : button === 2 ? 2 : 0;
  if (!firstBit || !secondBit) return false;
  if (!(buttons & firstBit) || !(buttons & secondBit)) return false;   // 첫 버튼이 아직 눌려 있어야 함
  return now >= chord.at && now - chord.at <= graceMs;
};
export const chordUp = (chord, buttons) => ((buttons & 3) === 0 ? { at: null, button: null, valid: false } : chord);
