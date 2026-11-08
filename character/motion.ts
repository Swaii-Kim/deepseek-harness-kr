// 절차 애니메이션에 쓰는 순수 계산: 잡음·스프링·곡선·몸짓 모양·깜빡임·가슴 가리기 팔 궤적.
// 상태는 인자로 받은 객체만 바꾸고 난수는 쓰지 않는다 (character/index.js의 프레임 갱신이 순서대로 부른다).

import type { Spring } from "./types.ts";

// 몸짓이 더하는 채널별 목표 (고개 yaw·pitch·roll, 몸 bodyX/Y/Z·lean, 표정 smile·eyeSmile·eyeClose·mouth)
export type GestureOut = Record<"yaw" | "pitch" | "roll" | "bodyX" | "bodyY" | "bodyZ" | "lean" | "smile" | "eyeSmile" | "eyeClose" | "mouth", number>;

/** value를 lo~hi 범위로 자름 */
export const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));

// 부드러운 잡음: 정수점마다 무작위 값을 두고 매끄럽게 잇기 (두 겹)
/** 정수점 n의 고정 무작위 값 (0~1) */
const hash = (n: number) => { const scaled = Math.sin(n * 127.1 + 311.7) * 43758.5453; return scaled - Math.floor(scaled); };
/** 정수점 무작위 값을 매끄럽게 이은 한 겹 잡음 (-1~1) */
const valueNoise = (t: number) => { const i = Math.floor(t), fraction = t - i, weight = fraction * fraction * (3 - 2 * fraction); return (hash(i) * (1 - weight) + hash(i + 1) * weight) * 2 - 1; };
/**
 * 두 겹 부드러운 잡음 (대략 -1~1)
 * @param t 시간 (초)
 * @param seed 채널마다 다른 잡음을 고르는 번호
 */
export const noise = (t: number, seed: number) => valueNoise(t + seed * 17.31) * 0.72 + valueNoise(t * 2.3 + seed * 5.17) * 0.28;

// 스프링: 목표를 살짝 넘었다 돌아오며 따라감 (stiffness 클수록 빠름, damping 클수록 덜 출렁임)
/** 정지한 새 스프링 상태 */
export const S = (): Spring => ({ x: 0, v: 0 });
/**
 * 스프링을 목표 쪽으로 dt만큼 진행. 프레임 간격이 길어도 흔들리지 않게 8ms 단위로 잘게 나눠 계산
 * (한 번에 계산하면 30fps 이하에서 눈동자가 매 프레임 튐)
 * @param state 바꿀 스프링 상태
 * @param dt 지난 시간 (초)
 * @param stiffness 당기는 세기 (클수록 빠름)
 * @param damping 감쇠 (클수록 덜 출렁임)
 * @returns 새 위치
 */
export const spring = (state: Spring, target: number, dt: number, stiffness: number, damping: number) => { const n = Math.max(1, Math.ceil(dt / 0.008)), step = dt / n; for (let i = 0; i < n; i++) { state.v += ((target - state.x) * stiffness - state.v * damping) * step; state.x += state.v * step; } return state.x; };

/** 0~1을 양 끝에서 천천히 움직이게 바꾼 곡선 (smootherstep, 범위 밖은 0·1로 자름) */
export const sstep = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * x * (x * (x * 6 - 15) + 10); };
/**
 * 몸짓 곡선. 천천히 들어가서(0~35%) 머물렀다가(~70%) 천천히 돌아옴
 * @param progress 진행도 (0~1)
 * @param riseEnd 들어가기를 마치는 진행도
 * @param fallStart 돌아오기를 시작하는 진행도
 * @returns 세기 (0~1)
 */
export const holdCurve = (progress: number, riseEnd = 0.35, fallStart = 0.7) => (progress < riseEnd ? sstep(progress / riseEnd) : progress > fallStart ? sstep((1 - progress) / (1 - fallStart)) : 1);

/**
 * 진행 중인 몸짓 하나의 출력을 채널별 목표에 더함
 * @param gestureOut 더할 채널별 목표
 * @param progress 진행도 (0~1)
 * @param direction 방향 (±1)
 */
export function addGesture(gestureOut: GestureOut, name: string, progress: number, direction: number) {
  const envelope = Math.sin(Math.PI * progress);
  switch (name) {
    case "nod": gestureOut.pitch -= Math.abs(Math.sin(progress * Math.PI * 4)) * 11 * envelope; gestureOut.bodyY -= Math.abs(Math.sin(progress * Math.PI * 4)) * 3 * envelope; break;   // 끄덕끄덕 (몸도 살짝 따라 숙임)
    case "tilt": gestureOut.roll += 15 * envelope * direction; gestureOut.bodyZ += 6 * envelope * direction; gestureOut.smile += envelope; break;                    // 고개 갸웃
    case "lean": { const hold = holdCurve(progress, 0.3, 0.72); gestureOut.lean -= 12 * hold; gestureOut.pitch += 4 * hold; gestureOut.roll += 8 * hold * direction; gestureOut.bodyX += 4 * hold * direction; gestureOut.smile += 0.7 * hold; break; }   // 다가와 들여다보기: 몸은 앞으로, 턱은 살짝 들어 화면을 봄
    case "sway": gestureOut.bodyZ += Math.sin(progress * Math.PI * 6) * 9 * envelope; gestureOut.roll += Math.sin(progress * Math.PI * 6) * 6 * envelope; gestureOut.bodyX += Math.sin(progress * Math.PI * 6) * 5 * envelope; gestureOut.smile += envelope; break;   // 흔들흔들 (몸도 좌우로 → 가슴·머리카락 좌우 출렁임)
    case "bounce": gestureOut.bodyY += Math.abs(Math.sin(progress * Math.PI * 4)) * 8 * envelope; gestureOut.bodyZ += Math.sin(progress * Math.PI * 4) * 6 * envelope; gestureOut.smile += envelope; break;   // 신나서 통통
    case "droop": gestureOut.pitch -= 14 * envelope; gestureOut.bodyY -= 6 * envelope; break;
    case "flinch": { const impact = progress < 0.15 ? progress / 0.15 : 1 - (progress - 0.15) / 0.85; gestureOut.pitch -= 7 * impact; gestureOut.bodyY -= 3 * impact; break; }   // 움찔
    case "bonk": { const impact = progress < 0.08 ? progress / 0.08 : Math.pow(1 - (progress - 0.08) / 0.92, 2); gestureOut.pitch -= 22 * impact; gestureOut.bodyY -= 9 * impact; gestureOut.roll += 7 * impact * direction; gestureOut.eyeClose += 0.6 * impact; break; }   // 냄비에 맞음: 순간 푹 숙였다가 천천히 고개를 듦
    case "laugh":                                                                                      // ^^ 눈웃음 + 어깨 들썩
      gestureOut.eyeSmile += envelope; gestureOut.eyeClose += envelope * 0.85; gestureOut.smile += envelope;
      { const bodyHold = holdCurve(progress, 0.25, 0.65), headHold = holdCurve(Math.max(0, progress - 0.08) / 0.92, 0.3, 0.6);   // 몸이 먼저, 고개가 조금 늦게
        gestureOut.lean -= 10 * bodyHold; gestureOut.pitch -= 9 * headHold - (progress > 0.7 ? 3 * Math.sin(Math.PI * (progress - 0.7) / 0.3) : 0); gestureOut.roll += 7 * bodyHold * direction; }
      gestureOut.bodyY += Math.abs(Math.sin(progress * Math.PI * 7)) * 7 * envelope; gestureOut.mouth += 0.45 * envelope;   // 어깨 들썩 (가슴도 같이 출렁)
      break;
  }
}

/**
 * 깜빡임 중 눈이 감긴 정도. 0.07초에 감고 0.1초까지 유지, 0.22초에 다 뜸
 * @param elapsed 깜빡임 시작 뒤 지난 시간 (초)
 * @returns 감긴 정도 (0 뜸 ~ 1 감음)
 */
export const blinkClose = (elapsed: number) => (elapsed < 0.07 ? elapsed / 0.07 : elapsed < 0.1 ? 1 : elapsed < 0.22 ? 1 - (elapsed - 0.1) / 0.12 : 0);

/** 구간 start~end 안에서 x의 진행도 (0~1) */
export const seg = (start: number, end: number, x: number) => clamp((x - start) / (end - start), 0, 1);
/**
 * 왼손 가슴 가리기의 아래팔 값. 몸 앞 팔 그림은 아래팔 0.15~0.7 구간에서 손이 몸 바깥으로 크게 돌아 나가게 그려져 있어,
 * 그 구간은 짧게(전체의 20%) 지나가고 가슴 근처(0.7 이후)에서 천천히 다가가 살짝 넘쳤다 자리 잡게 함
 * @param raise 올린 정도 (0~1). 0~25% 살짝 들기(→0.15), 25~45% 바깥 구간 빠르게(→0.7), 45~80% 가슴으로(→0.89), 80~100% 자리 잡기(→0.86)
 */
export const coverForearm = (raise: number) => (raise < 0.25 ? 0.15 * sstep(raise / 0.25) : raise < 0.45 ? 0.15 + 0.55 * seg(0.25, 0.45, raise) : raise < 0.8 ? 0.7 + 0.19 * sstep(seg(0.45, 0.8, raise)) : 0.89 - 0.03 * sstep(seg(0.8, 1, raise)));
