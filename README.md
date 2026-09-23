# Marp Mermaid Engine

A Marp Core 5 engine that renders fenced Mermaid diagrams with standard Mermaid.js through `@mermaid-js/mermaid-cli`. This supports Mermaid syntax such as `classDef` and `class` that Marp Core's built-in renderer may not handle the same way.

The engine keeps Mermaid source in the Markdown deck, renders SVGs asynchronously, and inlines them into the generated HTML. It also retains Marp Core's MathJax, KaTeX, and Shiki plugins.

## Requirements

- Node.js 20 or newer
- Marp CLI 3.2.1 or newer (async engine rendering support)
- Marp Core 5
- A Puppeteer-compatible browser installation

## Install from GitHub

```sh
npm install -g github:shanemcd/marp-mermaid-engine
```

If Puppeteer's browser install was skipped and Chrome is not available, install it once:

```sh
npx puppeteer browsers install chrome
```

Configure `marp-mode` to use the installed engine file. Using `npm root -g` avoids hard-coding the global npm prefix:

```elisp
(setq marp-engine
      (expand-file-name
       (concat (string-trim (shell-command-to-string "npm root -g"))
               "/marp-mermaid-engine/engine.mjs")))
```

Or run Marp directly:

```sh
marp --engine "$(npm root -g)/marp-mermaid-engine/engine.mjs" --preview slides.md
```

To update, run the same `npm install -g` command again. The GitHub repository is public. The `"private": true` field in `package.json` only prevents accidental `npm publish`; it does not affect GitHub installation or using the engine file with Marp.

Marp CLI resolves package specifiers from the Markdown file and current working directory, not npm's global module directory. Therefore, after a global install, pass the engine file path shown above rather than the bare package name.

## Test

```sh
npm test
```

The smoke test renders two identical diagrams containing `classDef`, checks that they become inline SVGs, and verifies that each SVG has a unique ID.
