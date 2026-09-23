# Marp Mermaid Engine

A custom Marp Core 5 engine that renders fenced Mermaid diagrams with standard Mermaid.js through `@mermaid-js/mermaid-cli`. This supports Mermaid syntax such as `classDef` and `class` while keeping diagram source in Markdown and inlining the resulting SVGs in Marp output.

The engine also installs Marp Core's MathJax, KaTeX, and Shiki plugins.

## Requirements

- Node.js 20 or newer
- Marp CLI 3.2.1 or newer (for async engine rendering)
- Marp Core 5
- A Puppeteer-compatible Chrome/Chromium installation

## Install

The GitHub repository is public. Install it globally with npm:

```sh
npm install -g github:shanemcd/marp-mermaid-engine
```

The package is marked `"private": true` to prevent accidental `npm publish`; this does not prevent installing it from GitHub.

## Use with Marp CLI

Marp CLI resolves engine package specifiers from the Markdown file and current working directory, not npm's global package directory. Pass the engine file path using npm's global root:

```sh
marp --engine "$(npm root -g)/marp-mermaid-engine/engine.mjs" --preview slides.md
```

To update the engine, run the same `npm install -g` command again.

## Theme-provided Mermaid defaults

A Marp theme can provide Mermaid renderer defaults alongside its stylesheet. Add metadata comments to the theme CSS:

```css
/* @theme redhat */
/* @marp-mermaid-config ./mermaid.config.json */
/* @marp-mermaid-css ./mermaid.css */
```

The engine matches the deck's `theme` frontmatter value to the `@theme` name in the registered `themeSet` files, then loads the referenced files relative to that theme CSS. If Marp CLI does not pass `themeSet` to the engine, it also resolves the conventional package `marp-theme-<theme-name>`; hosts can set `MARP_MERMAID_THEME_SET` to one or more CSS paths as an explicit fallback. The JSON file is passed to Mermaid CLI as `mermaidConfig`; the CSS file is embedded into each rendered SVG through `myCSS`. Themes without these metadata comments continue to render with Mermaid's defaults. Individual diagrams can still use Mermaid directives for local exceptions.

## Test

```sh
npm test
```

The smoke test renders two identical diagrams containing `classDef`, checks that they become inline SVGs, and verifies that each SVG has a unique ID.
