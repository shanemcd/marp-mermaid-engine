import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import Marp from '@marp-team/marp-core'
import katexPlugin from '@marp-team/marp-core/plugins/katex'
import mathjaxPlugin from '@marp-team/marp-core/plugins/mathjax'
import shikiPlugin from '@marp-team/marp-core/plugins/shiki'
import { run as renderMermaid } from '@mermaid-js/mermaid-cli'

const DIAGRAMS_KEY = '__marpMermaidDiagrams'
const svgCache = new Map()
const CACHE_LIMIT = 128

const mermaidConfig = {
  theme: 'base',
  themeVariables: {
    fontFamily: 'Red Hat Display, Helvetica Neue, Arial, sans-serif',
    primaryColor: '#f0f0f0',
    primaryTextColor: '#151515',
    primaryBorderColor: '#ee0000',
    lineColor: '#4d4d4d',
    secondaryColor: '#e7f1fa',
    tertiaryColor: '#f7f7f7',
    clusterBkg: '#f7f7f7',
    clusterBorder: '#6a6e73',
    edgeLabelBackground: '#ffffff',
  },
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
    padding: 16,
    nodeSpacing: 32,
    rankSpacing: 42,
  },
  themeCSS: '.nodeLabel, .label, .cluster-label { font-weight: 600; }',
}

const mermaidFencePlugin = (md) => {
  const defaultFence = md.renderer.rules.fence

  md.renderer.rules.fence = (tokens, index, options, env, renderer) => {
    const token = tokens[index]
    const info = md.utils.unescapeAll(token.info || '').trim()
    const [language] = info.split(/\s+/, 1)

    if (language?.toLowerCase() !== 'mermaid') {
      return defaultFence.call(renderer, tokens, index, options, env, renderer)
    }

    const diagrams = env?.[DIAGRAMS_KEY]
    if (!(diagrams instanceof Map)) {
      throw new Error('Marp Mermaid engine render context is missing')
    }

    const id = `marp-mermaid-${diagrams.size + 1}`
    diagrams.set(id, token.content)
    return `<div data-marp-mermaid-placeholder="${id}"></div>\n`
  }
}

async function renderDiagram(id, definition, tempDir) {
  const cacheKey = createHash('sha256')
    .update(JSON.stringify(mermaidConfig))
    .update(id)
    .update(definition)
    .digest('hex')
  const cached = svgCache.get(cacheKey)
  if (cached) return cached

  const inputFile = path.join(tempDir, `${id}.mmd`)
  const outputFile = path.join(tempDir, `${id}.svg`)
  await writeFile(inputFile, definition)
  await renderMermaid(inputFile, outputFile, {
    outputFormat: 'svg',
    quiet: true,
    puppeteerConfig: {
      headless: true,
      args: ['--force-color-profile=srgb'],
    },
    parseMMDOptions: {
      backgroundColor: 'transparent',
      mermaidConfig,
      svgId: id,
      viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
    },
  })

  const svg = (await readFile(outputFile, 'utf8')).replace(
    /<svg\b/,
    '<svg data-marp-mermaid',
  )
  if (svgCache.size >= CACHE_LIMIT) svgCache.delete(svgCache.keys().next().value)
  svgCache.set(cacheKey, svg)
  return svg
}

class MermaidMarp extends Marp {
  constructor(options) {
    super(options)
    this.use(mathjaxPlugin())
      .use(katexPlugin())
      .use(shikiPlugin())
      .use(mermaidFencePlugin)
  }

  async render(markdown, env = {}) {
    const diagrams = new Map()
    const result = super.render(markdown, { ...env, [DIAGRAMS_KEY]: diagrams })
    if (diagrams.size === 0) return result

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'marp-mermaid-'))
    try {
      for (const [id, definition] of diagrams) {
        const placeholder = `<div data-marp-mermaid-placeholder="${id}"></div>`
        const svg = await renderDiagram(id, definition, tempDir)
        if (!result.html.includes(placeholder)) {
          throw new Error(`Marp Mermaid placeholder not found for ${id}`)
        }
        result.html = result.html.replace(placeholder, svg)
      }
      return result
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }
}

export default async (constructorOptions) => new MermaidMarp(constructorOptions)
