import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { coverage, extractDictionaries, flatten, mergeTranslations, placeholders } from '../locales.mjs'

test('번들의 locale.register에서 지정한 언어 사전만 정적으로 읽는다', () => {
  const source = `const t = { a: "A", b: "x" + "y" }; locale.register("ns", { en: t, zh: { a: "甲" } }); ctx.locale.register("other", { en: { "dot.key": "D {name}" } });`
  assert.deepEqual(extractDictionaries(source, 'en'), { ns: { a: 'A', b: 'xy' }, other: { 'dot.key': 'D {name}' } })
  assert.deepEqual(extractDictionaries(source, 'zh'), { ns: { a: '甲' } })
})

test('키 이름에 점이 들어 있어도 중첩 경로와 섞이지 않는다', () => {
  assert.deepEqual(flatten({ 'message.copy': 'C', nested: { x: 'X' } }), [['message.copy', 'C'], ['nested›x', 'X']])
  const en = { chat: { 'message.copy': 'Copy', nested: { x: 'X' } } }
  const ko = { chat: { 'message.copy': '복사' } }
  const report = coverage(en, ko)
  assert.equal(report.count, 1)
  assert.deepEqual(report.missing, { chat: { 'nested›x': 'X' } })
})

test('병합: 자리표시자가 다르거나 영어에 없는 키·빈 번역은 거절하고, 있는 번역은 덮지 않는다', () => {
  const en = { ns: { a: 'Hello {name}', b: 'B', c: 'C', d: '{n} of {total}' } }
  const ko = { ns: { c: '기존' } }
  const { next, added, problems } = mergeTranslations(ko, en, { ns: { a: '안녕 {이름}', b: '비', c: '새것', d: '{total}개 중 {n}', x: '없음' }, other: { y: 'Y' } })
  assert.equal(added, 2)
  assert.deepEqual(next.ns, { c: '기존', b: '비', d: '{total}개 중 {n}' })
  assert.equal(problems.length, 3)
  assert.match(problems.join('\n'), /ns:a 자리표시자 다름/)
  assert.deepEqual(placeholders('{b} {a} {b}'), ['{a}', '{b}', '{b}'])
  assert.deepEqual(ko, { ns: { c: '기존' } }, '원본은 바꾸지 않는다')
})

test('한국어 사전의 모든 문구는 문자열이고 자리표시자 중괄호 짝이 맞다', async () => {
  // 구분자·접두어처럼 한국어에서는 비워 두는 값(예: sentenceSeparator)이 있어 빈 문자열은 허용한다
  const ko = JSON.parse(await readFile(new URL('../locales.ko.json', import.meta.url), 'utf8'))
  for (const [ns, dict] of Object.entries(ko)) {
    for (const [key, text] of flatten(dict)) {
      assert.equal(typeof text, 'string', `${ns}:${key}`)
      assert.equal((text.match(/\{/g) || []).length, (text.match(/\}/g) || []).length, `${ns}:${key} 중괄호 짝`)
    }
  }
})
