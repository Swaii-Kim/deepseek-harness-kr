// 제자리 크기·위치와 말풍선 위치 계산 (순수 함수). 창·입력창 사각형만 받아 계산하고 DOM은 건드리지 않는다.
import type { Rect, Viewport } from "./types.ts";

export const HOME_GAP = 8, BUBBLE_ROOM = 78, SHOW_K = 0.42, MIN_SHOW_K = 0.18, MOBILE_ABOVE_SCALE = 0.3;
/**
 * 제자리 배치. 컴포저(입력 카드) 오른쪽·아래 여유가 있으면 오른쪽 아래(데스크톱),
 * 좁은 화면처럼 옆 여유가 없으면 컴포저 위로 올림. 위쪽에는 말풍선 자리(BUBBLE_ROOM)를 남겨 두고,
 * 자동 크기일 때 컴포저 위 자리는 대화 내역을 덜 가리도록 조금 작게(MOBILE_ABOVE_SCALE) 둠
 * @param r 컴포저 카드 사각형(뷰포트 기준 CSS px, 없으면 자동 크기 상한 그대로)
 * @param maxK 자동 크기 상한 배율
 * @param W 캔버스 폭(배율 1)
 * @param visW 보이는 몸 폭(배율 1)
 * @param H 캔버스 높이(배율 1)
 * @param visH 보이는 몸 높이(배율 1)
 * @param minK 옆 자리를 쓰는 최소 배율
 * @param allowAbove true면 컴포저 위 배치 허용(터치 화면), false면 데스크톱 계산 그대로
 * @returns 배율 k와 캔버스 왼쪽 위(x, y), 컴포저 위 여부 above, 피할 자리가 없으면 noSafe
 */
export const homeLayout = ({ vp, r, maxK, W, visW, H, visH, minK, allowAbove = true }: { vp: Viewport; r: Rect | null | undefined; maxK: number; W: number; visW: number; H: number; visH: number; minK: number; allowAbove?: boolean }) => {
  /** 배율 k일 때 몸을 오른쪽 끝에 붙이는 캔버스 x */
  const rightX = (k: number) => vp.left + vp.w - 4 - (W + visW) / 2 * k;
  /** 배율 k일 때 캔버스를 화면 아래 끝에 붙이는 y */
  const bottomY = (k: number) => vp.top + vp.h - H * k;
  /**
   * 자리 크기로 자른 배율과 위치. r이 있을 때만 호출
   * @param above true면 컴포저 위, false면 오른쪽 아래
   */
  const fit = (k: number, above: boolean) => {
    const cap = above ? Math.min(maxK, ((r!.top - vp.top) - HOME_GAP) / H) : Math.min(maxK, (vp.w - HOME_GAP) / visW);
    const want = k * (above ? MOBILE_ABOVE_SCALE : 1);   // 컴포저 위(모바일 세로)는 자동 맞춤 크기의 30%로 줄인다
    const scale = Math.max(MIN_SHOW_K, Math.min(cap, want));
    return above
      ? { k: scale, x: rightX(scale), y: r!.top - HOME_GAP - H * scale, above: true }
      : { k: scale, x: rightX(scale), y: bottomY(scale), above: false };
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
/**
 * 말풍선 배치. 머리 위가 기본이고, 카드와 겹치면 옆/아래로 피하되 뷰포트 밖으로 나가지 않게 자름
 * @param headX 머리(코) 가운데 x (CSS px)
 * @param headTop 머리 위 끝 y (CSS px)
 * @param bw 말풍선 폭 (CSS px)
 * @param bh 말풍선 높이 (CSS px)
 * @param r 피할 컴포저 카드 사각형 (없으면 null)
 * @param above true면 캐릭터가 컴포저 위에 있어 늘 머리 위로 둠
 * @param tail 말풍선 오른쪽 끝에서 꼬리까지 거리 (px)
 * @returns 말풍선 왼쪽 위(left, top)와 옆으로 피했는지 side
 */
export const bubbleLayout = ({ vp, headX, headTop, bw, bh, r, above, tail = BUBBLE_TAIL }: { vp: Viewport; headX: number; headTop: number; bw: number; bh: number; r: Rect | null; above: boolean; tail?: number }) => {
  /** 말풍선 왼쪽 끝을 뷰포트 여백 안으로 자름 */
  const clampX = (left: number) => Math.min(Math.max(vp.left + HOME_GAP, left), Math.max(vp.left + HOME_GAP, vp.left + vp.w - bw - HOME_GAP));
  /** 말풍선 위 끝을 뷰포트 여백 안으로 자름 */
  const clampY = (top: number) => Math.min(Math.max(vp.top + HOME_GAP, top), Math.max(vp.top + HOME_GAP, vp.top + vp.h - bh - HOME_GAP));
  /** 그 자리 말풍선의 카드 겹침 여부 */
  const hit = (left: number, top: number) => !!r && left < r.right && left + bw > r.left && top < r.bottom && top + bh > r.top;
  const aboveTop = clampY(headTop - bh - 10);
  const aboveLeft = clampX(headX + tail - bw);   // 꼬리(오른쪽 tail px)가 머리 가운데에 오게
  if (!hit(aboveLeft, aboveTop) || above) return { left: aboveLeft, top: aboveTop, side: false };
  const below = r!.bottom + HOME_GAP, sideLeft = clampX(vp.left + vp.w - bw - HOME_GAP);
  if (below + bh <= vp.top + vp.h - HOME_GAP) return { left: sideLeft, top: clampY(below), side: true };
  // 아래로도 자리가 없으면(모바일처럼 컴포저가 화면 끝까지 차지) 머리 위로 유지하고 뷰포트 안으로만 자른다
  return { left: aboveLeft, top: aboveTop, side: false };
};
// 말풍선 꼬리(오른쪽 55px)를 코(noseX)에 맞추는 기준. 아래 tailRight·tailLeft는 순수 함수라 테스트에서 그대로 실행한다.
export const BUBBLE_TAIL = 55;
/**
 * 말풍선 폭에 맞춘 꼬리 위치. 짧은 말풍선은 꼬리를 폭 절반 안쪽으로 좁혀 몸통 밖에 뜨지 않게 함
 * (CSS 꼬리 가운데 --dsc-tail-c = 이 값 - 2px)
 * @param bubbleWidth 말풍선 폭 (CSS px, 0이면 기본 꼬리)
 * @returns 말풍선 오른쪽 끝에서 꼬리까지 거리 (px)
 */
export const bubbleTail = (bubbleWidth: number) => Math.min(BUBBLE_TAIL, Math.round((bubbleWidth || 2 * BUBBLE_TAIL) / 2) + 2);
/**
 * 꼬리를 코에 맞춘 말풍선의 CSS right. 화면 오른쪽 경계는 margin만 남김
 * @param noseX 코 x (기준 영역 왼쪽부터 px)
 * @param width 기준 영역 폭 (px)
 */
export const tailRight = ({ noseX, width, margin = HOME_GAP, tail = BUBBLE_TAIL }: { noseX: number; width: number; margin?: number; tail?: number }) => Math.max(margin, width - (noseX + tail));
/**
 * 꼬리를 코에 맞춘 말풍선의 CSS left (등장 연출용 왼쪽 기준). 기준 영역 안으로 자름
 * @param noseX 코 x (기준 영역 왼쪽부터 px)
 * @param bw 말풍선 폭 (px)
 * @param width 기준 영역 폭 (px)
 */
export const tailLeft = ({ noseX, bw, width, margin = HOME_GAP, tail = BUBBLE_TAIL }: { noseX: number; bw: number; width: number; margin?: number; tail?: number }) => Math.min(
  Math.max(margin, noseX - (bw - tail)),
  Math.max(margin, width - bw - margin),
);
/** 시작 연출 가운데의 큰 말풍선 크기 (px) */
export const INTRO_BUBBLE = { font: 22, padY: 14, padX: 24, maxWidth: 560 };
/** 평소 말풍선 크기 (px, assets/character.css #dsc-bubble과 같은 값) */
export const REST_BUBBLE = { font: 13, padY: 9, padX: 14 };
/**
 * 시작 연출 말풍선 크기. 제자리로 옮겨 가는 동안 캐릭터 배율과 같은 진행도로 평소 크기에 다가감
 * @param progress 제자리로 옮겨 간 진행도 (0 = 가운데, 1 = 제자리)
 * @param restMaxWidth 지금 배율의 평소 말풍선 최대폭 (px)
 * @returns 글자 크기·위아래/좌우 여백·최대폭 (px)
 */
export const introBubbleSize = (progress: number, restMaxWidth: number) => {
  const p = Math.min(1, Math.max(0, progress));
  /** 큰 말풍선 값에서 평소 값으로 p만큼 옮긴 값 */
  const mix = (from: number, to: number) => from + (to - from) * p;
  return {
    font: mix(INTRO_BUBBLE.font, REST_BUBBLE.font),
    padY: mix(INTRO_BUBBLE.padY, REST_BUBBLE.padY),
    padX: mix(INTRO_BUBBLE.padX, REST_BUBBLE.padX),
    maxWidth: mix(INTRO_BUBBLE.maxWidth, restMaxWidth),
  };
};
