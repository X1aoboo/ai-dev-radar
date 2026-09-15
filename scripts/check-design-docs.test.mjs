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
    writeFileSync(resolve(dir, 'index.md'), '[bad](missing.md)\n```markdown\n[example](ignored.md)\n```')
    writeFileSync(resolve(dir, 'adr/0007-invalid.md'), '# ADR\n\n## Status\nBogus\n\n## Context\nReason\n\n## Decision\nChoice')
    writeFileSync(resolve(dir, 'adr/0008-superseded.md'), '# ADR\n\n## Status\nSuperseded\nSuperseded by ADR-9999\n\n## Context\nReason\n\n## Decision\nChoice\n\n## Consequences\nCost')
    writeFileSync(resolve(dir, 'changes/active/wrong.md'), '# Change\n\n## Status\nCompleted')
    writeFileSync(resolve(dir, 'changes/completed/wrong.md'), '# Change\n\n## Status\nActive')
    const errors = checkDesignDocs(root).join('\n')
    for (const message of ['Missing required', 'broken link', 'invalid ADR status', 'missing Consequences', 'invalid superseding ADR', 'expected Status Active', 'expected Status Completed', 'missing or empty Design']) {
      assert.ok(errors.includes(message), message)
    }
    assert.ok(!errors.includes('ignored.md'))
  } finally { rmSync(root, { recursive: true, force: true }) }
})


