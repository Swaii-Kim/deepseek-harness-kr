// 바깥 펫 창과의 연결 (창 안 캐릭터 쪽). 플러그인 호스트가 /deepseek-harness-kr/pet/ 아래에서 펫 프로세스를 띄우고 메시지를 이어 준다.
// 연결 상태·송수신·알림 처리·동기화 주기·미리 띄우기·토글 규칙은 이 파일이 맡고,
// 화면 좌표·표정 같은 캐릭터 동작은 deps 콜백으로 받는다 (character/index.js).
//
// 상태 (link.*)
//   open: 펫 창이 대신 보여 주는 중, opening: 열기를 요청한 시각(0이면 아님),
//   follow: 끄는 도중 창 밖으로 나가 펫 창이 커서를 따라오는 중 ({ shown }), boot: 화면을 처음 불러온 뒤 첫 조회 전,
//   petState: 호스트가 알려 준 펫 프로세스 상태 (none | starting | hidden | shown),
//   seq: 펫 창을 열 때마다 올리는 회차 번호. 펫 창 알림에 같은 번호가 붙어 와서, 이전 회차에서 늦게 온 알림을 가려냄
//   queue: 펫 창으로 보낼 반응 묶음 ([이름, 인자] 목록, 150ms마다 보냄)
//
// deps
//   url: 펫 경로 주소(없으면 연결하지 않음), fetch, setTimeout, setInterval, requestAnimationFrame, now
//   onUse(): 펫 창을 쓴 적이 있다고 표시 (플러그인이 내려갈 때 펫 창도 숨김)
//   onEnter(): 펫 창이 보이기 시작함 → 창 안 캐릭터는 숨기고 그리기를 멈춤
//   onLeave(): 펫 창이 붙었거나 닫힘 → 창 안 제자리로 되돌리고 다시 그림
//   onConfig(key, value): 펫 창 메뉴·설정 패널에서 바꾼 값
//   snapshot(): 지금 표정·자세를 펫 창에 맞출 메시지 목록, dragMessages(): 이동 키 메시지 목록
//   dockState(): { dock, outfit } 붙을 자리와 소품·옷, dragKey(): 이동 키, voice(): 외부 음성 상태
//   idle(): 미리 띄워도 되는 한가한 때인지, hidden(): 캔버스를 숨긴 상태인지, openPose(): 지금 자리(화면 좌표 { k, x, y })
/** 펫 창으로 보내는 메시지: [이름, 인자 목록] */
export type PetMessage = [string, unknown[]];
export interface PetLinkDeps {
  url: string | null;
  fetch: (url: string, init?: RequestInit) => Promise<{ ok: boolean; json(): Promise<any> }>;
  setTimeout: (fn: () => void, ms?: number) => unknown;
  setInterval: (fn: () => void, ms?: number) => unknown;
  requestAnimationFrame: (fn: () => void) => unknown;
  now?: () => number;
  onUse(): void;
  onEnter(): void;
  onLeave(): void;
  onConfig(key: string, value: unknown): void;
  snapshot(): PetMessage[];
  dragMessages(): PetMessage[];
  dockState(): { dock: unknown; outfit: unknown };
  dragKey(): string;
  voice(): unknown;
  idle(): boolean;
  hidden(): boolean;
  openPose(): { k: number; x: number; y: number };
}
export interface PetLink {
  open: boolean; opening: number; supported: boolean; queue: PetMessage[]; last: string; polling: boolean;
  voiceSent: unknown; follow: { shown: boolean } | null; boot: boolean; petState: string; peek: number; seq: number; dragMod?: string;
  relay(fn: string, args: unknown[]): void;
  post(path: string, body?: unknown): Promise<any>;
  enter(): void;
  leave(): void;
  poll(): void;
  tick(): void;
  start(): void;
  toggle(): void;
}
/** 펫 창 알림 하나 */
interface PetEvent { type: string; seq?: number; list?: unknown }

export function createPetLink(deps: PetLinkDeps): PetLink {
  const { url, fetch, setTimeout, setInterval, requestAnimationFrame, now = () => performance.now() } = deps;
  // 메서드는 아래에서 채운다
  const link = { open: false, opening: 0, supported: false, queue: [], last: "", polling: false, voiceSent: null, follow: null, boot: true, petState: "none", peek: 0, seq: 0 } as unknown as PetLink;

  // 펫 창이 보이는 동안(따라오는 중 포함)만 반응을 모아 보냄
  link.relay = (fn, args) => { if (link.open || link.follow?.shown) link.queue.push([fn, args]); };

  link.post = (path, body = {}) => {
    deps.onUse();
    return fetch(url! + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      .then((r) => (r.ok ? r.json() : null)).then((s) => { if (s?.state) link.petState = s.state; return s; }).catch(() => null);
  };

  link.enter = () => {   // 펫 창이 보이기 시작함
    const already = !!link.follow?.shown;
    link.open = true; link.opening = 0; link.last = ""; deps.onUse();
    deps.onEnter();
    if (!already) link.queue.push(...deps.snapshot());   // 따라오는 동안·숨어 있는 동안 바뀐 표정·자세를 한 번에 맞춤
    link.queue.push(...deps.dragMessages());   // 펫 창 안에서도 같은 이동 키로 옮길 수 있게
  };

  link.leave = () => {   // 펫 창이 제자리에 붙었거나 닫힘
    if (!link.open) { link.opening = 0; return; }   // 아직 안 떴으면 창 안 캐릭터는 그대로
    link.open = false; link.opening = 0; link.queue = [];
    deps.onLeave();
    // 창 안 캐릭터가 다시 그려지는 프레임에 바로 펫 창을 숨김 (펫 창이 스스로 숨을 때까지 둘이 겹쳐 보이던 것 방지)
    requestAnimationFrame(() => { if (!link.open && !link.follow) link.post("hide"); });
  };

  // 펫 창 알림 하나를 처리한다
  const handle = (ev: PetEvent) => {
    if (ev.seq !== undefined && ev.seq !== link.seq) return;   // 이전 회차(붙고 숨은 뒤 늦게 남은) 알림은 버림
    // 보임: 이쪽이 연(따라오게 했거나 던져서 연) 경우만 받음. 이미 숨기라고 한 뒤 늦게 온 알림은 무시
    if (ev.type === "shown") { if (link.follow) { if (!link.follow.shown) { link.follow.shown = true; link.queue.push(...deps.snapshot()); } } else if (link.opening) link.enter(); }
    // 붙음·닫힘·오류: 창 안 캐릭터로 돌아옴. 숨음: 펫 창이 맡고 있던 때만 (방금 이쪽이 숨긴 따라오기 창이면 무시)
    else if (ev.type === "attach" || ev.type === "closed" || ev.type === "error") { link.follow = null; link.leave(); }
    else if (ev.type === "hidden" && link.open) link.leave();
    else if (ev.type === "hidden" && link.follow?.shown) link.follow.shown = false;   // 따라오던 펫 창이 숨음 → 창 안 캐릭터가 다시 보이게
    else if (ev.type === "config" && Array.isArray(ev.list)) {   // 펫 창 우클릭 메뉴·설정 패널에서 바꾼 값
      for (const pair of ev.list as unknown[]) if (Array.isArray(pair) && pair.length === 2 && typeof pair[0] === "string") {
        try { deps.onConfig(pair[0], pair[1]); } catch {}
      }
    }
  };

  link.poll = () => {
    if (link.polling) return;
    link.polling = true;
    fetch(url! + "poll", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((s) => {
      link.polling = false;
      if (!s) return;
      link.supported = !!s.supported; link.petState = s.state || "none";
      if (link.boot && Number.isInteger(s.seq)) link.seq = Math.max(link.seq, s.seq);   // 새로 불러온 화면은 회차 번호를 이어받음
      for (const ev of (s.events || []) as PetEvent[]) handle(ev);
      // 이 화면을 새로 불러왔는데 펫 창이 떠 있음 (처음 한 번만: 붙은 직후 잠깐 남은 펫 창 때문에 다시 숨으면 안 됨)
      if (link.boot && s.state === "shown" && !link.open) { if (Number.isInteger(s.seq)) link.seq = s.seq; link.enter(); }
      link.boot = false;
    }).catch(() => { link.polling = false; });
  };

  // 150ms마다: 열기 시간 초과 정리, 붙을 자리·소품·옷·이동 키가 바뀌면 보내고, 모인 반응을 한 번에 보낸 뒤 알림을 조회
  link.tick = () => {
    if (link.opening && now() - link.opening > 15000) link.opening = 0;   // 펫 창이 끝내 안 뜨면 포기
    if (!link.open && !link.opening && !link.follow) return;
    if (link.open || link.follow) {
      const { dock, outfit } = deps.dockState();
      const sig = JSON.stringify([dock, outfit]);
      if (sig !== link.last) { link.last = sig; link.queue.push(["dock", [dock]], ["outfit", [outfit]]); }
      // 이동 보조 키 설정이 바뀌면 펫 창에도 알려 줌 (펫 창은 설정 파일을 읽지 않는다)
      const dragNow = deps.dragKey();
      if (dragNow !== link.dragMod) { link.dragMod = dragNow; link.queue.push(["drag", [dragNow]]); }
      if (link.queue.length) { const list = link.queue; link.queue = []; link.post("send", { list }); }
    }
    link.poll();
  };

  link.start = () => {
    if (!url) return;
    link.poll();
    // 처음 끌 때 펫 프로세스가 준비되길 기다리지 않게(약 2.5초, 그동안 창 밖에서 캐릭터가 잘리다 튐), 화면이 자리 잡고 한가할 때 숨긴 채 미리 띄워 둠.
    // 시작 인사·작업 중·창이 안 보일 때는 미루고, 한가한 때(requestIdleCallback)에 한 번만. 시작하는 동안은 호스트가 낮은 우선순위로 돌림
    const warmUp = (tries = 0): void => {
      if (link.open || link.follow || (link.supported && link.petState !== "none")) return;
      if (!link.supported) { link.poll(); if (tries < 8) setTimeout(() => warmUp(tries + 1), 3000); return; }   // 호스트가 늦게 뜨면 처음 조회가 실패했을 수 있어 다시 물어봄 (지원 안 하면 포기)
      if (!deps.idle()) { setTimeout(() => warmUp(tries), 3000); return; }
      ((globalThis as any).requestIdleCallback || ((f: () => void) => setTimeout(f, 0)))(() => { if (link.petState === "none") link.post("warm"); }, { timeout: 5000 });
    };
    setTimeout(warmUp, 5000);
    setInterval(link.tick, 150);
    // 입 모양(외부 음성 상태)은 따로 자주 보냄
    setInterval(() => {
      const voice = deps.voice();
      if (!link.open || voice === link.voiceSent) return;
      link.voiceSent = voice;
      link.post("send", { list: [["voice", [voice]]] });
    }, 60);
  };

  // 단축키: 펫 창으로 내보내기 / 돌아오기. 돌아오기는 펫 창을 숨겨 poll('hidden') → leave()가 창 안 제자리로 되돌린다.
  link.toggle = () => {
    // 캔버스를 숨긴 상태에서는 펫 창으로 내보내지 않는다 (명시적 no-op).
    // 숨김은 '잠시 그리기만 멈춤'이고 복구 칩·설정·단축키로 되돌리는 경로가 이미 있다.
    // 여기서 펫 창을 열면 숨긴 캐릭터가 바깥에 나타나 의도와 어긋나고, 보이지 않는 상태의
    // 옛 포즈(shown)로 창을 배치하게 된다. 복구 후 다시 누르면 정상 동작한다.
    if (deps.hidden()) return;
    if (link.open || link.follow?.shown) { link.opening = 0; link.post("hide"); return; }   // 펫 창이 떠 있음 → 창 안으로
    if (!url) return;
    if (link.petState === "shown") { link.enter(); return; }   // 다른 화면에서 열어 둔 펫 창이 이어받게
    const pose = deps.openPose();
    link.opening = now();
    link.post("open", { from: pose, to: pose, seq: ++link.seq });
  };

  return link;
}
