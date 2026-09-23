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

# Run once if Puppeteer's browser install was skipped or no Chrome is available.
(cd "$HOME/.local/share/marp-mermaid-engine" && npx puppeteer browsers install chrome)

# Make the package name resolvable from decks anywhere under your home directory.
mkdir -p "$HOME/node_modules"
if [ ! -e "$HOME/node_modules/marp-mermaid-engine" ] && [ ! -L "$HOME/node_modules/marp-mermaid-engine" ]; then
  ln -s "$HOME/.local/share/marp-mermaid-engine" "$HOME/node_modules/marp-mermaid-engine"
fi
```

Configure `marp-mode` to use the package name:

```elisp
(setq marp-engine "marp-mermaid-engine")
```

Or run Marp directly:

```sh
marp --engine marp-mermaid-engine --preview slides.md
```

To update an existing clone:

```sh
git -C "$HOME/.local/share/marp-mermaid-engine" pull --ff-only
npm ci --prefix "$HOME/.local/share/marp-mermaid-engine"
```

The repository is public, so no GitHub authentication is needed to clone or pull it. The `"private": true` field in `package.json` only prevents accidental `npm publish`; it does not affect GitHub visibility, cloning, or use as a Marp engine.

## Package-name resolution

Marp CLI resolves package specifiers from the Markdown file's directory and current working directory. The symlink above makes `marp-mermaid-engine` resolvable for decks under your home directory, while keeping the actual Git checkout in `~/.local/share`.

## Test

```sh
npm test
```

The smoke test renders two identical diagrams containing `classDef`, checks that they become inline SVGs, and verifies that each SVG has a unique ID.
