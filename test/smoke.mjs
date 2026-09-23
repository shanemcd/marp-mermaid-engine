import assert from 'node:assert/strict'

import createEngine from '../engine.mjs'

const engine = await createEngine({})
const diagram = [
  'flowchart LR',
  '  A[One] --> B[Two]',
  '  classDef warm fill:#fff4cc,stroke:#666666,color:#222222;',
  '  class A warm;',
].join('\n')
const markdown = [
  '---',
  'marp: true',
  '---',
  '',
  '```mermaid',
  diagram,
  '```',
  '',
  '---',
  '',
  '```mermaid',
  diagram,
  '```',
  '',
].join('\n')

const { html } = await engine.render(markdown)
const ids = [...html.matchAll(/<svg data-marp-mermaid id="([^"]+)"/g)].map(
  ([, id]) => id,
)

assert.equal(ids.length, 2, 'both Mermaid fences should render as SVG')
assert.equal(new Set(ids).size, 2, 'each SVG should have a unique ID')
assert.match(html, /\.warm/, 'classDef styling should be retained')
assert.doesNotMatch(html, /data-marp-mermaid-placeholder/)
assert.doesNotMatch(html, /language-mermaid/)

console.log('Marp Mermaid engine smoke test passed.')
