# Marp Mermaid Engine

A Marp Core 5 engine that renders fenced Mermaid diagrams with standard Mermaid.js through `@mermaid-js/mermaid-cli`. This supports Mermaid syntax such as `classDef` and `class` that Marp Core's built-in renderer may not handle the same way.

The engine keeps Mermaid source in the Markdown deck, renders SVGs asynchronously, and inlines them into the generated HTML. It also retains Marp Core's MathJax, KaTeX, and Shiki plugins.

## Requirements

- Node.js 20 or newer
- Marp CLI 3.2.1 or newer (async engine rendering support)
- Marp Core 5
- A Puppeteer-compatible browser installation

## Install from GitHub for a user-level Emacs setup

```sh
git clone https://github.com/shanemcd/marp-mermaid-engine.git \
  "$HOME/.local/share/marp-mermaid-engine"
npm ci --prefix "$HOME/.local/share/marp-mermaid-engine"
```

Configure `marp-mode` to use the engine file:

```elisp
(setq marp-engine
      (expand-file-name "~/.local/share/marp-mermaid-engine/engine.mjs"))
```

Or run Marp directly:

```sh
marp --engine "$HOME/.local/share/marp-mermaid-engine/engine.mjs" --preview slides.md
```

To update an existing clone:

```sh
git -C "$HOME/.local/share/marp-mermaid-engine" pull --ff-only
npm ci --prefix "$HOME/.local/share/marp-mermaid-engine"
```

The repository is private for now, so authenticate with GitHub on each machine before cloning or pulling.

## Package-name resolution

Marp CLI also accepts a package specifier, for example `--engine marp-mermaid-engine`, when the package is installed in a `node_modules` directory resolvable from the Markdown file or current working directory. A global npm install is not necessarily in that resolution path; the absolute engine-file path above is the reliable choice for a user-level installation.

## Test

```sh
npm test
```

The smoke test renders two identical diagrams containing `classDef`, checks that they become inline SVGs, and verifies that each SVG has a unique ID.
