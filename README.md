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

## Reuse Mermaid configuration and CSS

The engine supports one optional `mermaid-config` fence and one optional `mermaid-css` fence per Markdown document. They are removed from the rendered slides and applied to every Mermaid diagram in that document:

````markdown
```mermaid-config
{
  "theme": "base",
  "themeVariables": {
    "primaryColor": "#f2f2f2",
    "primaryBorderColor": "#707070"
  }
}
```

```mermaid-css
svg[data-marp-mermaid] { max-height: 450px; }
```

```mermaid
flowchart LR
  A --> B
```
````

`mermaid-config` accepts a Mermaid configuration object and is passed to Mermaid CLI as `mermaidConfig`. `mermaid-css` is embedded into each rendered SVG through Mermaid CLI's `myCSS` option. These defaults are document-scoped; individual diagrams can still use Mermaid's own directives for exceptions.

## Test

```sh
npm test
```

The smoke test renders two identical diagrams containing `classDef`, checks that they become inline SVGs, and verifies that each SVG has a unique ID.
