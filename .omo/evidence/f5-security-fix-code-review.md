# F5 Security Fix Code Review

date: 2026-07-07
worktree: `/home/burt/Documents/kimi-agent-swarm-skill/.worktrees/next-priorities-integration`

## Scope

- Fixed `runtime/wide-search/src/completion-evidence.ts` to fail closed when recursive secret-shape scanning exceeds the max depth.
- Fixed `runtime/wide-search/src/providers/public-reader.ts` so explicit hostname HTTP fetches resolve to a validated public IP endpoint immediately before fetch; HTTPS hostnames fail closed because this runtime cannot safely preserve TLS hostname verification when fetching by IP.
- Added focused regressions in `runtime/wide-search/tests/completion-evidence.test.ts` and `runtime/wide-search/tests/providers/public-reader.test.ts`.

## Scenarios And Observables

| Scenario | Invocation | Binary observable | Artifact path |
| --- | --- | --- | --- |
| Deep completion evidence secret at depth greater than 8 is rejected | `cd runtime/wide-search && bun test tests/providers/public-reader.test.ts tests/completion-evidence.test.ts` | `rejects secret-shaped evidence past the recursive scan depth` passed; focused suite `19 pass, 0 fail` | `runtime/wide-search/tests/completion-evidence.test.ts` |
| Hostname HTTP opt-in fetch uses validated IP URL plus original Host header | `cd runtime/wide-search && bun test tests/providers/public-reader.test.ts tests/completion-evidence.test.ts` | `reads explicit public HTTP hostnames through the validated IP endpoint` passed and observed `http://93.184.216.34/research-note` with `Host: example.com` | `runtime/wide-search/tests/providers/public-reader.test.ts` |
| Hostname HTTPS opt-in fails closed before fetch | `cd runtime/wide-search && bun test tests/providers/public-reader.test.ts tests/completion-evidence.test.ts` | `fails closed for explicit HTTPS hostnames because IP fetch cannot preserve TLS host verification` passed with no fetcher calls | `runtime/wide-search/tests/providers/public-reader.test.ts` |
| DNS rebinding after precheck is blocked | `cd runtime/wide-search && bun test tests/providers/public-reader.test.ts tests/completion-evidence.test.ts` | Resolver returned public on precheck and private on fetch revalidation; `revalidates hostname DNS immediately before fetch and blocks rebinding` passed with no fetcher calls | `runtime/wide-search/tests/providers/public-reader.test.ts` |

## Commands

- `cd runtime/wide-search && bun test tests/providers/public-reader.test.ts tests/completion-evidence.test.ts` -> `19 pass, 0 fail`.
- `cd runtime/wide-search && bun run typecheck` -> `tsc --noEmit` passed.
- `cd runtime/wide-search && bun run check` -> `biome check .` passed, `Checked 108 files`.
- `cd runtime/wide-search && bun test` -> `170 pass, 9 skip, 0 fail`.
- `git diff --check` -> passed with no output.
- `rg -n "as any|as unknown|@ts-ignore|@ts-expect-error|eslint-disable|biome-ignore" runtime/wide-search/src/completion-evidence.ts runtime/wide-search/src/providers/public-reader.ts runtime/wide-search/tests/completion-evidence.test.ts runtime/wide-search/tests/providers/public-reader.test.ts` -> no matches.
- Pure LOC check:
  - `runtime/wide-search/src/completion-evidence.ts` -> 64
  - `runtime/wide-search/src/providers/public-reader.ts` -> 237
  - `runtime/wide-search/tests/completion-evidence.test.ts` -> 161
  - `runtime/wide-search/tests/providers/public-reader.test.ts` -> 249

## Risks

- HTTPS hostname reads with `allowHostnames: true` now fail closed. This is intentional because `fetch` does not expose a safe way here to connect to a selected IP while preserving SNI/certificate hostname verification.
- HTTP virtual-host behavior depends on the runtime honoring the explicit `Host` header. The regression checks the fetcher contract; default live web access was not used.
- The requested plan file `.omo/plans/next-priorities-roadmap-20260708.md` is not present in this worktree, but the commit footer uses the requested path string.
