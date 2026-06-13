# Contributing to Kimi Agent Swarm Skill

Thank you for your interest in contributing! This project is an evidence-backed wide-search runtime and skill pack for Kimi Code CLI and Codex.

## Quick Start

```bash
git clone https://github.com/min9lin9/kimi-agent-swarm-skill.git
cd kimi-agent-swarm-skill
cd runtime/wide-search
bun install
bun test
bun run typecheck
```

## Project Structure

- `runtime/wide-search/` — local wide-search runtime (CLI, scorer, verifier, providers)
- `skills/kimi-agent-swarm-cli/` — Kimi Code CLI skill
- `skills/kimi-agent-swarm-prompt/` — Codex prompt skill
- `docs/` — planning and product documents
- `bin/kasw` — single-entry CLI wrapper

## Making Changes

1. Open an issue or discuss your idea first for larger changes.
2. Create a branch from `main`.
3. Add tests for new behavior.
4. Run `bun test` and `bun run typecheck`.
5. Update README or docs if the change is user-facing.
6. Open a pull request using the provided template.

## Provider Development

To add a new search provider:

1. Implement `SearchProvider` in `runtime/wide-search/src/providers/<name>-provider.ts`.
2. Register it in `runtime/wide-search/src/providers/index.ts`.
3. Add mock mode for CI using `<NAME>_MOCK=1`.
4. Add unit tests in `runtime/wide-search/tests/<name>-provider.test.ts`.
5. Update `README.md` and `runtime/wide-search/src/cli.ts` help text.

## Benchmark Development

To add a new benchmark fixture:

1. Create `runtime/wide-search/fixtures/<name>.json` with sources and claims.
2. Add the profile to `ExecutionProfile` and `FIXTURE_FILE_MAP`.
3. Add golden answers to `runtime/wide-search/fixtures/golden-answers.ts`.
4. Add runtime and benchmark tests.
5. Record results in `BENCHMARKS.md`.

## Code Style

- TypeScript with strict mode enabled.
- Prefer deterministic logic; avoid hidden state.
- Keep CLI output machine-readable (JSON) by default.
- Document public functions with JSDoc comments when non-obvious.

## Community

- Be kind and constructive.
- Ask questions in GitHub Discussions.
- Report bugs with reproduction steps.
