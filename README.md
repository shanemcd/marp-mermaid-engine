# Marp Mermaid Engine

A Marp Core 5 engine that renders fenced Mermaid diagrams with standard Mermaid.js through `@mermaid-js/mermaid-cli`. This supports Mermaid syntax such as `classDef` and `class` that Marp Core's built-in renderer may not handle the same way.

The engine keeps Mermaid source in the Markdown deck, renders SVGs asynchronously, and inlines them into the generated HTML. It also retains Marp Core's MathJax, KaTeX, and Shiki plugins.

## Requirements

- Node.js 20 or newer
- Marp CLI 3.2.1 or newer (async engine rendering support)
- Marp Core 5
- A Puppeteer-compatible browser installation

## Install from GitHub

Install the public GitHub repo directly into your home-level `node_modules`:

```sh
npm install --prefix "$HOME" --no-save --package-lock=false github:shanemcd/marp-mermaid-engine
```

No clone or symlink is needed. This makes `marp-mermaid-engine` resolvable from decks located under your home directory. To update it, run the same command again.

If Puppeteer's browser install was skipped and Chrome is not available, install it once:

```sh
(cd "$HOME" && npx puppeteer browsers install chrome)
```

Configure `marp-mode` to use the package name:

```elisp
(setq marp-engine "marp-mermaid-engine")
```

Or run Marp directly:

```sh
marp --engine marp-mermaid-engine --preview slides.md
```

The GitHub repository is public. The `"private": true` field in `package.json` only prevents accidental `npm publish`; it does not affect GitHub visibility, cloning, or use as a Marp engine.

## Test

```sh
npm test
```

The smoke test renders two identical diagrams containing `classDef`, checks that they become inline SVGs, and verifies that each SVG has a unique ID.
