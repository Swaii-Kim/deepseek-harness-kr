// 바깥 펫 창 산책 경로 계산 (순수 함수). 화면(DIP) 좌표만 받아 출발 방향·경계까지의 거리·fade 구간·복귀 시작점을 정하고 DOM은 건드리지 않는다.
// 거리 부족 판단은 걷는 실제 몸 폭(꼬마 bbox)과 걷는 속도로만 한다. 창 위치 clamp와 무관하게
// 선택 경계까지 계속 걷고, 마지막 fade 구간에서만 투명해진다. 상태(산책 단계·타이머·표시장치 응답)는 character/index.ts가 들고 있다.

/** 화면 사각 영역 (DIP, 왼쪽·위·오른쪽·아래 경계). 펫 창 메시지·clip 계산 형식이라 필드 이름 고정 */
export type WalkArea = { l: number; t: number; r: number; b: number };
/** pet/main.cjs가 보낸 표시장치 정보 중 산책이 쓰는 부분 (Electron Display, DIP) */
export type WalkDisplay = { id?: string | number; scaleFactor?: number; request?: number; workArea?: { x: number; y: number; width: number; height: number } | null };
/** 캔버스 안 좌표 기준 workArea 밖을 잘라 낼 양 (px, CSS inset 순서) */
export type WalkClipInset = { left: number; top: number; right: number; bottom: number; any: boolean };
/** 출발 계획 (planWalkOut 결과) */
export type WalkPlan = ReturnType<typeof planWalkOut>;

/** 네 경계가 유한하고 넓이가 있는 영역인지 여부 */
export const walkAreaValid = (area: WalkArea | null | undefined): area is WalkArea =>
  !!area && [area.l, area.t, area.r, area.b].every((value) => Number.isFinite(value)) && area.r > area.l && area.b > area.t;

/** 두 영역의 네 경계가 모두 같은지 여부 (둘 중 하나라도 없으면 false) */
export const sameWalkArea = (first: WalkArea | null | undefined, second: WalkArea | null | undefined) =>
  !!first && !!second && first.l === second.l && first.t === second.t && first.r === second.r && first.b === second.b;

/**
 * pet/main.cjs가 준 Display.workArea(DIP) → { l, t, r, b }
 * @returns 유효한 영역, 값이 빠졌거나 넓이가 없으면 null
 */
export const walkDisplayArea = (display: WalkDisplay | null | undefined): WalkArea | null => {
  const workArea = display && display.workArea;
  if (!workArea || ![workArea.x, workArea.y, workArea.width, workArea.height].every((value) => Number.isFinite(value))) return null;
  const area = { l: workArea.x, t: workArea.y, r: workArea.x + workArea.width, b: workArea.y + workArea.height };
  return walkAreaValid(area) ? area : null;
};

/**
 * 캔버스 왼쪽 x·배율 k일 때 걷는 몸의 가로 범위 (몸은 캔버스 가운데)
 * @param canvasW 캔버스 폭(배율 1)
 * @param bodyW 걷는 몸 폭(배율 적용 뒤 px, 캔버스 폭을 넘지 않게 자름)
 * @returns 몸 왼쪽 l·오른쪽 r·폭 width·캔버스 가장자리에서 몸까지 side
 */
export const walkBodySpan = ({ x, k, canvasW, bodyW }: { x: number; k: number; canvasW: number; bodyW: number }) => {
  const width = Math.max(1, Math.min(bodyW, canvasW * k)), side = (canvasW * k - width) / 2;
  return { l: x + side, r: x + side + width, width, side };
};

/**
 * 산책 출발 계획: 기본은 왼쪽, 왼쪽 여유가 부족할 때만 오른쪽(더 넓을 때). 경계 직전 마지막 구간에서만 fade
 * @param speed 걷는 속도(px/초). 최소 이동량(1.5초 분량) 계산에 씀
 * @returns 방향 dir·경계까지 run·fade 구간·overshoot·전체 이동량 travel 등
 */
export const planWalkOut = ({ area, x, k, canvasW, bodyW, speed = 320 }: { area: WalkArea; x: number; k: number; canvasW: number; bodyW: number; speed?: number }) => {
  const span = walkBodySpan({ x, k, canvasW, bodyW });
  const left = Math.max(0, span.l - area.l), right = Math.max(0, area.r - span.r);   // 경계까지 남은 몸 가장자리 여유
  const near = left <= right ? -1 : 1;
  // 최소 1.5초(WALK_SPEED 320px/s = 480px) 또는 몸 폭 1.2배. 둘 다 짧으면 더 넓은 쪽.
  const minRun = Math.max(speed * 1.5, span.width * 1.2, 240);
  const dir = left >= minRun || right <= left ? -1 : 1;
  const run = dir < 0 ? left : right;
  // fade는 경계 직전 마지막 구간에서만: 몸 폭 비례 56~180px, 그래도 이동량의 75%를 넘지 않게 해
  // 출발하자마자 흐려지지 않는다. 경계에 닿는 순간 alpha 0.
  const fadeWanted = Math.max(56, Math.min(180, span.width * 0.8));
  const fade = Math.max(1, Math.min(fadeWanted, run * 0.75));
  const overshoot = Math.max(6, Math.min(24, span.width * 0.08));   // alpha 0 뒤에도 조금 더 걸어 완전히 사라진 느낌
  return { dir, near, left, right, minRun, run, fade, overshoot, travel: run + overshoot, body: span.width, bodyL: span.l, bodyR: span.r };
};

/**
 * 표시장치가 바뀐 뒤 보이는 몸을 새 workArea 안에 두는 자리 (영역이 몸보다 작으면 왼쪽·위 기준)
 * @param canvasH 캔버스 높이(배율 1)
 */
export const walkSafePose = ({ area, x, y, k, canvasW, canvasH, bodyW }: { area: WalkArea; x: number; y: number; k: number; canvasW: number; canvasH: number; bodyW: number }) => {
  const span = walkBodySpan({ x, k, canvasW, bodyW });
  const minX = area.l - span.side, maxX = area.r - span.side - span.width;
  const minY = area.t - canvasH * k * 0.05, maxY = area.b - canvasH * k;
  return { k, x: Math.min(Math.max(x, minX), Math.max(minX, maxX)), y: Math.min(Math.max(y, minY), Math.max(minY, maxY)) };
};

/**
 * 복귀 계획: 출발의 반대 경계 밖에서 조금만 들어와 시작 (fade-in)
 * @param dir 출발 방향 (-1 왼쪽 · 1 오른쪽). 오른쪽으로 나갔으면 왼쪽 경계에서, 왼쪽이면 오른쪽 경계에서 돌아옴
 * @returns 시작 fleeX from·시작 캔버스 x startX·경계 안쪽 진입 거리 entry·fade 구간
 */
export const planWalkReturn = ({ area, dir, x, k, canvasW, bodyW }: { area: WalkArea; dir: number; x: number; k: number; canvasW: number; bodyW: number }) => {
  const span = walkBodySpan({ x, k, canvasW, bodyW });
  const entry = Math.max(8, Math.min(64, span.width * 0.3));
  const startX = dir > 0 ? area.l - entry - span.side : area.r + entry - canvasW * k + span.side;
  const from = startX - x;
  const fadeWanted = Math.max(56, Math.min(180, span.width * 0.8));
  return { from, startX, entry, fade: Math.max(1, Math.min(fadeWanted, Math.abs(from) * 0.6)) };
};

/**
 * 나가는 동안의 불투명도: 경계까지 남은 거리 기준 (fade 구간 전까지 1, 경계에서 0)
 * @param traveled 출발점에서 걸은 거리(px)
 * @param run 경계까지 거리(px)
 * @param fade 흐려지는 구간 길이(px)
 */
export const walkOutAlpha = (traveled: number, run: number, fade: number) => {
  const progress = Math.max(0, Math.min(1, (run - traveled) / Math.max(1, fade)));
  return progress * progress * (3 - 2 * progress);
};

/**
 * 돌아오는 동안의 불투명도: 복귀 시작(경계)에서 0, fade 구간을 지나면 1
 * @param traveled 복귀 시작점에서 걸은 거리(px)
 * @param fade 나타나는 구간 길이(px)
 */
export const walkInAlpha = (traveled: number, fade: number) => {
  const progress = Math.max(0, Math.min(1, traveled / Math.max(1, fade)));
  return progress * progress * (3 - 2 * progress);
};

/**
 * 캔버스 안 좌표 기준 workArea 밖 hard clip 양. 실제 native window origin을 써도 setBounds 반영 오차가 남을 수 있으므로 pad만큼 더 안쪽을 자름(보수적)
 * @param screenX 캔버스 왼쪽 (화면 DIP)
 * @param screenY 캔버스 위 (화면 DIP)
 * @param pad 경계에서 더 잘라 낼 여유(px)
 * @param out 결과를 채울 객체 (매 프레임 부를 때 같은 객체를 넘겨 새로 만들지 않음)
 */
export const walkClipInset = ({ area, screenX, screenY, width, height, pad = 12 }: { area: WalkArea; screenX: number; screenY: number; width: number; height: number; pad?: number },
  out: WalkClipInset = { left: 0, top: 0, right: 0, bottom: 0, any: false }) => {
  out.left = area.l > screenX - pad ? Math.max(0, Math.ceil(area.l - screenX) + pad) : 0;
  out.top = area.t > screenY - pad ? Math.max(0, Math.ceil(area.t - screenY) + pad) : 0;
  out.right = area.r < screenX + width + pad ? Math.max(0, Math.ceil(screenX + width - area.r) + pad) : 0;
  out.bottom = area.b < screenY + height + pad ? Math.max(0, Math.ceil(screenY + height - area.b) + pad) : 0;
  out.any = out.left > 0 || out.top > 0 || out.right > 0 || out.bottom > 0;
  return out;
};

/**
 * 바깥 펫이 경계로 나갈 때의 진행 곡선: 출발만 살짝 부드럽게, 끝에서 감속하지 않음 (경계 직전에 멈춘 듯 보이지 않게)
 * @param progress 시간 진행도(0~1)
 * @returns 거리 진행도(0~1)
 */
export const walkEasePetOut = (progress: number) => { const ramp = 0.1; return progress < ramp ? progress * progress / (ramp * (2 - ramp)) : (2 * progress - ramp) / (2 - ramp); };
