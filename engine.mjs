import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import Marp from '@marp-team/marp-core'
import katexPlugin from '@marp-team/marp-core/plugins/katex'
import mathjaxPlugin from '@marp-team/marp-core/plugins/mathjax'
import shikiPlugin from '@marp-team/marp-core/plugins/shiki'
import { run as renderMermaid } from '@mermaid-js/mermaid-cli'

const RENDER_CONTEXT_KEY = '__marpMermaidRenderContext'
const require = createRequire(import.meta.url)
const svgCache = new Map()
const CACHE_LIMIT = 128

function getThemeName(markdown) {
  const frontMatter = markdown.match(
    /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/,
  )?.[1]
  if (!frontMatter) return undefined

  const themeValue = frontMatter.match(/^\s*theme\s*:\s*(.*?)\s*$/m)?.[1]
  if (!themeValue) return undefined

  const unquoted = themeValue.replace(/\s+#.*$/, '').trim()
  const quoted = unquoted.match(/^(['"])(.*)\1$/)
  return quoted ? quoted[2] : unquoted
}

function getThemeCssPaths(themeName, themeSet) {
  const paths = Array.isArray(themeSet) ? [...themeSet] : [themeSet]
  if (process.env.MARP_MERMAID_THEME_SET) {
    paths.push(...process.env.MARP_MERMAID_THEME_SET.split(path.delimiter))
  }

  if (themeName && /^[A-Za-z0-9_-]+$/.test(themeName)) {
    try {
      paths.push(require.resolve(`marp-theme-${themeName}/theme.css`))
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND' && error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
        throw error
      }
    }
  }

  return [...new Set(paths
    .filter((themePath) => typeof themePath === 'string' && themePath.length > 0)
    .map((themePath) => path.resolve(themePath)))]
}

async function loadThemeMermaidOptions(themeName, themeSet) {
  const emptyOptions = { mermaidConfig: {}, myCSS: undefined }
  if (!themeName) return emptyOptions

  const matches = []
  for (const themeCssPath of getThemeCssPaths(themeName, themeSet)) {
    const themeCss = await readFile(themeCssPath, 'utf8')
    const declaredTheme = themeCss.match(
      /\/\*\s*@theme\s+([^\s*]+)\s*\*\//i,
    )?.[1]
    if (declaredTheme === themeName) matches.push({ themeCssPath, themeCss })
  }

  if (matches.length === 0) return emptyOptions
  if (matches.length > 1) {
    throw new Error(`Multiple theme CSS files declare the Marp theme "${themeName}"`)
  }

  const [{ themeCssPath, themeCss }] = matches
  const configPath = themeCss.match(
    /\/\*\s*@marp-mermaid-config\s+([^*\s]+)\s*\*\//i,
  )?.[1]
  const cssPath = themeCss.match(
    /\/\*\s*@marp-mermaid-css\s+([^*\s]+)\s*\*\//i,
  )?.[1]

  let mermaidConfig = {}
  if (configPath) {
    const absoluteConfigPath = path.resolve(path.dirname(themeCssPath), configPath)
    const configText = await readFile(absoluteConfigPath, 'utf8')
    try {
      mermaidConfig = JSON.parse(configText)
    } catch (error) {
      throw new Error(
        `Invalid Mermaid config in ${absoluteConfigPath}: ${error.message}`,
        { cause: error },
      )
    }
    if (
      !mermaidConfig ||
      typeof mermaidConfig !== 'object' ||
      Array.isArray(mermaidConfig)
    ) {
      throw new Error(`Mermaid config in ${absoluteConfigPath} must be a JSON object`)
    }
  }

  const myCSS = cssPath
    ? await readFile(path.resolve(path.dirname(themeCssPath), cssPath), 'utf8')
    : undefined

  return { mermaidConfig, myCSS }
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

    const context = env?.[RENDER_CONTEXT_KEY]
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
    const themeOptions = await loadThemeMermaidOptions(
      getThemeName(markdown),
      this.options.themeSet,
    )
    const context = {
      diagrams: new Map(),
      ...themeOptions,
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
