# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-06-14

### Added

- Open provider registry (`src/providers/registry.ts`) centralizing provider metadata, pricing, credentials, and factory constructors.
- `src/text-utils.ts`, `src/html-utils.ts`, and `src/provider-utils.ts` for shared utility functions.
- `.gitignore` covering dependencies, build output, runtime artifacts, OS/editor files, and environment files.
- `CHANGELOG.md`.
- Additional test coverage for fetch utilities, provider registry, distributed resume, budget guards, scorer edge cases, and cache default TTL.

### Changed

- `src/providers/index.ts`, `src/config.ts`, `src/costs.ts`, `src/cli.ts`, and `src/init.ts` now derive provider data from the registry descriptor.
- Freshness scoring in `src/scorer.ts` is now relative to the current date instead of hardcoded year thresholds.
- Distributed latest query in `src/distributed/task-splitter.ts` now uses the current year dynamically.
- README external worker section clarified to describe `--workers 0` with Redis.
- Bumped version to `1.0.0`.

### Removed

- Hardcoded provider switch statements and duplicated credential/pricing tables.
- Duplicate `normalizeClaimText`, `tokenSet`, `jaccardSimilarity`, `escapeHtml`, `inferSourceClass`, and `parsePublishedAt` implementations.
