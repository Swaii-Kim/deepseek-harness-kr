// 제자리 크기·위치와 말풍선 위치 계산 (순수 함수). 창·입력창 사각형만 받아 계산하고 DOM은 건드리지 않는다.
import type { Rect, Viewport } from "./types.ts";

// 제자리 배치: 컴포저(입력 카드) 오른쪽·아래 여유가 있으면 오른쪽 아래(데스크톱),
// 좁은 화면처럼 옆 여유가 없으면 컴포저 위로 올린다. 위쪽에는 말풍선 자리(BUBBLE_ROOM)를 남겨 두고,
// 자동 크기일 때 컴포저 위 자리는 대화 내역을 덜 가리도록 조금 작게(MOBILE_ABOVE_SCALE) 둔다
export const HOME_GAP = 8, BUBBLE_ROOM = 78, SHOW_K = 0.42, MIN_SHOW_K = 0.18, MOBILE_ABOVE_SCALE = 0.3;
export const homeLayout = ({ vp, r, maxK, W, visW, H, visH, minK, allowAbove = true }: { vp: Viewport; r: Rect | null | undefined; maxK: number; W: number; visW: number; H: number; visH: number; minK: number; allowAbove?: boolean }) => {
  const rightX = (k: number) => vp.left + vp.w - 4 - (W + visW) / 2 * k;
  const bottomY = (k: number) => vp.top + vp.h - H * k;
  const fit = (k: number, above: boolean) => {   // r이 있을 때만 부른다
    const cap = above ? Math.min(maxK, ((r!.top - vp.top) - HOME_GAP) / H) : Math.min(maxK, (vp.w - HOME_GAP) / visW);
    const want = k * (above ? MOBILE_ABOVE_SCALE : 1);   // 컴포저 위(모바일 세로)는 자동 맞춤 크기의 30%로 줄인다
    const kk = Math.max(MIN_SHOW_K, Math.min(cap, want));
    return above
      ? { k: kk, x: rightX(kk), y: r!.top - HOME_GAP - H * kk, above: true }
      : { k: kk, x: rightX(kk), y: bottomY(kk), above: false };
  };
  if (!r) {
    const k = maxK;   // 맞출 자리(카드)가 없으면 자동 크기 상한 그대로
    return { k, x: rightX(k), y: bottomY(k), above: false };
  }
  const sideK = Math.min(maxK, Math.max((vp.w - (r.right - vp.left) - HOME_GAP) / visW, (vp.h - (r.bottom - vp.top) - (allowAbove ? 4 : 10)) / visH));
  // 데스크톱은 업스트림과 같은 계산을 그대로 쓴다 (작은 창에서도 붙을 자리는 dockTarget이 처리)
  if (!allowAbove) return { k: sideK, x: rightX(sideK), y: bottomY(sideK), above: false };
  const aboveRoom = (r.top - vp.top) - HOME_GAP - BUBBLE_ROOM;
  const aboveK = Math.min(maxK, aboveRoom / H, (vp.w - HOME_GAP) / visW);
  if (sideK >= Math.min(minK, maxK)) return fit(sideK, false);
  // 컴포저 위 배치(자동 크기의 30%)는 터치 화면에서만 쓴다
  if (aboveK >= MIN_SHOW_K) return fit(aboveK, true);
  const k = Math.min(maxK, MIN_SHOW_K);
  return { k, x: rightX(k), y: bottomY(k), above: false, noSafe: true };   // 컴포저 위·아래 어디에도 피할 자리가 없음 → 제자리에서는 숨긴다
};
// 말풍선 배치: 머리 위가 기본. 카드와 겹치면 옆/아래로 피하되, 뷰포트 밖으로 나가지 않게 자른다
export const bubbleLayout = ({ vp, headX, headTop, bw, bh, r, above, tail = BUBBLE_TAIL }: { vp: Viewport; headX: number; headTop: number; bw: number; bh: number; r: Rect | null; above: boolean; tail?: number }) => {
  const clampX = (left: number) => Math.min(Math.max(vp.left + HOME_GAP, left), Math.max(vp.left + HOME_GAP, vp.left + vp.w - bw - HOME_GAP));
  const clampY = (top: number) => Math.min(Math.max(vp.top + HOME_GAP, top), Math.max(vp.top + HOME_GAP, vp.top + vp.h - bh - HOME_GAP));
  const hit = (left: number, top: number) => !!r && left < r.right && left + bw > r.left && top < r.bottom && top + bh > r.top;
  const aboveTop = clampY(headTop - bh - 10);
  const aboveLeft = clampX(headX + tail - bw);   // 꼬리(오른쪽 tail px)가 머리 가운데에 오게
  if (!hit(aboveLeft, aboveTop) || above) return { left: aboveLeft, top: aboveTop, side: false };
  const below = r!.bottom + HOME_GAP, sideLeft = clampX(vp.left + vp.w - bw - HOME_GAP);
  if (below + bh <= vp.top + vp.h - HOME_GAP) return { left: sideLeft, top: clampY(below), side: true };
  // 아래로도 자리가 없으면(모바일처럼 컴포저가 화면 끝까지 차지) 머리 위로 유지하고 뷰포트 안으로만 자른다
  return { left: aboveLeft, top: aboveTop, side: false };
};
// 말풍선 꼬리(오른쪽 55px)를 코(noseX)에 맞추는 기준. 화면 오른쪽 경계는 HOME_GAP만 남기고,
// 왼쪽 기준(등장 연출)은 뷰포트 안으로 자른다. 순수 함수라 테스트에서 그대로 실행한다.
export const BUBBLE_TAIL = 55;
// 짧은 말풍선은 꼬리를 말풍선 폭 절반 안쪽으로 좁혀 몸통 밖에 뜨지 않게 한다 (CSS 꼬리 가운데 --dsc-tail-c = 이 값 - 2px)
export const bubbleTail = (bw: number) => Math.min(BUBBLE_TAIL, Math.round((bw || 2 * BUBBLE_TAIL) / 2) + 2);
export const tailRight = ({ noseX, width, margin = HOME_GAP, tail = BUBBLE_TAIL }: { noseX: number; width: number; margin?: number; tail?: number }) => Math.max(margin, width - (noseX + tail));
export const tailLeft = ({ noseX, bw, width, margin = HOME_GAP, tail = BUBBLE_TAIL }: { noseX: number; bw: number; width: number; margin?: number; tail?: number }) => Math.min(
  Math.max(margin, noseX - (bw - tail)),
  Math.max(margin, width - bw - margin),
);
