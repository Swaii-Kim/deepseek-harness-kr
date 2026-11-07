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

const defaultAsar = () => process.platform === 'darwin'
  ? '/Applications/DeepSeek Harness.app/Contents/Resources/app.asar'
  : join(process.env.LOCALAPPDATA || '', 'Programs', 'DeepSeek Harness', 'resources', 'app.asar')

function children(node) {
  return Object.values(node).flatMap((value) => Array.isArray(value) ? value.filter((item) => item?.type) : value?.type ? [value] : [])
}
const scopeNode = (node) => node.type === 'Program' || node.type === 'BlockStatement' || /Function/.test(node.type)

// 번들 하나에서 locale.register(ns, { [lang]: 사전 }) 를 정적으로 읽어 { ns: 사전 } 으로 돌려준다
export function extractDictionaries(source, lang = 'en') {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' })
  const scopes = new WeakMap()
  ;(function collect(node, stack = []) {
    if (scopeNode(node)) { scopes.set(node, new Map()); stack = [...stack, node] }
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') scopes.get(stack.at(-1)).set(node.id.name, node.init)
    for (const child of children(node)) collect(child, stack)
  })(ast)
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
      for (const prop of node.properties) {
        if (prop.type === 'SpreadElement') { Object.assign(result, value(prop.argument, stack, seen)); continue }
        if (prop.type !== 'Property' || prop.computed || prop.kind !== 'init') throw new Error('Non-static dictionary property')
        result[prop.key.name ?? prop.key.value] = value(prop.value, stack, seen)
      }
      return result
    }
    if (node.type === 'ArrayExpression') return node.elements.map((item) => value(item, stack, seen))
    if (node.type === 'BinaryExpression' && node.operator === '+') return value(node.left, stack, seen) + value(node.right, stack, seen)
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && node.callee.property.name === 'join') {
      const array = value(node.callee.object, stack, seen)
      if (Array.isArray(array)) return array.join(node.arguments.length ? value(node.arguments[0], stack, seen) : ',')
    }
    throw new Error('Non-static expression')
  }
  const found = {}
  ;(function visit(node, stack = []) {
    if (scopeNode(node)) stack = [...stack, node]
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && node.callee.property.name === 'register') {
      const receiver = node.callee.object
      const isLocale = (receiver.type === 'Identifier' && receiver.name === 'locale') || (receiver.type === 'MemberExpression' && receiver.property.name === 'locale')
      const dict = isLocale && node.arguments[1]?.type === 'ObjectExpression'
        ? node.arguments[1].properties.find((prop) => (prop.key?.name ?? prop.key?.value) === lang) : null
      if (dict) {
        try { found[value(node.arguments[0], stack)] = value(dict.value, stack) } catch {}   // 정적으로 못 읽는 등록은 건너뜀
      }
    }
    for (const child of children(node)) visit(child, stack)
  })(ast)
  return found
}

// 설치된 DSH(app.asar)의 @deepseek-ai 클라이언트 번들 전체에서 영어 사전을 모은다
export function readInstalledDictionaries(asarPath, lang = 'en') {
  const asar = require('@electron/asar')
  const all = {}
  for (const path of asar.listPackage(asarPath)) {
    const norm = path.replaceAll('\\', '/')
    if (!norm.includes('/node_modules/@deepseek-ai/') || !norm.endsWith('/lib/client.js')) continue
    Object.assign(all, extractDictionaries(asar.extractFile(asarPath, path.slice(1)).toString(), lang))
  }
  return all
}

// 키 이름에 '.'이 들어 있는 경우가 많아(예: message.copy) 중첩 경로는 '›'로 잇는다. 중첩되지 않은 키는 이름 그대로
const SEP = '›'
// 중첩 사전 → [[키, 값]]
export const flatten = (dict, prefix = '') => Object.entries(dict).flatMap(([key, value]) =>
  value && typeof value === 'object' && !Array.isArray(value) ? flatten(value, prefix + key + SEP) : [[prefix + key, value]])
const getPath = (dict, path) => path.split(SEP).reduce((node, key) => (node && typeof node === 'object' ? node[key] : undefined), dict)
const setPath = (dict, path, value) => {
  const keys = path.split(SEP)
  const parent = keys.slice(0, -1).reduce((node, key) => (node[key] ??= {}), dict)
  parent[keys.at(-1)] = value
}
// 자리표시자({name}) 집합이 같아야 한다
export const placeholders = (text) => [...String(text).matchAll(/\{[^{}]+\}/g)].map((m) => m[0]).sort()

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

// 번역 결과를 사전에 합친다. 영어에 없는 키·자리표시자가 다른 번역·빈 번역은 거절한다
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
    for (const name of (await readdir(dir)).filter((f) => f.endsWith('.ko.json'))) {
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
