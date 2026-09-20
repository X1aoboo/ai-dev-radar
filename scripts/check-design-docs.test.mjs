import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { checkDesignDocs } from './check-design-docs.mjs'

test('design checks accept the baseline and reject broken links, records and structure', () => {
  assert.deepEqual(checkDesignDocs(resolve(import.meta.dirname, '..')), [])
  const root = mkdtempSync(resolve(tmpdir(), 'radar-docs-'))
  try {
    const dir = resolve(root, 'docs')
    for (const path of ['adr', 'changes/active', 'changes/completed']) mkdirSync(resolve(dir, path), { recursive: true })
    mkdirSync(resolve(dir, 'contracts/ai-dev-data-gateway/baseline'), { recursive: true })
    mkdirSync(resolve(dir, 'contracts/ai-dev-data-gateway/changes'), { recursive: true })
    writeFileSync(resolve(dir, 'index.md'), '[bad](missing.md)\n```markdown\n[example](ignored.md)\n```')
    writeFileSync(resolve(dir, 'adr/0007-invalid.md'), '# ADR\n\n## Status\nBogus\n\n## Context\nReason\n\n## Decision\nChoice')
    writeFileSync(resolve(dir, 'adr/0008-superseded.md'), '# ADR\n\n## Status\nSuperseded\nSuperseded by ADR-9999\n\n## Context\nReason\n\n## Decision\nChoice\n\n## Consequences\nCost')
    writeFileSync(resolve(dir, 'changes/active/wrong.md'), '# Change\n\n## Status\nCompleted')
    writeFileSync(resolve(dir, 'changes/completed/wrong.md'), '# Change\n\n## Status\nActive')
    writeFileSync(resolve(dir, 'contracts/ai-dev-data-gateway/README.md'), '# Contract')
    writeFileSync(resolve(dir, 'contracts/ai-dev-data-gateway/baseline/capability-protocol.md'), '# Baseline')
    writeFileSync(resolve(dir, 'contracts/ai-dev-data-gateway/changes/README.md'), '# Changes\n\n最新版本：`1.0.0`。\n\n| `1.0.0` | x | x | x | [x](1.0.0.md) |')
    writeFileSync(resolve(dir, 'contracts/ai-dev-data-gateway/changes/1.0.0.md'), '# Version\n\n版本：`1.0.1`')
    writeFileSync(resolve(dir, 'contracts/ai-dev-data-gateway/baseline/openapi.json'), JSON.stringify({
      openapi: '3.0.0',
      info: { version: '1.1.0' },
      'x-capabilities': [{ id: 'planned.only', status: 'planned' }],
      paths: { '/v1/example': { post: {
        'x-capability-id': 'planned.only',
        requestBody: { content: { 'application/json': { schema: { '$ref': '#/missing' } } } },
        responses: {},
      } } },
    }))
    const errors = checkDesignDocs(root).join('\n')
    for (const message of ['Missing required', 'broken link', 'invalid ADR status', 'missing Consequences', 'invalid superseding ADR', 'expected Status Active', 'expected Status Completed', 'missing or empty Design', 'expected OpenAPI 3.1.x', 'does not match latest', 'declared version does not match filename', 'unresolved or non-local $ref', 'must reference an available capability', 'missing a request example']) {
      assert.ok(errors.includes(message), message)
    }
    assert.ok(!errors.includes('ignored.md'))
  } finally { rmSync(root, { recursive: true, force: true }) }
})
