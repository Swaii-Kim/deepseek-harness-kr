import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { bundleCharacter, runTrace } from './trace/harness.mjs'
import { BUILTIN_BEHAVIORS } from '../../character/behaviors/index.ts'

const root = fileURLToPath(new URL('../..', import.meta.url))
const shown = (frames) => new Set(frames.map((f) => (f.bubble?.cls?.includes('show') ? f.bubble.text : '')).filter(Boolean))
/** 대사 꼬리표([표정])를 뗀 문장 */
const plain = (line) => line.replace(/^\[[^\]]+\]\s*/, '')

test('행동 목록이 비면(3D 기본) 냄비·세숫대야·삐짐·가슴·아랫배·소품 대사 없이 모든 터치가 기본 반응이다', async () => {
  const frames = await runTrace(await bundleCharacter(root, { behaviors: [] }), { fallbackRegion: 'body' })   // 가슴·아랫배는 몸으로 판정됨
  const said = shown(frames)
  for (const def of BUILTIN_BEHAVIORS) for (const [concept, lines] of Object.entries(def.lines || {}))
    for (const line of lines) assert.ok(!said.has(plain(line)), `${def.id} 대사(${concept})가 나오면 안 됨: ${line}`)
  assert.ok(frames.every((f) => !f.params || !('key10' in f.params)), '세숫대야 파라미터를 쓰지 않음')
  const settled = frames[1000].overlays   // 시작 연출·창 크기 변경이 끝난 뒤 (터치 시나리오는 그 뒤)
  assert.ok(frames.slice(1000).every((f) => f.overlays === settled), '냄비·충격 그림 같은 연출 요소가 붙지 않음')
  assert.ok(said.size > 5, '기본 반응 대사는 그대로 나옴')
})

test('Live2D 기본 프로필(전체 행동)은 같은 입력에서 고유 행동 대사를 낸다', async () => {
  const said = shown(await runTrace(await bundleCharacter(root)))
  for (const concept of ['pot_hit', 'pot_guard', 'basin_on', 'head_sulk', 'head_after', 'chest3', 'chest_calm', 'lower3', 'lower_after'])
    assert.ok(BUILTIN_BEHAVIORS.some((def) => (def.lines?.[concept] || []).some((line) => said.has(plain(line)))), `${concept} 대사가 나와야 함`)
})
