// assets/dsc.js 진입점: <script src=".../dsc.js">로 바로 실행되는 곳(바깥 펫 창 pet/index.html)에서 쓴다.
// 자산 폴더는 이 스크립트 주소 기준이고, 수명은 창이 닫힐 때까지라 정리하지 않는다.
// 펫 창은 pet/index.html이 __dscPetMode를, preload가 window.dscPet(메인 프로세스와의 통로)을 넣어 준다.
// 설정값(소품·옷·이동 키)은 창 안 캐릭터가 펫 연결로 보내 준다.
import { createCharacter } from './index.ts'
import { createLifetime } from './lifetime.ts'

createCharacter({
  base: new URL('./', (document.currentScript as HTMLScriptElement).src).href,
  life: createLifetime(),
  pet: window.__dscPetMode ? window.dscPet : null,
})
