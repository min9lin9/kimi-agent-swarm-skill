# Verification

## Focused

- `bun test tests/providers/public-reader.test.ts tests/strict-claims.test.ts tests/distributed/runner.test.ts tests/providers/index.test.ts tests/runtime.test.ts tests/markdown.test.ts tests/cli.test.ts` -> 56 pass.
- `bun run typecheck` -> pass.
- `bun run check` -> pass.
- LSP diagnostics on changed TypeScript source/test files -> no diagnostics.
- AST-grep checks for `as any` and optional-assignment patterns -> no matches.

## E2E

- `bun src/cli.ts research "strict claims smoke test" --profile fixture-github-repo-landscape --strict-claims --work-dir /private/tmp/kasw-strict-e2e-v2.j3pIH4` -> failed closed with 29 unresolved unclassified strict claims and wrote strict artifacts.
- `bun src/cli.ts verify --run-dir /private/tmp/kasw-strict-e2e-v2.j3pIH4/.runs/wide-search/2026-07-07T07-48-48-130Z-vqkvca --strict-claims` -> failed closed with 29 unresolved strict claims.
- `bun src/cli.ts run "strict distributed smoke" --profile fixture --distributed --strict-claims --work-dir /private/tmp/kasw-strict-e2e-v2.j3pIH4` -> failed closed with `verification.strictClaims.enabled === true` and unresolved `C001`.
- `bun src/cli.ts research "read http://127.0.0.1/admin" --profile web-search --provider public-reader --work-dir /private/tmp/kasw-strict-e2e-v2.j3pIH4 --max-results 5` -> private URL produced zero accepted sources.

## Full Gates

- Raw `bun test` in sandbox failed due environment: user HOME npm/kasw cache EPERM, `Bun.serve({ port: 0 })` EADDRINUSE, Redis probe late timeout.
- `env HOME=/private/tmp/kasw-test-home XDG_CONFIG_HOME=/private/tmp/kasw-test-home/.config REDIS_URL=not-a-url bun test` outside sandbox -> 151 pass, 9 skip, 0 fail.
- `env HOME=/private/tmp/kasw-test-home XDG_CONFIG_HOME=/private/tmp/kasw-test-home/.config REDIS_URL=not-a-url bun run prepublishOnly` outside sandbox -> pass.
- `npm pack --dry-run --cache /private/tmp/kasw-npm-cache` -> `kimi-agent-swarm-cli@1.0.2`, 60 files.

## Review

- Reviewer 1 strict verifier/completion evidence -> OK after unclassified claims and structured secret evidence fixes.
- Reviewer 2 public-reader security -> OK after IPv4-mapped IPv6 canonical hex fix.
- Reviewer 3 CLI/e2e/distributed strict propagation -> OK after forwarding `strictClaims` through distributed runs.
- Reviewer 4 slop/size -> OK after provider address split kept changed files under 250 pure LOC.
- Reviewer 5 packaging/release -> OK after final prepublish and pack dry-run.
