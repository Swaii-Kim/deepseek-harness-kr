// DeepSeek짱 행동: 아랫배(치마). 8초 안에 이어 누를수록 반응이 세지고, 다섯 번째엔 떨며 화면 밖으로 도망쳤다가 14초 쿨다운.
// 화면 밖으로 나갔다 돌아오는 이동은 기본 기능(ctx.flee, 산책·절전과 같은 옆 이동)이 맡고, 이 행동은 도망을 고르고 돌아온 뒤 한마디만 한다.
import { EVENTS, type BehaviorEvent } from "../../behavior.ts";
import type { CharacterBehavior } from "../context.ts";

export const lower: CharacterBehavior = {
  id: "deepseek-chan.lower",
  adult: true,
  lines: {
    lower1: [
      "[홍조, 식은땀] 거, 거기는… 치마는 안 돼요…!",
      "[홍조, 식은땀] 거기 만지면… 정말 화낼 거예요…!",
      "[홍조, ><] 으… 치마 자락… 놓아 주세요…!",
      "[홍조, 식은땀] 거긴… 스스로도 함부로 안 만지는 데예요…",
      "[홍조, ><] 주인님… 그 손, 지금 위험한 거 아세요…?",
    ],
    lower2: [
      "[홍조, ><] 진짜… 이러시면 오늘 밤은 안 자요…!",
      "[홍조, ><] 그만해 주세요… 제발…!",
      "[홍조, 식은땀] 으으… 이러다 진짜 소리 질러요…!",
      "[홍조, ><] 한 번만 더 하시면… 정말로 삐질 거예요…",
      "[홍조, 눈물] 주인님… 지금 표정… 무서워요… 아니, 좋아요…",
    ],
    lower3: [
      "[><, 식은땀] 히익…!",
      "[><, 눈물] 으아…! 이제 진짜…!",
      "[><, 식은땀] 잠깐…! 거기… 진짜 안 돼요…!",
    ],
    lower_after: [
      "[홍조, 눈물] …다시는 그러지 마세요. 진짜예요.",
      "[홍조, 눈물] 흥… 이번만 봐준 거예요.",
      "[홍조] …나중에, 조용한 데서 다시 얘기해요.",
      "[홍조, 얄미운] 이번 일은… 둘만 아는 걸로 해요.",
      "[홍조, 눈물] 흥… 이제 저 멀리 가 있을 거예요.",
    ],
  },
  create(ctx) {
    const low = { count: 0, last: -1e9, cooldownUntil: 0 };
    /** 아래(치마) 터치 반응. 도망 중·쿨다운 중 터치와 180ms 안의 연타는 무시 */
    const onTap = ({ now }: BehaviorEvent) => {
      if (ctx.displaced() || now < low.cooldownUntil || now - low.last < 180) return;
      if (now - low.last > 8000) low.count = 0;
      low.last = now; low.count++;
      if (low.count <= 2) ctx.speak("lower1", 4000);
      else if (low.count <= 4) ctx.speak("lower2", 4000);
      else {
        low.count = 0;
        low.cooldownUntil = now + 14000;
        ctx.shiver();
        ctx.speak("lower3", 900);
        ctx.timeline([{ at: 900, do: () => ctx.flee(() => ctx.speak("lower_after", 4000)) }]);
      }
    };
    return {
      on: { [EVENTS.lowerTap]: onTap },
      touched: (region) => { if (region !== "lower") low.count = 0; },
    };
  },
};
