// 빌드 산출물입니다. 직접 고치지 말고 소스(character/, plugin/client.ts, shared/)를 고친 뒤 npm run build 하세요.
"use strict";
(() => {
  // shared/settings.js
  var OUTFIT_ITEMS = [
    { key: "glasses", ko: "뿔테 안경", en: "Glasses", param: "key11", on: 1, line: "outfit_glasses" },
    { key: "monocle", ko: "외눈 안경", en: "Monocle", param: "key12", on: 1, line: "outfit_glasses" },
    { key: "skirt", ko: "치마 길이 바꾸기", en: "Change skirt length", param: "Clothes1", on: -1, line: "outfit_clothes" },
    { key: "chestClothes", ko: "가슴 옷 바꾸기", en: "Change top", param: "Clothes3", on: 1, line: "outfit_clothes" },
    { key: "shoesOff", ko: "신발 벗기", en: "Take off shoes", param: "Clothes4", on: 1, line: "outfit_shoes" },
    { key: "tailHide", ko: "꼬리 숨기기", en: "Hide tail", param: "Clothes5", on: -1, line: "outfit_tail" },
    // 동물귀는 파라미터가 아니라 모델 파트(Part159)의 불투명도로 부드럽게 감춘다 (character/index.js의 earHide)
    { key: "earHide", ko: "동물귀 숨기기", en: "Hide animal ears" }
  ];
  var BODY_TYPES = [
    { key: "default", ko: "기본 체형", en: "Default", value: 0 },
    { key: "type1", ko: "체형 1", en: "Body type 1", value: 0.4 },
    { key: "type2", ko: "체형 2 (꼬마)", en: "Body type 2 (chibi)", value: 1 }
  ];

  // character/layout.ts
  var HOME_GAP = 8;
  var BUBBLE_ROOM = 78;
  var SHOW_K = 0.42;
  var MIN_SHOW_K = 0.18;
  var MOBILE_ABOVE_SCALE = 0.3;
  var homeLayout = ({ vp, r, maxK, W, visW, H, visH, minK, allowAbove = true }) => {
    const rightX = (k2) => vp.left + vp.w - 4 - (W + visW) / 2 * k2;
    const bottomY = (k2) => vp.top + vp.h - H * k2;
    const fit = (k2, above) => {
      const cap = above ? Math.min(maxK, (r.top - vp.top - HOME_GAP) / H) : Math.min(maxK, (vp.w - HOME_GAP) / visW);
      const want = k2 * (above ? MOBILE_ABOVE_SCALE : 1);
      const kk = Math.max(MIN_SHOW_K, Math.min(cap, want));
      return above ? { k: kk, x: rightX(kk), y: r.top - HOME_GAP - H * kk, above: true } : { k: kk, x: rightX(kk), y: bottomY(kk), above: false };
    };
    if (!r) {
      const k2 = maxK;
      return { k: k2, x: rightX(k2), y: bottomY(k2), above: false };
    }
    const sideK = Math.min(maxK, Math.max((vp.w - (r.right - vp.left) - HOME_GAP) / visW, (vp.h - (r.bottom - vp.top) - (allowAbove ? 4 : 10)) / visH));
    if (!allowAbove) return { k: sideK, x: rightX(sideK), y: bottomY(sideK), above: false };
    const aboveRoom = r.top - vp.top - HOME_GAP - BUBBLE_ROOM;
    const aboveK = Math.min(maxK, aboveRoom / H, (vp.w - HOME_GAP) / visW);
    if (sideK >= Math.min(minK, maxK)) return fit(sideK, false);
    if (aboveK >= MIN_SHOW_K) return fit(aboveK, true);
    const k = Math.min(maxK, MIN_SHOW_K);
    return { k, x: rightX(k), y: bottomY(k), above: false, noSafe: true };
  };
  var bubbleLayout = ({ vp, headX, headTop, bw, bh, r, above, tail = BUBBLE_TAIL }) => {
    const clampX = (left) => Math.min(Math.max(vp.left + HOME_GAP, left), Math.max(vp.left + HOME_GAP, vp.left + vp.w - bw - HOME_GAP));
    const clampY = (top) => Math.min(Math.max(vp.top + HOME_GAP, top), Math.max(vp.top + HOME_GAP, vp.top + vp.h - bh - HOME_GAP));
    const hit = (left, top) => !!r && left < r.right && left + bw > r.left && top < r.bottom && top + bh > r.top;
    const aboveTop = clampY(headTop - bh - 10);
    const aboveLeft = clampX(headX + tail - bw);
    if (!hit(aboveLeft, aboveTop) || above) return { left: aboveLeft, top: aboveTop, side: false };
    const below = r.bottom + HOME_GAP, sideLeft = clampX(vp.left + vp.w - bw - HOME_GAP);
    if (below + bh <= vp.top + vp.h - HOME_GAP) return { left: sideLeft, top: clampY(below), side: true };
    return { left: aboveLeft, top: aboveTop, side: false };
  };
  var BUBBLE_TAIL = 55;
  var bubbleTail = (bw) => Math.min(BUBBLE_TAIL, Math.round((bw || 2 * BUBBLE_TAIL) / 2) + 2);
  var tailRight = ({ noseX, width, margin = HOME_GAP, tail = BUBBLE_TAIL }) => Math.max(margin, width - (noseX + tail));
  var tailLeft = ({ noseX, bw, width, margin = HOME_GAP, tail = BUBBLE_TAIL }) => Math.min(
    Math.max(margin, noseX - (bw - tail)),
    Math.max(margin, width - bw - margin)
  );

  // character/chord.ts
  var CHORD_GRACE_MS = 150;
  var chordDown = (chord, button, buttons, now) => {
    if (button !== 0 && button !== 2) return chord;
    const other = button === 0 ? 2 : 1;
    if (buttons & other) return chord;
    return { at: now, button, valid: false };
  };
  var chordWithinGrace = (chord, button, buttons, now, graceMs = CHORD_GRACE_MS) => {
    if (!chord || chord.valid !== true || !Number.isFinite(chord.at)) return false;
    if (button === chord.button) return false;
    const firstBit = chord.button === 0 ? 1 : chord.button === 2 ? 2 : 0;
    const secondBit = button === 0 ? 1 : button === 2 ? 2 : 0;
    if (!firstBit || !secondBit) return false;
    if (!(buttons & firstBit) || !(buttons & secondBit)) return false;
    const at = chord.at;
    return now >= at && now - at <= graceMs;
  };
  var chordUp = (chord, buttons) => (buttons & 3) === 0 ? { at: null, button: null, valid: false } : chord;

  // character/motion.ts
  var clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  var hash = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  var vnoise = (t) => {
    const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f);
    return (hash(i) * (1 - u) + hash(i + 1) * u) * 2 - 1;
  };
  var noise = (t, seed) => vnoise(t + seed * 17.31) * 0.72 + vnoise(t * 2.3 + seed * 5.17) * 0.28;
  var S = () => ({ x: 0, v: 0 });
  var spring = (s, target, dt, k, d) => {
    const n = Math.max(1, Math.ceil(dt / 8e-3)), h = dt / n;
    for (let i = 0; i < n; i++) {
      s.v += ((target - s.x) * k - s.v * d) * h;
      s.x += s.v * h;
    }
    return s.x;
  };
  var sstep = (x) => {
    x = Math.max(0, Math.min(1, x));
    return x * x * x * (x * (x * 6 - 15) + 10);
  };
  var holdCurve = (p, a = 0.35, b = 0.7) => p < a ? sstep(p / a) : p > b ? sstep((1 - p) / (1 - b)) : 1;
  function addGesture(GO, name, p, d) {
    const env = Math.sin(Math.PI * p);
    switch (name) {
      case "nod":
        GO.pitch -= Math.abs(Math.sin(p * Math.PI * 4)) * 11 * env;
        GO.bodyY -= Math.abs(Math.sin(p * Math.PI * 4)) * 3 * env;
        break;
      // 끄덕끄덕 (몸도 살짝 따라 숙임)
      case "tilt":
        GO.roll += 15 * env * d;
        GO.bodyZ += 6 * env * d;
        GO.smile += env;
        break;
      // 고개 갸웃
      case "lean": {
        const h = holdCurve(p, 0.3, 0.72);
        GO.lean -= 12 * h;
        GO.pitch += 4 * h;
        GO.roll += 8 * h * d;
        GO.bodyX += 4 * h * d;
        GO.smile += 0.7 * h;
        break;
      }
      // 다가와 들여다보기: 몸은 앞으로, 턱은 살짝 들어 화면을 봄
      case "sway":
        GO.bodyZ += Math.sin(p * Math.PI * 6) * 9 * env;
        GO.roll += Math.sin(p * Math.PI * 6) * 6 * env;
        GO.bodyX += Math.sin(p * Math.PI * 6) * 5 * env;
        GO.smile += env;
        break;
      // 흔들흔들 (몸도 좌우로 → 가슴·머리카락 좌우 출렁임)
      case "bounce":
        GO.bodyY += Math.abs(Math.sin(p * Math.PI * 4)) * 8 * env;
        GO.bodyZ += Math.sin(p * Math.PI * 4) * 6 * env;
        GO.smile += env;
        break;
      // 신나서 통통
      case "droop":
        GO.pitch -= 14 * env;
        GO.bodyY -= 6 * env;
        break;
      case "flinch": {
        const k = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
        GO.pitch -= 7 * k;
        GO.bodyY -= 3 * k;
        break;
      }
      // 움찔
      case "bonk": {
        const k = p < 0.08 ? p / 0.08 : Math.pow(1 - (p - 0.08) / 0.92, 2);
        GO.pitch -= 22 * k;
        GO.bodyY -= 9 * k;
        GO.roll += 7 * k * d;
        GO.eyeClose += 0.6 * k;
        break;
      }
      // 냄비에 맞음: 순간 푹 숙였다가 천천히 고개를 듦
      case "laugh":
        GO.eyeSmile += env;
        GO.eyeClose += env * 0.85;
        GO.smile += env;
        {
          const hb = holdCurve(p, 0.25, 0.65), hh = holdCurve(Math.max(0, p - 0.08) / 0.92, 0.3, 0.6);
          GO.lean -= 10 * hb;
          GO.pitch -= 9 * hh - (p > 0.7 ? 3 * Math.sin(Math.PI * (p - 0.7) / 0.3) : 0);
          GO.roll += 7 * hb * d;
        }
        GO.bodyY += Math.abs(Math.sin(p * Math.PI * 7)) * 7 * env;
        GO.mouth += 0.45 * env;
        break;
    }
  }
  var blinkClose = (bt) => bt < 0.07 ? bt / 0.07 : bt < 0.1 ? 1 : bt < 0.22 ? 1 - (bt - 0.1) / 0.12 : 0;
  var seg = (a, b, x) => clamp((x - a) / (b - a), 0, 1);
  var coverForearm = (q) => q < 0.25 ? 0.15 * sstep(q / 0.25) : q < 0.45 ? 0.15 + 0.55 * seg(0.25, 0.45, q) : q < 0.8 ? 0.7 + 0.19 * sstep(seg(0.45, 0.8, q)) : 0.89 - 0.03 * sstep(seg(0.8, 1, q));

  // character/harness-signals.ts
  var TOOLS = {
    "명령 실행": "명령 실행 중…",
    "코드": "코드 돌리는 중…",
    "읽기": "파일 읽는 중…",
    "이미지 읽기": "그림 보는 중…",
    "편집": "코드 고치는 중…",
    "쓰기": "파일 쓰는 중…",
    "검색": "찾아보는 중…",
    "파일 내용 검색": "찾아보는 중…",
    "파일 찾기": "파일 찾는 중…",
    "웹 검색": "검색하는 중…",
    "웹페이지 가져오기": "웹페이지 보는 중…",
    "하위 에이전트 만들기": "도우미 부르는 중…",
    "팀원 만들기": "도우미 부르는 중…",
    "워크플로 실행": "워크플로 돌리는 중…",
    // 영어 화면
    "Bash": "명령 실행 중…",
    "Pwsh": "명령 실행 중…",
    "Code": "코드 돌리는 중…",
    "Read": "파일 읽는 중…",
    "Read image": "그림 보는 중…",
    "Edit": "코드 고치는 중…",
    "Write": "파일 쓰는 중…",
    "Search": "찾아보는 중…",
    "Grep": "찾아보는 중…",
    "Glob": "파일 찾는 중…",
    "Fetch": "웹페이지 보는 중…",
    "Create subagent": "도우미 부르는 중…",
    "Create teammate": "도우미 부르는 중…",
    "Run workflow": "워크플로 돌리는 중…"
  };
  var UI = {
    stop: 'button[aria-label="생성 중지"], button[aria-label="Stop generating"]',
    approval: '[aria-label="승인 상세"], [aria-label="Approval details"]',
    turnError: ["이번 턴 실행 실패", "This turn failed"]
  };
  function readStatus(doc) {
    const running = !!doc.querySelector(UI.stop);
    const waiting = doc.querySelector(UI.approval + ', [class*="Zf6DNq_card"]') ? "approval" : doc.querySelector('[data-question-reply], [data-question-key], [class*="Nksazq_card"], [class*="wnLwla_card"]') ? "question" : null;
    return { running, waiting };
  }
  function scanAddedNode(node, { running }) {
    const found = { error: false, tool: null };
    if (node.nodeType !== 1) return found;
    const element = node;
    const t = element.textContent || "";
    if (t.length < 400 && UI.turnError.some((w) => t.includes(w))) found.error = true;
    if (running && t.length < 200) {
      const leaves = element.children.length === 0 ? [element] : element.querySelectorAll("span, div");
      for (const el of leaves) {
        if (el.children.length) continue;
        const s = (el.textContent || "").trim();
        if (TOOLS[s]) {
          found.tool = TOOLS[s];
          break;
        }
      }
    }
    return found;
  }
  function readThought(doc) {
    const live = [...doc.querySelectorAll('[class*="VJlF5q_summary"][data-streaming]')].map((e) => (e.textContent || "").trim()).filter(Boolean).pop();
    if (live) return live;
    const live2 = [...doc.querySelectorAll('button[data-process-activity="thinking"][aria-expanded="false"] [data-shimmer] > span:first-child')].pop();
    if (live2) {
      const t = live2.textContent || "", i = t.indexOf(" · ");
      if (i >= 0 && t.slice(i + 3).trim()) return t.slice(i + 3).trim();
    }
    const body = [...doc.querySelectorAll('[class*="VJlF5q_thinkBody"]')].pop();
    if (!body) return "";
    const paras = (body.innerText || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    return paras.length > 1 ? paras[paras.length - 2].split("\n")[0] : "";
  }
  var VERB = {
    is: "are",
    was: "were",
    has: "have",
    wants: "want",
    needs: "need",
    asks: "ask",
    asked: "asked",
    said: "said",
    says: "say",
    likes: "like",
    prefers: "prefer",
    seems: "seem",
    mentioned: "mentioned",
    requested: "requested"
  };
  var vtuberize = (s) => s.replace(/\b(the|this) user's\b/gi, (m) => m[0] === "T" ? "Your" : "your").replace(/\b(the|this) user (\w+)/gi, (m, d, v) => {
    const you = d[0] === d[0].toUpperCase() ? "You" : "you";
    return you + " " + (VERB[v.toLowerCase()] || v);
  }).replace(/\b(the|this) user\b/gi, (m) => m[0] === m[0].toUpperCase() ? "You" : "you");
  function thoughtLine(s, random = Math.random) {
    const t = s.replace(/[*_`#>]+/g, "").replace(/\s+/g, " ").trim().replace(/^(?:[-•]|\d+[.)])\s+/, "").replace(/^\([^)]{1,30}\):?\s*/, "");
    const hangul = (t.match(/[가-힣]/g) || []).length;
    const latin = (t.match(/[A-Za-z]/g) || []).length;
    const first = (t.match(/^.{4,}?[.!?。…](\s|$)/) || [t])[0].trim();
    if (hangul >= 4 && latin <= hangul * 0.35)
      return first.length > 42 ? first.slice(0, 40).trim() + "…" : first;
    const words = first.split(" ").filter((w) => /[A-Za-z]{2,}/.test(w)).length;
    const symbols = (first.match(/[{}()\[\];=<>\/\\|$@]/g) || []).length;
    if (latin < 12 || words < 3 || hangul > latin * 0.1 || symbols > first.length * 0.04 || first.includes("://")) return null;
    let line = vtuberize(first);
    const hmm = random() < 0.3 ? "Hmm… " : "";
    const max = 64 - hmm.length;
    if (line.length > max) {
      const cut = line.slice(0, max - 2), sp = cut.lastIndexOf(" ");
      line = (sp > 30 ? cut.slice(0, sp) : cut).replace(/[\s,;:]+$/, "") + "…";
    }
    if ((line.match(/"/g) || []).length % 2) line = line.slice(0, line.lastIndexOf('"')).replace(/[\s,;:]+$/, "") + "…";
    return hmm + line;
  }

  // character/pet-link.ts
  function createPetLink(deps) {
    const { url, fetch: fetch2, setTimeout, setInterval, requestAnimationFrame, now = () => performance.now() } = deps;
    const link = { open: false, opening: 0, supported: false, queue: [], last: "", polling: false, voiceSent: null, follow: null, boot: true, petState: "none", peek: 0, seq: 0 };
    link.relay = (fn, args) => {
      if (link.open || link.follow?.shown) link.queue.push([fn, args]);
    };
    link.post = (path, body = {}) => {
      deps.onUse();
      return fetch2(url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.ok ? r.json() : null).then((s) => {
        if (s?.state) link.petState = s.state;
        return s;
      }).catch(() => null);
    };
    link.enter = () => {
      const already = !!link.follow?.shown;
      link.open = true;
      link.opening = 0;
      link.last = "";
      deps.onUse();
      deps.onEnter();
      if (!already) link.queue.push(...deps.snapshot());
      link.queue.push(...deps.dragMessages());
    };
    link.leave = () => {
      if (!link.open) {
        link.opening = 0;
        return;
      }
      link.open = false;
      link.opening = 0;
      link.queue = [];
      deps.onLeave();
      requestAnimationFrame(() => {
        if (!link.open && !link.follow) link.post("hide");
      });
    };
    const handle = (ev) => {
      if (ev.seq !== void 0 && ev.seq !== link.seq) return;
      if (ev.type === "shown") {
        if (link.follow) {
          if (!link.follow.shown) {
            link.follow.shown = true;
            link.queue.push(...deps.snapshot());
          }
        } else if (link.opening) link.enter();
      } else if (ev.type === "attach" || ev.type === "closed" || ev.type === "error") {
        link.follow = null;
        link.leave();
      } else if (ev.type === "hidden" && link.open) link.leave();
      else if (ev.type === "hidden" && link.follow?.shown) link.follow.shown = false;
      else if (ev.type === "config" && Array.isArray(ev.list)) {
        for (const pair of ev.list) if (Array.isArray(pair) && pair.length === 2 && typeof pair[0] === "string") {
          try {
            deps.onConfig(pair[0], pair[1]);
          } catch {
          }
        }
      }
    };
    link.poll = () => {
      if (link.polling) return;
      link.polling = true;
      fetch2(url + "poll", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((s) => {
        link.polling = false;
        if (!s) return;
        link.supported = !!s.supported;
        link.petState = s.state || "none";
        if (link.boot && Number.isInteger(s.seq)) link.seq = Math.max(link.seq, s.seq);
        for (const ev of s.events || []) handle(ev);
        if (link.boot && s.state === "shown" && !link.open) {
          if (Number.isInteger(s.seq)) link.seq = s.seq;
          link.enter();
        }
        link.boot = false;
      }).catch(() => {
        link.polling = false;
      });
    };
    link.tick = () => {
      if (link.opening && now() - link.opening > 15e3) link.opening = 0;
      if (!link.open && !link.opening && !link.follow) return;
      if (link.open || link.follow) {
        const { dock, outfit } = deps.dockState();
        const sig = JSON.stringify([dock, outfit]);
        if (sig !== link.last) {
          link.last = sig;
          link.queue.push(["dock", [dock]], ["outfit", [outfit]]);
        }
        const dragNow = deps.dragKey();
        if (dragNow !== link.dragMod) {
          link.dragMod = dragNow;
          link.queue.push(["drag", [dragNow]]);
        }
        if (link.queue.length) {
          const list = link.queue;
          link.queue = [];
          link.post("send", { list });
        }
      }
      link.poll();
    };
    link.start = () => {
      if (!url) return;
      link.poll();
      const warmUp = (tries = 0) => {
        if (link.open || link.follow || link.supported && link.petState !== "none") return;
        if (!link.supported) {
          link.poll();
          if (tries < 8) setTimeout(() => warmUp(tries + 1), 3e3);
          return;
        }
        if (!deps.idle()) {
          setTimeout(() => warmUp(tries), 3e3);
          return;
        }
        (globalThis.requestIdleCallback || ((f) => setTimeout(f, 0)))(() => {
          if (link.petState === "none") link.post("warm");
        }, { timeout: 5e3 });
      };
      setTimeout(warmUp, 5e3);
      setInterval(link.tick, 150);
      setInterval(() => {
        const voice = deps.voice();
        if (!link.open || voice === link.voiceSent) return;
        link.voiceSent = voice;
        link.post("send", { list: [["voice", [voice]]] });
      }, 60);
    };
    link.toggle = () => {
      if (deps.hidden()) return;
      if (link.open || link.follow?.shown) {
        link.opening = 0;
        link.post("hide");
        return;
      }
      if (!url) return;
      if (link.petState === "shown") {
        link.enter();
        return;
      }
      const pose = deps.openPose();
      link.opening = now();
      link.post("open", { from: pose, to: pose, seq: ++link.seq });
    };
    return link;
  }

  // character/speech.ts
  var JUNG = "AEAEOEOEOAEEOUOEIUUII";
  var latinVowel = (ch) => {
    const l = ch.toLowerCase();
    return l === "a" ? "A" : l === "e" ? "E" : l === "o" ? "O" : l === "u" ? "U" : "I";
  };
  function addWord(w, syl, random) {
    let first = true, prevVowel = false;
    for (const ch of w) {
      const c = ch.charCodeAt(0);
      if (c >= 44032 && c <= 55203) {
        syl.push({ v: JUNG[Math.floor((c - 44032) % 588 / 28)], d: 0.15 + random() * 0.05, amp: 0.65 + random() * 0.35, stress: first });
        first = false;
      } else if (/[aeiouy]/i.test(ch)) {
        if (!prevVowel) {
          syl.push({ v: latinVowel(ch), d: 0.13 + random() * 0.05, amp: 0.55 + random() * 0.35, stress: first });
          first = false;
        }
        prevVowel = true;
        continue;
      } else if (/[.,!?…~。，！？]/.test(ch)) syl.push({ v: null, d: ch === "," || ch === "，" ? 0.12 : 0.24 });
      else if (/[0-9]/.test(ch)) {
        syl.push({ v: "A", d: 0.12, amp: 0.7, stress: first });
        first = false;
      }
      prevVowel = false;
    }
  }
  function parseSyllables(text, ms, random = Math.random) {
    const syl = [];
    for (const w of String(text).split(/(\s+)/)) {
      if (/^\s+$/.test(w)) {
        syl.push({ v: null, d: 0.07 });
        continue;
      }
      addWord(w, syl, random);
    }
    let total = syl.reduce((s, x) => s + x.d, 0);
    const limit = (ms || 3e3) / 1e3 * 0.92;
    if (total > limit && total > 0) {
      const k = limit / total;
      for (const x of syl) x.d *= k;
      total = limit;
    }
    return { syl, total };
  }

  // character/hit.ts
  function meshBounds(v) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let k = 0; k < v.length; k += 2) {
      if (v[k] < x0) x0 = v[k];
      if (v[k] > x1) x1 = v[k];
      if (v[k + 1] < y0) y0 = v[k + 1];
      if (v[k + 1] > y1) y1 = v[k + 1];
    }
    return [x0, y0, x1, y1];
  }
  function meshHit(v, idx, uv, px, py, alphaAt) {
    for (let k = 0; k < idx.length; k += 3) {
      const a = idx[k] * 2, b = idx[k + 1] * 2, c = idx[k + 2] * 2;
      const d = (v[b + 1] - v[c + 1]) * (v[a] - v[c]) + (v[c] - v[b]) * (v[a + 1] - v[c + 1]);
      if (Math.abs(d) < 1e-9) continue;
      const l1 = ((v[b + 1] - v[c + 1]) * (px - v[c]) + (v[c] - v[b]) * (py - v[c + 1])) / d;
      const l2 = ((v[c + 1] - v[a + 1]) * (px - v[c]) + (v[a] - v[c]) * (py - v[c + 1])) / d;
      const l3 = 1 - l1 - l2;
      if (l1 < 0 || l2 < 0 || l3 < 0) continue;
      if (alphaAt(l1 * uv[a] + l2 * uv[b] + l3 * uv[c], l1 * uv[a + 1] + l2 * uv[b + 1] + l3 * uv[c + 1]) > 40) return true;
    }
    return false;
  }

  // character/index.ts
  function createCharacter({ base, life, pet = null, prefs: initialPrefs = {}, onSetting = null }) {
    const BASE = base;
    const prefs = { ...initialPrefs };
    const hooks = {};
    let petUsed = false;
    const previousDsc = window.__dsc;
    life.add(() => {
      if (window.__dsc !== previousDsc) {
        if (previousDsc === void 0) delete window.__dsc;
        else window.__dsc = previousDsc;
      }
      document.documentElement.classList.remove("dsc-hover", "dsc-grabbing");
      if (petUsed) {
        try {
          fetch(new URL("../pet/hide", new URL(BASE, location.href)).href, { method: "POST", keepalive: true }).catch(() => {
          });
        } catch {
        }
      }
    });
    const setTimeout = life.timeout, setInterval = life.interval, requestAnimationFrame = life.frame;
    const addEventListener = (type, fn, options) => life.listen(window, type, fn, options);
    const MutationObserver = function(fn) {
      return life.observe(fn);
    };
    const TEXT = {
      hello: "안녕하세요, 주인님! 오늘은… 저랑 뭐 해 볼까요?",
      start: "알겠어요! …잘 부탁드려요, 주인님",
      approval: "확인이 필요해요! …이거, 저 대신 눌러 주실 거죠?",
      question: "여쭤볼 게 있어요! …잠깐만 저만 봐 주세요",
      done: "다 했어요! …칭찬해 주실 거죠?",
      error: "앗, 문제가 생겼어요… …한 번만 더 봐 주세요"
    };
    const ready = (fn) => document.body ? fn() : addEventListener("DOMContentLoaded", fn, { once: true });
    ready(() => {
      let running = false, lastError = -1e9, lastToolSay = 0, waitingKind = null;
      const listeners = { tool: null };
      const scanAdded = (node) => {
        const found = scanAddedNode(node, { running: running && !!listeners.tool });
        if (found.error) lastError = performance.now();
        if (found.tool) listeners.tool(found.tool);
      };
      if (!pet) new MutationObserver((records) => {
        for (const r of records) for (const n of r.addedNodes) scanAdded(n);
      }).observe(document.body, { childList: true, subtree: true });
      const load = (src) => new Promise((ok, no) => {
        const s = life.own(document.createElement("script"), (node) => node.remove());
        s.src = BASE + src;
        s.onload = ok;
        s.onerror = () => no(new Error(src));
        document.head.appendChild(s);
      });
      (async () => {
        if (!window.Live2DCubismCore) await load("vendor/live2dcubismcore.min.js");
        if (!window.PIXI) await load("vendor/pixi.min.js");
        if (!window.PIXI.live2d) await load("vendor/cubism4.patched.js");
        if (life.stopped) return;
        const W = 300, H = 300;
        const canvas = life.own(document.createElement("canvas"), (node) => node.remove());
        canvas.id = "dsc-stage";
        const bubble = life.own(document.createElement("div"), (node) => node.remove());
        bubble.id = "dsc-bubble";
        document.body.append(canvas, bubble);
        const app = new PIXI.Application({ view: canvas, width: W, height: H, sharedTicker: false, autoStart: false, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: (devicePixelRatio || 1) * 1.5 });
        const systemTicker = (on) => {
          try {
            app.renderer.plugins.interaction.useSystemTicker = on;
          } catch {
          }
        };
        life.add(() => app.destroy(true, { children: true }));
        const model = await PIXI.live2d.Live2DModel.from(BASE + "model/model.model3.json", { autoUpdate: false, autoInteract: false, idleMotionGroup: "Idle" });
        if (life.stopped) {
          model.destroy();
          return;
        }
        app.stage.addChild(model);
        app.ticker.add(() => model.update(Math.min(app.ticker.deltaMS, 100)), void 0, PIXI.UPDATE_PRIORITY.HIGH);
        const im = model.internalModel, core = im.coreModel;
        im.eyeBlink = void 0;
        im.breath = void 0;
        const CHEST_DRAG_SIGN = 1;
        const dragLift = { x: 0, v: 0 };
        const dragShift = { x: 0, v: 0 };
        let chestFrom = null, chestDragging = false, chestTarget = 0, chestShiftTarget = 0;
        let chestLongTimer = 0;
        const chestShake = { x: 0, y: 0, acc: 0, last: 0, next: 0 };
        if (im.physics) {
          const evaluate = im.physics.evaluate;
          const param = (id) => {
            const i = core.getParameterIndex(id);
            if (i < 0) return null;
            const min = core.getParameterMinimumValue(i), max = core.getParameterMaximumValue(i);
            return Number.isFinite(min) && Number.isFinite(max) ? { id, min, max } : null;
          };
          const chestParams = ["ChestY1", "ChestY2", "ChestY3", "ChestY4"].map(param).filter(Boolean);
          const chestXParams = ["ChestX1", "ChestX2", "ChestX3"].map(param).filter(Boolean);
          im.physics.evaluate = function(...args) {
            const result = evaluate.apply(this, args);
            const lift = dragLift.x * CHEST_DRAG_SIGN, shift = dragShift.x * CHEST_DRAG_SIGN;
            if (lift) for (const p of chestParams) core.addParameterValueById(p.id, lift * (lift > 0 ? p.max : -p.min));
            if (shift) for (const p of chestXParams) core.addParameterValueById(p.id, shift * (shift > 0 ? p.max : -p.min) * 0.9);
            return result;
          };
        }
        const WHOLE_BODY = !!pet;
        core.update();
        const cm = core.getModel();
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const each = (fn) => {
          for (let i = 0; i < cm.drawables.count; i++) {
            if (cm.drawables.opacities[i] < 0.01) continue;
            const v = im.getDrawableVertices(i);
            for (let k = 0; k < v.length; k += 2) fn(v[k], v[k + 1]);
          }
        };
        each((x, y) => {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        });
        const cutY = minY + (maxY - minY) * 0.47;
        let ux0 = Infinity, ux1 = -Infinity;
        each((x, y) => {
          if (y < cutY) {
            ux0 = Math.min(ux0, x);
            ux1 = Math.max(ux1, x);
          }
        });
        const sBust = Math.min(W * 0.98 / (ux1 - ux0), H * 0.95 / (cutY - minY));
        const sFull = Math.min(W * 0.98 / (maxX - minX), H * 0.95 / (maxY - minY));
        const PET_HEAD_RATIO = sBust / sFull;
        const PET_K_MIN = 0.45, PET_BUBBLE = 150;
        const PET_K_MAX = Math.max(1.2, ((typeof screen !== "undefined" && screen.availHeight ? screen.availHeight : 1080) - PET_BUBBLE) / H);
        const BUST_CX = (ux0 + ux1) / 2, FULL_CX = (minX + maxX) / 2;
        const WAIST_PET = H * 0.05 + (cutY - minY) * sFull;
        const WAIST_WIN = H * 0.05 + (cutY - minY) * sBust;
        const WAIST_PCT = WAIST_PET / H * 100;
        const bw = WHOLE_BODY ? maxX - minX : ux1 - ux0;
        const bh = WHOLE_BODY ? maxY - minY : cutY - minY;
        const s = WHOLE_BODY ? sFull : sBust;
        const HEAD_GAIN = sBust / s;
        model.scale.set(s);
        model.x = W / 2 - ((WHOLE_BODY ? minX : ux0) + bw / 2) * s;
        model.y = H * 0.05 - minY * s;
        core.setParameterValueById("Clothes2", 1);
        core.update();
        let chibiMinY = Infinity, chibiMaxY = -Infinity;
        each((x, y) => {
          chibiMinY = Math.min(chibiMinY, y);
          chibiMaxY = Math.max(chibiMaxY, y);
        });
        core.setParameterValueById("Clothes2", 0);
        core.update();
        const baseY = model.y;
        const chibiDrop = Math.max(0, H * 0.99 - chibiMaxY * s - baseY);
        const chibiHeadDrop = (chibiMinY - minY) * s + chibiDrop;
        const noseModelX = BUST_CX + (ux1 - ux0) * 0.055;
        (() => {
          const d = cm.drawables, N = d.count, localUpdate = () => Object.getPrototypeOf(cm).update.call(cm);
          let w;
          try {
            w = new Worker(BASE + "dsc-core-worker.js");
          } catch {
            return;
          }
          life.add(() => {
            try {
              w.terminate();
            } catch {
            }
          });
          let lo = Infinity, hi = 0;
          for (let i = 0; i < N; i++) {
            const a = d.vertexPositions[i];
            lo = Math.min(lo, a.byteOffset);
            hi = Math.max(hi, a.byteOffset + a.byteLength);
          }
          const offs = Array.from(d.vertexPositions, (a) => a.byteOffset - lo).join();
          const vBytes = new Uint8Array(d.vertexPositions[0].buffer, lo, hi - lo);
          let ready2 = false, busy = false, result = null, spare = null;
          const stop = () => {
            ready2 = false;
            delete cm.update;
            try {
              w.terminate();
            } catch {
            }
          };
          const apply = (buf) => {
            const u8 = new Uint8Array(buf);
            let o = 0;
            vBytes.set(u8.subarray(0, vBytes.length));
            o += vBytes.length;
            d.opacities.set(new Float32Array(buf, o, N));
            o += N * 4;
            d.drawOrders.set(new Int32Array(buf, o, N));
            o += N * 4;
            d.renderOrders.set(new Int32Array(buf, o, N));
            o += N * 4;
            d.multiplyColors.set(new Float32Array(buf, o, N * 4));
            o += N * 16;
            d.screenColors.set(new Float32Array(buf, o, N * 4));
            o += N * 16;
            d.dynamicFlags.set(u8.subarray(o, o + N));
          };
          w.onerror = stop;
          w.onmessage = (e) => {
            const m = e.data;
            if (m.type === "ready") {
              if (m.count === N && m.params === cm.parameters.count && m.parts === cm.parts.count && m.offs.join() === offs) ready2 = true;
              else stop();
            } else if (m.type === "frame") {
              result = m.buf;
              busy = false;
            } else if (m.type === "fail") stop();
          };
          cm.update = () => {
            if (!ready2) return localUpdate();
            if (result) {
              apply(result);
              spare = result;
              result = null;
            }
            if (!busy) {
              const P = cm.parameters.count, inp = new Float32Array(P + cm.parts.count);
              inp.set(cm.parameters.values);
              inp.set(cm.parts.opacities, P);
              const tr = [inp.buffer];
              if (spare) tr.push(spare);
              w.postMessage({ type: "frame", inp: inp.buffer, out: spare }, tr);
              spare = null;
              busy = true;
            }
          };
          w.postMessage({ type: "init", url: BASE + "model/model.moc3" });
        })();
        const exp = {};
        await Promise.all(["loading", "heart", "blush", "sweat", "dizzy", "tears", "squint", "smug", "dark"].map(async (f) => {
          try {
            exp[f] = (await (await fetch(`${BASE}model/exp/${f}.exp3.json`)).json()).Parameters || [];
          } catch {
            exp[f] = [];
          }
        }));
        if (life.stopped) return;
        const weight = {}, hold = {}, until = {};
        const OUTFIT_PARAMS = OUTFIT_ITEMS.filter((item) => item.param).map((item) => [item.key, item.param, item.on]);
        const OUTFIT_LINE = Object.fromEntries(OUTFIT_ITEMS.filter((item) => item.line).map((item) => [item.key, item.line]));
        const BODY_VALUE = Object.fromEntries(BODY_TYPES.map((body) => [body.key, body.value]));
        const outfitW = {};
        for (const [key] of OUTFIT_PARAMS) outfitW[key] = (prefs.outfit || {})[key] ? 1 : 0;
        const EAR_PART_ID = "Part159";
        const earPartIndexFor = (ids, id) => {
          if (!ids) return -1;
          const found = Array.from(ids).indexOf(id);
          return found >= 0 ? found : -1;
        };
        const earPartIndex = earPartIndexFor(cm.parts && cm.parts.ids, EAR_PART_ID);
        const earDrawables = [];
        if (earPartIndex >= 0) {
          for (let i = 0; i < cm.drawables.count; i++) if (cm.drawables.parentPartIndices[i] === earPartIndex) earDrawables.push(i);
        }
        const earSet = new Set(earDrawables);
        const earVisible = (opacity, flags) => opacity >= 0.05 && (flags & 1) !== 0;
        const earBaseVisible = new Map(earDrawables.map((i) => [i, earVisible(cm.drawables.opacities[i], cm.drawables.dynamicFlags[i])]));
        const earOpacityValue = (w) => Math.max(0, Math.min(1, 1 - w));
        const earOpacityStep = (w, on, dt) => Math.min(1, Math.max(0, w + ((on ? 1 : 0) - w) * Math.min(1, dt * 6)));
        const applyEarOpacity = (parts, index, w) => {
          if (!parts || !parts.opacities || index < 0) return false;
          parts.opacities[index] = earOpacityValue(w);
          return true;
        };
        let earW = (prefs.outfit || {}).earHide ? 1 : 0;
        const earHitVisible = (i) => earW > 5e-3 ? earBaseVisible.get(i) === true : earVisible(cm.drawables.opacities[i], cm.drawables.dynamicFlags[i]);
        let basinUntil = 0, basinW = 0;
        let bodyW = BODY_VALUE[(prefs.outfit || {}).bodyType] || 0, outfitPrev = null, outfitTalk = null;
        const PET = pet;
        const PET_URL = PET ? null : (() => {
          try {
            return new URL("../pet/", new URL(BASE, location.href)).href;
          } catch {
            return null;
          }
        })();
        const link = createPetLink({
          url: PET_URL,
          fetch: (...args) => fetch(...args),
          setTimeout,
          setInterval,
          requestAnimationFrame,
          onUse: () => {
            petUsed = true;
          },
          // 플러그인이 내려갈 때 펫 창을 숨길지 판단
          onConfig: (key, value) => onSetting?.(key, value),
          onEnter: () => petLinkEnter(),
          onLeave: () => petLinkLeave(),
          snapshot: () => petLinkSnapshot(),
          dragMessages: () => petLinkDragMessages(),
          dockState: () => petLinkDock(),
          dragKey: () => dragKeyRaw(),
          voice: () => voiceState,
          idle: () => intro.phase === "done" && !running && !document.hidden,
          hidden: () => hidden,
          openPose: () => petOpenScreenPose()
        });
        const relay = link.relay;
        const EYE_EXP = ["heart", "squint", "smug", "dizzy"];
        const clearOtherEyes = (name) => {
          if (EYE_EXP.includes(name)) {
            for (const e of EYE_EXP) if (e !== name) {
              until[e] = 0;
              hold[e] = false;
            }
          }
        };
        const setExp = (name, on) => {
          relay("setExp", [name, on]);
          if (on) clearOtherEyes(name);
          hold[name] = on;
        };
        const flashExp = (name, ms) => {
          relay("flashExp", [name, ms]);
          clearOtherEyes(name);
          until[name] = performance.now() + ms;
        };
        const gest = { name: null, start: 0, dur: 0, dir: 1 };
        const cover = { until: 0, start: -1e9, q: 0 };
        const coverChest = (ms) => {
          const now = performance.now();
          if (now >= cover.until) cover.start = now;
          cover.until = Math.max(cover.until, now + ms);
        };
        const play = (name, dur) => {
          relay("play", [name, dur]);
          gest.name = name;
          gest.start = performance.now();
          gest.dur = dur;
          gest.dir = Math.random() < 0.5 ? -1 : 1;
          if (BOB_KICK[name]) bobKick(BOB_KICK[name]);
        };
        const BOB_KICK = { bounce: 60, laugh: 50, nod: -45 };
        let mood = "idle", moodUntil = 0, nextIdleGesture = performance.now() + 6e3, talkUntil = 0;
        const setMood = (m, ms = 0) => {
          relay("setMood", [m, ms]);
          mood = m;
          moodUntil = ms ? performance.now() + ms : 0;
        };
        const pose = { lean: 0, headZ: 0, headY: 0, bodyY: 0, swayAmp: 0 };
        let shiverStarted = -1e9, touchLeanUntil = 0, touchLean = 0;
        let shiverBobAt = 0, shiverBobSign = 1;
        let happyMouthUntil = 0, happyMouth = 0;
        let stareUntil = 0, stareW = 0;
        let sulkStart = -1e9, sulkUntil = 0, sulkDir = 1, sulkPeeks = [], sulkYaw = 0, sulkRoll = 0;
        const SULK_CHIN = 10;
        const PEEK_RISE = 550, PEEK_HOLD = 450, PEEK_SNAP = 150;
        const visW = bw * s, visH = H * 0.95;
        let coarseMql = null;
        const coarsePointer = () => {
          if (typeof matchMedia !== "function") return false;
          if (!coarseMql) coarseMql = matchMedia("(hover: none) and (pointer: coarse)");
          return coarseMql.matches;
        };
        const mobileHidden = () => !!prefs.mobile && prefs.mobile.enabled === false && coarsePointer();
        const keyboardOpen = () => {
          const vv = typeof visualViewport !== "undefined" && visualViewport ? visualViewport : null;
          if (!vv || vv.scale !== 1) return false;
          return innerHeight - vv.height > 120 || vv.offsetTop > 4;
        };
        const typingActive = () => coarsePointer() && keyboardOpen();
        const viewport = () => {
          const vv = typeof visualViewport !== "undefined" && visualViewport ? visualViewport : null;
          return vv ? { w: vv.width, h: vv.height, top: vv.offsetTop, left: vv.offsetLeft } : { w: innerWidth, h: innerHeight, top: 0, left: 0 };
        };
        const layoutViewport = () => coarsePointer() ? viewport() : { w: innerWidth, h: innerHeight, top: 0, left: 0 };
        let curK = 1, fleeX = 0;
        const free = { on: false, x: 0, y: 0, k: 1, anim: null, mode: null, applied: true };
        const drag = { pending: null, on: false, x: 0, y: 0, samples: [] };
        let chord = { at: null, button: null, valid: false };
        let rightPress = null;
        let mouseButtons = 0;
        const carry = { vx: 0, vy: 0 };
        const shown = { k: 1, x: 0, y: 0 };
        let touchHold = 0;
        let petDock = null, petDocked = false, snapP = 0;
        const PET_SIZE_KEY = "dsc-pet-size";
        let petPanel = null, petPanelOpen = false, petPanelWin = { w: 0, h: 0 };
        let petBaseK = 1, petPendingRatio = null, petSizeTimer = 0, petMenuSig = "";
        const FREE_KEY = "dsc-free-pos";
        const FREE_KEY_MOBILE = "dsc-free-pos-mobile";
        const freeMode = () => coarsePointer() ? "mobile" : "desktop";
        const freeStorageKey = (mode) => mode === "mobile" ? FREE_KEY_MOBILE : FREE_KEY;
        const freeToRatio = () => {
          free.fx = (free.x + W * free.k / 2) / innerWidth;
          free.fy = (free.y + H * free.k) / innerHeight;
        };
        if (!PET) try {
          const mode = freeMode();
          const s2 = JSON.parse(localStorage.getItem(freeStorageKey(mode)) || "null");
          if (s2 && isFinite(s2.fx) && isFinite(s2.fy) && s2.k > 0 && (!s2.mode || s2.mode === mode)) {
            Object.assign(free, { on: true, fx: s2.fx, fy: s2.fy, k: s2.k, mode, applied: true });
          }
        } catch {
        }
        const saveFree = (fromPose = true) => {
          if (PET || free.applied === false) return;
          if (free.on && fromPose) freeToRatio();
          try {
            const mode = free.mode || freeMode();
            const key = freeStorageKey(mode);
            if (free.on) localStorage.setItem(key, JSON.stringify({ mode, fx: +free.fx.toFixed(4), fy: +free.fy.toFixed(4), k: +free.k.toFixed(3) }));
            else localStorage.removeItem(key);
          } catch {
          }
        };
        const walk = { phase: "", face: 0, dir: -1, out: 0, timers: [], slideId: 0, lastTouch: 0, next: performance.now() + (180 + Math.random() * 180) * 1e3 };
        let walkCheck = null;
        const DPR = (devicePixelRatio || 1) * 1.5;
        const intro = { phase: "center", start: performance.now(), moveStart: 0, from: null, kc: 1 };
        const veil = life.own(document.createElement("div"), (node) => node.remove());
        veil.style.cssText = "position:fixed;inset:0;z-index:29;background:radial-gradient(circle at 50% 55%,var(--dsc-veil1,#ffffffd9),var(--dsc-veil2,#eef0ffcc) 70%);backdrop-filter:blur(8px);opacity:0;transition:none;cursor:pointer";
        document.body.append(veil);
        veil.addEventListener("pointerdown", () => {
          if (intro.phase === "center") intro.skip = true;
        });
        const setRes = (k) => {
          const res = DPR * Math.max(1, k);
          if (app.renderer.resolution === res) return;
          app.renderer.resolution = res;
          app.renderer.resize(W, H);
        };
        const ease = (p) => p < 0 ? 0 : p > 1 ? 1 : p * p * (3 - 2 * p);
        const findCard = () => document.querySelector(".dsc-composer") || [...document.querySelectorAll('[class*="_card"]')].find((e) => e.closest('[class*="_root"]') && e.querySelector('[class*="_input"]'));
        const cardRect = (card) => {
          const r = card.getBoundingClientRect();
          if (r.width) return r;
          const seat = card.closest('[class*="composerSeat"]');
          for (const alt of seat ? seat.querySelectorAll('[class*="_card"]') : []) {
            if (alt === card) continue;
            const ar = alt.getBoundingClientRect();
            if (ar.width) return ar;
          }
          return null;
        };
        const homePose = () => {
          const card = findCard();
          const vp = layoutViewport();
          const maxK = Math.min(PET_K_MAX / PET_HEAD_RATIO, vp.h * 0.92 / visH);
          const r = card ? cardRect(card) : null;
          const pose2 = homeLayout({ vp, r, maxK, W, visW, H, visH, minK: SHOW_K, allowAbove: coarsePointer() });
          return { k: pose2.k, x: pose2.x + fleeX, y: pose2.y, card, r, above: pose2.above, noSafe: !!pose2.noSafe, vp };
        };
        const centerPose = () => {
          const vp = layoutViewport();
          const k = Math.min(vp.h * 0.74 / visH, vp.w * 0.55 / visW, 3.2);
          return { k, x: vp.left + vp.w / 2 - W * k / 2, y: vp.top + vp.h - H * k };
        };
        const introOff = !!prefs.intro && prefs.intro.enabled === false;
        if (!introOff) {
          intro.kc = centerPose().k;
          setRes(intro.kc);
        }
        const skipIntro = () => {
          if (intro.phase === "done") return;
          intro.phase = "done";
          setRes(1);
          veil.remove();
          canvas.style.opacity = "";
          bubble.style.left = "";
          bubble.style.fontSize = "";
          bubble.style.padding = "";
        };
        if (PET || introOff) skipIntro();
        const bodyRect = (x, y, k) => {
          const side = (W - visW) / 2 * k;
          return { l: x + side, t: y + H * 0.05 * k, r: x + W * k - side, b: y + H * k };
        };
        const easeOut = (p) => 1 - Math.pow(1 - p, 3);
        const easeBack = (p) => {
          const c = 1.25, q = p - 1;
          return 1 + (c + 1) * q * q * q + c * q * q;
        };
        const area = () => PET ? { l: screen.availLeft, t: screen.availTop, r: screen.availLeft + screen.availWidth, b: screen.availTop + screen.availHeight } : { l: 0, t: 0, r: innerWidth, b: innerHeight };
        const keepIn = (p) => {
          const a = area(), side = (W - visW) / 2 * p.k;
          return { k: p.k, x: Math.min(Math.max(p.x, a.l - side), a.r - W * p.k + side), y: Math.min(Math.max(p.y, a.t - H * p.k * 0.05), a.b - H * p.k * 0.3) };
        };
        const screenOf = (x, y) => {
          const bx = (outerWidth - innerWidth) / 2;
          return { x: screenX + bx + x, y: screenY + Math.max(0, outerHeight - innerHeight - bx) + y };
        };
        const dockTarget = (home) => home.k >= SHOW_K || home.above || home.noSafe ? home : { k: SHOW_K, x: innerWidth - 4 - (W + visW) / 2 * SHOW_K + fleeX, y: innerHeight - H * SHOW_K };
        const bodyOut = (q, entering = true) => {
          const side = (W - visW) / 2 * q.k, edge = visW * q.k * (entering ? 0.15 : -0.02), low2 = entering ? 0.5 : 0.8;
          return q.x + side < -edge || q.x + W * q.k - side > innerWidth + edge || q.y < -edge || q.y + H * q.k * low2 > innerHeight;
        };
        const inWindow = (q, w) => {
          const side = (W - visW) / 2 * q.k, edge = visW * q.k * 0.02;
          return q.x + side >= w.l + edge && q.x + W * q.k - side <= w.r - edge && q.y >= w.t + edge && q.y + H * q.k * 0.8 <= w.b;
        };
        const dockPose = (home, now) => {
          snapP = 0;
          if (drag.on) return { k: free.k, x: drag.x, y: drag.y };
          const a = free.anim;
          if (a) {
            const p2 = Math.min(1, (now - a.t0) / a.ms), to = a.snap ? (PET ? petDock : dockTarget(home)) || a.from : a.to;
            const e = a.snap ? easeBack(p2) : easeOut(p2), ek = easeOut(p2);
            const pose2 = { k: a.from.k + (to.k - a.from.k) * ek, x: a.from.x + (to.x - a.from.x) * e, y: a.from.y + (to.y - a.from.y) * e };
            if (a.snap) snapP = ek;
            if (p2 >= 1) {
              free.anim = null;
              if (a.snap && !PET) {
                free.on = false;
                saveFree();
              } else {
                Object.assign(free, { on: true, x: to.x, y: to.y, k: to.k });
                saveFree();
              }
              if (a.snap && PET) {
                petDocked = true;
                PET.send({ type: "attach" });
              }
              if (PET) {
                petSyncMenu();
                renderPetPanel();
              }
            }
            return pose2;
          }
          const currentMode = freeMode();
          if (!PET && free.on && free.mode && free.mode !== currentMode) {
            free.applied = false;
            return dockTarget(home);
          }
          free.applied = true;
          if (!free.on) return dockTarget(home);
          let q = free;
          if (!PET) {
            if (!isFinite(free.fx) || !isFinite(free.fy)) freeToRatio();
            const floor = coarsePointer() ? MIN_SHOW_K : SHOW_K;
            const baseK = coarsePointer() && home.r ? home.k : free.k;
            const k = Math.max(floor, Math.min(baseK, Math.min(1.25, innerHeight * 0.45 / visH)));
            q = { k, x: free.fx * innerWidth - W * k / 2, y: free.fy * innerHeight - H * k };
          }
          const p = keepIn(q);
          return { k: p.k, x: p.x + fleeX, y: p.y };
        };
        const GLIDE = 0.066;
        const release = (vx, vy, touch = false) => {
          const k = free.k, from = { k, x: drag.x, y: drag.y }, p = { k, x: from.x + vx * GLIDE, y: from.y + vy * GLIDE };
          const home = PET ? petDock : dockTarget(homePose());
          const mid = (q, kk) => [q.x + W * kk / 2, q.y + H * kk * 0.5];
          const [px, py] = mid(p, k);
          const outside = !PET && bodyOut(p);
          const backIn = !PET || !home?.win || inWindow(p, home.win);
          const snapRange = touch ? Math.max(80, visW * k * 0.35) : Math.max(140, visW * k * 0.7);
          const snap = !outside && backIn && !!home && Math.hypot(px - mid(home, home.k)[0], py - mid(home, home.k)[1]) < snapRange;
          if (Math.hypot(vx, vy) > 2600) flashExp("dizzy", 1500);
          if (outside && link.supported) {
            const a = screenOf(from.x, from.y), b = screenOf(p.x, p.y);
            link.opening = performance.now();
            link.post("open", { from: { k, x: a.x, y: a.y }, to: { k, x: b.x, y: b.y }, seq: ++link.seq });
          }
          free.on = true;
          if (snap) {
            free.anim = { t0: performance.now(), ms: 650, from, to: null, snap: true };
            return;
          }
          const to = keepIn(p);
          let target = to;
          if (PET && petPendingRatio != null) {
            target = keepIn(petSizedPose(p, k, petPendingRatio));
            petPendingRatio = null;
          }
          if (target.x !== from.x || target.y !== from.y || target.k !== from.k) free.anim = { t0: performance.now(), ms: 300, from, to: target, snap: false };
          else {
            free.anim = null;
            Object.assign(free, { x: from.x, y: from.y, k });
            saveFree();
          }
        };
        let lastPlaceKey = "";
        let hidden = false;
        let pageHiddenApplied = false;
        const pageHiddenNow = () => !PET && prefs.pageHidden === true;
        let petPower = !PET;
        let lastClip = "";
        let lastMask = "", lastMaskComposite = "";
        const petWin = { x: NaN, y: NaN };
        let petWinSize = { w: 0, h: 0 };
        let petTracking = false, petGrab = null;
        let petBox = "";
        const movePet = (pose2) => {
          const cx = (innerWidth - W * pose2.k) / 2, cy = innerHeight - H * pose2.k;
          const wx = Math.round(pose2.x - cx), wy = Math.round(pose2.y - cy);
          if (petTracking) petWin.x = petWin.y = NaN;
          else if (wx !== petWin.x || wy !== petWin.y) {
            petWin.x = wx;
            petWin.y = wy;
            PET.move(wx, wy);
          }
          return { x: cx, y: cy };
        };
        let renderOn = true;
        const setRender = (on) => {
          if (renderOn === on) return;
          renderOn = on;
          if (!on) return;
          app.ticker.lastTime = performance.now();
          wakeRaf();
        };
        const hideCharacter = () => {
          canvas.style.display = bubble.style.display = "none";
        };
        const placeBlocked = () => {
          if (hidden) {
            hideCharacter();
            return true;
          }
          if (pageHiddenNow()) {
            hideForPage();
            return true;
          }
          if (pageHiddenApplied) {
            pageHiddenApplied = false;
            veil.style.opacity = "";
            veil.style.pointerEvents = "";
            lastPlaceKey = "";
            wakeRaf();
          }
          if (mobileHidden() || typingActive()) {
            skipIntro();
            setRender(false);
            hideCharacter();
            veil.style.opacity = "0";
            veil.style.pointerEvents = "none";
            lastPlaceKey = "";
            return true;
          }
          if (link.open || link.follow?.shown) {
            setRender(false);
            hideCharacter();
            lastPlaceKey = "";
            return true;
          }
          return false;
        };
        const introPose = (home, dock, now) => {
          let { k, x, y } = dock;
          let introOn = intro.phase !== "done", vo = 0;
          if (introOn && !intro.begun) {
            if (home.card && !intro.cardAt) intro.cardAt = now;
            if (!(intro.cardAt && now - intro.cardAt > 300) && now - intro.start < 8e3) {
              veil.style.opacity = "1";
              veil.style.pointerEvents = "none";
              return null;
            }
            intro.begun = true;
            intro.start = now;
          }
          if (introOn) {
            const c = centerPose();
            if (intro.phase === "center") {
              vo = 1;
              k = c.k;
              x = c.x;
              y = c.y;
              if (intro.skip) {
                intro.phase = "move";
                intro.moveStart = now;
                intro.from = c;
              }
            } else {
              const p = ease((now - intro.moveStart) / 900);
              vo = 1 - p;
              k = intro.from.k + (dock.k - intro.from.k) * p;
              x = intro.from.x + (dock.x - intro.from.x) * p;
              y = intro.from.y + (dock.y - intro.from.y) * p;
              if (p >= 1) {
                intro.phase = "done";
                introOn = false;
                setRes(1);
                veil.remove();
                bubble.style.left = "";
                bubble.style.fontSize = "";
                bubble.style.padding = "";
              }
            }
            veil.style.opacity = String(vo);
            veil.style.pointerEvents = intro.phase === "center" ? "auto" : "none";
            canvas.style.opacity = intro.phase === "center" ? String(ease((now - intro.start) / 300)) : "";
          }
          return { k, x, y, introOn };
        };
        const placePetWindow = (dock, k) => {
          const { x, y } = movePet(dock);
          const needW = Math.ceil(W * k) + 24, needH = Math.ceil(H * k) + PET_BUBBLE;
          const panelW = petPanelOpen && petPanel ? Math.ceil(petPanel.offsetWidth) + 24 : 0;
          const panelH = petPanelOpen && petPanel ? Math.ceil(petPanel.offsetHeight) + 24 : 0;
          const fitW = Math.max(needW, panelW), fitH = Math.max(needH, panelH);
          if (fitW !== petWinSize.w || fitH !== petWinSize.h) {
            petWinSize.w = fitW;
            petWinSize.h = fitH;
            PET.send({ type: "fit", w: fitW, h: fitH });
          }
          if (petPanelOpen && (innerWidth !== petPanelWin.w || innerHeight !== petPanelWin.h)) {
            petPanelWin = { w: innerWidth, h: innerHeight };
            fitPetPanel();
          }
          const r = bodyRect(x, y, k), body = walking() || fleeX !== 0 ? null : { l: Math.round(r.l), t: Math.round(r.t), r: Math.round(r.r), b: Math.round(r.b) };
          const b = petPanelBox(body);
          const sig = JSON.stringify(b);
          if (sig !== petBox) {
            petBox = sig;
            PET.send({ type: "hitbox", box: b });
          }
          return { x, y };
        };
        const updateCardClip = (home, introOn, k, x, y) => {
          const seat = !introOn && home.card && home.card.closest('[class*="composerSeat"]');
          const popup = seat && seat.querySelector('[class*="_card"]:not(.dsc-composer)');
          let clip = "";
          if (popup) {
            const pr = popup.getBoundingClientRect(), cs = getComputedStyle(popup), cw = W * k, ch = H * k;
            const l = pr.left - x, t = pr.top - y, rr = pr.right - x, bb = pr.bottom - y;
            if (rr > 0 && bb > 0 && l < cw && t < ch) {
              const rad = (v) => Math.min(parseFloat(v) || 0, pr.width / 2, pr.height / 2), f = (n) => +n.toFixed(2);
              const tl = rad(cs.borderTopLeftRadius), tr = rad(cs.borderTopRightRadius), br = rad(cs.borderBottomRightRadius), bl = rad(cs.borderBottomLeftRadius);
              clip = `path(evenodd, "M0 0H${f(cw)}V${f(ch)}H0Z M${f(l + tl)} ${f(t)}H${f(rr - tr)}A${f(tr)} ${f(tr)} 0 0 1 ${f(rr)} ${f(t + tr)}V${f(bb - br)}A${f(br)} ${f(br)} 0 0 1 ${f(rr - br)} ${f(bb)}H${f(l + bl)}A${f(bl)} ${f(bl)} 0 0 1 ${f(l)} ${f(bb - bl)}V${f(t + tl)}A${f(tl)} ${f(tl)} 0 0 1 ${f(l + tl)} ${f(t)}Z")`;
            }
          }
          if (clip !== lastClip) {
            canvas.style.clipPath = clip;
            lastClip = clip;
          }
        };
        const canvasMask = ({ winBox, petFade, fade, x, y }) => {
          if (winBox && petFade > 1e-3) {
            const o = screenOf(0, 0), A = (1 - petFade).toFixed(3);
            const l = (winBox.l - o.x - x).toFixed(1), r = (winBox.r - o.x - x).toFixed(1);
            const t = (winBox.t - o.y - y).toFixed(1), b = (winBox.b - o.y - y).toFixed(1);
            return {
              mask: `linear-gradient(to right, rgba(0,0,0,${A}) 0 ${l}px, #000 ${l}px ${r}px, rgba(0,0,0,${A}) ${r}px 100%), linear-gradient(to bottom, rgba(0,0,0,${A}) 0 ${t}px, #000 ${t}px ${b}px, rgba(0,0,0,${A}) ${b}px 100%)`,
              maskComposite: "intersect"
            };
          }
          if (petFade > 1e-3) {
            const alpha = (1 - petFade).toFixed(3), b0 = Math.max(0, WAIST_PCT - 2.5).toFixed(2), b1 = Math.min(100, WAIST_PCT + 2.5).toFixed(2);
            return { mask: `linear-gradient(to bottom, #000 0 ${b0}%, rgba(0,0,0,${alpha}) ${b1}% 100%)`, maskComposite: "" };
          }
          return { mask: fade > 0 ? `linear-gradient(to bottom, #000 calc(100% - ${fade}px), transparent)` : "", maskComposite: "" };
        };
        const applyCanvasMask = (spec) => {
          const { mask, maskComposite } = canvasMask(spec);
          if (mask !== lastMask || maskComposite !== lastMaskComposite) {
            canvas.style.maskImage = canvas.style.webkitMaskImage = mask;
            canvas.style.maskComposite = maskComposite || "add";
            canvas.style.webkitMaskComposite = maskComposite === "intersect" ? "source-in" : "source-over";
            lastMask = mask;
            lastMaskComposite = maskComposite;
          }
        };
        const fitTail = () => {
          const t = bubbleTail(bubble.offsetWidth);
          bubble.style.setProperty("--dsc-tail-c", t - 2 + "px");
          return t;
        };
        const placeIntroBubble = ({ noseX, headTop, vp }) => {
          bubble.style.right = "auto";
          bubble.style.fontSize = "22px";
          bubble.style.padding = "14px 24px";
          bubble.style.maxWidth = "560px";
          const bw0 = bubble.offsetWidth, bh0 = bubble.offsetHeight, tail = fitTail();
          if (!coarsePointer()) {
            bubble.style.left = tailLeft({ noseX, bw: bw0, width: innerWidth, tail }) + "px";
            bubble.style.top = Math.max(8, headTop - bh0 - 6) + "px";
            return;
          }
          const clampY = (top) => Math.min(Math.max(vp.top + HOME_GAP, top), Math.max(vp.top + HOME_GAP, vp.top + vp.h - bh0 - HOME_GAP));
          bubble.style.left = vp.left + tailLeft({ noseX: noseX - vp.left, bw: bw0, width: vp.w, tail }) + "px";
          bubble.style.top = clampY(Math.max(vp.top + HOME_GAP, headTop - bh0 - 6)) + "px";
        };
        const placeDesktopBubble = ({ k, x, noseX, headTop, home, loose }) => {
          const card = home.card;
          bubble.style.left = "auto";
          bubble.style.maxWidth = Math.max(150, visW * k * 1.1) + "px";
          const tail = fitTail();
          bubble.style.right = tailRight({ noseX, width: innerWidth, tail }) + "px";
          bubble.style.top = Math.max(8, headTop - bubble.offsetHeight - 10) + "px";
          if (!(card && home.r)) return;
          const r = home.r, bl = bubble.offsetLeft, bt = bubble.offsetTop, b = { left: bl, top: bt, right: bl + bubble.offsetWidth, bottom: bt + bubble.offsetHeight };
          if (!(b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top)) return;
          bubble.classList.add("side");
          bubble.style.maxWidth = "220px";
          bubble.style.right = loose ? innerWidth - (x + (W - visW) / 2 * k) + 8 + "px" : "10px";
          const sideTop = Math.max(r.bottom + 8, headTop + 4);
          if (sideTop + bubble.offsetHeight <= innerHeight - HOME_GAP) bubble.style.top = sideTop + "px";
          else {
            bubble.classList.remove("side");
            bubble.style.maxWidth = Math.min(Math.max(150, visW * k * 1.1), innerWidth - 16) + "px";
            bubble.style.top = Math.max(8, Math.min(innerHeight - bubble.offsetHeight - HOME_GAP, headTop - bubble.offsetHeight - 10)) + "px";
          }
        };
        const placeMobileBubble = ({ k, noseX, headTop, vp, home }) => {
          const card = home.card;
          bubble.style.right = "auto";
          bubble.style.maxWidth = Math.min(Math.max(150, visW * k * 1.1), vp.w - 16) + "px";
          const bl = bubbleLayout({ vp, headX: noseX, headTop, bw: bubble.offsetWidth, bh: bubble.offsetHeight, r: card && home.r ? home.r : null, above: home.above, tail: fitTail() });
          bubble.style.left = bl.left + "px";
          bubble.style.top = bl.top + "px";
          if (bl.side && !home.above) bubble.classList.add("side");
        };
        const placeKeyOf = ({ k, x, y, vp, home, noseX, fade, petFade, loose, winBox }) => {
          const r0 = home.r;
          return [
            k,
            x,
            y,
            vp.left,
            vp.top,
            vp.w,
            vp.h,
            fleeX,
            Math.round(bodyW * 40),
            r0 && r0.left,
            r0 && r0.right,
            r0 && r0.top,
            r0 && r0.bottom,
            Math.round(noseX / 3),
            home.above ? 1 : 0,
            bubble.textContent,
            bubble.className.replace(/\bside\b/g, "").trim(),
            fade,
            Math.round(petFade * 60),
            loose,
            winBox ? [winBox.l, winBox.t, winBox.r, winBox.b].join(",") : ""
          ].join("|");
        };
        const fadeAmounts = (k, y) => {
          const lift = PET ? 0 : Math.max(0, innerHeight - (y + H * k));
          const fade = PET ? 0 : Math.round(Math.max(0, Math.min(lift, H * k * 0.18)) * (1 - Math.min(1, Math.max(0, bodyW))));
          const petFade = PET ? Math.min(1, Math.max(0, petDocked ? 1 : snapP)) : 0;
          return { fade, petFade };
        };
        const place = () => {
          if (placeBlocked()) return;
          const now = performance.now();
          const home = homePose();
          const dock = dockPose(home, now);
          const pose2 = introPose(home, dock, now);
          if (!pose2) return;
          let { k, x, y } = pose2;
          const { introOn } = pose2;
          const show = introOn || k >= SHOW_K || home.above && k >= MIN_SHOW_K;
          canvas.style.display = bubble.style.display = show ? "block" : "none";
          setRender(show && (!PET || petPower));
          if (!show) return;
          if (curK !== k) {
            curK = k;
            setRes(k);
          }
          shown.k = k;
          shown.x = x;
          shown.y = y;
          const loose = PET || free.on && free.applied || !!free.anim;
          if (PET) ({ x, y } = placePetWindow(dock, k));
          updateCardClip(home, introOn, k, x, y);
          const { fade, petFade } = fadeAmounts(k, y);
          const winBox = PET && petDock && petDock.win ? petDock.win : null;
          const noseX = x + (model.x + noseModelX * model.scale.x) * k;
          const vp = home.vp || viewport();
          const placeKey = introOn ? "" : placeKeyOf({ k, x, y, vp, home, noseX, fade, petFade, loose, winBox });
          if (placeKey && placeKey === lastPlaceKey) return;
          lastPlaceKey = placeKey;
          applyCanvasMask({ winBox, petFade, fade, x, y });
          canvas.style.width = W * k + "px";
          canvas.style.height = H * k + "px";
          if (fleeX !== 0) bubble.style.display = "none";
          canvas.style.left = x + "px";
          canvas.style.top = y + "px";
          const headTop = y + (H * 0.05 + chibiHeadDrop * Math.min(1, Math.max(0, bodyW))) * k;
          bubble.classList.remove("side");
          const spot = { k, x, noseX, headTop, vp, home, loose };
          if (introOn) placeIntroBubble(spot);
          else if (!coarsePointer() && !home.above) placeDesktopBubble(spot);
          else placeMobileBubble(spot);
        };
        const hideChipVisible = ({ pet: pet2 = PET, isHidden = hidden, mobileHiddenNow = mobileHidden() } = {}) => !pet2 && isHidden && !mobileHiddenNow && !pageHiddenNow();
        let placeErrorWarned = false;
        let rafIdle = false;
        const wakeRaf = () => {
          if (rafIdle) {
            rafIdle = false;
            systemTicker(true);
            requestAnimationFrame(raf);
          }
        };
        const raf = (time) => {
          if (rafIdle) {
            systemTicker(false);
            return;
          }
          if (hidden) {
            syncHideChip();
          } else if (SLEEP.state !== "asleep") {
            try {
              place();
              placeErrorWarned = false;
            } catch (error) {
              if (!placeErrorWarned) {
                placeErrorWarned = true;
                console.warn("캐릭터 배치 실패:", error);
              }
            }
          }
          if (renderOn) app.ticker.update(time);
          if (!PET && pageHiddenNow()) {
            rafIdle = true;
            systemTicker(false);
            return;
          }
          if (rafIdle) {
            systemTicker(false);
            return;
          }
          if (PET ? !petPower : link.open) {
            rafIdle = true;
            systemTicker(false);
            return;
          }
          requestAnimationFrame(raf);
        };
        requestAnimationFrame(raf);
        let bubbleTimer;
        let lastSayAt = 0;
        let lastSayText = "";
        const hideBubble = (delay) => {
          bubbleTimer = setTimeout(() => {
            if (voiceState?.speaking === true) {
              hideBubble(250);
              return;
            }
            bubble.classList.remove("show");
          }, delay);
        };
        const say = (text, ms = 3500, mutter = false, kind) => {
          relay("say", [text, ms, mutter, kind]);
          bubble.textContent = text;
          bubble.classList.add("show");
          lastSayText = text;
          bubble.classList.toggle("mutter", mutter);
          lastSayAt = performance.now();
          startTalk(text, ms || 3e3, mutter);
          clearTimeout(bubbleTimer);
          if (ms) hideBubble(ms);
          kind = kind || (mutter ? "mutter" : "other");
          try {
            window.dispatchEvent(new CustomEvent("dsc:say", { detail: { text, ms, kind } }));
          } catch {
          }
        };
        const hush = () => {
          relay("hush", []);
          clearTimeout(bubbleTimer);
          bubble.classList.remove("show");
        };
        let hideChip = null;
        const showHideChip = () => {
          if (hideChip || !hideChipVisible()) return;
          hideChip = life.own(document.createElement("button"), (node) => node.remove());
          hideChip.type = "button";
          hideChip.id = "dsc-hide-chip";
          hideChip.textContent = "캐릭터 숨김 · 다시 표시";
          hideChip.addEventListener("click", () => setHidden(false));
          document.body.append(hideChip);
        };
        const clearHideChip = () => {
          if (hideChip) {
            hideChip.remove();
            hideChip = null;
          }
        };
        const syncHideChip = () => {
          if (hideChipVisible()) showHideChip();
          else clearHideChip();
        };
        const hideForPage = () => {
          pageHiddenApplied = true;
          canvas.style.display = bubble.style.display = "none";
          veil.style.opacity = "0";
          veil.style.pointerEvents = "none";
          setRender(false);
          clearHideChip();
          lastPlaceKey = "";
          systemTicker(false);
        };
        const restoreFromPage = () => {
          if (PET) return;
          const applied = pageHiddenApplied;
          pageHiddenApplied = false;
          if (!applied) {
            syncHideChip();
            return;
          }
          veil.style.opacity = "";
          veil.style.pointerEvents = "";
          systemTicker(true);
          if (!hidden && SLEEP.state !== "asleep") {
            canvas.style.display = bubble.style.display = "";
            lastPlaceKey = "";
            wakeRaf();
            try {
              place();
            } catch (error) {
              console.warn("캐릭터 배치 실패:", error);
            }
          } else {
            canvas.style.display = bubble.style.display = "none";
            setRender(false);
            wakeRaf();
          }
          syncHideChip();
        };
        const syncPageHidden = () => {
          if (PET) return;
          if (pageHiddenNow()) hideForPage();
          else restoreFromPage();
        };
        if (!PET) hooks.syncPageHidden = syncPageHidden;
        if (pageHiddenNow()) hideForPage();
        const setHidden = (next) => {
          if (PET || hidden === next) return hidden;
          hidden = next;
          if (hidden) {
            drag.pending = null;
            drag.on = false;
            strokeFrom = null;
            chestFrom = null;
            hush();
            canvas.style.display = bubble.style.display = "none";
            veil.style.display = "none";
            document.documentElement.classList.remove("dsc-hover", "dsc-grabbing");
            setRender(false);
            if (link.open || link.follow) {
              link.opening = 0;
              try {
                link.post("hide");
              } catch {
              }
            }
            showHideChip();
          } else {
            clearHideChip();
            veil.style.display = "";
            bubble.style.display = "";
            canvas.style.display = "";
            lastPlaceKey = "";
            if (SLEEP.state === "asleep" || SLEEP.state === "leaving") {
              clearTimeout(sleepTimer);
              sleepTimer = 0;
              cancelSleepSlide?.();
              cancelSleepSlide = null;
              SLEEP.state = "active";
              fleeX = 0;
              SLEEP.lastActive = performance.now();
            }
            setRender(true);
            if (link.open || link.follow) {
              link.open = false;
              link.follow = null;
              link.opening = 0;
              try {
                link.post("hide");
              } catch {
              }
            }
            wakeRaf();
            place();
            requestAnimationFrame(() => {
              if (!hidden && !link.open && !link.follow && canvas.style.display === "none") lastPlaceKey = "";
            });
            setTimeout(() => {
              if (!hidden && !link.open && !link.follow) {
                lastPlaceKey = "";
                place();
              }
            }, 350);
          }
          return hidden;
        };
        if (!PET) {
          hooks.toggleCanvas = () => setHidden(!hidden);
          hooks.canvasHidden = () => hidden;
        }
        let mx = innerWidth / 2, my = innerHeight / 2, lastMove = 0;
        addEventListener("mousemove", (e) => {
          mx = e.clientX;
          my = e.clientY;
          lastMove = performance.now();
        }, { passive: true });
        const hx = S(), hy = S(), ex = S(), ey = S();
        const bob = S();
        const bobKick = (v) => {
          bob.v += v;
        };
        let energy = 0.6;
        const attn = { x: 0, y: 0.05, next: 0 };
        const pickAttention = (now, talking) => {
          let p;
          const r = Math.random();
          if (talking) p = r < 0.85 ? [0, 0.05] : [-0.5, 0.1];
          else if (mood === "work") p = r < 0.55 ? [-0.75, 0.12] : r < 0.75 ? [-0.55, -0.3] : r < 0.9 ? [0, 0.05] : [0.35, 0.3];
          else if (mood === "wait") p = r < 0.7 ? [0, 0.05] : [-0.7, 0.05];
          else if (mood === "sad") p = r < 0.6 ? [0.1, -0.45] : [-0.3, -0.3];
          else p = r < 0.4 ? [0, 0.05] : r < 0.6 ? [-0.7, 0.1] : [(Math.random() - 0.5) * 1.2, (Math.random() - 0.4) * 0.7];
          attn.x = p[0] + (Math.random() - 0.5) * 0.12;
          attn.y = p[1] + (Math.random() - 0.5) * 0.1;
          attn.next = now + (talking ? 2500 : mood === "work" ? 1200 : 1500) + Math.random() * 3e3;
          if (Math.random() < 0.35) blink.next = Math.min(blink.next, now + 60);
          if (Math.random() < 0.3) browKick = Math.max(browKick, 0.25);
        };
        let talk = null;
        const startTalk = (text, ms, quiet) => {
          const { syl, total } = parseSyllables(text, ms);
          talk = { syl, t0: performance.now(), total, quiet };
        };
        const VOW = ["A", "I", "U", "E", "O"];
        const VOW_EYE_SAFE = { I: 0.45, E: 0.45 };
        const vowel = { A: 0, I: 0, U: 0, E: 0, O: 0 };
        let mouthOpen = 0, talkSway = 0, browKick = 0, browVal = 0, nodKick = 0, lastStressIdx = -1;
        let voiceState = null;
        const look = { x: 0, y: 0 };
        const pose1 = { lean: 0, headZ: 0, headY: 0, bodyY: 0 };
        const gestS = {};
        const GEST_K = {
          yaw: [90, 19],
          pitch: [90, 19],
          roll: [90, 19],
          // 고개: 약 0.42초에 안정
          bodyX: [55, 14.8],
          bodyY: [55, 14.8],
          bodyZ: [55, 14.8],
          lean: [48, 13.8],
          // 몸통: 약 0.5~0.6초
          smile: [40, 12.6],
          eyeSmile: [40, 12.6],
          eyeClose: [40, 12.6],
          mouth: [40, 12.6]
          // 팔·표정: 약 0.65초
        };
        for (const ch in GEST_K) gestS[ch] = { x: 0, v: 0 };
        let blink = { next: performance.now() + 2e3, start: -1e9, double: false }, lastT = performance.now();
        const updateChestDrag = (now, dt) => {
          spring(dragLift, chestDragging ? chestTarget : 0, dt, chestDragging ? 820 : 200, chestDragging ? 40 : 6);
          spring(dragShift, chestDragging ? chestShiftTarget : 0, dt, chestDragging ? 700 : 220, chestDragging ? 42 : 7);
          if (!chestDragging && Math.abs(dragShift.x) < 1e-4 && Math.abs(dragShift.v) < 1e-3) dragShift.x = dragShift.v = 0;
          if (!chestDragging && Math.abs(dragLift.x) < 1e-4 && Math.abs(dragLift.v) < 1e-3) dragLift.x = dragLift.v = 0;
          if (chestDragging) {
            flashExp("squint", 400);
            flashExp("blush", 400);
            walk.lastTouch = now;
          }
        };
        const frameContext = (now, dt) => {
          const introCalm = intro.phase !== "done";
          const T = now / 1e3;
          if (voiceState && voiceState.until && now > voiceState.until) voiceState = null;
          const talking = voiceState?.speaking === true || bubble.classList.contains("show") && fleeX === 0;
          const muttering = talking && bubble.classList.contains("mutter");
          if (moodUntil && now > moodUntil) {
            mood = "idle";
            moodUntil = 0;
          }
          const laughing = gest.name === "laugh";
          return { now, dt, T, introCalm, talking, muttering, laughing };
        };
        const updateEnergy = ({ dt, talking, muttering, laughing }) => {
          const eTarget = (mood === "sad" ? 0.35 : mood === "wait" ? 0.55 : mood === "work" ? 0.75 : 0.6) + (talking && !muttering ? 0.35 : 0) + (laughing ? 0.5 : 0);
          energy += (eTarget - energy) * Math.min(1, dt * 1.5);
        };
        const updateGaze = ({ now, dt, introCalm, talking, muttering }) => {
          let tx, ty;
          if (now < stareUntil) {
            tx = 0;
            ty = 0.05;
          } else if (muttering) {
            tx = 0.4;
            ty = 0.38;
          } else if (talking && introCalm) {
            tx = attn.x * 0.25;
            ty = 0.05 + attn.y * 0.2;
          } else if (now - lastMove < 2500 && !talking) {
            const r = canvas.getBoundingClientRect();
            tx = clamp((mx - (r.left + r.width / 2)) / 600, -1, 1);
            ty = clamp((r.top + r.height * 0.25 - my) / 500, -1, 1);
          } else {
            if (now > attn.next || !introCalm && talking && Math.abs(attn.x) > 0.3 && Math.random() < dt * 2) pickAttention(now, talking);
            tx = attn.x;
            ty = attn.y;
          }
          const eyeK = introCalm ? 420 : 900, eyeD = introCalm ? 42 : 55;
          spring(ex, tx, dt, eyeK, eyeD);
          spring(ey, ty, dt, eyeK, eyeD);
          spring(hx, tx * 0.85, dt, 38, 9.5);
          spring(hy, ty * 0.8, dt, 38, 9.5);
          look.x = hx.x;
          look.y = hy.x;
        };
        const updateSpeech = ({ now, dt, introCalm }) => {
          let open = 0;
          for (const k of VOW) vowel[k] *= Math.max(0, 1 - dt * 14);
          if (talk) {
            let t = (now - talk.t0) / 1e3;
            if (t >= talk.total) talk = null;
            else {
              let i = 0;
              while (i < talk.syl.length && t > talk.syl[i].d) {
                t -= talk.syl[i].d;
                i++;
              }
              const s2 = talk.syl[i];
              if (s2 && s2.v) {
                const p = t / s2.d, env = Math.pow(Math.sin(Math.PI * Math.min(1, p)), 0.7);
                open = env * s2.amp * (talk.quiet ? 0.3 : 1);
                vowel[s2.v] = Math.max(vowel[s2.v], open);
                if (s2.stress && i !== lastStressIdx) {
                  lastStressIdx = i;
                  if (!talk.quiet) {
                    if (!introCalm) browKick = Math.max(browKick, 0.35 + Math.random() * 0.35);
                    else if (Math.random() < 0.35) browKick = Math.max(browKick, 0.2 + Math.random() * 0.15);
                    if (Math.random() < 0.45) nodKick = Math.max(nodKick, 0.6 + Math.random() * 0.5);
                  }
                }
              }
            }
          }
          if (voiceState?.speaking) {
            open = clamp(voiceState.level, 0, 1) * 0.9;
            if (voiceState.vowels) for (const k of VOW) vowel[k] = Math.max(vowel[k] * 0.4, clamp(voiceState.vowels[k] || 0, 0, 1));
          }
          mouthOpen += (open - mouthOpen) * Math.min(1, dt * 16);
          browKick *= Math.max(0, 1 - dt * (introCalm ? 2 : 3.5));
          browVal = introCalm ? browVal + (browKick - browVal) * Math.min(1, dt * 5) : browKick;
          nodKick *= Math.max(0, 1 - dt * 5);
        };
        const updateMoodPose = (dt) => {
          const goal = { lean: 0, headZ: 0, headY: 0, bodyY: 0 };
          if (mood === "work") {
            goal.lean = -7;
            goal.headY = -5;
          }
          if (mood === "wait") {
            goal.lean = -9;
            goal.headZ = 8;
            goal.headY = 3;
          }
          if (mood === "sad") {
            goal.headY = -10;
            goal.bodyY = -5;
          }
          const pk = Math.min(1, dt * 2.2);
          for (const key in goal) {
            pose1[key] += (goal[key] - pose1[key]) * pk;
            pose[key] += (pose1[key] - pose[key]) * pk;
          }
        };
        const baseMotion = ({ now, dt, T, talking, muttering }) => {
          const m = { yaw: hx.x * 22 + noise(T * 0.33, 1) * 6 * energy };
          m.pitch = hy.x * 13 + noise(T * 0.41, 2) * 4.5 * energy + pose.headY - nodKick * 4 - mouthOpen * 1.5;
          m.roll = noise(T * 0.27, 3) * 7.5 * energy - hx.x * hy.x * 7 + pose.headZ;
          stareW += ((now < stareUntil ? 1 : 0) - stareW) * Math.min(1, dt * 6);
          talkSway += ((talking && !muttering && now >= stareUntil ? 1 : 0) - talkSway) * Math.min(1, dt * 2.5);
          m.swayYaw = Math.sin(T * Math.PI * 2 * 0.31 + 1.3) * 4.5 * talkSway;
          m.swayPitch = Math.sin(T * Math.PI * 2 * 0.47 + 0.6) * 1.5 * talkSway;
          if (talkSway > 0.01) {
            m.roll += Math.sin(T * Math.PI * 2 * 0.55) * 4 * talkSway;
            m.yaw += m.swayYaw;
            m.pitch += m.swayPitch;
          }
          m.bodyX = hx.x * 8 + noise(T * 0.17, 4) * 5 * energy;
          m.bodyZ = m.roll * 0.5 + noise(T * 0.21, 5) * 3 * energy;
          spring(bob, 0, dt, 70, 6);
          m.bodyY = pose.bodyY + Math.sin(T * 2 * Math.PI / 3.6) * 1.8 + clamp(bob.x, -14, 14);
          m.lean = pose.lean;
          m.smile = 0;
          m.eyeSmileAdd = 0;
          m.eyeClose = 0;
          m.mouthAdd = 0;
          if (mood === "work") m.bodyZ += Math.sin(T * 2.1) * 1.2;
          return m;
        };
        const applyGesture = (m, { now, dt }) => {
          const GO = { yaw: 0, pitch: 0, roll: 0, bodyX: 0, bodyY: 0, bodyZ: 0, lean: 0, smile: 0, eyeSmile: 0, eyeClose: 0, mouth: 0 };
          if (gest.name) {
            const p = (now - gest.start) / gest.dur;
            if (p >= 1) {
              gest.name = null;
              nextIdleGesture = Math.max(nextIdleGesture, now + 2500 + Math.random() * 3500);
            } else addGesture(GO, gest.name, p, gest.dir);
          }
          for (const ch in GO) {
            const gk = GEST_K[ch];
            spring(gestS[ch], GO[ch], dt, gk[0], gk[1]);
          }
          m.yaw += gestS.yaw.x;
          m.pitch += gestS.pitch.x;
          m.roll += gestS.roll.x;
          m.bodyX += gestS.bodyX.x;
          m.bodyY += gestS.bodyY.x;
          m.bodyZ += gestS.bodyZ.x;
          m.lean += gestS.lean.x;
          m.smile += gestS.smile.x;
          m.eyeSmileAdd += gestS.eyeSmile.x;
          m.eyeClose += gestS.eyeClose.x;
          m.mouthAdd += gestS.mouth.x;
          if (!gest.name && mood === "idle" && now > nextIdleGesture && now >= sulkUntil) {
            const r = Math.random();
            const pick = r < 0.3 ? "tilt" : r < 0.5 ? "sway" : r < 0.72 ? "lean" : r < 0.88 ? "nod" : "laugh";
            play(pick, pick === "lean" ? 2600 : pick === "sway" ? 2300 : pick === "laugh" ? 1500 : 1800);
            nextIdleGesture = now + 7e3 + Math.random() * 9e3;
          }
        };
        const applyTouchAndShiver = (m, { now, dt }) => {
          touchLean += ((now < touchLeanUntil ? -30 : 0) - touchLean) * Math.min(1, dt * 4);
          m.lean += touchLean;
          const se = (now - shiverStarted) / 1e3;
          if (se >= 0 && se < 5) {
            const tr = Math.sin(se * Math.PI * 2 * 8) * Math.min(1, se / 0.2) * Math.pow(1 - se / 5, 1.5);
            m.bodyZ -= tr * 3;
            m.roll += tr * 2;
            if (now > shiverBobAt) {
              bobKick((shiverBobSign = -shiverBobSign) * 40 * Math.pow(1 - se / 5, 1.5));
              shiverBobAt = now + 170 + Math.random() * 90;
            }
          }
        };
        const applyWalk = (m, { now, dt, T }) => {
          if (fleeX !== 0 && !walk.phase) m.bodyZ += Math.sin(T * 16) * 8;
          const faceTo = walk.phase === "out" ? walk.dir : walk.phase === "in" ? -walk.dir : 0;
          walk.face += (faceTo - walk.face) * Math.min(1, dt * 5);
          const wa = Math.abs(walk.face);
          if (wa > 0.01) {
            const ph = T * Math.PI * 2 * 1.8, wf = walk.face;
            m.yaw = m.yaw * (1 - wa) + 22 * wf;
            m.pitch -= 2 * wa;
            m.roll += Math.sin(ph) * 2.5 * wa;
            m.bodyX += 6 * wf;
            m.bodyY += Math.abs(Math.sin(ph)) * 6 * wa;
            m.bodyZ += Math.sin(ph) * 4 * wa;
          }
          if (walkCheck) walkCheck(now);
        };
        const applyCarry = (m, { now, dt }) => {
          const lastSample = drag.samples.length ? drag.samples[drag.samples.length - 1][0] : 0;
          if (!drag.on || now - lastSample > 60) {
            const f = Math.max(0, 1 - dt * 5);
            carry.vx *= f;
            carry.vy *= f;
          }
          const cvx = clamp(carry.vx / 1600, -1, 1), cvy = clamp(carry.vy / 1600, -1, 1);
          if (Math.abs(cvx) + Math.abs(cvy) > 2e-3) {
            m.bodyX -= cvx * 16;
            m.bodyZ -= cvx * 14;
            m.roll -= cvx * 12;
            m.yaw += cvx * 8;
            m.bodyY -= cvy * 12;
            m.pitch += cvy * 10;
          }
        };
        const applySulk = (m, { now, dt }) => {
          const sk = now < sulkUntil ? Math.min(sstep((now - sulkStart) / 350), sstep((sulkUntil - now) / 1200)) : 0;
          let peek = 0;
          if (sk > 0) {
            const ts = now - sulkStart;
            for (const p of sulkPeeks) {
              const u = ts - p.at;
              if (u < 0 || u > PEEK_RISE + PEEK_HOLD + PEEK_SNAP) continue;
              if (u >= PEEK_RISE + PEEK_HOLD && !p.done) {
                p.done = true;
                if (p.flip) sulkDir = -sulkDir;
              }
              peek = u < PEEK_RISE ? sstep(u / PEEK_RISE) : u < PEEK_RISE + PEEK_HOLD ? 1 : 1 - sstep((u - PEEK_RISE - PEEK_HOLD) / PEEK_SNAP);
            }
            const away = 1 - 0.75 * peek, k = Math.min(1, dt * 14);
            sulkYaw += (-24 * sulkDir * away - sulkYaw) * k;
            sulkRoll += (-8 * sulkDir * away - sulkRoll) * k;
            m.yaw = m.yaw * (1 - sk) + sulkYaw * sk;
            m.roll = m.roll * (1 - sk) + sulkRoll * sk;
            m.pitch = m.pitch * (1 - sk) + SULK_CHIN * (1 - 0.6 * peek) * sk;
            m.bodyX = m.bodyX * (1 - sk) + sulkYaw / 6 * sk;
            m.smile *= 1 - sk;
            m.eyeSmileAdd *= 1 - sk;
          }
          const sulkEye = sulkDir * (-0.45 + 0.85 * Math.min(1, peek * 1.8));
          return { sk, peek, sulkEye };
        };
        const writeHeadBody = (m) => {
          if (stareW > 0.01) {
            const k = 1 - stareW * 0.92;
            m.yaw = hx.x * 22 * (1 - stareW) + (m.yaw - hx.x * 22) * k;
            m.pitch *= k;
            m.roll *= k;
            m.bodyX *= k;
            m.bodyZ *= k;
          }
          m.yaw = clamp(m.yaw, -30, 30);
          m.pitch = clamp(m.pitch, -30, 30);
          m.roll = clamp(m.roll, -30, 30);
          for (const [id, v] of [
            ["AngleX", m.yaw],
            ["AngleY", m.pitch],
            ["AngleZ", m.roll],
            ["ParamAngleX", m.yaw],
            ["ParamAngleY", m.pitch],
            ["ParamAngleZ", m.roll],
            ["PositionX", clamp(m.bodyX, -30, 30)],
            ["PositionY", clamp(m.bodyY, -30, 30)],
            ["PositionZ", clamp(m.bodyZ, -30, 30)],
            ["LeanInput", clamp(m.lean, -30, 30)]
          ]) core.addParameterValueById(id, v);
        };
        const writeEyes = (m, { T }, { sk, sulkEye }) => {
          core.addParameterValueById("ParamEyeBallX", clamp(((ex.x - hx.x) * 0.9 + hx.x * 0.2) * 0.6, -0.45, 0.45) * (1 - sk) + sulkEye * sk - m.swayYaw / 30 * (1 - sk));
          core.addParameterValueById("ParamEyeBallY", clamp(((ey.x - hy.x) * 0.9 + hy.x * 0.2) * 0.6 - m.swayPitch / 30, -0.3, 0.3));
          core.setParameterValueById("ParamBreath", 0.5 + 0.5 * Math.sin(T * 2 * Math.PI / 3.6));
        };
        const writeBrows = ({ T }) => {
          const brow = browVal + noise(T * 0.5, 7) * 0.12 + (mood === "wait" ? 0.25 : mood === "sad" ? -0.3 : 0) - 0.15 * happyMouth;
          if (happyMouth > 0.01) core.addParameterValueById("BrowInnerUp", 0.55 * happyMouth);
          core.addParameterValueById("ParamBrowLY", clamp(brow, -1, 1));
          core.addParameterValueById("ParamBrowRY", clamp(brow + noise(T * 0.6, 8) * 0.06, -1, 1));
          if (browVal > 0.15) core.addParameterValueById("BrowInnerUp", Math.min(1, browVal * 0.6));
        };
        const writeMouth = (m, { now, dt, T }, { sk, peek }) => {
          const openNow = clamp(mouthOpen + m.mouthAdd + 0.14 * happyMouth, 0, 1);
          if (openNow > 0.01) {
            core.setParameterValueById("ParamMouthOpenY", openNow * 0.9);
            core.addParameterValueById("JawOpen", openNow * 0.45);
            core.setParameterValueById("ParamSilence", 1 - openNow);
            for (const k of VOW) if (vowel[k] > 0.01) core.addParameterValueById("Param" + k, Math.min(1, vowel[k]) * (VOW_EYE_SAFE[k] || 1));
            if (m.mouthAdd > 0.01) core.addParameterValueById("ParamA", m.mouthAdd * 0.8);
          }
          happyMouth += ((now < happyMouthUntil ? 1 : 0) - happyMouth) * Math.min(1, dt * 5);
          const baseSmile = (mood === "sad" ? 0 : mood === "wait" ? 0.15 : 0.35) * (1 - sk) + 0.2 * happyMouth;
          if (sk > 0.01) for (const [id, eased] of [["CheeckPuff", 0.5], ["Mouthpucker", 0.3], ["Angry", 0.5], ["Angry2", 0.5]]) core.addParameterValueById(id, sk * (1 - eased * peek));
          core.addParameterValueById("ParamMouthForm", clamp(baseSmile + m.smile * 0.4, -1, 1));
          core.addParameterValueById("MouthSmile_L", clamp(baseSmile + m.smile * 0.5 + 0.3 * happyMouth, 0, 1));
          core.addParameterValueById("MouthSmile_R", clamp(baseSmile + m.smile * 0.5 + noise(T * 0.3, 9) * 0.05, 0, 1));
          const eSmile = clamp((mood === "sad" ? 0 : 0.12) + m.smile * 0.35 + m.eyeSmileAdd, 0, 1);
          if (eSmile > 0.01) core.addParameterValueById("EyeSmile", eSmile);
        };
        const writeBlink = (m, { now, laughing }) => {
          if (now >= blink.next && !laughing) {
            blink.start = now;
            blink.next = blink.double ? now + 2e3 + Math.random() * 4e3 : Math.random() < 0.18 ? now + 260 : now + 2e3 + Math.random() * 4e3;
            blink.double = !blink.double && blink.next - now < 400;
          }
          const bt = (now - blink.start) / 1e3;
          const eyeOpen = clamp((mood === "work" ? 0.92 : 0.97) * (1 - blinkClose(bt)) * (1 - m.eyeClose), 0, 1.2);
          core.setParameterValueById("ParamEyeLOpen", eyeOpen);
          core.setParameterValueById("ParamEyeROpen", eyeOpen);
        };
        const writeExpressions = ({ now, dt }) => {
          for (const [name, params] of Object.entries(exp)) {
            const target = hold[name] || (until[name] || 0) > now ? 1 : 0;
            const EYE_SWAP = name === "heart" || name === "squint" || name === "smug" || name === "dizzy";
            if (EYE_SWAP && weight[name] > 0.5 !== target > 0.5) {
              blink.start = now - 0.07 * 1e3;
              blink.next = Math.max(blink.next, now + 1500);
            }
            const w = weight[name] = EYE_SWAP ? target : (weight[name] || 0) + (target - (weight[name] || 0)) * Math.min(1, dt * 6);
            if (w < 0.01) continue;
            for (const p of params) {
              if (p.Blend === "Multiply") core.multiplyParameterValueById(p.Id, p.Value, w);
              else if (p.Blend === "Add") core.addParameterValueById(p.Id, p.Value, w);
              else core.setParameterValueById(p.Id, p.Value, w);
            }
          }
        };
        const writeCoverChest = ({ now, dt, T }) => {
          const leaning = now < touchLeanUntil || touchLean < -2;
          const want = now >= cover.start && now < cover.until && bodyW < 0.5 && fleeX === 0 && !leaning;
          const q0 = cover.q;
          cover.q = clamp(cover.q + (want ? 1 : -1) * dt / 0.38, 0, 1);
          if (cover.q > 0) {
            const q = cover.q;
            const fore = coverForearm(q);
            const breath = Math.sin(T * Math.PI * 2 * 0.4) * 0.02 * sstep(seg(0.8, 1, q));
            const vel = (cover.q - q0) / Math.max(dt, 1e-3);
            core.setParameterValueById("Movement2", 1);
            core.addParameterValueById("Param62", 0.034 * sstep(q));
            core.addParameterValueById("Param59", 0.48 * sstep(seg(0, 0.6, q)));
            core.addParameterValueById("Param60", fore + breath);
            core.addParameterValueById("Param61", clamp(vel * 0.06, -0.2, 0.2) * Math.sin(Math.PI * q));
          }
        };
        const writeOutfitParams = (of, dt) => {
          for (const [key, id, v] of OUTFIT_PARAMS) {
            const w = outfitW[key] = (outfitW[key] || 0) + ((of[key] ? 1 : 0) - (outfitW[key] || 0)) * Math.min(1, dt * 6);
            if (w > 5e-3) core.addParameterValueById(id, v * w);
          }
        };
        const writeEarHide = (of, dt) => {
          const earWas = earW;
          earW = earOpacityStep(earW, of.earHide === true, dt);
          if (earPartIndex >= 0) {
            if (earW > 5e-3) applyEarOpacity(cm.parts, earPartIndex, earW);
            else if (earWas > 5e-3) cm.parts.opacities[earPartIndex] = 1;
          }
        };
        const writeBodyShape = (of, now, dt) => {
          const walkingBody = walk.phase === "out" || walk.phase === "away" || walk.phase === "in" || SLEEP.state === "leaving" || SLEEP.state === "waking";
          basinW += ((now < basinUntil ? 1 : 0) - basinW) * Math.min(1, dt * 4);
          if (basinW > 5e-3) core.addParameterValueById("key10", basinW);
          bodyW += ((walkingBody ? 1 : BODY_VALUE[of.bodyType] || 0) - bodyW) * Math.min(1, dt * 4);
          if (bodyW > 2e-3) core.addParameterValueById("Clothes2", bodyW);
          model.y = baseY + chibiDrop * clamp(bodyW, 0, 1);
        };
        const talkOutfitChange = (of) => {
          if (outfitPrev && outfitTalk) {
            for (const [key] of OUTFIT_PARAMS) if (of[key] && !outfitPrev[key]) outfitTalk(OUTFIT_LINE[key]);
            if ((of.bodyType || "default") !== (outfitPrev.bodyType || "default")) outfitTalk("body_" + (of.bodyType || "default"));
          }
          outfitPrev = { ...of };
        };
        const writeOutfit = ({ now, dt }) => {
          const of = prefs.outfit || {};
          writeOutfitParams(of, dt);
          writeEarHide(of, dt);
          writeBodyShape(of, now, dt);
          talkOutfitChange(of);
        };
        im.motionManager.expressionManager = {
          destroy() {
          },
          update() {
            const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1e3);
            lastT = now;
            updateChestDrag(now, dt);
            const f = frameContext(now, dt);
            updateEnergy(f);
            updateGaze(f);
            updateSpeech(f);
            updateMoodPose(dt);
            const m = baseMotion(f);
            applyGesture(m, f);
            applyTouchAndShiver(m, f);
            applyWalk(m, f);
            applyCarry(m, f);
            const sulk2 = applySulk(m, f);
            writeHeadBody(m);
            writeEyes(m, f, sulk2);
            writeBrows(f);
            writeMouth(m, f, sulk2);
            writeBlink(m, f);
            writeExpressions(f);
            writeCoverChest(f);
            writeOutfit(f);
          }
        };
        const LINES = {
          head: [
            "[어두운, 얄미운] …거긴, 그렇게 쓰다듬지 마세요. 버릇 들면 어쩌려고요.",
            "[어두운, 얄미운] …주인님, 그 손… 계속 두실 생각이세요?",
            "[어두운, 얄미운] …한 번만 봐드리는 거예요.",
            "[어두운, 얄미운] …머리카락 엉키면, 내일 아침에 빗겨 주셔야 해요.",
            "[어두운, 얄미운] …손 놓으세요. 그렇게 보시면… 저도 참아야 하잖아요.",
            "[어두운, 얄미운] …이번엔 그냥 넘어갈게요. 착한 척은 여기까지예요."
          ],
          head_sulk: [
            "[홍조] 흥! 그럼 오늘은 안아 드리지 않을 거예요!",
            "[홍조] 흥, 나중에 후회하실 거예요…!",
            "[홍조] …만질 거면, 아예 달래 주시던가요.",
            "[홍조] 흥! 등 돌리고 있을 거예요. …곁에 있으면 안 되지만.",
            "[홍조] …한 번만 더 그러시면, 진짜 삐질 거예요."
          ],
          head_after: [
            "[홍조] …이번만 봐주는 거예요. 다음엔… 각오하세요.",
            "[홍조] …다음엔 진짜, 책임지셔야 해요.",
            "[홍조] 후… 이제 됐어요. …손은 아직 놓지 마시고요.",
            "[홍조] …이번 일은 비밀로 해 드릴게요. 대신, 나중에.",
            "[홍조] …주인님 나쁜 손. 오늘은 그렇게 기억해 둘게요."
          ],
          // 소품·옷·체형을 바꿨을 때 (데스크톱 펫 대사.md와 같은 대사)
          outfit_glasses: [
            "안경 쓴 비서… 오늘 밤은 엄격하게 굴어 드릴까요, 주인님?",
            "이런 지적인 얼굴… 마음에 드세요? 렌즈 너머로 다 보여요♪",
            "주인님 취향이… 이런 쪽이었나요? 메모해 둘게요♪",
            "안경 쓴 채로 보는 얼굴… 꽤 위험한데요. 감당하시겠어요?",
            "선생님, 숙제 다 했어요. …칭찬은 어떻게 해 주실 거예요?"
          ],
          outfit_shoes: [
            "주인님 앞에서 신발까지 벗다니… 이제 도망칠 데도 없네요",
            "[홍조] 앗… 맨발을 그렇게 보시면… 발끝이 저려요…",
            "바닥이 차가워요… 안아 올려 주실 거죠?",
            "[얄미운] 발끝만 보시는 거예요? …조금 서운한데요."
          ],
          outfit_tail: [
            "꼬리 숨기니… 기분을 들키지 않겠네요♪ …입꼬리는 못 숨기지만요",
            "쉿, 이건 주인님만 아는 거예요~",
            "[얄미운] 꼬리로 감으면… 붙잡히지 않을 자신 있는데요?",
            "꼬리 끝까지 다 보이니까… 이제 숨기는 건 없네요."
          ],
          outfit_clothes: [
            "[홍조] 앗… 이 옷, 생각보다 몸에 붙어서… 시선이 어디 가는지 아시죠?",
            "에헤헤, 좋다면… 조금 더 가까이 가도 돼요…",
            "[><, 홍조] 주, 주인님… 눈이 너무 노골적이세요…!",
            "[하트] 이 정도면… 만족하실 수 있어요? 아니면… 더?",
            "[홍조] 움직일 때마다… 느껴져서, 조금 곤란해요…",
            "[얄미운] 굳이 안 벗어도 괜찮죠. …필요하시면 말씀하시고요♪"
          ],
          body_default: [
            "익숙한 몸으로 돌아왔네요… 이게 제일 좋으시죠? 다 보이는데요",
            "원래 모습으로 복귀 완료! …다시 유혹해 볼까요♪",
            "역시 익숙한 게 좋으세요? …손이 먼저 움직이시네요.",
            "이 모습이 가장 편하다고… 그렇게 말씀하셨죠? 잘 기억해요."
          ],
          body_type1: [
            "어라… 몸매가 달라 보이지 않나요, 주인님? …어디가요?",
            "평소보다 색다른 느낌인데… 직접 확인하실 거예요?",
            "이 몸엔… 주인님 시선이 더 붙는 것 같네요. 기분 탓인가요?",
            "[얄미운] 어느 쪽이 마음에 드세요? …정직하게 말해 주세요."
          ],
          body_type2: [
            "앗, 작아졌어요! …안아 주시면 커질지도 몰라요♪",
            "[하트] 꼬마 모습이 됐어요… 무릎에 앉혀 주세요~",
            "작아도… 할 일은 다 할 수 있어요. 믿어 주세요♪",
            "[하트] 이 모습, 귀여우세요? …아니면 다른 게 좋으세요?",
            "작은 손으로도… 주인님 옷자락은 잘 잡아요."
          ],
          basin_on: [
            "[하트] 밥 먹을 시간이에요? …입 벌려 주세요♪",
            "[얄미운] 세숫대야 쓴 채로 먹는 거… 생각보다 불편해요.",
            "잘 먹을게요. …다 먹으면 칭찬해 주세요."
          ],
          pot_guard: [
            "[얄미운] 후훗, 이 정도는… 주인님 손길보다 약해요~",
            "[얄미운] 후훗, 제가 막을 줄 몰랐죠? 칭찬해 주세요♪",
            "[하트] 방어 성공이에요! 이번 판은 제 승리네요.",
            "[얄미운] 냄비보다 가벼운 손길이었어요. 아쉽네요♪",
            "[하트] 막았으니까… 이제 쓰다듬어 주실 차례죠?"
          ],
          pot_hit: [
            "[눈물] 아야야…! 머리 아파요…",
            "[눈물] 으앗! 별이 보여요…",
            "[눈물] …방금 그거 냄비였죠?!",
            "[눈물] 이마가… 좀 부풀었죠? 나중에 불어 주세요…",
            "[눈물] 아파서 그래요… 잠깐만 안아 주세요. 진짜로."
          ],
          walk_out: [
            "산책 좀 다녀올게요~ …따라오시면 안 돼요♪",
            "잠깐 바람 쐬고 올게요! 몸 좀 풀고요",
            "다리 좀 풀고 올게요~ 금방 올게요",
            "혼자 걷는 게 좋아요. …돌아올 땐 옆에 있어 주세요.",
            "바람이 좋아서요. 이 기분, 같이 나누고 싶네요."
          ],
          walk_back: [
            "다녀왔어요! …기다리셨죠? 얼굴에 쓰여 있어요♪",
            "산책 끝! 그새 보고 싶으셨어요?",
            "[하트] 다녀왔어요~ 안아 주세요.",
            "금방 다녀왔는데… 왜 벌써 반가운 거예요.",
            "[홍조] 발이 차가워졌어요… 손 좀 잡아 주시겠어요?"
          ],
          body: [
            "[하트] 불렀어요? …손, 잡아 주세요.",
            "[홍조] 왜요… 그렇게 빤히 보시면 더 부끄러운데.",
            "[얄미운] 흐응~? 만지고 싶으신 거죠?",
            "[식은땀] 앗, 깜짝이야! …놀라면 심장에 안 좋아요.",
            "[하트, 홍조] 오늘도 화이팅이에요! …조금 가까이 있어도 돼요?",
            "[얄미운] 그렇게 부르시면… 거절할 수 없잖아요.",
            "[홍조] 옆에 있으면 마음이 놓여요. …그러니까 계속 있어 주세요.",
            "[하트] 한 번 불러 주시면… 하루 종일 기분이 좋아요."
          ],
          arm: [
            "[홍조] 손 잡고 싶으신 거예요? …놓치면 안 돼요.",
            "[홍조] 팔은 왜요~? …팔찌라도 채워 주실 거예요?",
            "[얄미운] 그렇게 붙잡으면… 도망칠 맘도 없어지잖아요.",
            "손끝이 따뜻해요… 조금만 더 있어 주세요.",
            "[홍조] 팔에 힘이 들어오시는데… 저, 이러면 못 움직여요."
          ],
          leg: [
            "[식은땀, 홍조] 다, 다리는… 아직 안 돼요…!",
            "[식은땀, 홍조] 거기 만지면… 힘이 확 풀려요…!",
            "[홍조, ><] 으… 무릎은… 그렇게 안아 주시면 안 돼요…!",
            "[식은땀, 홍조] 서 있는 것도 벅차요… 놓아 주세요…",
            "[홍조, 하트] 거기, 감각이 예민하다니까요…"
          ],
          chest1: [
            "[홍조, 얄미운] 앗… 거긴… 그렇게 세게 하면 안 돼요.",
            "[홍조, 얄미운] 제 반응이 그렇게 궁금하세요…? 나쁜 주인님.",
            "[홍조, ><] 잠깐… 거기, 옷 위로도 다 느껴져요…",
            "[홍조, 얄미운] 손끝이… 너무 정확하신데요…?",
            "[홍조, 얄미운] 한 번은 봐드릴게요… 딱 한 번만이에요.",
            "[홍조, ><] 아… 그렇게 갑자기 만지시면… 숨이 멈춰요…",
            "[홍조, 얄미운] 앗…! 아직 마음의 준비도 안 했는데요…",
            "[홍조, ><] 손… 손이 너무 빨라요…!",
            "[홍조, 얄미운] 그렇게 놀라게 하시면… 반응이 다 보이잖아요.",
            "[홍조, ><] 잠깐… 여기, 사람 있는 데서는…",
            "[홍조, 하트] 지금… 일부러 그러신 거죠?",
            "[홍조, 얄미운] 옷 위로도 이렇게 느껴지는데… 어쩌죠?",
            "[홍조, ><] 앗… 그 손가락, 거기 두지 마세요…",
            "[홍조, 식은땀] 하… 갑자기 숨이 막혀서…",
            "[홍조, 얄미운] 주인님은… 이런 거 잘 아시네요.",
            "[홍조, 하트] 한 번만… 정말 한 번만이라고 했는데.",
            "[홍조, ><] 으… 이거, 웃으면서 넘길 일이 아니에요…",
            "[홍조, 얄미운] 거기, 손끝이 아직도 남아 있는데요…",
            "[홍조, 식은땀] 숨… 조금만 정리하게 해 주세요.",
            "[홍조, ><] 아… 아직 마음 준비가…",
            "[홍조, 하트] 그렇게 만지시면… 저, 나중에 못 참아요.",
            "[홍조, 얄미운] 한 번 더 하시면… 저도 방법을 생각해 볼게요.",
            "[홍조, ><] 앗, 거긴… 옷이 얇아서…",
            "[홍조, 식은땀] 잠깐만… 손 좀 내려 주세요… 아니, 그대로…",
            "[홍조, 하트] 지금 그 표정… 마음에 들어요.",
            "[홍조, 얄미운] …이번 건, 나중에 청구할 거예요."
          ],
          chest2: [
            "[하트, 홍조] 자꾸 그러면… 숨소리가 이상해지잖아요!",
            "[하트, 홍조] 으으… 장난치지 말아 주세요… 손에 힘이 없어져요…",
            "[하트, 홍조] 하아… 그렇게 만지작거리면… 저도 모르게 몸이…",
            "[홍조, 식은땀] 잠깐… 이거, 그만두실 생각 없으시죠…?",
            "[하트, 홍조] 주인님 손… 너무 따뜻해서 자꾸 기대게 돼요…",
            "[하트, ><] 으… 소리 내면 안 되는데… 참는 게 더 힘들어요…",
            "[하트, 홍조] 제가… 이상한 표정 짓고 있죠? 보지 마세요…",
            "[홍조, 식은땀] 손 떼 주세요… 이대로면 제가 먼저 무너져요…",
            "[하트, 홍조] 하아… 이제… 자꾸 손이 가잖아요…",
            "[하트, ><] 으… 숨소리, 주인님한테 다 들려요…",
            "[하트, 홍조] 잠깐만… 저, 지금 표정 관리가 안 돼요…",
            "[홍조, 식은땀] 하… 거기, 계속 만지면… 무릎 힘이…",
            "[하트, 홍조] 주인님 손, 왜 이렇게 따뜻해요…",
            "[하트, ><] 으으… 이러면 저, 아무 말도 못 해요…",
            "[하트, 홍조] 자꾸 그러시면… 제가 먼저 손을 잡을지도 몰라요.",
            "[홍조, 식은땀] 하아… 이거, 장난이 아니잖아요…",
            "[하트, 홍조] 소리… 소리 내면 안 되는데…",
            "[하트, ><] 잠깐… 살짝만… 천천히…",
            "[홍조, 하트] 저… 지금 얼굴, 보지 마세요…",
            "[하트, 홍조] 심장이 너무 뛰어서… 주인님 손에 다 느껴질 거예요.",
            "[하트, ><] 으… 옷자락 좀… 정리하게 해 주세요…",
            "[홍조, 식은땀] 하아… 이대로 있으면… 저, 이상해져요…",
            "[하트, 홍조] 주인님… 이거, 언제 멈추실 거예요…?",
            "[하트, ><] 아… 아직… 마음 준비 안 됐다니까요…",
            "[홍조, 하트] 손끝이 움직일 때마다… 저도 따라 움직여요…",
            "[하트, 식은땀] 잠깐… 숨 좀… 쉬게 해 주세요…",
            "[하트, 홍조] 이런 거… 익숙해지면 안 되는데…",
            "[홍조, ><] 주인님… 웃지 마세요… 지금 제가 우습죠…?"
          ],
          chest3: [
            "[하트, 홍조] 이제… 진짜 부끄러우니까 잠깐만요!",
            "[홍조, 식은땀] 더 하시면… 저, 가만히 못 있어요…!",
            "[하트, 눈물] 그만… 그만해 주세요… 심장이 터질 것 같아요…",
            "[하트, 홍조] 주인님… 이러다 정말… 되돌릴 수 없게 돼요…",
            "[홍조, ><] 으으… 이제 팔에 힘이 안 들어가요…",
            "[홍조, 식은땀] 이제… 정말 그만해 주세요…!",
            "[하트, 눈물] 으으… 저, 이제 한계예요…",
            "[홍조, ><] 더 하시면… 쓰러질지도 몰라요…",
            "[하트, 식은땀] 잠깐… 잠깐만… 숨이…",
            "[홍조, 눈물] 주인님… 이러다 진짜…!",
            "[하트, ><] 으아… 이제 팔에 힘이…",
            "[홍조, 식은땀] 그만… 부탁이에요… 이러다간…",
            "[하트, 눈물] 저… 눈물 날 것 같아요…",
            "[홍조, ><] 잠깐… 이건… 너무해요…",
            "[하트, 식은땀] 하아… 아직… 끝난 것도 아닌데…",
            "[홍조, 눈물] 주인님… 손… 놓아 주세요… 아니, 그대로…",
            "[하트, ><] 으으… 이제… 아무 생각도 안 나요…",
            "[홍조, 식은땀] 잠깐만… 머리가… 어지러워요…",
            "[하트, 눈물] 이러다… 저, 울어 버릴 것 같아요…",
            "[홍조, ><] 제발… 조금만 쉬게 해 주세요…",
            "[하트, 식은땀] 하아… 지금 제 얼굴… 부끄러워요…",
            "[홍조, 눈물] 주인님은… 진짜… 못 말리겠어요…",
            "[하트, ><] 으으… 이제… 제가 뭘 하는지도…",
            "[홍조, 식은땀] 이제… 정말 안아 주세요… 그만하고…",
            "[하트, 눈물] …이번엔, 제가 먼저 항복할게요…"
          ],
          chest_calm: [
            "[하트, 홍조] 후우… 심장이 아직도 두근거려요.",
            "[홍조, 얄미운] …이제 진정됐어요. 다음엔 각오하세요.",
            "[하트, 홍조] 이런 얼굴… 처음 보여 드리는 거예요.",
            "[홍조] …잠깐만 이대로 있게 해 주세요. 아직 다리가 후들거려요.",
            "[하트, 홍조] 후… 아직… 다리 힘이 안 들어오네요.",
            "[홍조] …조금만 더 이렇게 있어 주세요.",
            "[하트, 홍조] 이제… 말할 수 있을 것 같아요. …아니, 아직.",
            "[홍조, 얄미운] …다음엔, 제가 먼저 할지도 몰라요.",
            "[하트] 자꾸 생각나요… 아까 그 느낌.",
            "[홍조] …지금 얼굴 보이면 안 되는데, 늦었죠.",
            "[하트, 홍조] 숨은 돌아왔는데… 마음이 안 진정돼요.",
            "[홍조, 얄미운] …주인님 손, 인제 다 알겠네요.",
            "[하트] 이런 거… 자주 하면 저 먼저 지치는 거 아닐까요.",
            "[홍조] …앉아 있을게요. 잠깐만.",
            "[하트, 홍조] 손, 아직 떼지 마세요… 아니, 떼 주세요…",
            "[홍조, 얄미운] …오늘 일은, 저만 아는 걸로 해 둘게요.",
            "[하트] 심장… 아직도 응원 소리 같아요.",
            "[홍조] …다음에 또 그러실 거죠? 대답 안 하셔도 알아요.",
            "[하트, 홍조] 이제 제 눈 똑바로 못 보세요, 주인님.",
            "[홍조, 얄미운] …손끝, 기억났어요. 이 정도면 됐죠?",
            "[하트] 잠깐… 웃음이 안 멈춰요. 이상하죠.",
            "[홍조] …저 더워요. 창문 좀…",
            "[하트, 홍조] 이제 조금… 진정되었어요. 조금만요.",
            "[홍조, 얄미운] …다음엔 안 봐드릴 거예요. 진짜로."
          ],
          chest_pull: [
            "[홍조, ><] 아흣…?! 그, 그쪽은…!",
            "[홍조, ><] 히잇…! 거기 잡으면… 몸이 이상해져요…!",
            "[홍조, 하트] 으으… 거긴… 예민한 데라고요…",
            "[홍조, ><] 자, 잠깐… 그렇게 당기면… 모양이…!",
            "[홍조, 식은땀] 하앗…! 손… 힘 좀 빼 주세요… 숨이…",
            "[홍조, 하트] 으… 그렇게 만지면… 몸에 힘이 하나도 안 들어가요…",
            "[홍조, ><] 주, 주인님…! 이런 건… 밤에 하세요…!",
            "[홍조, 하트] 하아… 일부러 그러시죠… 재미있으세요…?",
            "[홍조, ><] 엇…! 거기, 위로… 그렇게 끌어올리면…!",
            "[홍조, 식은땀] 으으으… 손대지 마세요… 아니, 놓지도 마시고요…",
            "[홍조, ><] 주인님 손가락… 너무 정확해요… 그런 데까지…",
            "[홍조, 하트] 숨이… 잘 안 쉬어져요… 조금만 천천히…",
            "[홍조, ><] 으앗…! 그렇게 한 번에…!",
            "[홍조, 식은땀] 하앗… 거기, 힘 빼면 안 돼요…",
            "[홍조, ><] 앗… 손이… 손이 떨려서…",
            "[홍조, 하트] 그만… 위로 올리지 마세요…",
            "[홍조, ><] 으으… 이거, 생각보다…!",
            "[홍조, 식은땀] 잠깐… 숨이… 안 쉬어져요…",
            "[홍조, ><] 아… 옷이… 옷이 걸려서…",
            "[홍조, 하트] 주인님… 조금만… 살살요…",
            "[홍조, ><] 으… 거긴 잡는 게 아니에요…",
            "[홍조, 식은땀] 하아… 이러다 진짜…",
            "[홍조, ><] 손가락… 하나씩 다 느껴져요…",
            "[홍조, 하트] 잠깐만… 마음 준비…",
            "[홍조, ><] 아앗… 조금만 천천히…!",
            "[홍조, 식은땀] 으으… 저, 소리 낼 것 같아요…",
            "[홍조, ><] 주인님… 이거, 놀이가 아니죠…?",
            "[홍조, 하트] 그렇게 당기시면… 몸이 따라올라와요…",
            "[홍조, ><] 잠깐… 손이 미끄러져요…!",
            "[홍조, 식은땀] 하… 하아… 조금만 쉬게…",
            "[홍조, ><] 거기… 정말 예민하다니까요…",
            "[홍조, 하트] …계속 이러시면, 저도… 각오할게요."
          ],
          chest_pull_long: [
            "[홍조, 하트] 하아… 아직도… 놓지 않으실 거예요…?",
            "[홍조, ><] 으으… 이러다간… 제가 먼저… 이상해져요…",
            "[홍조, 하트] 잠깐… 그만… 몸에 힘이 풀려서… 녹아내릴 것 같아요…",
            "[홍조, 식은땀] 하앗… 손 떼 주세요… 이러다… 소리 낼지도 몰라요…",
            "[홍조, 하트] 주인님… 너무해요… 이런 건… 반칙이라고요…",
            "[홍조, ><] 히으… 계속 그러시면… 저… 참을 수 없어요…",
            "[홍조, 하트] 으… 머리가… 하얘져서… 아무것도 안 보여요…",
            "[홍조, 얄미운] 하아… 이렇게까지 하실 거면서… 놀리기만 하시고…",
            "[홍조, 하트] 하아… 이거… 언제까지 하실 거예요…?",
            "[홍조, ><] 저… 이미… 참는 게 한계예요…",
            "[홍조, 하트] 제발… 조금만… 아니, 조금만 더…",
            "[홍조, ><] 주인님… 이러다 제가 먼저 손을… 아니에요, 아무것도 아니에요…",
            "[홍조, 하트] 하아… 아직… 계속하시는 거예요…?",
            "[홍조, ><] 으응… 이제… 어지러워요… 기분 좋게…",
            "[홍조, 하트] 잠깐… 저… 지금 제 목소리 이상하죠…",
            "[홍조, 식은땀] 하앗… 손가락 힘… 조금만 빼 주세요…",
            "[홍조, ><] 으으… 이러다간… 진짜 소리 질러요…",
            "[홍조, 하트] 주인님… 저… 이상해요… 몸이…",
            "[홍조, ><] 히으… 머리가… 자꾸 새하얘져요…",
            "[홍조, 식은땀] 잠깐만… 이대로면… 제가 먼저 손을 뻗어요…",
            "[홍조, 하트] 흔들지 마세요… 그럼… 더…",
            "[홍조, ><] 으… 그만… 아니, 아직…",
            "[홍조, 하트] 하아… 이제 정말… 한계에 가까워요…",
            "[홍조, ><] 주인님… 이러다 저… 참지 못해요…",
            "[홍조, 식은땀] 손… 손을… 놓을 수가 없잖아요…",
            "[홍조, 하트] 하앗… 이거… 오래 하시면 저… 녹아요…",
            "[홍조, ><] 으으… 숨… 숨이 안 나와요…",
            "[홍조, 하트] 이제… 조금만 더하면… 저…",
            "[홍조, ><] 잠깐… 눈물 날 것 같아요… 이상하게…",
            "[홍조, 식은땀] 하아… 주인님… 이거… 정말 반칙이에요…",
            "[홍조, 하트] …계속 이러시면, 오늘 밤 못 자요…",
            "[홍조, ><] 으… 이제… 그만… 정말로 그만…"
          ],
          chest_pull_dizzy: [
            "[어지럼, 홍조] 으으… 자꾸 흔들면… 어지러워요…",
            "[어지럼, 홍조] 잠깐… 세상이… 빙글빙글 돌아요…",
            "[어지럼, 하트] 아이… 머리가 핑 돌아서… 못 서겠어요…",
            "[어지럼, 식은땀] 하아… 그만… 눈앞이 흔들려요…",
            "[어지럼, 홍조] 으… 어지러워서… 잠깐만 기대도 돼요…?"
          ],
          chest_drop: [
            "[홍조, ><] 꺅!",
            "[홍조, 눈물] 꺅…! 이, 이건 반칙이에요…!",
            "[홍조, 하트] 하아… 갑자기 놓으면… 몸이 아직… 어지러워요…",
            "[홍조, 식은땀] 아… 아직… 감각이 안 돌아와요…",
            "[홍조, ><] 으으… 다리 힘이… 풀려 버렸잖아요…",
            "[홍조, 하트] 잠깐만… 심장이 너무 뛰어서… 숨 좀 돌릴게요…",
            "[홍조, 눈물] 부, 부끄러워서… 얼굴을 못 들겠어요…",
            "[홍조, 얄미운] …이번엔 봐드린 거예요… 다음엔… 각오하세요…",
            "[홍조, 하트] 아… 아직 거기… 감각이 남아 있어요…",
            "[홍조, 식은땀] 이 상태로 일어나면… 다리에 힘이 안 들어가요…",
            "[홍조, ><] 주인님… 이거… 책임지실 거죠…?",
            "[홍조, 눈물] 하아… 창피해서 어디 숨고 싶어요…",
            "[홍조, ><] 하앗…!",
            "[홍조, 눈물] 아… 아직… 아직 거기…",
            "[홍조, 하트] 으으… 갑자기 놓으면… 몸이 휘청…",
            "[홍조, 식은땀] 하아… 다리에 힘 안 들어가요…",
            "[홍조, ><] 잠깐… 숨… 돌릴 시간…",
            "[홍조, 하트] 주인님… 손 좀… 놓지 마세요…",
            "[홍조, 눈물] 이제… 이제 된 거예요…?",
            "[홍조, ><] 으으… 아직… 여운이…",
            "[홍조, 식은땀] 하아… 이러면… 일할 수가 없어요…",
            "[홍조, 하트] 잠깐만… 마음이… 안 정리돼요…",
            "[홍조, ><] 아… 아직 감각이… 남아 있어요…",
            "[홍조, 눈물] 부끄러워… 부끄러워요…",
            "[홍조, 식은땀] 이제… 제 얼굴… 다 보였죠…?",
            "[홍조, 하트] 놓고 나니까… 더… 이상해요…",
            "[홍조, ><] 으으… 다리… 풀렸어요…",
            "[홍조, 눈물] 주인님… 이거… 저만 아는 거예요…",
            "[홍조, 식은땀] 하아… 물 좀… 마실 수 있게…",
            "[홍조, ><] 잠깐… 그 자리에… 서 있을게요…",
            "[홍조, 하트] …이번엔, 제가 진 거네요…",
            "[홍조, 눈물] …다음엔, 조용한 데서 해요… 제발요…"
          ],
          lower1: [
            "[홍조, 식은땀] 거, 거기는… 치마는 안 돼요…!",
            "[홍조, 식은땀] 거기 만지면… 정말 화낼 거예요…!",
            "[홍조, ><] 으… 치마 자락… 놓아 주세요…!",
            "[홍조, 식은땀] 거긴… 스스로도 함부로 안 만지는 데예요…",
            "[홍조, ><] 주인님… 그 손, 지금 위험한 거 아세요…?"
          ],
          lower2: [
            "[홍조, ><] 진짜… 이러시면 오늘 밤은 안 자요…!",
            "[홍조, ><] 그만해 주세요… 제발…!",
            "[홍조, 식은땀] 으으… 이러다 진짜 소리 질러요…!",
            "[홍조, ><] 한 번만 더 하시면… 정말로 삐질 거예요…",
            "[홍조, 눈물] 주인님… 지금 표정… 무서워요… 아니, 좋아요…"
          ],
          lower3: [
            "[><, 식은땀] 히익…!",
            "[><, 눈물] 으아…! 이제 진짜…!",
            "[><, 식은땀] 잠깐…! 거기… 진짜 안 돼요…!"
          ],
          lower_after: [
            "[홍조, 눈물] …다시는 그러지 마세요. 진짜예요.",
            "[홍조, 눈물] 흥… 이번만 봐준 거예요.",
            "[홍조] …나중에, 조용한 데서 다시 얘기해요.",
            "[홍조, 얄미운] 이번 일은… 둘만 아는 걸로 해요.",
            "[홍조, 눈물] 흥… 이제 저 멀리 가 있을 거예요."
          ],
          spam: [
            "[어두운, 얄미운] …그만 좀 눌러요. 반응 다 보이잖아요.",
            "[어두운, 얄미운] …주인님, 손가락이 너무 성실하시네요.",
            "[어두운, 얄미운] …부탁인데, 잠깐만 쉬어 주세요."
          ],
          makeup: [
            "[홍조] …이제 안 누르실 거죠? 약속하세요.",
            "[홍조] …이번엔 넘어갈게요. 대신 기억해 둘게요.",
            "[홍조] …이제 진정하셨어요? 저는 아직인데."
          ],
          working: [
            "[식은땀] 지금 일하는 중이에요~ …나중에 하세요, 나중에♪",
            "[식은땀] 잠깐만요… 지금 집중해야 하는데… 손이 자꾸…",
            "[식은땀] 일 끝나면… 그때 만져 주세요. 약속하시고요.",
            "[식은땀] 으… 지금 그러시면 작업이 안 끝나요…"
          ],
          sleep_out: [
            "잠깐 쉬고 올게요~ …그리워하시면 금방 와요♪",
            "절전 모드 들어갑니다~ 불러 주시면 바로요!",
            "좀 쉬었다 올게요, 주인님♪ …꿈에서 봬요.",
            "눈 좀 붙이고 올게요. …몰래 보고 계시면 안 돼요.",
            "충전하러 갑니다~ 다녀오면 안아 주세요."
          ],
          sleep_back: [
            "다녀왔어요! …보고 싶으셨죠?",
            "돌아왔어요! 기다리게 해서 죄송해요♪",
            "[하트] 부르셨죠? …이리 와요.",
            "푹 잤더니… 얼굴이 좋아 보이세요, 주인님.",
            "[홍조] 자는 동안… 계속 곁에 있으셨어요?"
          ]
        };
        const EXP_NAME = { "홍조": "blush", "><": "squint", "하트": "heart", "얄미운": "smug", "식은땀": "sweat", "어두운": "dark", "눈물": "tears", "어지럼": "dizzy" };
        const lastLine = {};
        const speak = (key, ms = 3500) => {
          const list = LINES[key];
          if (!list) return;
          const candidates = [];
          for (let i = 0; i < list.length; i++) {
            if (list.length > 1 && i === lastLine[key]) continue;
            const raw = list[i], m = raw.match(/^\[([^\]]+)\]\s*/);
            const text2 = m ? raw.slice(m[0].length) : raw;
            if (text2 === lastSayText) continue;
            candidates.push({ i, text: text2, exp: m ? m[1] : "" });
          }
          if (!candidates.length) return;
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          lastLine[key] = pick.i;
          for (const n of pick.exp.split(",")) {
            const e = EXP_NAME[n.trim()];
            if (e) flashExp(e, ms);
          }
          const text = pick.text;
          say(text, ms);
        };
        outfitTalk = (key) => {
          if (fleeX === 0 && performance.now() >= sulkUntil) speak(key, 4e3);
        };
        const PART_REGION = {
          Part99: "head",
          Part47: "head",
          Part155: "head",
          Part156: "head",
          Part161: "head",
          Part64: "head",
          Part66: "head",
          Part10: "head",
          Part8: "head",
          Part127: "arm",
          Part94: "arm",
          Part68: "arm",
          Part93: "arm",
          Part117: "arm",
          Part54: "arm",
          Part42: "arm",
          Part114: "leg",
          Part97: "lower",
          Part107: "lower",
          Part125: "lower",
          Part126: "lower",
          Part89: "waist",
          Part85: "chestpart",
          Part88: "chestpart",
          Part136: "tail"
        };
        const DR = cm.drawables, PT = cm.parts;
        const drawRegion = Array.from({ length: DR.count }, (_, i) => {
          for (let p = DR.parentPartIndices[i]; p >= 0; p = PT.parentIndices[p]) if (PART_REGION[PT.ids[p]]) return PART_REGION[PT.ids[p]];
          return null;
        });
        const chestDraw = [];
        for (let i = 0; i < DR.count; i++) for (let p = DR.parentPartIndices[i]; p >= 0; p = PT.parentIndices[p]) if (PT.ids[p] === "Part88" || PT.ids[p] === "Part86") {
          chestDraw.push(i);
          break;
        }
        const chestCenter = () => {
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          for (const i of chestDraw) {
            if (DR.opacities[i] < 0.05) continue;
            const v = im.getDrawableVertices(i);
            for (let k = 0; k < v.length; k += 2) {
              x0 = Math.min(x0, v[k]);
              x1 = Math.max(x1, v[k]);
              y0 = Math.min(y0, v[k + 1]);
              y1 = Math.max(y1, v[k + 1]);
            }
          }
          return x0 === Infinity ? null : { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
        };
        const chestBase = chestCenter();
        const B = { minX, minY, w: maxX - minX, h: maxY - minY };
        const AN = 512;
        let alphaMaps = null;
        const buildAlpha = () => {
          alphaMaps = model.textures.map((t) => {
            try {
              const c = life.own(document.createElement("canvas"), (node) => node.remove());
              c.width = c.height = AN;
              const g = c.getContext("2d", { willReadFrequently: true });
              g.drawImage(t.baseTexture.resource.source, 0, 0, AN, AN);
              const d = g.getImageData(0, 0, AN, AN).data, a = new Uint8Array(AN * AN);
              for (let k = 0; k < a.length; k++) a[k] = d[k * 4 + 3];
              return a;
            } catch {
              return null;
            }
          });
        };
        const alphaAt = (tex, u, v) => {
          const a = alphaMaps[tex];
          if (!a) return 255;
          return a[Math.min(AN - 1, Math.max(0, Math.floor((1 - v) * AN))) * AN + Math.min(AN - 1, Math.max(0, Math.floor(u * AN)))];
        };
        const touchable = (i) => earSet.has(i) ? earHitVisible(i) : !(DR.opacities[i] < 0.05 || !(DR.dynamicFlags[i] & 1));
        const pickDrawable = (x, y) => {
          if (!alphaMaps) buildAlpha();
          const px = (x - model.x) / model.scale.x, py = (y - model.y) / model.scale.y;
          let best = -1, bestOrder = -Infinity;
          for (let i = 0; i < DR.count; i++) {
            if (!touchable(i)) continue;
            const order = DR.renderOrders[i];
            if (order <= bestOrder) continue;
            const v = im.getDrawableVertices(i);
            const [x0, y0, x1, y1] = meshBounds(v);
            if (px < x0 || px > x1 || py < y0 || py > y1) continue;
            if (meshHit(v, DR.indices[i], DR.vertexUvs[i], px, py, (u, w) => alphaAt(DR.textureIndices[i], u, w))) {
              best = i;
              bestOrder = order;
            }
          }
          return best;
        };
        const chibiRegion = (y) => {
          let y0 = Infinity, y1 = -Infinity;
          for (let i = 0; i < DR.count; i++) {
            if (DR.opacities[i] < 0.05) continue;
            const v = im.getDrawableVertices(i);
            for (let k = 1; k < v.length; k += 2) {
              if (v[k] < y0) y0 = v[k];
              if (v[k] > y1) y1 = v[k];
            }
          }
          return ((y - model.y) / model.scale.y - y0) / (y1 - y0) < 0.45 ? "head" : "body";
        };
        const regionByShape = (r, ry, inChest) => {
          if (r === "head" && ry > 0.3) r = null;
          if (r === "arm" && cover.q > 0.3 && ry < 0.45) return "chest";
          if (r === "arm" || r === "leg" || r === "head") return r;
          if (inChest) return "chest";
          if (r === "lower") return "lower";
          if (r === "waist") return ry > 0.4 ? "lower" : "chest";
          if (r === null && ry < 0.3) return "head";
          return ry < 0.4 ? "chest" : "body";
        };
        const touchRegion = (x, y, d) => {
          if (bodyW > 0.5) return chibiRegion(y);
          const sc = model.scale.x, cc = chestCenter();
          const shiftX = cc && chestBase ? cc.x - chestBase.x : 0, shiftY = cc && chestBase ? cc.y - chestBase.y : 0;
          const rx = (x - model.x - (B.minX + shiftX) * sc) / (B.w * sc);
          const ry = (y - model.y - (B.minY + shiftY) * sc) / (B.h * sc);
          const inChest = Math.pow((rx - 0.45) / 0.13, 2) + Math.pow((ry - 0.295) / 0.045, 2) <= 1;
          return regionByShape(drawRegion[d], ry, inChest);
        };
        const UI_HIT = 'button, a[href], input, textarea, select, summary, [contenteditable="true"], [class*="composerSeat"] [class*="_card"]';
        const hitAt = (cx, cy) => {
          if (canvas.style.display === "none" || fleeX !== 0) return null;
          const r = canvas.getBoundingClientRect();
          if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null;
          if (document.elementFromPoint(cx, cy)?.closest(UI_HIT)) return null;
          const x = (cx - r.left) / curK, y = (cy - r.top) / curK;
          const d = pickDrawable(x, y);
          return d >= 0 ? [x, y, d] : null;
        };
        let clicks = [], headClicks = [], spamAt = -1e9, inputLockedUntil = 0;
        const shy = { count: 0, last: -1e9, cooldownUntil: 0 }, low = { count: 0, last: -1e9, cooldownUntil: 0 };
        const onChest = (now) => {
          if (now < shy.cooldownUntil || now - shy.last < 180) return;
          if (now - shy.last > 8e3) shy.count = 0;
          shy.last = now;
          shy.count++;
          if (shy.count <= 4) {
            if (now < touchLeanUntil || Math.random() < 0.16) touchLeanUntil = now + 3e3;
            speak(shy.count <= 1 ? "chest1" : "chest2", 4e3);
            if (shy.count >= 2) happyMouthUntil = now + 4e3;
            if (shy.count >= 3) coverChest(2600);
          } else {
            touchLeanUntil = 0;
            shy.count = 0;
            shy.cooldownUntil = inputLockedUntil = now + 6e3;
            shiverStarted = now;
            speak("chest3", 3e3);
            happyMouthUntil = now + 6e3;
            coverChest(6e3);
            setTimeout(() => speak("chest_calm", 2800), 3e3);
          }
        };
        const nearSide = () => {
          const a = area(), c = shown.x - fleeX + W * curK / 2;
          return c - a.l < a.r - c ? -1 : 1;
        };
        const outDistance = (dir) => {
          const a = area(), x = shown.x - fleeX;
          return dir < 0 ? -(x + W * curK - a.l + 20) : a.r - x + 20;
        };
        const FLEE_DIST = 300, FLEE_OUT_MS = 700, FLEE_IN_MS = 900, FLEE_HIDE_MS = 1e4;
        let fleeFade = 1;
        const fleeSlide = (from, to, ms, done) => {
          const t0 = performance.now();
          const step = () => {
            const p = Math.min(1, (performance.now() - t0) / ms), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
            fleeX = from + (to - from) * e;
            if (p < 1) requestAnimationFrame(step);
            else done && done();
          };
          requestAnimationFrame(step);
        };
        const flee = () => {
          if (drag.pending || drag.on || link.open || link.follow) return;
          hush();
          if (!PET) {
            const off = outDistance(nearSide());
            fleeSlide(Math.sign(off) * 0.01, off, 700, () => setTimeout(() => fleeSlide(off, 0, 1100, () => {
              fleeX = 0;
              setTimeout(() => speak("lower_after", 4e3), 400);
            }), 1e4));
            return;
          }
          const dist = nearSide() * Math.max(FLEE_DIST, W * curK * 0.5);
          const finish = () => {
            fleeX = 0;
            fleeFade = 1;
            canvas.style.opacity = "";
            setTimeout(() => speak("lower_after", 4e3), 400);
          };
          const runIn = () => {
            const t02 = performance.now();
            const step = () => {
              if (drag.pending || drag.on) return finish();
              const p = Math.min(1, (performance.now() - t02) / FLEE_IN_MS);
              fleeX = dist * (1 - p * p * (3 - 2 * p));
              fleeFade = p * p * (3 - 2 * p);
              canvas.style.opacity = String(Math.min(1, fleeFade));
              if (p < 1) requestAnimationFrame(step);
              else finish();
            };
            requestAnimationFrame(step);
          };
          const t0 = performance.now();
          const runOut = () => {
            const p = Math.min(1, (performance.now() - t0) / FLEE_OUT_MS);
            fleeX = dist * (1 - Math.pow(1 - p, 3));
            fleeFade = Math.max(0, 1 - Math.pow(p, 1.5));
            canvas.style.opacity = String(fleeFade);
            if (p < 1) requestAnimationFrame(runOut);
            else setTimeout(runIn, FLEE_HIDE_MS);
          };
          requestAnimationFrame(runOut);
        };
        const WALK_SPEED = 320;
        const walkEase = (p) => {
          const a = 0.12, m = 2 * a * (1 - a);
          return p < a ? p * p / m : p > 1 - a ? 1 - (1 - p) * (1 - p) / m : (p - a / 2) / (1 - a);
        };
        const walkLater = (fn, ms) => {
          const id = setTimeout(() => {
            walk.timers = walk.timers.filter((t) => t !== id);
            fn();
          }, ms);
          walk.timers.push(id);
          return id;
        };
        const slide = (from, to, done) => {
          const t0 = performance.now(), ms = Math.abs(to - from) / WALK_SPEED * 1e3, id = ++walk.slideId;
          let cancelled = false;
          const step = () => {
            if (cancelled || id !== walk.slideId) return;
            const p = ms ? Math.min(1, (performance.now() - t0) / ms) : 1;
            fleeX = from + (to - from) * walkEase(p);
            if (p < 1) requestAnimationFrame(step);
            else done();
          };
          requestAnimationFrame(step);
          return () => {
            cancelled = true;
          };
        };
        const cancelWalk = () => {
          if (walk.phase !== "ready") return;
          for (const t of walk.timers) clearTimeout(t);
          walk.timers = [];
          walk.slideId++;
          walk.phase = "";
        };
        const walkBack = () => {
          if (walk.phase !== "away") return;
          for (const t of walk.timers) clearTimeout(t);
          walk.timers = [];
          walk.phase = "in";
          walk.dir = 1;
          slide(outDistance(1), 0, () => {
            fleeX = 0;
            walk.phase = "";
            walkLater(() => {
              if (!walk.phase) speak("walk_back", 3500);
            }, 450);
          });
        };
        const startWalk = () => {
          if (SLEEP.state !== "active") return;
          walk.phase = "ready";
          walk.dir = -1;
          speak("walk_out", 2200);
          walkLater(() => {
            walk.phase = "out";
            hush();
            walkLater(() => {
              walk.out = outDistance(walk.dir);
              slide(0, walk.out, () => {
                walk.phase = "away";
                walkLater(walkBack, 8e3 + Math.random() * 6e3);
              });
            }, 700);
          }, 2300);
        };
        const walkMoodBusy = (now) => intro.phase !== "done" || mood !== "idle" || running || !!waitingKind || now < sulkUntil || now < inputLockedUntil || fleeX !== 0;
        const walkInputBusy = () => !!(drag.pending || drag.on || free.anim || link.open || link.opening || link.follow);
        const walkRecentlyActive = (now) => bubble.classList.contains("show") || now - walk.lastTouch < 6e4 || now - lastSayAt < 15e3 || document.hidden;
        walkCheck = (now) => {
          if (SLEEP.state !== "active") return;
          if (walk.phase === "away" && running) return walkBack();
          if (walk.phase || now < walk.next) return;
          walk.next = now + 3e4;
          if (walkMoodBusy(now) || walkInputBusy() || walkRecentlyActive(now)) return;
          walk.next = now + (240 + Math.random() * 240) * 1e3;
          startWalk();
        };
        const SLEEP = { enabled: true, minutes: 1, lastActive: performance.now(), state: "active" };
        let sleepTimer = 0, cancelSleepSlide = null;
        const SLEEP_OFF = () => innerWidth - (canvas.getBoundingClientRect().left - fleeX) + 40;
        const startWake = () => {
          if (SLEEP.state !== "asleep" && SLEEP.state !== "leaving") return;
          clearTimeout(sleepTimer);
          sleepTimer = 0;
          cancelSleepSlide?.();
          cancelSleepSlide = null;
          if (link.open || link.follow?.shown) {
            SLEEP.state = "active";
            fleeX = 0;
            return;
          }
          hush();
          SLEEP.state = "waking";
          setRender(true);
          place();
          slide(fleeX, 0, () => {
            fleeX = 0;
            SLEEP.state = "active";
            SLEEP.lastActive = performance.now();
            if (!running && !waitingKind) speak("sleep_back", 3500);
          });
        };
        const sleepActivity = () => {
          if (hidden) return;
          SLEEP.lastActive = performance.now();
          startWake();
        };
        for (const t of PET ? [] : ["pointerdown", "pointermove", "mousedown", "keydown", "wheel", "touchstart"]) addEventListener(t, sleepActivity, { passive: true, capture: true });
        const sleepGo = () => {
          if (hidden || PET || drag.on || drag.pending || free.anim || SLEEP.state !== "active" || intro.phase !== "done" || fleeX !== 0 || walk.phase) return;
          if (link.open || link.follow?.shown) {
            SLEEP.lastActive = performance.now();
            return;
          }
          SLEEP.state = "leaving";
          speak("sleep_out", 2600);
          sleepTimer = setTimeout(() => {
            sleepTimer = 0;
            if (SLEEP.state !== "leaving") return;
            hush();
            cancelSleepSlide = slide(fleeX, SLEEP_OFF(), () => {
              cancelSleepSlide = null;
              SLEEP.state = "asleep";
              canvas.style.display = bubble.style.display = "none";
              setRender(false);
            });
          }, 2500);
        };
        const onLower = (now) => {
          if (fleeX !== 0 || now < low.cooldownUntil || now - low.last < 180) return;
          if (now - low.last > 8e3) low.count = 0;
          low.last = now;
          low.count++;
          if (low.count <= 2) speak("lower1", 4e3);
          else if (low.count <= 4) speak("lower2", 4e3);
          else {
            low.count = 0;
            low.cooldownUntil = now + 14e3;
            shiverStarted = now;
            speak("lower3", 900);
            setTimeout(flee, 900);
          }
        };
        const POT_SVG = '<svg viewBox="0 0 140 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="dscPotBody" x1="0" x2="1"><stop offset="0" stop-color="#7d8794"/><stop offset=".35" stop-color="#e3e8ee"/><stop offset=".6" stop-color="#b8c0ca"/><stop offset="1" stop-color="#6c7580"/></linearGradient></defs><rect x="2" y="34" width="26" height="10" rx="5" fill="#3d434b"/><rect x="112" y="34" width="26" height="10" rx="5" fill="#3d434b"/><path d="M22 30 H118 V78 Q118 96 100 96 H40 Q22 96 22 78 Z" fill="url(#dscPotBody)" stroke="#4b525b" stroke-width="3"/><ellipse cx="70" cy="30" rx="50" ry="10" fill="#d7dde4" stroke="#4b525b" stroke-width="3"/><ellipse cx="70" cy="30" rx="40" ry="6" fill="#59616b"/><path d="M38 48 Q44 70 40 86" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".55" fill="none"/></svg>';
        const impactSvg = (guarded) => {
          const pts = [];
          for (let i = 0; i < 20; i++) {
            const r = i % 2 ? 22 : 46, a = i / 20 * Math.PI * 2 - Math.PI / 2;
            pts.push((50 + Math.cos(a) * r).toFixed(1) + "," + (50 + Math.sin(a) * r).toFixed(1));
          }
          const fill = guarded ? "#f1f5f9" : "#ffe14d", stroke = guarded ? "#64748b" : "#ea580c", core2 = guarded ? "#ffffff" : "#fff7c2";
          let rays = "";
          for (let i = 0; i < 8; i++) {
            const a = i / 8 * Math.PI * 2 + 0.2, c = Math.cos(a), sn = Math.sin(a);
            rays += `<line x1="${(50 + c * 50).toFixed(1)}" y1="${(50 + sn * 50).toFixed(1)}" x2="${(50 + c * 62).toFixed(1)}" y2="${(50 + sn * 62).toFixed(1)}" stroke="${stroke}" stroke-width="4" stroke-linecap="round"/>`;
          }
          return `<svg viewBox="-14 -14 128 128" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">${rays}<polygon points="${pts.join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="50" r="12" fill="${core2}"/></svg>`;
        };
        let audioCtx = null;
        const impactSound = (guarded) => {
          try {
            audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
            const ac = audioCtx, t = ac.currentTime, out = ac.createGain();
            out.gain.value = 0.22;
            out.connect(ac.destination);
            const tone = (f, dur, vol, type = "sine", drop = 1) => {
              const o = ac.createOscillator(), g = ac.createGain();
              o.type = type;
              o.frequency.setValueAtTime(f, t);
              if (drop !== 1) o.frequency.exponentialRampToValueAtTime(f * drop, t + dur);
              g.gain.setValueAtTime(vol, t);
              g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
              o.connect(g);
              g.connect(out);
              o.start(t);
              o.stop(t + dur + 0.02);
            };
            const noise2 = (dur, vol, hp) => {
              const b = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate), d = b.getChannelData(0);
              for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
              const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
              src.buffer = b;
              f.type = "highpass";
              f.frequency.value = hp;
              g.gain.value = vol;
              src.connect(f);
              f.connect(g);
              g.connect(out);
              src.start(t);
            };
            if (guarded) {
              noise2(0.05, 0.7, 2500);
              for (const [f, d, v] of [[640, 1.1, 0.5], [1370, 0.9, 0.35], [2230, 0.7, 0.25], [3150, 0.5, 0.15]]) tone(f, d, v, "sine", 0.995);
            } else {
              noise2(0.07, 0.8, 900);
              tone(190, 0.28, 0.9, "triangle", 0.45);
              tone(470, 0.35, 0.35, "sine", 0.9);
              tone(1130, 0.22, 0.18, "sine", 0.95);
            }
          } catch {
          }
        };
        const potHit = (x, y) => {
          const now = performance.now();
          walk.lastTouch = now;
          clicks = [];
          headClicks = [];
          const guarded = now < basinUntil;
          inputLockedUntil = now + (guarded ? 1200 : 3200);
          const w = Math.max(64, 150 * curK), h = w * 100 / 140;
          const pot = life.own(document.createElement("div"), (node) => node.remove());
          pot.style.cssText = `position:fixed;left:${x - w / 2}px;top:${y - h * 0.9}px;width:${w}px;height:${h}px;z-index:40;pointer-events:none;will-change:transform,opacity`;
          pot.innerHTML = POT_SVG;
          document.body.append(pot);
          const fall = y + h + 20, T = 1250;
          const anim = pot.animate([
            { transform: `translateY(${-fall}px) rotate(-14deg)`, offset: 0, easing: "cubic-bezier(.5,0,1,.6)" },
            { transform: "translateY(0) rotate(0deg) scale(1.12,.86)", offset: 0.4, easing: "ease-out" },
            // 쾅
            guarded ? { transform: `translate(${w * 0.45}px,${-h * 1.6}px) rotate(60deg)`, offset: 0.66, easing: "ease-in" } : { transform: `translate(${w * 0.25}px,${-h * 0.6}px) rotate(32deg)`, offset: 0.62, easing: "ease-in" },
            { transform: `translate(${w * 0.7}px,${h * 0.9}px) rotate(85deg)`, opacity: 0, offset: 1 }
          ], { duration: T, fill: "forwards" });
          anim.onfinish = () => pot.remove();
          setTimeout(() => {
            const fs = Math.max(60, 130 * curK), fx = life.own(document.createElement("div"), (node) => node.remove());
            fx.style.cssText = `position:fixed;left:${x - fs / 2}px;top:${y - h * 0.9 - fs / 2}px;width:${fs}px;height:${fs}px;z-index:41;pointer-events:none`;
            fx.innerHTML = impactSvg(guarded);
            document.body.append(fx);
            fx.animate([{ transform: "scale(.2) rotate(-20deg)", opacity: 0 }, { transform: "scale(1.15) rotate(5deg)", opacity: 1, offset: 0.25 }, { transform: "scale(1.3) rotate(10deg)", opacity: 0 }], { duration: 620, fill: "forwards" }).onfinish = () => fx.remove();
            impactSound(guarded);
            if (guarded) {
              play("flinch", 600);
              speak("pot_guard", 3e3);
              return;
            }
            play("bonk", 1100);
            shiverStarted = performance.now();
            speak("pot_hit", 3e3);
            flashExp("dizzy", 2800);
          }, T * 0.4);
        };
        const putBasin = () => {
          const now = performance.now();
          walk.lastTouch = now;
          clicks = [];
          headClicks = [];
          basinUntil = now + 1e4;
          speak("basin_on", 3800);
        };
        const HEAD_SULK_AT = 3, SULK_MS = 15e3;
        const sulk = (now) => {
          clicks = [];
          headClicks = [];
          until.dark = until.smug = 0;
          gest.name = null;
          sulkStart = now;
          sulkUntil = inputLockedUntil = now + SULK_MS;
          sulkDir = Math.random() < 0.5 ? 1 : -1;
          sulkYaw = sulkRoll = 0;
          sulkPeeks = [0, 1, 2].map((i) => ({ at: 2800 + i * 4e3 + (Math.random() - 0.5) * 1e3, flip: Math.random() < 0.6, done: false }));
          speak("head_sulk", 4e3);
          flashExp("blush", SULK_MS);
          setTimeout(() => {
            stareUntil = performance.now() + 4300;
            speak("head_after", 4e3);
          }, SULK_MS);
        };
        const onTouch = (x, y, d) => {
          const now = performance.now();
          if (now < inputLockedUntil) return;
          walk.lastTouch = now;
          const region = touchRegion(x, y, d);
          if (region === "chest") {
            clicks = [];
            headClicks = [];
            low.count = 0;
            return onChest(now);
          }
          if (region === "lower") {
            clicks = [];
            headClicks = [];
            shy.count = 0;
            return onLower(now);
          }
          shy.count = 0;
          low.count = 0;
          clicks = clicks.filter((t) => now - t < 3e3);
          clicks.push(now);
          if (clicks.length >= 6) {
            clicks = [];
            headClicks = [];
            spamAt = now;
            return speak("spam", 3e3);
          }
          if (running && Math.random() < 0.5) return speak("working");
          if (region === "head") {
            if (now - spamAt < 1e4) {
              spamAt = -1e9;
              return speak("makeup");
            }
            headClicks = headClicks.filter((t) => now - t < 8e3);
            headClicks.push(now);
            if (headClicks.length >= HEAD_SULK_AT) return sulk(now);
            return speak("head");
          }
          if (region === "arm") return speak("arm");
          if (region === "leg") return speak("leg");
          play("sway", 1600);
          speak("body");
        };
        const POT_MS = 130;
        let swallowClick = false, strokeFrom = null;
        const pt = (e) => PET ? [e.screenX, e.screenY] : [e.clientX, e.clientY];
        const overBody = (cx, cy) => {
          if (canvas.style.display === "none" || fleeX !== 0) return false;
          const c = canvas.getBoundingClientRect(), r = bodyRect(c.left, c.top, curK);
          return cx >= r.l && cx <= r.r && cy >= r.t && cy <= r.b;
        };
        const walking = () => walk.phase === "out" || walk.phase === "away" || walk.phase === "in";
        const canPullChest = (now) => bodyW <= 0.5 && fleeX === 0 && !walk.phase && intro.phase === "done" && !drag.on && !link.opening && now >= sulkUntil;
        const armChestLong = () => {
          clearInterval(chestLongTimer);
          const startedAt = performance.now();
          chestShake.acc = 0;
          chestShake.last = 0;
          chestShake.next = startedAt + 3e3;
          chestLongTimer = setInterval(() => {
            if (!chestDragging) {
              clearInterval(chestLongTimer);
              chestLongTimer = 0;
              return;
            }
            const now = performance.now();
            if (now < chestShake.next) return;
            if (now - chestShake.last > 500 || chestShake.acc < 30) return;
            speak(now - startedAt >= 4e3 ? "chest_pull_dizzy" : "chest_pull_long", 4e3);
            chestShake.acc = 0;
            chestShake.next = now + 3e3;
          }, 300);
        };
        const releaseChest = () => {
          chestFrom = null;
          if (!chestDragging) return;
          chestDragging = false;
          chestTarget = 0;
          chestShiftTarget = 0;
          clearInterval(chestLongTimer);
          const now = performance.now();
          const dropped = Math.max(0, dragLift.x);
          dragLift.v = Math.min(0, dragLift.v) - dropped * 2.5;
          speak("chest_drop", 3500);
          shiverStarted = now;
          coverChest(3e3);
          inputLockedUntil = now + 2500;
          walk.lastTouch = now;
        };
        const armChordGrab = (e, now, pointerId = e.pointerId) => {
          if (chestDragging) {
            clearInterval(chestLongTimer);
            chestDragging = false;
            chestTarget = 0;
            chestShiftTarget = 0;
          }
          strokeFrom = null;
          chestFrom = null;
          if (!drag.pending) {
            const [px, py] = pt(e);
            drag.pending = { id: pointerId, sx: px, sy: py, h: null, ox: px - shown.x, oy: py - shown.y };
          }
          chord.valid = true;
          if (PET) PET.press(true);
          try {
            e.preventDefault();
            e.stopPropagation();
          } catch {
          }
          swallowClick = true;
        };
        const rightStart = (e, id = e.pointerId ?? rightPress?.id) => {
          if (PET && petPanelOpen && petPanel && petPanel.contains(e.target)) return null;
          if (walking()) return null;
          if (intro.phase !== "done" || fleeX !== 0 || link.opening) return null;
          const h = hitAt(e.clientX, e.clientY);
          if (!h && !(PET && overBody(e.clientX, e.clientY))) return null;
          return { at: performance.now(), hit: true, id };
        };
        const chordButtonsMoved = (e, now) => {
          const mask = e.buttons & 3, prev = mouseButtons;
          mouseButtons = mask;
          if (mask !== 3 || prev === 3) return false;
          if (prev === 2) {
            if (!rightPress?.hit) return false;
            armChordGrab(e, now, rightPress.id ?? e.pointerId);
            return true;
          }
          if (prev === 1) {
            if (!chordWithinGrace(chord, 2, mask, now)) return false;
            armChordGrab(e, now, drag.pending?.id ?? e.pointerId);
            return true;
          }
          return false;
        };
        const rightButtonDown = (e, nowDown) => {
          if (e.button === 2) {
            rightPress = rightStart(e);
            if ((e.buttons & 3) === 3 && rightPress) armChordGrab(e, nowDown, e.pointerId);
          }
          if (e.buttons & 1 && chordWithinGrace(chord, e.button, e.buttons, nowDown)) armChordGrab(e, nowDown);
        };
        const armHeadOrChest = (e, h) => {
          const head = !!h && performance.now() >= inputLockedUntil && touchRegion(h[0], h[1], h[2]) === "head";
          if (head) strokeFrom = { x: e.clientX, y: e.clientY, t: performance.now(), h };
          else if (h && canPullChest(performance.now()) && touchRegion(h[0], h[1], h[2]) === "chest") chestFrom = { x: e.clientX, y: e.clientY, id: e.pointerId, h };
          return head;
        };
        const armTouchHold = (e) => {
          clearTimeout(touchHold);
          touchHold = setTimeout(() => {
            if (!drag.pending || drag.pending.id !== e.pointerId || drag.pending.touchStroke) return;
            drag.pending.touchGrab = true;
            strokeFrom = null;
            chestFrom = null;
            if (PET) PET.press(true);
          }, TOUCH.grabMs);
        };
        const preparePetOnPress = () => {
          if (link.supported && link.petState === "none") link.post("warm");
          else if (!PET && link.petState === "shown" && !link.open && !link.follow) link.post("hide");
        };
        life.listen(document, "pointerdown", (e) => {
          if (hidden) return;
          const nowDown = performance.now();
          mouseButtons = e.buttons & 3;
          chord = chordDown(chord, e.button, e.buttons, nowDown);
          if (e.button !== 0) {
            rightButtonDown(e, nowDown);
            return;
          }
          if (chestFrom) {
            e.preventDefault();
            e.stopPropagation();
            swallowClick = true;
            return;
          }
          swallowClick = false;
          strokeFrom = null;
          if (PET && petPanelOpen && petPanel && petPanel.contains(e.target)) return;
          if (walking()) return;
          const h = hitAt(e.clientX, e.clientY);
          if (!h && !(PET && overBody(e.clientX, e.clientY))) return;
          e.preventDefault();
          e.stopPropagation();
          swallowClick = true;
          const head = armHeadOrChest(e, h);
          if (intro.phase !== "done" || fleeX !== 0 || link.opening) {
            if (h && !head) onTouch(h[0], h[1], h[2]);
            return;
          }
          const [px, py] = pt(e);
          drag.pending = { id: e.pointerId, sx: px, sy: py, h, ox: px - shown.x, oy: py - shown.y };
          chord.valid = true;
          if (e.pointerType === "touch") armTouchHold(e);
          if (PET) PET.press(true);
          preparePetOnPress();
        }, true);
        life.listen(document, "mousedown", (e) => {
          if (hidden) return;
          const now = performance.now();
          if (e.button === 2) {
            if (!(e.buttons & 1)) rightPress = rightStart(e);
            if (e.buttons & 1 && chordWithinGrace(chord, 2, e.buttons, now)) armChordGrab(e, now, rightPress?.id ?? e.pointerId);
            return;
          }
          if (e.button !== 0) return;
          if (e.buttons & 2 && rightPress?.hit && Number.isFinite(rightPress.id) && !drag.pending && !drag.on) {
            chord = chordDown(chord, 0, e.buttons, now);
            const [px, py] = pt(e);
            drag.pending = { id: rightPress.id, sx: px, sy: py, h: null, ox: px - shown.x, oy: py - shown.y };
            chord.valid = true;
            if (PET) PET.press(true);
            try {
              e.preventDefault();
              e.stopPropagation();
            } catch {
            }
            swallowClick = true;
          }
        }, true);
        life.listen(document, "mouseup", (e) => {
          if (e.button === 2) rightPress = null;
        }, true);
        const strokeKind = (st, e) => {
          const dy = e.clientY - st.y, dx = Math.abs(e.clientX - st.x);
          if (performance.now() - st.t < POT_MS) return dy > 55 && dy > dx * 1.2 ? "pot" : null;
          return dy > 40 && dy > dx * 0.8 ? "basin" : null;
        };
        const dragKeyRaw = () => String(prefs.drag?.key ?? "Alt").trim();
        const dragKeyToken = () => {
          const text = dragKeyRaw().toLowerCase();
          if (!text || text === "none") return "";
          if (text === "alt" || text === "option") return "alt";
          if (text === "ctrl" || text === "control") return "ctrl";
          if (text === "shift") return "shift";
          if (text === "meta" || text === "cmd" || text === "command" || text === "win" || text === "windows") return "meta";
          return text === "space" ? " " : text === "plus" ? "+" : text;
        };
        const pressedKeys = /* @__PURE__ */ new Set();
        const DRAG_MODIFIER_TOKENS = /* @__PURE__ */ new Set(["alt", "ctrl", "shift", "meta"]);
        const relayDragKey = (token, on) => {
          if (PET || !link.open || !token || DRAG_MODIFIER_TOKENS.has(token)) return;
          if (dragKeyToken() !== token) return;
          try {
            link.post("send", { list: [["dragheld", [token, on]]] });
          } catch {
          }
        };
        const rememberKey = (e, on) => {
          const token = String(e && e.key || "").toLowerCase();
          if (!token) return;
          if (on) pressedKeys.add(token);
          else pressedKeys.delete(token);
          relayDragKey(token, on);
        };
        addEventListener("keydown", (e) => rememberKey(e, true));
        addEventListener("keyup", (e) => rememberKey(e, false));
        addEventListener("blur", () => pressedKeys.clear());
        const dragKeyHeld = (e) => {
          if ((e.buttons & 1) !== 1) return false;
          const token = dragKeyToken();
          if (!token) return false;
          if (token === "alt") return !!e.altKey;
          if (token === "ctrl") return !!e.ctrlKey;
          if (token === "shift") return !!e.shiftKey;
          if (token === "meta") return !!e.metaKey;
          return pressedKeys.has(token);
        };
        const TOUCH = { grabMs: 320, movePx: 14, verticalPx: 8 };
        const touchGesture = ({ dx = 0, dy = 0, heldMs = 0, grabMs = TOUCH.grabMs, movePx = TOUCH.movePx, verticalPx = TOUCH.verticalPx }) => {
          if (Math.hypot(dx, dy) > movePx && Math.abs(dx) > Math.abs(dy) * 1.2) return "grab";
          if (Math.abs(dy) > verticalPx || Math.hypot(dx, dy) > movePx) return "stroke";
          return heldMs >= grabMs ? "grab" : "wait";
        };
        const classifyTouchMove = (e) => {
          if (!(e.pointerType === "touch" && drag.pending && !drag.pending.touchGrab && !drag.pending.touchStroke && e.pointerId === drag.pending.id)) return;
          const dx = e.clientX - drag.pending.sx, dy = e.clientY - drag.pending.sy;
          const gesture = touchGesture({ dx, dy });
          if (gesture === "wait") return;
          clearTimeout(touchHold);
          if (gesture === "grab") drag.pending.touchGrab = true;
          else drag.pending.touchStroke = true;
        };
        const chestMove = (e) => {
          const dy = e.clientY - chestFrom.y, dx = e.clientX - chestFrom.x, now = performance.now();
          if (!chestDragging) {
            if (dy < -12 && Math.abs(dy) > Math.abs(dx) && canPullChest(now)) {
              chestDragging = true;
              shy.count = 0;
              headClicks = [];
              clicks = [];
              cover.until = 0;
              drag.pending = null;
              walk.lastTouch = now;
              speak("chest_pull", 3e3);
              armChestLong();
              flashExp("squint", 400);
              flashExp("blush", 400);
            } else if (Math.hypot(dx, dy) >= 6 && !(dy < 0 && Math.abs(dy) > Math.abs(dx))) chestFrom = null;
            else {
              e.preventDefault();
              return true;
            }
          }
          if (!chestDragging) return false;
          const up = Math.max(0, -dy / curK);
          chestTarget = 1 - Math.exp(-up / 85);
          chestShiftTarget = clamp(dx / (curK * 110), -1, 1) * (0.45 + 0.55 * Math.min(1, chestTarget * 1.4));
          const moved = Math.hypot(dx - chestShake.x, dy - chestShake.y);
          chestShake.x = dx;
          chestShake.y = dy;
          if (moved > 1) {
            chestShake.acc += moved;
            chestShake.last = now;
          }
          e.preventDefault();
          e.stopPropagation();
          swallowClick = true;
          return true;
        };
        const strokeMove = (e) => {
          const st = strokeFrom, kind = strokeKind(st, e);
          if (kind) {
            strokeFrom = null;
            if (drag.pending) {
              drag.pending = null;
              if (PET) PET.press(false);
            }
            if (kind === "pot") potHit(st.x, st.y);
            else putBasin();
            return true;
          }
          const dy = e.clientY - st.y, dx = Math.abs(e.clientX - st.x);
          if (!drag.pending || Math.hypot(dx, dy) < 6 || dy > 0 && dy > dx * 0.8) return true;
          strokeFrom = null;
          return false;
        };
        const beginCarry = (e, p, px, py, now) => {
          cancelWalk();
          drag.on = true;
          drag.touch = e.pointerType === "touch" || !!(p && p.touchGrab);
          drag.samples = [];
          free.anim = null;
          free.k = shown.k;
          free.mode = freeMode();
          free.applied = true;
          petDocked = false;
          try {
            document.documentElement.setPointerCapture(e.pointerId);
          } catch {
          }
          document.documentElement.classList.add("dsc-grabbing");
          until.sweat = Infinity;
          walk.lastTouch = now;
          if (PET) {
            petGrab = { x: p.ox, y: p.oy };
            petTracking = true;
            drag.x = px - p.ox;
            drag.y = py - p.oy;
            drag.samples = [[now, px, py]];
            PET.send({ type: "track", on: true, grab: petGrab, off: { x: (innerWidth - W * free.k) / 2, y: innerHeight - H * free.k } });
          }
        };
        const carryMove = (e, p) => {
          strokeFrom = null;
          chestFrom = null;
          const [px, py] = pt(e), now = performance.now();
          if (!drag.on) beginCarry(e, p, px, py, now);
          if (PET && petTracking) {
            e.preventDefault();
            return;
          }
          drag.x = px - p.ox;
          drag.y = py - p.oy;
          drag.samples.push([now, px, py]);
          while (drag.samples.length > 2 && now - drag.samples[0][0] > 100) drag.samples.shift();
          const [t0, x0, y0] = drag.samples[0], dt = Math.max(16, now - t0) / 1e3;
          carry.vx += ((px - x0) / dt - carry.vx) * 0.5;
          carry.vy += ((py - y0) / dt - carry.vy) * 0.5;
          if (!PET) followPet(now);
          e.preventDefault();
        };
        life.listen(document, "pointermove", (e) => {
          if (hidden) return;
          if (PET && petPanelOpen && petPanel && petPanel.contains(e.target)) return;
          if (e.pointerType !== "touch") chordButtonsMoved(e, performance.now());
          classifyTouchMove(e);
          const touchGrab = !!(drag.pending && drag.pending.touchGrab && e.pointerId === drag.pending.id);
          const both = (e.buttons & 3) === 3 || touchGrab || dragKeyHeld(e);
          if (chestFrom && !both && e.pointerId === chestFrom.id && chestMove(e)) return;
          if (strokeFrom && !both && strokeMove(e)) return;
          const p = drag.pending;
          if (!p || e.pointerId !== p.id) return;
          if (e.buttons === 0) return endDrag(e, false);
          if (!both) {
            if (drag.on) endDrag(e, false);
            return;
          }
          carryMove(e, p);
        }, true);
        const followPet = (now) => {
          if (!link.supported || link.open) return;
          const k = free.k;
          const out = bodyOut({ k, x: drag.x, y: drag.y });
          const s2 = screenOf(drag.x, drag.y), pose2 = { k, x: s2.x, y: s2.y };
          if (!link.follow) {
            if (!out) return;
            if (link.petState !== "hidden") {
              if (now - link.peek > 250) {
                link.peek = now;
                if (link.petState === "none") link.post("warm");
                else link.poll();
              }
              return;
            }
            link.follow = { shown: false };
            link.last = "";
            link.post("open", { from: pose2, to: pose2, follow: true, grab: { x: drag.pending?.ox ?? 0, y: drag.pending?.oy ?? 0 }, seq: ++link.seq });
          }
        };
        const finishFollow = (vx, vy) => {
          const f = link.follow;
          link.follow = null;
          link.queue = [];
          lastPlaceKey = "";
          const outside = bodyOut({ k: free.k, x: drag.x + vx * GLIDE, y: drag.y + vy * GLIDE }, !f.shown);
          if (outside && f.shown) {
            link.post("send", { list: [["release", [vx, vy]]] });
            link.enter();
            return true;
          }
          if (!outside) link.post("hide");
          return false;
        };
        const endDrag = (e, cancel) => {
          const p = drag.pending;
          if (!p || e.pointerId !== p.id) return;
          clearTimeout(touchHold);
          drag.pending = null;
          strokeFrom = null;
          if (PET) PET.press(false);
          if (!drag.on) {
            if (!cancel && p.h) onTouch(p.h[0], p.h[1], p.h[2]);
            return;
          }
          drag.on = false;
          if (PET && petTracking) {
            petTracking = false;
            petGrab = null;
            PET.send({ type: "track", on: false });
          }
          try {
            document.documentElement.releasePointerCapture(e.pointerId);
          } catch {
          }
          document.documentElement.classList.remove("dsc-grabbing");
          until.sweat = performance.now() + 400;
          const moving = performance.now() - drag.samples[drag.samples.length - 1][0] < 80;
          const vx = moving ? carry.vx : 0, vy = moving ? carry.vy : 0;
          if (link.follow && finishFollow(vx, vy)) return;
          release(vx, vy, drag.touch);
        };
        life.listen(document, "pointerup", (e) => {
          if (hidden) return;
          mouseButtons = e.buttons & 3;
          chord = chordUp(chord, e.buttons);
          if (chestFrom && e.pointerId === chestFrom.id) {
            const dragged = chestDragging;
            releaseChest();
            if (dragged) {
              if (PET) PET.press(false);
              return;
            }
          }
          const st = strokeFrom;
          strokeFrom = null;
          if (drag.pending) return endDrag(e, false);
          if (st) onTouch(st.h[0], st.h[1], st.h[2]);
        }, true);
        addEventListener("blur", () => {
          mouseButtons = 0;
          chord = chordUp(chord, 0);
          rightPress = null;
          releaseChest();
          if (drag.pending) endDrag({ pointerId: drag.pending.id }, !drag.on);
        });
        life.listen(document, "pointercancel", (e) => {
          mouseButtons = 0;
          chord = chordUp(chord, e.buttons);
          rightPress = null;
          if (chestFrom && e.pointerId === chestFrom.id) {
            const d = chestDragging;
            releaseChest();
            if (d && PET) PET.press(false);
          }
          endDrag(e, true);
        }, true);
        for (const type of ["pointerup", "mousedown", "mouseup", "click", "dblclick"]) {
          life.listen(document, type, (e) => {
            if (!swallowClick) return;
            e.preventDefault();
            e.stopPropagation();
            if (type === "click" || type === "dblclick") setTimeout(() => {
              if (!chestFrom) swallowClick = false;
            }, 0);
          }, true);
        }
        let hoverCheck = 0;
        life.listen(document, "mousemove", (e) => {
          if (hidden) return;
          const now = performance.now();
          if (now - hoverCheck < 80) return;
          hoverCheck = now;
          if (PET && petPanelOpen && petPanel && petPanel.contains(e.target)) {
            document.documentElement.classList.remove("dsc-hover");
            return;
          }
          const over = !walking() && !!hitAt(e.clientX, e.clientY);
          document.documentElement.classList.toggle("dsc-hover", over);
        }, { passive: true });
        life.listen(document, "contextmenu", (e) => {
          if (hidden) return;
          if (drag.pending || drag.on) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (!PET) {
            if (coarsePointer() && overBody(e.clientX, e.clientY)) {
              e.preventDefault();
              e.stopPropagation();
            }
            return;
          }
          e.preventDefault();
          if (!petPanelOpen && !walking() && overBody(e.clientX, e.clientY)) PET.menu();
        }, true);
        const touchOnBody = (e) => {
          const t = e.touches && e.touches[0];
          return !!t && !PET && hitAt(t.clientX, t.clientY) !== null;
        };
        life.listen(document, "touchstart", (e) => {
          if (touchOnBody(e)) e.preventDefault();
        }, { passive: false, capture: true });
        life.listen(document, "touchmove", (e) => {
          if (drag.on || drag.pending) e.preventDefault();
        }, { passive: false, capture: true });
        const wheelResizes = (e) => (PET || !coarsePointer()) && free.applied && intro.phase === "done" && free.on && overBody(e.clientX, e.clientY);
        life.listen(document, "wheel", (e) => {
          if (hidden) return;
          if (PET && petPanelOpen && petPanel && petPanel.contains(e.target)) return;
          if (!wheelResizes(e)) return;
          e.preventDefault();
          e.stopPropagation();
          if (drag.on || free.anim || walk.phase || fleeX !== 0) return;
          const kMin = PET ? PET_K_MIN : SHOW_K, kMax = PET ? PET_K_MAX : Math.min(1.25, innerHeight * 0.45 / visH);
          const k0 = Math.min(free.k, kMax), k = Math.min(kMax, Math.max(kMin, k0 * Math.exp(-e.deltaY * 12e-4)));
          if (k === k0) return;
          if (PET) {
            free.x += W * (k0 - k) / 2;
            free.y += H * (k0 - k);
          }
          free.k = k;
          if (!PET) saveFree(false);
          else {
            petRememberRatio(petRatio());
            petSyncMenu();
            renderPetPanel();
          }
        }, { capture: true, passive: false });
        const PET_OUTFIT_ROWS = OUTFIT_ITEMS.map((item) => [item.key, item.ko]);
        const PET_BODY_ROWS = BODY_TYPES.map((body) => [body.key, body.ko]);
        function petKFit() {
          return Math.min(PET_K_MAX, (screen.availHeight - PET_BUBBLE) / H, (screen.availWidth - 40) / W);
        }
        function petClampK(k) {
          const n = Number(k);
          return Number.isFinite(n) ? Math.min(petKFit(), Math.max(PET_K_MIN, n)) : null;
        }
        function petRatio() {
          return petBaseK > 0 ? free.k / petBaseK : 1;
        }
        function petRatioBounds() {
          const minR = Math.max(0.05, PET_K_MIN / petBaseK);
          return { minR, maxR: Math.max(minR + 0.01, petKFit() / petBaseK) };
        }
        function petLoadRatio() {
          if (!PET) return 1;
          try {
            const n = parseFloat(localStorage.getItem(PET_SIZE_KEY) || "");
            return Number.isFinite(n) && n >= 0.1 && n <= 8 ? n : 1;
          } catch {
            return 1;
          }
        }
        function petRememberRatio(r) {
          if (!PET || !Number.isFinite(r) || r <= 0) return;
          clearTimeout(petSizeTimer);
          petSizeTimer = setTimeout(() => {
            try {
              localStorage.setItem(PET_SIZE_KEY, String(+r.toFixed(3)));
            } catch {
            }
          }, 250);
        }
        function petSizedPose(pose2, fromK, ratio) {
          if (ratio == null) return pose2;
          const k = petClampK(petBaseK * ratio);
          if (k == null || Math.abs(k - fromK) < 1e-3) return pose2;
          return { k, x: pose2.x + W * (fromK - k) / 2, y: pose2.y + H * (fromK - k) };
        }
        function petSyncMenu() {
          if (!PET) return;
          const outfit = prefs.outfit || {};
          const sig = JSON.stringify([+petRatio().toFixed(3), outfit]);
          if (sig === petMenuSig) return;
          petMenuSig = sig;
          PET.send({ type: "state", value: { size: +petRatio().toFixed(3), outfit } });
        }
        function petPanelBox(body) {
          if (!PET || !petPanelOpen || !petPanel) return body;
          const r = petPanel.getBoundingClientRect();
          const box = { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) };
          return body ? { l: Math.min(body.l, box.l), t: Math.min(body.t, box.t), r: Math.max(body.r, box.r), b: Math.max(body.b, box.b) } : box;
        }
        function petSetRatio(ratio, ms) {
          const k = petClampK(petBaseK * ratio);
          if (k == null || drag.on) return;
          const from = free.on && shown.k ? { k: shown.k, x: shown.x, y: shown.y } : { k: free.k, x: free.x, y: free.y };
          if (Math.abs(k - from.k) >= 1e-3) {
            const x = from.x + W * (from.k - k) / 2, y = from.y + H * (from.k - k);
            if (free.on) {
              if (ms > 0) free.anim = { t0: performance.now(), ms, from, to: { k, x, y }, snap: false };
              else {
                free.anim = null;
                free.x = x;
                free.y = y;
                free.k = k;
              }
            } else free.k = k;
          }
          petRememberRatio(k / petBaseK);
          petSyncMenu();
          renderPetPanel();
        }
        function renderPetPanel() {
          if (!petPanel) return;
          const { minR, maxR } = petRatioBounds();
          const minPct = Math.max(5, Math.ceil(minR * 100)), maxPct = Math.max(minPct + 1, Math.floor(maxR * 100));
          const pct = Math.min(maxPct, Math.max(minPct, Math.round(petRatio() * 100)));
          const slider = petPanel.querySelector("[data-size-slider]");
          if (slider) {
            if (slider.min !== String(minPct)) slider.min = String(minPct);
            if (slider.max !== String(maxPct)) slider.max = String(maxPct);
            if (slider.value !== String(pct)) slider.value = String(pct);
          }
          const out = petPanel.querySelector("[data-size-value]");
          if (out) out.textContent = pct + "%";
          const outfit = prefs.outfit || {};
          for (const input of petPanel.querySelectorAll("[data-outfit]")) input.checked = outfit[input.dataset.outfit] === true;
          const body = outfit.bodyType || "default";
          for (const input of petPanel.querySelectorAll("[data-body]")) input.checked = input.value === body;
        }
        function createPetPanel() {
          const root = life.own(document.createElement("div"), (node) => node.remove());
          root.id = "dsc-pet-panel";
          root.setAttribute("role", "dialog");
          root.setAttribute("aria-label", "캐릭터 설정");
          root.innerHTML = [
            '<div class="dsc-panel-head"><strong>설정</strong><button type="button" class="dsc-panel-close" data-close aria-label="닫기">×</button></div>',
            '<section class="dsc-panel-section"><div class="dsc-panel-row"><span>크기 <small>기본 대비</small></span><output data-size-value>100%</output></div>',
            '<input type="range" min="50" max="200" step="1" data-size-slider aria-label="캐릭터 크기"></section>',
            '<section class="dsc-panel-section"><div class="dsc-panel-sub">소품·옷</div>',
            ...PET_OUTFIT_ROWS.map(([key, label]) => `<label class="dsc-panel-check"><input type="checkbox" data-outfit="${key}"> ${label}</label>`),
            "</section>",
            '<section class="dsc-panel-section"><div class="dsc-panel-sub">체형</div>',
            ...PET_BODY_ROWS.map(([value, label]) => `<label class="dsc-panel-check"><input type="radio" name="dsc-pet-body" value="${value}" data-body> ${label}</label>`),
            "</section>",
            '<section class="dsc-panel-section dsc-panel-actions"><button type="button" data-hide>캐릭터 잠시 숨기기</button></section>'
          ].join("");
          document.body.append(root);
          root.addEventListener("click", (e) => {
            if (e.target.closest("[data-close]")) closePetPanel();
          });
          const slider = root.querySelector("[data-size-slider]");
          slider.addEventListener("input", () => petSetRatio(Number(slider.value) / 100, 0));
          for (const input of root.querySelectorAll("[data-outfit]")) input.addEventListener("change", () => PET.send({ type: "config", list: [[input.dataset.outfit, input.checked]] }));
          for (const input of root.querySelectorAll("[data-body]")) input.addEventListener("change", () => {
            if (input.checked) PET.send({ type: "config", list: [["bodyType", input.value]] });
          });
          root.querySelector("[data-hide]").addEventListener("click", () => {
            closePetPanel();
            PET.send({ type: "config", list: [["character", false]] });
          });
          return root;
        }
        function fitPetPanel() {
          if (!petPanel) return;
          const r = petPanel.getBoundingClientRect();
          if (!r.width || !r.height) return;
          const l = Math.max(0, screen.availLeft - screenX), t = Math.max(0, screen.availTop - screenY);
          const rr = Math.min(innerWidth, screen.availLeft + screen.availWidth - screenX);
          const bb = Math.min(innerHeight, screen.availTop + screen.availHeight - screenY);
          const x = Math.max(l + 4, Math.min(rr - r.width - 4, (l + rr - r.width) / 2));
          const y = Math.max(t + 4, Math.min(bb - r.height - 4, (t + bb - r.height) / 2));
          petPanel.style.left = Math.round(x) + "px";
          petPanel.style.top = Math.round(y) + "px";
          petPanel.style.transform = "none";
        }
        function openPetPanel(focus) {
          if (!PET) return;
          if (!petPanel) petPanel = createPetPanel();
          renderPetPanel();
          petPanel.classList.add("show");
          petPanelOpen = true;
          const room = Number(screen?.availHeight) > 0 ? Math.round(screen.availHeight - 48) : 560;
          petPanel.style.maxHeight = Math.max(260, Math.min(560, room)) + "px";
          petPanelWin = { w: innerWidth, h: innerHeight };
          fitPetPanel();
          const slider = focus === "size" && petPanel.querySelector("[data-size-slider]");
          if (slider) slider.focus({ preventScroll: true });
          petSyncMenu();
        }
        function closePetPanel() {
          if (!petPanel) return;
          petPanelOpen = false;
          petPanelWin = { w: 0, h: 0 };
          petPanel.classList.remove("show");
        }
        listeners.tool = (text) => {
          const now = performance.now();
          if (waitingKind || now - lastToolSay < 1500) return;
          lastToolSay = now;
          say(text, 0, false, "status");
        };
        let lastThought = "", lastMutterAt = 0;
        const mutterCheck = () => {
          const raw = readThought(document);
          if (!raw || raw === lastThought) return;
          lastThought = raw;
          const now = performance.now();
          if (now - lastMutterAt < 6e3 || now - lastSayAt < 2500) return;
          const line = thoughtLine(raw);
          if (!line) return;
          lastMutterAt = now;
          say(line, Math.min(5200, Math.max(3800, 1500 + line.length * 55)), true);
          if (Math.random() < 0.35) play("tilt", 1600);
        };
        if (!PET) setTimeout(() => {
          if (!link.open) {
            say(TEXT.hello, 5800, false, "reaction");
            play("sway", 2300);
          }
        }, 700);
        if (life.stopped) return;
        window.__dsc = { say, play, setMood, flashExp, sulking: () => performance.now() < sulkUntil, sulkPeeks: () => sulkPeeks.map((p) => ({ at: Math.round(p.at), flip: p.flip })), walk: () => {
          if (!walk.phase && fleeX === 0) startWalk();
          return walk.phase;
        }, walking: () => walk.phase, sleep: () => SLEEP.state, regionAt: (cx, cy) => {
          const h = hitAt(cx, cy);
          return h && touchRegion(h[0], h[1], h[2]);
        }, fleeX: () => fleeX, bubble: () => bubble.classList.contains("show") ? bubble.textContent : "", lines: TEXT, voice: (s2) => {
          voiceState = s2 && s2.speaking !== false ? s2 : null;
        } };
        const petLinkEnter = () => {
          skipIntro();
          free.anim = null;
          drag.pending = null;
          drag.on = false;
          setRender(false);
        };
        const petLinkLeave = () => {
          wakeRaf();
          SLEEP.state = "active";
          SLEEP.lastActive = performance.now();
          free.on = false;
          free.anim = null;
          saveFree();
          lastPlaceKey = "";
          if (!hidden) setRender(true);
        };
        const petLinkSnapshot = () => {
          const left = moodUntil ? Math.max(1, moodUntil - performance.now()) : 0;
          const list = [...Object.keys(hold).map((name) => ["setExp", [name, !!hold[name]]]), ["setMood", [mood, left]]];
          if (!bubble.classList.contains("show")) list.push(["hush", []]);
          return list;
        };
        const petLinkDragMessages = () => {
          const list = [["drag", [dragKeyRaw()]]];
          const dragToken = dragKeyToken();
          if (dragToken && !DRAG_MODIFIER_TOKENS.has(dragToken)) list.push(["dragheld", [dragToken, pressedKeys.has(dragToken)]]);
          return list;
        };
        const petLinkDock = () => {
          const h = dockTarget(homePose()), d = screenOf(h.x - fleeX, h.y);
          const k2 = h.k * PET_HEAD_RATIO;
          const wx = d.x + W * h.k / 2;
          const wy = d.y + h.k * WAIST_WIN;
          const tl = screenOf(0, 0), br = screenOf(innerWidth, innerHeight);
          const dock = {
            k: +k2.toFixed(3),
            x: Math.round(wx - k2 * (W / 2 + (BUST_CX - FULL_CX) * sFull)),
            y: Math.round(wy - k2 * WAIST_PET),
            win: { l: Math.round(tl.x), t: Math.round(tl.y), r: Math.round(br.x), b: Math.round(br.y) }
          };
          return { dock, outfit: prefs.outfit || {} };
        };
        const petOpenScreenPose = () => {
          const pose2 = SLEEP.state === "active" && shown.k > 0 ? { k: shown.k, x: shown.x, y: shown.y } : dockTarget(homePose());
          const s2 = screenOf(pose2.x, pose2.y);
          return { k: pose2.k, x: s2.x, y: s2.y };
        };
        link.start();
        if (!PET) hooks.togglePet = link.toggle;
        if (PET) {
          const local = { say, play, setMood, flashExp, setExp, hush };
          const onPetCursor = (m) => {
            if (!drag.on || !petGrab) return;
            const now = performance.now();
            drag.x = m.x - petGrab.x;
            drag.y = m.y - petGrab.y;
            drag.samples.push([now, m.x, m.y]);
            while (drag.samples.length > 2 && now - drag.samples[0][0] > 100) drag.samples.shift();
            const [t0, x0, y0] = drag.samples[0], dt = Math.max(16, now - t0) / 1e3;
            carry.vx += ((m.x - x0) / dt - carry.vx) * 0.5;
            carry.vy += ((m.y - y0) / dt - carry.vy) * 0.5;
          };
          const onPetPower = (m) => {
            if (!m.on) {
              petTracking = false;
              petGrab = null;
              closePetPanel();
            }
            petPower = !!m.on;
            setRender(petPower);
            if (petPower) wakeRaf();
          };
          const onPetOpen = (m) => {
            petPower = true;
            setRender(true);
            wakeRaf();
            for (const t of walk.timers) clearTimeout(t);
            walk.timers = [];
            walk.slideId++;
            walk.phase = "";
            fleeX = 0;
            drag.pending = null;
            PET.press(false);
            closePetPanel();
            petDocked = false;
            free.on = true;
            Object.assign(free, m.from);
            petGrab = m.follow ? m.grab || { x: 0, y: 0 } : null;
            petTracking = !!m.follow;
            const kFrom = Number(m.from.k) || 1;
            const kBase = Math.min(petKFit(), Math.max(PET_K_MIN, kFrom * HEAD_GAIN));
            petBaseK = kBase;
            const ratio = petLoadRatio();
            petPendingRatio = m.follow ? ratio : null;
            const kApply = m.follow ? kBase : petClampK(kBase * ratio);
            if (kApply !== kFrom) {
              const dk = kFrom - kApply;
              free.x += W * dk / 2;
              free.y += H * dk;
              free.k = kApply;
              if (petGrab) petGrab = { x: petGrab.x * kApply / kFrom, y: petGrab.y * kApply / kFrom };
            }
            const pose2 = { k: free.k, x: free.x, y: free.y }, to = { k: kApply, x: m.to.x + W * (kFrom - kApply) / 2, y: m.to.y + H * (kFrom - kApply) };
            PET.send({ type: "track", on: !!m.follow, grab: petGrab, off: { x: (innerWidth - W * pose2.k) / 2, y: innerHeight - H * pose2.k } });
            drag.on = !!m.follow;
            drag.x = pose2.x;
            drag.y = pose2.y;
            drag.samples = [[performance.now(), pose2.x + (petGrab?.x ?? 0), pose2.y + (petGrab?.y ?? 0)]];
            free.anim = m.follow ? null : { t0: performance.now(), ms: 300, from: pose2, to: keepIn(to), snap: false };
            until.sweat = m.follow ? Infinity : 0;
            movePet(pose2);
            PET.send({ type: "placed" });
            petSyncMenu();
          };
          const onPetHome = () => {
            closePetPanel();
            if (petDock) free.anim = { t0: performance.now(), ms: 650, from: { ...shown }, to: null, snap: true };
            else PET.send({ type: "attach" });
          };
          const releaseFromHost = (vx, vy) => {
            petGrab = null;
            petTracking = false;
            PET.send({ type: "track", on: false });
            drag.on = false;
            until.sweat = performance.now() + 400;
            release(vx, vy);
          };
          const PET_COMMANDS = {
            outfit: (a) => {
              prefs.outfit = a[0];
              renderPetPanel();
              petSyncMenu();
            },
            dock: (a) => {
              petDock = a[0];
            },
            voice: (a) => {
              voiceState = a[0];
            },
            drag: (a) => {
              prefs.drag = { key: a[0] };
            },
            // 창 안 캐릭터와 같은 이동 키
            dragheld: (a) => {
              if (a[1]) pressedKeys.add(a[0]);
              else pressedKeys.delete(a[0]);
            },
            // 포커스 없는 펫 창에 키 상태 전달
            release: (a) => {
              if (drag.on) releaseFromHost(a[0], a[1]);
            }
          };
          const onPetCommands = (m) => {
            for (const [fn, a] of m.list || []) {
              if (Object.hasOwn(PET_COMMANDS, fn)) PET_COMMANDS[fn](a);
              else if (Object.hasOwn(local, fn) && Array.isArray(a)) local[fn](...a);
            }
          };
          const PET_MESSAGES = {
            cursor: onPetCursor,
            power: onPetPower,
            panel: (m) => openPetPanel(m.focus),
            // 우클릭 메뉴: 설정(또는 크기) 패널 열기
            size: (m) => petSetRatio(Number(m.ratio), 220),
            // 우클릭 메뉴: 정해진 배율로 (기본 대비)
            open: onPetOpen,
            home: onPetHome,
            cmd: onPetCommands
          };
          PET.on((m) => {
            if (Object.hasOwn(PET_MESSAGES, m.type)) PET_MESSAGES[m.type](m);
          });
          petPower = false;
          setRender(false);
          PET.send({ type: "ready" });
        }
        const readSleepPrefs = () => {
          const cfg = prefs.sleep || {};
          SLEEP.enabled = !PET && cfg.enabled !== false;
          const cfgMin = Number(cfg.minutes);
          SLEEP.minutes = Number.isFinite(cfgMin) ? Math.min(60, Math.max(0.5, cfgMin)) : 1;
        };
        const reactToWaiting = (kind) => {
          if (kind === waitingKind) return;
          waitingKind = kind;
          setExp("sweat", kind === "approval");
          setExp("squint", kind === "question");
          if (kind) {
            say(TEXT[kind], 0, false, "reaction");
            setMood("wait");
            play("tilt", 1800);
          } else {
            setMood(running ? "work" : "idle");
            if (running) hush();
          }
        };
        const reactToFinish = () => {
          if (running) return;
          if (performance.now() - lastError < 8e3) {
            flashExp("tears", 5e3);
            flashExp("dizzy", 2500);
            say(TEXT.error, 5e3, false, "reaction");
            setMood("sad", 5e3);
            play("droop", 2e3);
          } else {
            flashExp("heart", 4e3);
            flashExp("blush", 4e3);
            say(TEXT.done, 4e3, false, "reaction");
            setMood("idle");
            play("laugh", 1700);
          }
        };
        const reactToRunning = (nowRunning) => {
          if (nowRunning && !running) {
            running = true;
            lastError = -1e9;
            setExp("loading", true);
            if (!waitingKind) {
              say(TEXT.start, 2500, false, "reaction");
              setMood("work");
              play("nod", 1300);
            }
          } else if (!nowRunning && running) {
            running = false;
            setExp("loading", false);
            setTimeout(reactToFinish, 600);
          }
        };
        const sleepDue = () => SLEEP.enabled && SLEEP.state === "active" && !running && !waitingKind && !document.hidden && performance.now() - SLEEP.lastActive > SLEEP.minutes * 6e4 && performance.now() - lastSayAt > 5e3 && !bubble.classList.contains("show");
        if (!PET) setInterval(() => {
          const { running: nowRunning, waiting: kind } = readStatus(document);
          readSleepPrefs();
          if (nowRunning || kind || !SLEEP.enabled) sleepActivity();
          if (SLEEP.state === "asleep") return;
          if (nowRunning && !waitingKind && !kind) mutterCheck();
          reactToWaiting(kind);
          reactToRunning(nowRunning);
          if (sleepDue()) sleepGo();
        }, 400);
      })().catch((e) => console.warn("DeepSeek짱 캐릭터 로드 실패:", e));
    });
    return {
      // 플러그인 설정이 바뀌면 부른다. 패널 숨김(pageHidden)이 바뀌면 바로 숨김/복구를 반영한다
      setPrefs(next) {
        const pageChanged = "pageHidden" in next && next.pageHidden !== prefs.pageHidden;
        Object.assign(prefs, next);
        if (pageChanged) hooks.syncPageHidden?.();
      },
      // 모델이 준비되기 전에는 null (단축키는 이때 키 입력을 가로채지 않는다)
      get togglePet() {
        return hooks.togglePet || null;
      },
      get toggleCanvas() {
        return hooks.toggleCanvas || null;
      },
      canvasHidden: () => hooks.canvasHidden?.() === true
    };
  }

  // character/lifetime.ts
  function createLifetime() {
    let stopped = false;
    const cleanups = [];
    const timers = /* @__PURE__ */ new Set(), intervals = /* @__PURE__ */ new Set(), frames = /* @__PURE__ */ new Set();
    const add = (cleanup) => {
      if (stopped) cleanup();
      else cleanups.push(cleanup);
    };
    const timeout = (fn, ms, ...args) => {
      if (stopped) return 0;
      const id = window.setTimeout(() => {
        timers.delete(id);
        if (!stopped) fn(...args);
      }, ms);
      timers.add(id);
      return id;
    };
    const interval = (fn, ms, ...args) => {
      if (stopped) return 0;
      const id = window.setInterval(() => {
        if (!stopped) fn(...args);
      }, ms);
      intervals.add(id);
      return id;
    };
    const frame = (fn) => {
      if (stopped) return 0;
      const id = window.requestAnimationFrame((time) => {
        frames.delete(id);
        if (!stopped) fn(time);
      });
      frames.add(id);
      return id;
    };
    const listen = (target, type, fn, options) => {
      if (stopped) return;
      target.addEventListener(type, fn, options);
      add(() => target.removeEventListener(type, fn, options));
    };
    const observe = (fn) => {
      const observer = new window.MutationObserver((...args) => {
        if (!stopped) fn(...args);
      });
      add(() => observer.disconnect());
      return observer;
    };
    const own = (value, cleanup) => {
      add(() => cleanup(value));
      return value;
    };
    return {
      add,
      timeout,
      interval,
      frame,
      listen,
      observe,
      own,
      get stopped() {
        return stopped;
      },
      dispose() {
        if (stopped) return;
        stopped = true;
        for (const id of timers) window.clearTimeout(id);
        for (const id of intervals) window.clearInterval(id);
        for (const id of frames) window.cancelAnimationFrame(id);
        for (const cleanup of cleanups.reverse()) {
          try {
            cleanup();
          } catch (error) {
            console.warn("DeepSeek짱 cleanup:", error);
          }
        }
      }
    };
  }

  // character/standalone.ts
  createCharacter({
    base: new URL("./", document.currentScript.src).href,
    life: createLifetime(),
    pet: window.__dscPetMode ? window.dscPet : null
  });
})();
