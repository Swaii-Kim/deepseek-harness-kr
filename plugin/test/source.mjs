// 캐릭터 소스(character/*.ts)를 테스트에서 읽을 때 타입 표기만 공백으로 지운다.
// 줄 위치와 나머지 글자는 그대로라, 소스 구간을 잘라 vm으로 실행하거나 문장 모양을 확인하는 테스트가 그대로 동작한다.
// 타입이 지워진 자리에 남는 공백(`(on        )`, `let x          = null`)은 `)`·`,` 앞에서는 지우고 `=` 앞에서는 한 칸으로 맞춘다.
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'

const quiet = (fn) => {
  const emit = process.emitWarning
  process.emitWarning = (warning, ...rest) => { if (!String(warning).includes('stripTypeScriptTypes')) emit.call(process, warning, ...rest) }
  try { return fn() } finally { process.emitWarning = emit }
}
/** @param {URL | string} url */
export const readSource = (url) => quiet(() => stripTypeScriptTypes(readFileSync(url, 'utf8'))).replace(/(?<=\S) {2,}(?=[),=])/g, (m, i, all) => (all[i + m.length] === '=' ? ' ' : ''))