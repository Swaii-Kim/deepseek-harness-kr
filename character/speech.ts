// 말풍선 글자 → 입 모양 음절 (순수 함수). 한글은 중성으로, 영어는 모음 글자로 입 모양을 고르고, 문장 부호는 쉼으로 둔다.

/** v: 입 모양(A·I·U·E·O, 쉼이면 null), d: 길이(초), amp: 입 벌림 세기, stress: 낱말 첫소리 */
export interface Syllable { v: string | null; d: number; amp?: number; stress?: boolean }

// 한글 중성 21개 → 입 모양 (ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ)
const JUNG = "AEAEOEOEOAEEOUOEIUUII";
/** 영어 모음 글자의 입 모양 (y는 I) */
const latinVowel = (letter: string) => { const lower = letter.toLowerCase(); return lower === "a" ? "A" : lower === "e" ? "E" : lower === "o" ? "O" : lower === "u" ? "U" : "I"; };

/**
 * 낱말 하나의 음절을 syl에 추가. 난수는 글자 순서대로 길이 → 세기 순으로 사용
 * @param random 0~1 난수 함수
 */
function addWord(word: string, syl: Syllable[], random: () => number) {
  let first = true, prevVowel = false;
  for (const letter of word) {
    const code = letter.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      syl.push({ v: JUNG[Math.floor(((code - 0xac00) % 588) / 28)], d: 0.15 + random() * 0.05, amp: 0.65 + random() * 0.35, stress: first });
      first = false;
    } else if (/[aeiouy]/i.test(letter)) {
      if (!prevVowel) { syl.push({ v: latinVowel(letter), d: 0.13 + random() * 0.05, amp: 0.55 + random() * 0.35, stress: first }); first = false; }
      prevVowel = true; continue;
    } else if (/[.,!?…~。，！？]/.test(letter)) syl.push({ v: null, d: letter === "," || letter === "，" ? 0.12 : 0.24 });
    else if (/[0-9]/.test(letter)) { syl.push({ v: "A", d: 0.12, amp: 0.7, stress: first }); first = false; }
    prevVowel = false;
  }
}

/**
 * 글자를 음절로 나누고, 말풍선이 떠 있는 시간의 92% 안에 끝나게 길이 축소
 * @param ms 말풍선이 떠 있는 시간 (ms, 없거나 0이면 3초)
 * @param random 0~1 난수 함수
 * @returns 음절 목록 syl과 전체 길이 total (초)
 */
export function parseSyllables(text: string, ms: number, random: () => number = Math.random): { syl: Syllable[]; total: number } {
  const syl: Syllable[] = [];
  for (const part of String(text).split(/(\s+)/)) {
    if (/^\s+$/.test(part)) { syl.push({ v: null, d: 0.07 }); continue; }
    addWord(part, syl, random);
  }
  let total = syl.reduce((sum, item) => sum + item.d, 0);
  const limit = (ms || 3000) / 1000 * 0.92;
  if (total > limit && total > 0) { const k = limit / total; for (const item of syl) item.d *= k; total = limit; }   // 말풍선 시간 안에 끝나게
  return { syl, total };
}
