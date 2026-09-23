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
  'contracts/ai-dev-data-gateway/README.md',
  'contracts/ai-dev-data-gateway/baseline/capability-protocol.md',
  'contracts/ai-dev-data-gateway/baseline/openapi.json',
  'contracts/ai-dev-data-gateway/changes/README.md',
]

const semverPattern = /^\d+\.\d+\.\d+$/
const httpMethods = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'])

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

function resolveJsonPointer(root, ref) {
  if (!ref.startsWith('#/')) return undefined
  return ref.slice(2).split('/').reduce((value, part) => {
    const key = part.replaceAll('~1', '/').replaceAll('~0', '~')
    return value && typeof value === 'object' ? value[key] : undefined
  }, root)
}

function inspectGatewayContract(docs, errors) {
  const root = resolve(docs, 'contracts/ai-dev-data-gateway')
  const openapiPath = resolve(root, 'baseline/openapi.json')
  const capabilityBaselinePath = resolve(root, 'baseline/capability-protocol.md')
  const changesIndexPath = resolve(root, 'changes/README.md')
  if (!exists(openapiPath)?.isFile() || !exists(changesIndexPath)?.isFile()) return

  let contract
  try {
    contract = JSON.parse(readFileSync(openapiPath, 'utf8'))
  } catch (error) {
    errors.push(`${openapiPath}: invalid JSON: ${error.message}`)
    return
  }
  if (!/^3\.1\.\d+$/.test(contract.openapi ?? '')) {
    errors.push(`${openapiPath}: expected OpenAPI 3.1.x`)
  }

  const indexText = readFileSync(changesIndexPath, 'utf8')
  const latest = indexText.match(/最新版本：`([^`]+)`/)?.[1]
  const openapiVersion = contract.info?.version
  if (!latest || !semverPattern.test(latest)) {
    errors.push(`${changesIndexPath}: missing valid latest SemVer`)
  }
  if (openapiVersion !== latest) {
    errors.push(`${openapiPath}: info.version ${openapiVersion ?? 'missing'} does not match latest ${latest ?? 'missing'}`)
  }
  if (exists(capabilityBaselinePath)?.isFile()) {
    const baselineVersion = readFileSync(capabilityBaselinePath, 'utf8').match(/当前版本：`([^`]+)`/)?.[1]
    if (baselineVersion !== latest) {
      errors.push(`${capabilityBaselinePath}: current version ${baselineVersion ?? 'missing'} does not match latest ${latest ?? 'missing'}`)
    }
  }

  const changesDir = resolve(root, 'changes')
  const versionFiles = exists(changesDir)?.isDirectory()
    ? readdirSync(changesDir).filter(name => name.endsWith('.md') && name !== 'README.md')
    : []
  const versions = versionFiles.map(name => name.slice(0, -3))
  for (const version of versions) {
    if (!semverPattern.test(version)) errors.push(`${changesDir}/${version}.md: filename is not SemVer`)
    const text = readFileSync(resolve(changesDir, `${version}.md`), 'utf8')
    const declared = text.match(/版本：`([^`]+)`/)?.[1]
    if (declared !== version) errors.push(`${changesDir}/${version}.md: declared version does not match filename`)
  }
  const indexedVersions = [...indexText.matchAll(/\|\s*`(\d+\.\d+\.\d+)`\s*\|/g)].map(match => match[1])
  if (new Set(indexedVersions).size !== indexedVersions.length) {
    errors.push(`${changesIndexPath}: duplicate version in index`)
  }
  if (versions.some(version => !indexedVersions.includes(version)) || indexedVersions.some(version => !versions.includes(version))) {
    errors.push(`${changesIndexPath}: index and version documents differ`)
  }
  const descending = [...indexedVersions].sort((left, right) => {
    const a = left.split('.').map(Number)
    const b = right.split('.').map(Number)
    return b[0] - a[0] || b[1] - a[1] || b[2] - a[2]
  })
  if (indexedVersions.join(',') !== descending.join(',')) {
    errors.push(`${changesIndexPath}: versions are not ordered newest first`)
  }
  if (latest && indexedVersions[0] !== latest) {
    errors.push(`${changesIndexPath}: latest version is not the first indexed version`)
  }

  const refs = []
  const visit = value => {
    if (Array.isArray(value)) return value.forEach(visit)
    if (!value || typeof value !== 'object') return
    if (typeof value.$ref === 'string') refs.push(value.$ref)
    Object.values(value).forEach(visit)
  }
  visit(contract)
  for (const ref of refs) {
    if (!ref.startsWith('#/') || resolveJsonPointer(contract, ref) === undefined) {
      errors.push(`${openapiPath}: unresolved or non-local $ref ${ref}`)
    }
  }

  const capabilities = Array.isArray(contract['x-capabilities']) ? contract['x-capabilities'] : []
  const capabilityIds = capabilities.map(item => item?.id)
  if (capabilityIds.some(id => typeof id !== 'string') || new Set(capabilityIds).size !== capabilityIds.length) {
    errors.push(`${openapiPath}: capability ids must be unique strings`)
  }
  const capabilityStatus = new Map(capabilities.map(item => [item?.id, item?.status]))
  for (const [path, pathItem] of Object.entries(contract.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (!httpMethods.has(method)) continue
      const capabilityId = operation?.['x-capability-id']
      const protocolOperation = operation?.['x-protocol-operation']
      if (typeof protocolOperation === 'string' && protocolOperation.trim()) {
        if (capabilityId !== undefined) {
          errors.push(`${openapiPath}: ${method.toUpperCase()} ${path} cannot be both a protocol operation and a capability`)
        }
      } else if (capabilityStatus.get(capabilityId) !== 'available') {
        errors.push(`${openapiPath}: ${method.toUpperCase()} ${path} must reference an available capability`)
      }
      const requestMedia = operation?.requestBody?.content?.['application/json']
      if (operation?.requestBody && !requestMedia?.example) {
        errors.push(`${openapiPath}: ${method.toUpperCase()} ${path} is missing a request example`)
      }
      for (const [status, unresolvedResponse] of Object.entries(operation?.responses ?? {})) {
        const response = unresolvedResponse?.$ref
          ? resolveJsonPointer(contract, unresolvedResponse.$ref)
          : unresolvedResponse
        const media = response?.content?.['application/json']
        if (media && !media.example) {
          errors.push(`${openapiPath}: ${method.toUpperCase()} ${path} response ${status} is missing an example`)
        }
      }
    }
  }
}

export function checkDesignDocs(root) {
  const docs = resolve(root, 'docs')
  const errors = []
  for (const item of required) {
    const found = exists(resolve(docs, item))
    const expectsFile = /\.[a-z\d]+$/i.test(item)
    if (!found || (expectsFile ? !found.isFile() : !found.isDirectory())) {
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
  inspectGatewayContract(docs, errors)
  return errors
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = checkDesignDocs(resolve(dirname(fileURLToPath(import.meta.url)), '..'))
  if (errors.length) {
    console.error(errors.join('\n'))
    process.exitCode = 1
  } else console.log('Design documentation checks passed.')
}
