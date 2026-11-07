// assets/dsc.js 진입점: <script src=".../dsc.js">로 바로 실행되는 곳(바깥 펫 창 pet/index.html)에서 쓴다.
// 자산 폴더는 이 스크립트 주소 기준이고, 수명은 창이 닫힐 때까지라 정리하지 않는다.
import { createCharacter } from './index.js'
import { createLifetime } from './lifetime.js'

createCharacter({ base: new URL('./', document.currentScript.src).href, life: createLifetime() })
