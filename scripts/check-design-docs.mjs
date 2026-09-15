import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const legacy = new Set([
  '0001-store-raw-counts-compute-rates-in-dashboard.md',
  '0002-collector-interface-reserved-manual-only-mode.md',
  '0003-source-data-first-metrics.md',
  '0004-staged-import-and-field-merge.md',
  '0005-team-owned-product-hierarchy.md',
])
const required = [
  'index.md', 'business/index.md', 'architecture/overview.md', 'architecture/modules',
  'standards/engineering.md', 'standards/api.md', 'standards/data.md', 'standards/testing.md',
  'adr/README.md', 'changes/README.md', 'changes/active/README.md',
  'changes/completed/README.md', 'glossary.md', 'agents/design-maintenance.md',
]

function exists(path) {
  try { return statSync(path) } catch { return null }
}

function markdownFiles(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap(entry => {
    const child = resolve(path, entry.name)
    return entry.isDirectory() ? markdownFiles(child) : entry.name.endsWith('.md') ? [child] : []
  })
}

function prose(text) {
  let fence = null
  return text.split(/\r?\n/).filter(line => {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (marker) {
      if (!fence) fence = marker[1]
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null
      return false
    }
    return !fence
  }).join('\n')
}

function section(text, name) {
  return text.match(new RegExp(`^##\\s+${name}\\s*\\n([^#]*)(?=^##|$)`, 'mi'))?.[1].trim()
}

export function checkDesignDocs(root) {
  const docs = resolve(root, 'docs')
  const errors = []
  for (const item of required) {
    const found = exists(resolve(docs, item))
    if (!found || (item.endsWith('.md') ? !found.isFile() : !found.isDirectory())) {
      errors.push(`Missing required design path: docs/${item}`)
    }
  }
  if (!exists(docs)?.isDirectory()) return errors
  const files = markdownFiles(docs)
  for (const file of files) {
    const text = prose(readFileSync(file, 'utf8'))
    // ponytail: checks file targets, not anchors or remote URLs; add a Markdown parser if syntax expands.
    const targets = [...text.matchAll(/\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\s*\)/g)].map(match => match[1])
    targets.push(...[...text.matchAll(/^\s*\[[^\]]+\]:\s*(<[^>]+>|\S+)/gm)].map(match => match[1]))
    for (const raw of targets) {
      const target = raw.replace(/^<|>$/g, '').split('#')[0]
      if (!target || /^[a-z][a-z\d+.-]*:/i.test(target)) continue
      try {
        if (!exists(resolve(dirname(file), decodeURIComponent(target)))) errors.push(`${file}: broken link ${raw}`)
      } catch { errors.push(`${file}: invalid link ${raw}`) }
    }
  }
  const adrDir = resolve(docs, 'adr')
  const adrs = files.filter(file => dirname(file) === adrDir && !file.endsWith('README.md'))
  const numbers = new Set()
  for (const file of adrs) {
    const name = file.slice(adrDir.length + 1)
    const number = name.match(/^(\d{4})-[a-z\d-]+\.md$/)?.[1]
    if (!number || numbers.has(number)) errors.push(`${file}: invalid or duplicate ADR number`)
    numbers.add(number)
    const text = prose(readFileSync(file, 'utf8'))
    if (!legacy.has(name)) {
      for (const heading of ['Status|状态', 'Context|背景', 'Decision|决策', 'Consequences|后果']) {
        if (!new RegExp(`^##\\s+(?:${heading})\\s*$`, 'm').test(text)) errors.push(`${file}: missing ${heading}`)
      }
      const status = section(text, '(?:Status|状态)')
      if (!/^(?:Proposed|Accepted|Deprecated|Superseded|已接受)(?:\b|（)/i.test(status ?? '')) {
        errors.push(`${file}: invalid ADR status`)
      }
    }
    if (/superseded/i.test(text)) {
      const target = text.match(/Superseded by ADR-(\d{4})/i)?.[1]
      if (!target || target === number || !adrs.some(adr => adr.includes(`${target}-`))) {
        errors.push(`${file}: missing or invalid superseding ADR`)
      }
    }
  }
  for (const state of ['active', 'completed']) {
    const directory = resolve(docs, 'changes', state)
    for (const file of files.filter(item => dirname(item) === directory && !item.endsWith('README.md'))) {
      const text = prose(readFileSync(file, 'utf8'))
      const expected = state === 'active' ? 'Active' : 'Completed'
      if (section(text, 'Status') !== expected) errors.push(`${file}: expected Status ${expected}`)
      for (const heading of ['Requirement', 'Design', 'Test Strategy', 'Documentation Impact']) {
        if (!section(text, heading)) errors.push(`${file}: missing or empty ${heading}`)
      }
    }
  }
  return errors
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = checkDesignDocs(resolve(dirname(fileURLToPath(import.meta.url)), '..'))
  if (errors.length) {
    console.error(errors.join('\n'))
    process.exitCode = 1
  } else console.log('Design documentation checks passed.')
}


