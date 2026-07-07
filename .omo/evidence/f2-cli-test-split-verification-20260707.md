# F2 CLI Test Split Verification

## Scenario

Fix final F2 rejection by splitting oversized integrated CLI coverage without changing production behavior.

## Changed Files For This Fix

- `runtime/wide-search/tests/cli.test.ts` -> core CLI integration tests only.
- `runtime/wide-search/tests/cli-inspect.test.ts` -> distributed inspect CLI coverage.
- `runtime/wide-search/tests/cli-leaderboard-export.test.ts` -> leaderboard/export CLI coverage.
- `runtime/wide-search/tests/cli-test-utils.ts` -> shared CLI spawn and JSON parsing helpers.
- `.omo/evidence/evidence-gated-deep-wide-search/verification.md` -> corrected the false slop/size claim.

## Verification

- Focused CLI invocation: `cd runtime/wide-search && bun test tests/cli.test.ts tests/cli-inspect.test.ts tests/cli-leaderboard-export.test.ts` -> 15 pass, 0 fail.
- Full suite invocation: `cd runtime/wide-search && bun test` -> 170 pass, 9 skip, 0 fail on rerun. First run exposed a flaky/unrelated `public-reader` failure that passed alone and passed on rerun.
- Typecheck invocation: `cd runtime/wide-search && bun run typecheck` -> pass.
- Biome invocation: `cd runtime/wide-search && bun run check` -> pass.
- Root whitespace invocation: `git diff --check` -> pass.
- Escape-hatch scan invocation: `rg -n "as any|as unknown|@ts-ignore|@ts-expect-error|:\s*any\b|Promise<any>" <changed TS files>` -> no matches.

## Pure LOC

Commit-scoped CLI split:

- `runtime/wide-search/tests/cli.test.ts` -> 118 pure LOC.
- `runtime/wide-search/tests/cli-inspect.test.ts` -> 181 pure LOC.
- `runtime/wide-search/tests/cli-leaderboard-export.test.ts` -> 64 pure LOC.
- `runtime/wide-search/tests/cli-test-utils.ts` -> 38 pure LOC.

Full dirty-worktree TS scan at verification time:

- `runtime/wide-search/src/completion-evidence.ts` -> 64 pure LOC.
- `runtime/wide-search/src/providers/public-reader.ts` -> 237 pure LOC.
- `runtime/wide-search/tests/cli.test.ts` -> 118 pure LOC.
- `runtime/wide-search/tests/completion-evidence.test.ts` -> 161 pure LOC.
- `runtime/wide-search/tests/providers/public-reader.test.ts` -> 264 pure LOC. This was pre-existing unrelated dirty work in the shared worktree and was not included in the F2 commit.

## Artifact

Captured artifact path: `.omo/evidence/f2-cli-test-split-verification-20260707.md`.
