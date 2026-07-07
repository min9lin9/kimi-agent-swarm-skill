# Evidence-Gated Deep Wide Search Notepad

Tier: HEAVY - TypeScript runtime verifier/CLI/synthesis behavior, evidence gates, and user requested rigorous subagent/review flow.

Skills:
- `omo:programming` - TypeScript code edit rules, strict types, TDD.
- `omo:remove-ai-slops` - branch cleanup pass after behavior is locked.
- Ponytail full - smallest working diff; defer speculative public-reader implementation until verifier slice is green.

Success criteria:
1. Strict verification writes `verified-claims.json`, `unresolved-claims.json`, and `refuted-claims.json`; high-risk unsupported-by-policy claims fail strict verification.
2. Strict synthesis only renders verified high-risk claims as definitive claims and records strict artifacts in evidence files.
3. `verify --strict-claims --require-completion-evidence` enforces completion evidence and rejects secret-shaped evidence.
4. `public-reader` reads only explicit public HTTP(S) URLs and drops private-network or private-redirect targets.
5. Existing fixture runtime and CLI flows remain green.
6. Package is publishable as `kimi-agent-swarm-cli@1.0.2`.

Manual QA scenarios:
- CLI strict run: `bun src/cli.ts research "strict claims smoke test" --profile fixture-github-repo-landscape --strict-claims --work-dir <tmp>`; PASS if JSON returns passed verification and strict claim artifact files exist.
- CLI completion evidence failure: `bun src/cli.ts verify --run-dir <temp-run> --require-completion-evidence`; PASS if status failed and report names missing completion evidence.
- Public reader guard: provider tests pass without live network and prove private IP/metadata/redirect targets are not fetched.
