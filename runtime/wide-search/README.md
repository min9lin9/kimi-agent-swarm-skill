# kimi-agent-swarm-cli

Evidence-backed wide-search CLI for Kimi Agent Swarm.

## Install

Requires [Bun](https://bun.sh) 1.0 or later.

```bash
npm install -g kimi-agent-swarm-cli
# or
bun install -g kimi-agent-swarm-cli
```

## Quick Start

```bash
# First-run setup
kasw init

# Run a fixture benchmark
kasw benchmark --profile fixture-paul-graham-corpus

# Live search with Tavily (requires TAVILY_API_KEY)
kasw research "AI browser agent repos" --profile web-search --provider tavily

# Distributed execution
kasw research "AI browser agent landscape" --profile web-search --provider tavily --distributed --workers 4

# Leaderboard
kasw leaderboard --profile fixture-paul-graham-corpus
kasw leaderboard --html --out leaderboard.html
```

## Providers

- `mock` — deterministic demo/CI provider
- `serper` — Serper.dev Google Search (requires `SERPER_API_KEY`)
- `tavily` — Tavily AI search (requires `TAVILY_API_KEY`)
- `brave` — Brave Search API (requires `BRAVE_API_KEY`)
- `github` — GitHub repository search (requires `GITHUB_TOKEN`)

## Documentation

See the [main repository README](https://github.com/min9lin9/kimi-agent-swarm-skill/blob/main/README.md) for full documentation.

## License

MIT
