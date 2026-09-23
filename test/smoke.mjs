import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import puppeteer from 'puppeteer'
import createEngine from '../engine.mjs'

const themeDir = await mkdtemp(path.join(os.tmpdir(), 'marp-mermaid-theme-test-'))

try {
  const themeCssPath = path.join(themeDir, 'theme.css')
  const mermaidConfig = {
    theme: 'base',
    themeVariables: {
      primaryColor: '#fce3e3',
      primaryBorderColor: '#ee0000',
    },
  }
  const sharedCSS =
    '/* shared-engine-css */\nsvg[data-marp-mermaid] { overflow: visible; }'

  await writeFile(
    themeCssPath,
    [
      '/* @theme smoke */',
      '/* @marp-mermaid-config ./mermaid.config.json */',
      '/* @marp-mermaid-css ./mermaid.css */',
      '',
    ].join('\n'),
  )
  await writeFile(
    path.join(themeDir, 'mermaid.config.json'),
    JSON.stringify(mermaidConfig),
  )
  await writeFile(path.join(themeDir, 'mermaid.css'), sharedCSS)

  const engine = await createEngine({ themeSet: themeCssPath })
  const diagram = [
    'flowchart LR',
    '  A[One] --> B[Two]',
    '  classDef warm fill:#fff4cc,stroke:#666666,color:#222222;',
    '  class A warm;',
  ].join('\n')
  const markdown = [
    '---',
    'marp: true',
    'theme: smoke',
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

  const originalLaunch = puppeteer.launch
  let browserLaunches = 0
  puppeteer.launch = (...args) => {
    browserLaunches += 1
    return originalLaunch.apply(puppeteer, args)
  }

  let html
  try {
    html = (await engine.render(markdown)).html
    assert.equal(
      browserLaunches,
      1,
      'one Puppeteer browser should serve all diagrams in one render',
    )
    await engine.render(markdown)
    assert.equal(
      browserLaunches,
      1,
      'a cached re-render should not launch another browser',
    )
  } finally {
    puppeteer.launch = originalLaunch
  }

  const ids = [...html.matchAll(/<svg data-marp-mermaid id="([^"]+)"/g)].map(
    ([, id]) => id,
  )

  assert.equal(ids.length, 2, 'both Mermaid fences should render as SVG')
  assert.equal(new Set(ids).size, 2, 'each SVG should have a unique ID')
  assert.match(html, /\.warm/, 'classDef styling should be retained')
  assert.match(html, /#fce3e3/, 'theme Mermaid config should be applied')
  assert.equal(
    [...html.matchAll(/shared-engine-css/g)].length,
    2,
    'theme CSS should be embedded in each SVG',
  )
  assert.doesNotMatch(html, /data-marp-mermaid-placeholder/)
  assert.doesNotMatch(html, /language-mermaid/)

  console.log('Marp Mermaid engine smoke test passed.')
} finally {
  await rm(themeDir, { recursive: true, force: true })
}
