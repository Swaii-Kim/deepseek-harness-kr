// 한국어 사전(plugin/locales.ko.json) 관리 도구. 사전 원본은 locales.ko.json 자체이고, 설치된 DSH의 영어 사전과 비교해 빠진 키를 찾는다.
// 앱 코드를 실행하지 않고 번들의 locale.register(ns, { en: {...} }) 정적 사전만 읽는다.
//   node plugin/locales.mjs report [--asar <app.asar>]          빠진 키·사라진 네임스페이스 보고
//   node plugin/locales.mjs todo <outDir> [--asar <app.asar>]   번역할 영어 문구를 네임스페이스별 JSON으로 내보냄
//   node plugin/locales.mjs merge <dir> [--asar <app.asar>]     <dir>/*.json 번역({ "키": "한국어" })을 자리표시자 검사 뒤 합침
import { parse } from 'acorn'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const KO_FILE = join(here, 'locales.ko.json')
const require = createRequire(import.meta.url)

/** 설치된 DSH 의 기본 app.asar 경로 (macOS: /Applications, 그 밖: LOCALAPPDATA\Programs) */
const defaultAsar = () => process.platform === 'darwin'
  ? '/Applications/DeepSeek Harness.app/Contents/Resources/app.asar'
  : join(process.env.LOCALAPPDATA || '', 'Programs', 'DeepSeek Harness', 'resources', 'app.asar')

/** AST 노드의 자식 노드 목록 (type 이 있는 값만) */
function children(node) {
  return Object.values(node).flatMap((value) => Array.isArray(value) ? value.filter((item) => item?.type) : value?.type ? [value] : [])
}
/** 변수 범위를 만드는 노드 여부 (프로그램·블록·함수) */
const scopeNode = (node) => node.type === 'Program' || node.type === 'BlockStatement' || /Function/.test(node.type)

/**
 * 번들 하나의 locale.register(ns, { [lang]: 사전 }) 정적 읽기
 * @param source 번들 소스 코드 (실행하지 않음)
 * @returns 네임스페이스 → 사전 객체 (정적으로 못 읽는 등록은 빠짐)
 */
export function extractDictionaries(source, lang = 'en') {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' })
  const scopes = new WeakMap()
  /** 범위 노드마다 변수 이름 → 초기값 노드 표 수집 @param stack 바깥에서 안쪽 순서의 범위 노드 */
  ;(function collect(node, stack = []) {
    if (scopeNode(node)) { scopes.set(node, new Map()); stack = [...stack, node] }
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') scopes.get(stack.at(-1)).set(node.id.name, node.init)
    for (const child of children(node)) collect(child, stack)
  })(ast)
  /**
   * 정적 식의 값 계산 (리터럴·이름·객체·배열·속성 읽기·문자열 +·join). 못 읽으면 예외
   * @param stack 이름을 찾을 범위 노드 (바깥에서 안쪽 순서) @param seen 따라가는 중인 이름 (순환 참조 방지)
   */
  const value = (node, stack, seen = new Set()) => {
    if (!node) throw new Error('Missing initializer')
    if (node.type === 'Literal') return node.value
    if (node.type === 'TemplateLiteral' && !node.expressions.length) return node.quasis[0].value.cooked
    if (node.type === 'Identifier') {
      if (seen.has(node.name)) throw new Error('Recursive identifier ' + node.name)
      for (let i = stack.length - 1; i >= 0; i--) {
        const found = scopes.get(stack[i]).get(node.name)
        if (found) return value(found, stack.slice(0, i + 1), new Set([...seen, node.name]))
      }
      throw new Error('Unresolved identifier ' + node.name)
    }
    if (node.type === 'ObjectExpression') {
      const result = {}
      for (const property of node.properties) {
        if (property.type === 'SpreadElement') { Object.assign(result, value(property.argument, stack, seen)); continue }
        if (property.type !== 'Property' || property.computed || property.kind !== 'init') throw new Error('Non-static dictionary property')
        result[property.key.name ?? property.key.value] = value(property.value, stack, seen)
      }
      return result
    }
    if (node.type === 'ArrayExpression') return node.elements.map((item) => value(item, stack, seen))
    // 다른 상수의 속성을 그대로 쓰는 문구 (예: builtinCommandTokens.en.goal)
    if (node.type === 'MemberExpression') {
      const object = value(node.object, stack, seen), key = node.computed ? value(node.property, stack, seen) : node.property.name
      if (object && typeof object === 'object' && Object.hasOwn(object, key)) return object[key]
    }
    if (node.type === 'BinaryExpression' && node.operator === '+') return value(node.left, stack, seen) + value(node.right, stack, seen)
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && node.callee.property.name === 'join') {
      const array = value(node.callee.object, stack, seen)
      if (Array.isArray(array)) return array.join(node.arguments.length ? value(node.arguments[0], stack, seen) : ',')
    }
    throw new Error('Non-static expression')
  }
  /**
   * 이름이면 선언된 초기값 노드까지 따라가기 (사전을 상수에 담아 넘기는 등록: register(NS, dictionaries)). 최대 8단계
   * @returns 초기값 노드와 범위 목록(찾은 선언의 범위까지), 못 찾으면 null
   */
  const resolve = (node, stack) => {
    for (let hops = 0; node?.type === 'Identifier' && hops < 8; hops++) {
      let next = null
      for (let i = stack.length - 1; i >= 0 && !next; i--) {
        const init = scopes.get(stack[i]).get(node.name)
        if (init) { next = init; stack = stack.slice(0, i + 1) }
      }
      if (!next) return null
      node = next
    }
    return node ? { node, stack } : null
  }
  /** 언어별 사전 객체({ en: {...}, ko: {...} })에서 lang 속성 값 노드 찾기 (없으면 null) */
  const langProp = (node, stack) => {
    const resolved = resolve(node, stack)
    if (resolved?.node.type !== 'ObjectExpression') return null
    const property = resolved.node.properties.find((candidate) => candidate.type === 'Property' && (candidate.key?.name ?? candidate.key?.value) === lang)
    return property ? { node: property.value, stack: resolved.stack } : null
  }
  /**
   * 언어별로 한 번씩 등록하는 모양에서 lang 사전 노드 찾기: for (const [code, dict] of pairs) register(NS, code, dict)
   * @param ancestors 바깥에서 안쪽 순서의 조상 노드 (둘러싼 for…of 찾기용)
   */
  const pairEntry = (call, ancestors, stack) => {
    const [, codeArg, dictArg] = call.arguments
    if (codeArg?.type !== 'Identifier' || dictArg?.type !== 'Identifier') return null
    const loop = [...ancestors].reverse().find((ancestor) => ancestor.type === 'ForOfStatement')
    const pattern = loop?.left.type === 'VariableDeclaration' ? loop.left.declarations[0].id : loop?.left
    if (pattern?.type !== 'ArrayPattern' || pattern.elements[0]?.name !== codeArg.name || pattern.elements[1]?.name !== dictArg.name) return null
    const list = resolve(loop.right, stack)
    if (list?.node.type !== 'ArrayExpression') return null
    for (const pair of list.node.elements) {
      if (pair?.type !== 'ArrayExpression') continue
      try { if (value(pair.elements[0], list.stack) === lang) return { node: pair.elements[1], stack: list.stack } } catch {}
    }
    return null
  }
  /** register 호출의 lang 사전 노드 찾기 (인자 3개: register(ns, lang, dict) 또는 루프 쌍, 2개: 언어별 사전 객체) */
  const dictionaryOf = (call, ancestors, stack) => {
    if (call.arguments.length >= 3) {
      try { if (value(call.arguments[1], stack) === lang) return { node: call.arguments[2], stack } } catch {}
      return pairEntry(call, ancestors, stack)
    }
    return langProp(call.arguments[1], stack)
  }
  const found = {}
  /** locale.register 호출을 찾아 found 에 네임스페이스별 사전 채우기 */
  ;(function visit(node, stack = [], ancestors = []) {
    if (scopeNode(node)) stack = [...stack, node]
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && node.callee.property.name === 'register') {
      const receiver = node.callee.object
      const isLocale = (receiver.type === 'Identifier' && receiver.name === 'locale') || (receiver.type === 'MemberExpression' && receiver.property.name === 'locale')
      const dict = isLocale ? dictionaryOf(node, ancestors, stack) : null
      if (dict) {
        try { found[value(node.arguments[0], stack)] = value(dict.node, dict.stack) } catch {}   // 정적으로 못 읽는 등록은 건너뜀
      }
    }
    const below = [...ancestors, node]
    for (const child of children(node)) visit(child, stack, below)
  })(ast)
  return found
}

/** 설치된 DSH(app.asar)의 @deepseek-ai 클라이언트 번들 전체에서 lang(기본 영어) 사전 모으기 (네임스페이스 → 사전 객체) */
export function readInstalledDictionaries(asarPath, lang = 'en') {
  const asar = require('@electron/asar')
  const all = {}
  for (const path of asar.listPackage(asarPath)) {
    const normalized = path.replaceAll('\\', '/')
    if (!normalized.includes('/node_modules/@deepseek-ai/') || !normalized.endsWith('/lib/client.js')) continue
    Object.assign(all, extractDictionaries(asar.extractFile(asarPath, path.slice(1)).toString(), lang))
  }
  return all
}

// 키 이름에 '.'이 들어 있는 경우가 많아(예: message.copy) 중첩 경로는 '›'로 잇는다. 중첩되지 않은 키는 이름 그대로
const SEP = '›'
/** 중첩 사전 → [[키, 값]] (중첩 경로는 SEP 로 이음) @param prefix 앞에 붙일 상위 경로 (SEP 로 끝남) */
export const flatten = (dict, prefix = '') => Object.entries(dict).flatMap(([key, value]) =>
  value && typeof value === 'object' && !Array.isArray(value) ? flatten(value, prefix + key + SEP) : [[prefix + key, value]])
/** SEP 로 이은 경로의 사전 값 (없으면 undefined) */
const getPath = (dict, path) => path.split(SEP).reduce((node, key) => (node && typeof node === 'object' ? node[key] : undefined), dict)
/** SEP 로 이은 경로에 사전 값 넣기 (중간 객체는 만듦) */
const setPath = (dict, path, value) => {
  const keys = path.split(SEP)
  const parent = keys.slice(0, -1).reduce((node, key) => (node[key] ??= {}), dict)
  parent[keys.at(-1)] = value
}
/** 문구의 자리표시자({name}) 목록 (정렬). 번역 전후 같은 집합이어야 함 */
export const placeholders = (text) => [...String(text).matchAll(/\{[^{}]+\}/g)].map((match) => match[0]).sort()

/**
 * 영어 사전 대비 한국어 사전의 번역 범위
 * @returns total 영어 문구 수, count 한국어 없는 수, missing 빠진 문구(네임스페이스 → { 키: 영어 }), stale 영어에 없는 한국어 네임스페이스
 */
export function coverage(en, ko) {
  const missing = {}, stale = Object.keys(ko).filter((ns) => !en[ns])
  let total = 0, count = 0
  for (const [ns, dict] of Object.entries(en)) {
    for (const [key, text] of flatten(dict)) {
      total++
      if (typeof getPath(ko[ns] ?? {}, key) === 'string') continue
      ;(missing[ns] ??= {})[key] = text
      count++
    }
  }
  return { total, count, missing, stale }
}

/**
 * 번역 결과를 사전에 합치기. 영어에 없는 키·자리표시자가 다른 번역·빈 번역은 거절, 이미 있는 번역은 유지
 * @param translated 네임스페이스 → { 키: 한국어 }
 * @returns next 합친 사전(ko 는 그대로), added 더한 수, problems 거절 이유 목록
 */
export function mergeTranslations(ko, en, translated) {
  const next = structuredClone(ko), problems = []
  let added = 0
  for (const [ns, entries] of Object.entries(translated)) {
    for (const [key, text] of Object.entries(entries)) {
      const source = getPath(en[ns] ?? {}, key)
      if (typeof source !== 'string') { problems.push(`${ns}:${key} 영어 사전에 없는 키`); continue }
      if (typeof text !== 'string' || !text.trim()) { problems.push(`${ns}:${key} 빈 번역`); continue }
      if (placeholders(source).join() !== placeholders(text).join()) { problems.push(`${ns}:${key} 자리표시자 다름 ${placeholders(source)} → ${placeholders(text)}`); continue }
      if (typeof getPath(next[ns] ?? {}, key) === 'string') continue   // 이미 있는 번역은 덮지 않는다
      setPath(next[ns] ??= {}, key, text)
      added++
    }
  }
  return { next, added, problems }
}

/** 명령줄 진입점: report · todo <outDir> · merge <dir> (--asar 로 app.asar 지정) */
async function main() {
  const [command, dir] = process.argv.slice(2).filter((arg, i, all) => arg !== '--asar' && all[i - 1] !== '--asar')
  const asarIndex = process.argv.indexOf('--asar')
  const asarPath = asarIndex > 0 ? process.argv[asarIndex + 1] : defaultAsar()
  const ko = JSON.parse(await readFile(KO_FILE, 'utf8'))
  const en = readInstalledDictionaries(asarPath)
  const report = coverage(en, ko)
  if (command === 'report' || !command) {
    console.log(`DSH 영어 문구 ${report.total}개 중 한국어 없음 ${report.count}개 (${(100 * report.count / report.total).toFixed(1)}%)`)
    for (const [ns, entries] of Object.entries(report.missing)) console.log(`  ${ns}: ${Object.keys(entries).length}`)
    if (report.stale.length) console.log(`이 DSH에는 없는 한국어 네임스페이스(옛 버전용으로 남겨 둠): ${report.stale.join(', ')}`)
  } else if (command === 'todo') {
    await mkdir(dir, { recursive: true })
    for (const [ns, entries] of Object.entries(report.missing)) {
      // 같은 네임스페이스의 기존 번역을 함께 넣어 용어·말투를 맞추게 한다
      const existing = Object.fromEntries(flatten(ko[ns] ?? {}).map(([key, text]) => [key, { en: getPath(en[ns] ?? {}, key), ko: text }]).filter(([, pair]) => typeof pair.en === 'string'))
      await writeFile(join(dir, `${ns}.todo.json`), JSON.stringify({ namespace: ns, missing: entries, existing }, null, 2) + '\n')
    }
    console.log(`${Object.keys(report.missing).length}개 네임스페이스, ${report.count}개 문구를 ${dir}에 썼습니다`)
  } else if (command === 'merge') {
    const translated = {}
    for (const name of (await readdir(dir)).filter((file) => file.endsWith('.ko.json'))) {
      translated[name.slice(0, -'.ko.json'.length)] = JSON.parse(await readFile(join(dir, name), 'utf8'))
    }
    const { next, added, problems } = mergeTranslations(ko, en, translated)
    for (const problem of problems) console.error('거절: ' + problem)
    await writeFile(KO_FILE, JSON.stringify(next, null, 2) + '\n')
    console.log(`${added}개 번역을 합쳤습니다. 거절 ${problems.length}개`)
    if (problems.length) process.exitCode = 1
  } else {
    console.error('명령: report | todo <outDir> | merge <dir>')
    process.exitCode = 2
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main()
