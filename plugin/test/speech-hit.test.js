import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSyllables } from '../../character/speech.ts'
import { meshBounds, meshHit } from '../../character/hit.ts'

const fixed = (v) => () => v

test('음절: 한글은 중성으로 입 모양을 고르고 낱말 첫소리에 힘을 준다', () => {
  const { syl } = parseSyllables('가 이', 10000, fixed(0))
  assert.deepEqual(syl.map((s) => s.v), ['A', null, 'I'])
  assert.deepEqual(syl.map((s) => s.stress), [true, undefined, true])
  assert.equal(syl[0].d, 0.15); assert.equal(syl[0].amp, 0.65)
})

test('음절: 영어는 이어진 모음을 하나로, 문장 부호는 쉼, 숫자는 A', () => {
  const { syl } = parseSyllables('book, 7!', 10000, fixed(0))
  assert.deepEqual(syl.map((s) => s.v), ['O', null, null, 'A', null])
  assert.deepEqual(syl.map((s) => s.d), [0.13, 0.12, 0.07, 0.12, 0.24])
})

test('음절: 말풍선 시간의 92% 안에 끝나도록 길이를 줄인다', () => {
  const { syl, total } = parseSyllables('가나다라마바사아자차카타파하', 1000, fixed(1))
  assert.ok(Math.abs(total - 0.92) < 1e-9)
  assert.ok(Math.abs(syl.reduce((s, x) => s + x.d, 0) - 0.92) < 1e-9)
})

test('메시: 감싸는 사각형과, 그림이 있는 삼각형 위인지', () => {
  const v = [0, 0, 10, 0, 10, 10, 0, 10], idx = [0, 1, 2, 0, 2, 3], uv = [0, 0, 1, 0, 1, 1, 0, 1]
  assert.deepEqual(meshBounds(v), [0, 0, 10, 10])
  const seen = []
  assert.equal(meshHit(v, idx, uv, 8, 2, (u, w) => { seen.push([u, w]); return 255 }), true)
  assert.ok(Math.abs(seen[0][0] - 0.8) < 1e-9 && Math.abs(seen[0][1] - 0.2) < 1e-9, '텍스처 좌표를 무게중심으로 보간')
  assert.equal(meshHit(v, idx, uv, 20, 2, () => 255), false, '삼각형 밖')
  assert.equal(meshHit(v, idx, uv, 5, 5, () => 10), false, '투명한 곳')
})
