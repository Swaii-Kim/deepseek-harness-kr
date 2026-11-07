// 절차 애니메이션에 쓰는 순수 계산: 잡음·스프링·곡선·몸짓 모양·깜빡임·가슴 가리기 팔 궤적.
// 상태는 인자로 받은 객체만 바꾸고 난수는 쓰지 않는다 (character/index.js의 프레임 갱신이 순서대로 부른다).

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 부드러운 잡음: 정수점마다 무작위 값을 두고 매끄럽게 잇기 (두 겹)
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (t) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return (hash(i) * (1 - u) + hash(i + 1) * u) * 2 - 1; };
export const noise = (t, seed) => vnoise(t + seed * 17.31) * 0.72 + vnoise(t * 2.3 + seed * 5.17) * 0.28;

// 스프링: 목표를 살짝 넘었다 돌아오며 따라감 (k 클수록 빠름, d 클수록 덜 출렁임)
export const S = () => ({ x: 0, v: 0 });
// 프레임 간격이 길어도 흔들리지 않게 8ms 단위로 잘게 나눠 계산 (한 번에 계산하면 30fps 이하에서 눈동자가 매 프레임 튐)
export const spring = (s, target, dt, k, d) => { const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n; for (let i = 0; i < n; i++) { s.v += ((target - s.x) * k - s.v * d) * h; s.x += s.v * h; } return s.x; };

// 몸짓 곡선: 천천히 들어가서(0~35%) 머물렀다가(~70%) 천천히 돌아옴
export const sstep = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * x * (x * (x * 6 - 15) + 10); };
export const holdCurve = (p, a = 0.35, b = 0.7) => (p < a ? sstep(p / a) : p > b ? sstep((1 - p) / (1 - b)) : 1);

// 진행 중인 몸짓 하나의 출력을 GO(채널별 목표)에 더한다. p: 진행도 0~1, d: 방향 ±1
export function addGesture(GO, name, p, d) {
  const env = Math.sin(Math.PI * p);
  switch (name) {
    case "nod": GO.pitch -= Math.abs(Math.sin(p * Math.PI * 4)) * 11 * env; GO.bodyY -= Math.abs(Math.sin(p * Math.PI * 4)) * 3 * env; break;   // 끄덕끄덕 (몸도 살짝 따라 숙임)
    case "tilt": GO.roll += 15 * env * d; GO.bodyZ += 6 * env * d; GO.smile += env; break;                    // 고개 갸웃
    case "lean": { const h = holdCurve(p, 0.3, 0.72); GO.lean -= 12 * h; GO.pitch += 4 * h; GO.roll += 8 * h * d; GO.bodyX += 4 * h * d; GO.smile += 0.7 * h; break; }   // 다가와 들여다보기: 몸은 앞으로, 턱은 살짝 들어 화면을 봄
    case "sway": GO.bodyZ += Math.sin(p * Math.PI * 6) * 9 * env; GO.roll += Math.sin(p * Math.PI * 6) * 6 * env; GO.bodyX += Math.sin(p * Math.PI * 6) * 5 * env; GO.smile += env; break;   // 흔들흔들 (몸도 좌우로 → 가슴·머리카락 좌우 출렁임)
    case "bounce": GO.bodyY += Math.abs(Math.sin(p * Math.PI * 4)) * 8 * env; GO.bodyZ += Math.sin(p * Math.PI * 4) * 6 * env; GO.smile += env; break;   // 신나서 통통
    case "droop": GO.pitch -= 14 * env; GO.bodyY -= 6 * env; break;
    case "flinch": { const k = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85; GO.pitch -= 7 * k; GO.bodyY -= 3 * k; break; }   // 움찔
    case "bonk": { const k = p < 0.08 ? p / 0.08 : Math.pow(1 - (p - 0.08) / 0.92, 2); GO.pitch -= 22 * k; GO.bodyY -= 9 * k; GO.roll += 7 * k * d; GO.eyeClose += 0.6 * k; break; }   // 냄비에 맞음: 순간 푹 숙였다가 천천히 고개를 듦
    case "laugh":                                                                                      // ^^ 눈웃음 + 어깨 들썩
      GO.eyeSmile += env; GO.eyeClose += env * 0.85; GO.smile += env;
      { const hb = holdCurve(p, 0.25, 0.65), hh = holdCurve(Math.max(0, p - 0.08) / 0.92, 0.3, 0.6);   // 몸이 먼저, 고개가 조금 늦게
        GO.lean -= 10 * hb; GO.pitch -= 9 * hh - (p > 0.7 ? 3 * Math.sin(Math.PI * (p - 0.7) / 0.3) : 0); GO.roll += 7 * hb * d; }
      GO.bodyY += Math.abs(Math.sin(p * Math.PI * 7)) * 7 * env; GO.mouth += 0.45 * env;   // 어깨 들썩 (가슴도 같이 출렁)
      break;
  }
}

// 깜빡임: 시작 뒤 bt초에 눈이 감긴 정도 (0.07초에 감고 0.1초까지 유지, 0.22초에 다 뜸)
export const blinkClose = (bt) => (bt < 0.07 ? bt / 0.07 : bt < 0.1 ? 1 : bt < 0.22 ? 1 - (bt - 0.1) / 0.12 : 0);

// 구간 a~b 안에서의 진행도 (0~1)
export const seg = (a, b, x) => clamp((x - a) / (b - a), 0, 1);
// 왼손 가슴 가리기의 아래팔 값. 몸 앞 팔 그림은 아래팔 0.15~0.7 구간에서 손이 몸 바깥으로 크게 돌아 나가게 그려져 있어,
// 그 구간은 짧게(전체의 20%) 지나가고 가슴 근처(0.7 이후)에서 천천히 다가가 살짝 넘쳤다 자리 잡게 한다.
// q: 올린 정도 0~1. 0~25% 살짝 들기(→0.15), 25~45% 바깥 구간 빠르게(→0.7), 45~80% 가슴으로(→0.89), 80~100% 자리 잡기(→0.86)
export const coverForearm = (q) => (q < 0.25 ? 0.15 * sstep(q / 0.25) : q < 0.45 ? 0.15 + 0.55 * seg(0.25, 0.45, q) : q < 0.8 ? 0.7 + 0.19 * sstep(seg(0.45, 0.8, q)) : 0.89 - 0.03 * sstep(seg(0.8, 1, q)));
