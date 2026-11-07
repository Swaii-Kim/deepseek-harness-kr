// 캐릭터 코드가 읽는 브라우저 전역 (타입 검사 전용). PIXI·Live2D는 assets/vendor 스크립트가 실행 중에 넣는다.
import type { PetBridge } from "./types.ts";

declare global {
  // eslint-disable-next-line no-var
  var PIXI: any;
  interface Window {
    PIXI?: any;
    Live2DCubismCore?: unknown;
    /** 디버그·말풍선 음성(dsh-tts)이 쓰는 캐릭터 핸들 */
    __dsc?: any;
    /** 펫 창(pet/index.html)이 켜는 표시 */
    __dscPetMode?: boolean;
    dscPet?: PetBridge;
    webkitAudioContext?: typeof AudioContext;
  }
  // Chromium 확장: 여러 모니터에서 화면 왼쪽 위
  interface Screen { availLeft?: number; availTop?: number }
}
export {};