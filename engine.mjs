import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import Marp from '@marp-team/marp-core'
import katexPlugin from '@marp-team/marp-core/plugins/katex'
import mathjaxPlugin from '@marp-team/marp-core/plugins/mathjax'
import shikiPlugin from '@marp-team/marp-core/plugins/shiki'
import { run as renderMermaid } from '@mermaid-js/mermaid-cli'

const RENDER_CONTEXT_KEY = '__marpMermaidRenderContext'
const svgCache = new Map()
const CACHE_LIMIT = 128

const mermaidFencePlugin = (md) => {
  const defaultFence = md.renderer.rules.fence

  md.renderer.rules.fence = (tokens, index, options, env, renderer) => {
    const token = tokens[index]
    const info = md.utils.unescapeAll(token.info || '').trim()
    const [language] = info.split(/\s+/, 1)
    const normalizedLanguage = language?.toLowerCase()
    const context = env?.[RENDER_CONTEXT_KEY]

    if (normalizedLanguage === 'mermaid-config') {
      if (!context) throw new Error('Marp Mermaid engine render context is missing')
      if (context.hasMermaidConfig) {
        throw new Error('Only one mermaid-config fence is allowed per document')
      }

      try {
        context.mermaidConfig = JSON.parse(token.content)
      } catch (error) {
        throw new Error(`Invalid mermaid-config JSON: ${error.message}`)
      }
      if (
        !context.mermaidConfig ||
        typeof context.mermaidConfig !== 'object' ||
        Array.isArray(context.mermaidConfig)
      ) {
        throw new Error('mermaid-config must contain a JSON object')
      }
      context.hasMermaidConfig = true
      return ''
    }

    if (normalizedLanguage === 'mermaid-css') {
      if (!context) throw new Error('Marp Mermaid engine render context is missing')
      if (context.hasMyCSS) {
        throw new Error('Only one mermaid-css fence is allowed per document')
      }
      context.myCSS = token.content
      context.hasMyCSS = true
      return ''
    }

    if (normalizedLanguage !== 'mermaid') {
      return defaultFence.call(renderer, tokens, index, options, env, renderer)
    }

    if (!context) throw new Error('Marp Mermaid engine render context is missing')

    const id = `marp-mermaid-${context.diagrams.size + 1}`
    context.diagrams.set(id, token.content)
    return `<div data-marp-mermaid-placeholder="${id}"></div>\n`
  }
}

async function renderDiagram(id, definition, tempDir, context) {
  const cacheKey = createHash('sha256')
    .update(id)
    .update(definition)
    .update(JSON.stringify(context.mermaidConfig))
    .update(context.myCSS || '')
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
      mermaidConfig: context.mermaidConfig,
      myCSS: context.myCSS,
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
    const context = {
      diagrams: new Map(),
      mermaidConfig: {},
      myCSS: undefined,
      hasMermaidConfig: false,
      hasMyCSS: false,
    }
    const result = super.render(markdown, {
      ...env,
      [RENDER_CONTEXT_KEY]: context,
    })
    if (context.diagrams.size === 0) return result

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'marp-mermaid-'))
    try {
      for (const [id, definition] of context.diagrams) {
        const placeholder = `<div data-marp-mermaid-placeholder="${id}"></div>`
        const svg = await renderDiagram(id, definition, tempDir, context)
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
