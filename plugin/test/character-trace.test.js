import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { GOLDEN, GOLDEN_PET, bundleCharacter, runTrace, summarize } from './trace/harness.mjs'

// 캐릭터 동작 기준 기록(골든 트레이스)과 지금 소스의 기록이 프레임마다 같은지 본다.
// 리팩터링(함수 분해·모듈 분리·TS 전환)은 같은 입력에 같은 모델 파라미터·배치·펫 프로세스 메시지를 내야 한다.
// 의도한 동작 변경이면 `node plugin/test/trace/harness.mjs --update`로 기준을 다시 만들고 함께 커밋한다.
// 어디가 달라졌는지는 `node plugin/test/trace/harness.mjs --diff <기준 소스가 있는 저장소> [--pet]`로 본다.
const root = fileURLToPath(new URL('../../', import.meta.url))
const code = await bundleCharacter(root)

for (const [name, file, opts] of [['창 안 캐릭터', GOLDEN, {}], ['바깥 펫 창', GOLDEN_PET, { pet: true }]]) {
  test(`${name}: 캐릭터 동작이 기준 기록과 프레임마다 같다`, async () => {
    const golden = JSON.parse(await readFile(file, 'utf8'))
    const now = summarize(await runTrace(code, opts))
    assert.equal(now.frames, golden.frames, '기록한 프레임 수')
    const first = now.hashes.findIndex((h, i) => h !== golden.hashes[i])
    if (first >= 0) {
      const sample = golden.samples.find((s) => s.f >= first)
      const mine = now.samples.find((s) => s.f === sample?.f)
      assert.fail(`프레임 ${first}부터 다릅니다 (전체 ${now.frames}).\n가까운 기준 표본 f=${sample?.f}: ${JSON.stringify(sample)}\n지금: ${JSON.stringify(mine)}`)
    }
  })
}
