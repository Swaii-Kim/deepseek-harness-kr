// 말풍선 글자 → 입 모양 음절 (순수 함수). 한글은 중성으로, 영어는 모음 글자로 입 모양을 고르고, 문장 부호는 쉼으로 둔다.

/** v: 입 모양(A·I·U·E·O, 쉼이면 null), d: 길이(초), amp: 입 벌림 세기, stress: 낱말 첫소리 */
export interface Syllable { v: string | null; d: number; amp?: number; stress?: boolean }

// 한글 중성 21개 → 입 모양 (ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ)
const JUNG = "AEAEOEOEOAEEOUOEIUUII";
const latinVowel = (ch: string) => { const l = ch.toLowerCase(); return l === "a" ? "A" : l === "e" ? "E" : l === "o" ? "O" : l === "u" ? "U" : "I"; };

// 낱말 하나의 음절을 syl에 더한다. 난수는 글자 순서대로 길이 → 세기 순으로 쓴다
function addWord(w: string, syl: Syllable[], random: () => number) {
  let first = true, prevVowel = false;
  for (const ch of w) {
    const c = ch.charCodeAt(0);
    if (c >= 0xac00 && c <= 0xd7a3) {
      syl.push({ v: JUNG[Math.floor(((c - 0xac00) % 588) / 28)], d: 0.15 + random() * 0.05, amp: 0.65 + random() * 0.35, stress: first });
      first = false;
    } else if (/[aeiouy]/i.test(ch)) {
      if (!prevVowel) { syl.push({ v: latinVowel(ch), d: 0.13 + random() * 0.05, amp: 0.55 + random() * 0.35, stress: first }); first = false; }
      prevVowel = true; continue;
    } else if (/[.,!?…~。，！？]/.test(ch)) syl.push({ v: null, d: ch === "," || ch === "，" ? 0.12 : 0.24 });
    else if (/[0-9]/.test(ch)) { syl.push({ v: "A", d: 0.12, amp: 0.7, stress: first }); first = false; }
    prevVowel = false;
  }
}

/** 글자를 음절로 나누고, 말풍선이 떠 있는 시간(ms, 없으면 3초)의 92% 안에 끝나게 길이를 줄인다 */
export function parseSyllables(text: string, ms: number, random: () => number = Math.random): { syl: Syllable[]; total: number } {
  const syl: Syllable[] = [];
  for (const w of String(text).split(/(\s+)/)) {
    if (/^\s+$/.test(w)) { syl.push({ v: null, d: 0.07 }); continue; }
    addWord(w, syl, random);
  }
  let total = syl.reduce((s, x) => s + x.d, 0);
  const limit = (ms || 3000) / 1000 * 0.92;
  if (total > limit && total > 0) { const k = limit / total; for (const x of syl) x.d *= k; total = limit; }   // 말풍선 시간 안에 끝나게
  return { syl, total };
}
