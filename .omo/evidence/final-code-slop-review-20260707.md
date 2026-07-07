# Final Code / Slop Review - 2026-07-07

## Verdict

Status: PASS after F2 rerun fix.

Scope reviewed:

- Full changed TypeScript/test set from `origin/main...HEAD`.
- Current working-tree F2 fix: `runtime/wide-search/tests/markdown.test.ts` split into `runtime/wide-search/tests/markdown-strict.test.ts`.
- No production behavior changes were made for this rerun fix.

## Skill Lenses Applied

### `omo:programming`

- TypeScript reference was loaded before editing.
- New code stayed in TypeScript test files only.
- No new `as any`, `as unknown`, `@ts-ignore`, `@ts-expect-error`, `SIZE_OK`, `no-excuse-ok`, or non-null assertions were added.
- Changed TypeScript/test files are below the 250 pure-LOC ceiling after the split.

### `omo:remove-ai-slops`

- This pass did not remove production logic.
- The oversized-test blocker was handled by cohesive extraction: strict/high-risk markdown rendering coverage moved to `tests/markdown-strict.test.ts`.
- Existing assertions were preserved and still drive the real renderer surface.
- No new helper abstraction or parser dependency was added for the split.

## Command Evidence

### Changed TypeScript/Test Inventory

Command:

```bash
{ git diff --name-only origin/main...HEAD -- '*.ts' '*.tsx' '*.mts' '*.cts'; git diff --name-only -- '*.ts' '*.tsx' '*.mts' '*.cts'; git ls-files --others --exclude-standard -- '*.ts' '*.tsx' '*.mts' '*.cts'; } | sort -u
```

Observed changed files included the branch runtime files plus the new split file:

```text
runtime/wide-search/tests/markdown-strict.test.ts
runtime/wide-search/tests/markdown.test.ts
runtime/wide-search/src/cli-contract.ts
runtime/wide-search/src/cli.ts
runtime/wide-search/src/providers/public-reader.ts
runtime/wide-search/src/strict-claims.ts
runtime/wide-search/src/types.ts
...
```

### Changed-File Pure LOC

Command:

```bash
files=$({ git diff --name-only origin/main...HEAD -- '*.ts' '*.tsx' '*.mts' '*.cts'; git diff --name-only -- '*.ts' '*.tsx' '*.mts' '*.cts'; git ls-files --others --exclude-standard -- '*.ts' '*.tsx' '*.mts' '*.cts'; } | sort -u); for f in $files; do [ -f "$f" ] || continue; loc=$(awk '!/^[[:space:]]*$/ && !/^[[:space:]]*(\/\/|#|--)/ { count++ } END { print count+0 }' "$f"); printf '%4d %s\n' "$loc" "$f"; done | sort -nr
```

Top results:

```text
 249 runtime/wide-search/tests/providers/public-reader.test.ts
 240 runtime/wide-search/src/distributed/runner.ts
 237 runtime/wide-search/src/providers/public-reader.ts
 221 runtime/wide-search/src/shared-runtime.ts
 217 runtime/wide-search/src/types.ts
 217 runtime/wide-search/src/cli.ts
 216 runtime/wide-search/src/verifier.ts
 200 runtime/wide-search/src/cli-contract.ts
 191 runtime/wide-search/src/markdown.ts
 185 runtime/wide-search/tests/markdown.test.ts
 181 runtime/wide-search/tests/cli-inspect.test.ts
 110 runtime/wide-search/tests/markdown-strict.test.ts
```

Result: PASS. No changed TypeScript/test file is at or above 250 pure LOC. `tests/markdown.test.ts` is now 185 pure LOC; `tests/markdown-strict.test.ts` is 110 pure LOC.

### Escape Hatches

Changed-file scan command:

```bash
files=$({ git diff --name-only origin/main...HEAD -- '*.ts' '*.tsx' '*.mts' '*.cts'; git diff --name-only -- '*.ts' '*.tsx' '*.mts' '*.cts'; git ls-files --others --exclude-standard -- '*.ts' '*.tsx' '*.mts' '*.cts'; } | sort -u); rg -n 'as any|as unknown|@ts-ignore|@ts-expect-error|eslint-disable|biome-ignore|no-excuse-ok|SIZE_OK|allow: SIZE_OK|debt:|ponytail:|\!\.' $files
```

Output:

```text
runtime/wide-search/src/distributed/worker.ts:77:  // eslint-disable-next-line no-constant-condition
runtime/wide-search/src/distributed/worker.ts:163:        providerCalls: acc.providerCalls + t.result!.usageMetrics.providerCalls,
runtime/wide-search/src/distributed/worker.ts:164:        apiCalls: acc.apiCalls + t.result!.usageMetrics.apiCalls,
```

Diff-only scan command:

```bash
git diff --unified=0 -- '*.ts' '*.tsx' '*.mts' '*.cts' | rg '^\+.*(as any|as unknown|@ts-ignore|@ts-expect-error|eslint-disable|biome-ignore|no-excuse-ok|SIZE_OK|allow: SIZE_OK|debt:|ponytail:|!\.)'
```

Output: no matches.

Origin check command:

```bash
git show origin/main:runtime/wide-search/src/distributed/worker.ts | nl -ba | sed -n '70,85p;156,168p'
```

Result: the `eslint-disable` and non-null assertions already exist on `origin/main`. No new escape hatch was added by this branch or this rerun fix.

### Overfit, Tautological, and Implementation-Mirroring Tests

Focused assertion scan command:

```bash
rg -n 'delete|deletion|remove|removed|only verifies|tautolog|mirror|implementation|not\.toInclude|toInclude|toEqual\(\[\]\)' runtime/wide-search/tests/cli-contract.test.ts runtime/wide-search/tests/cli-inspect.test.ts runtime/wide-search/tests/cli-leaderboard-export.test.ts runtime/wide-search/tests/cli.test.ts runtime/wide-search/tests/completion-evidence.test.ts runtime/wide-search/tests/distributed/runner-contract.test.ts runtime/wide-search/tests/markdown.test.ts runtime/wide-search/tests/markdown-strict.test.ts runtime/wide-search/tests/providers/public-reader.test.ts runtime/wide-search/tests/publish-script.test.ts runtime/wide-search/tests/strict-claims.test.ts
```

Findings:

- `completion-evidence.test.ts` asserts observable persisted evidence redaction, not internal deletion.
- `providers/public-reader.test.ts` asserts fetch/no-fetch behavior and returned source arrays for hostile/private inputs.
- `publish-script.test.ts` asserts observable CLI/process behavior and absence of publish/pack calls in failure modes.
- `markdown.test.ts` and `markdown-strict.test.ts` assert rendered markdown sections from the public renderer.

Implementation-coupling scan command:

```bash
rg -n 'mock|spy|toHaveBeenCalled|private|implementation' runtime/wide-search/tests/cli-contract.test.ts runtime/wide-search/tests/cli-inspect.test.ts runtime/wide-search/tests/cli-leaderboard-export.test.ts runtime/wide-search/tests/cli.test.ts runtime/wide-search/tests/completion-evidence.test.ts runtime/wide-search/tests/distributed/runner-contract.test.ts runtime/wide-search/tests/markdown.test.ts runtime/wide-search/tests/markdown-strict.test.ts runtime/wide-search/tests/providers/public-reader.test.ts runtime/wide-search/tests/publish-script.test.ts runtime/wide-search/tests/strict-claims.test.ts
```

Output was limited to fixture/provider names and public-reader test names:

```text
runtime/wide-search/tests/cli-inspect.test.ts:46:        providerName: 'mock',
runtime/wide-search/tests/cli-inspect.test.ts:153:        providerName: 'mock',
runtime/wide-search/tests/cli.test.ts:41:    expect(providers.some((p: { name: string }) => p.name === 'mock')).toBe(true);
runtime/wide-search/tests/providers/public-reader.test.ts:13:  test('rejects non-http protocols and private network targets', async () => {
...
```

Result: PASS. No `spy`, `toHaveBeenCalled`, private-member probing, or implementation-mirroring assertions were found. Negative assertions are paired with observable allow/deny outcomes and are not deletion-only tests.

### Unnecessary Extraction, Parsing, or Normalization

Scan command:

```bash
files=$(git diff --name-only origin/main...HEAD -- 'runtime/wide-search/src/*.ts' 'runtime/wide-search/src/**/*.ts'); rg -n 'parse|parser|normalize|normalise|extract|sanitize|helper|util|wrapper|adapter' $files
```

Reviewed hits:

- `cli-contract.ts`: central CLI argument parsing and option building, covered by `tests/cli-contract.test.ts` and CLI scenario tests.
- `providers/public-reader.ts`: `normalizeHost` and `extractUrls` are boundary/security logic for opt-in URL fetching.
- `config.ts`: `normalizeConfig` is the config boundary after JSON load.
- `strict-claims.ts`: score normalization is part of strict-claim grading.
- Existing JSON parsing in `runtime.ts`, `cli.ts`, `distributed/runner.ts`, and `verifier.ts` is file/CLI boundary parsing.

Package scan command:

```bash
git diff --unified=0 origin/main...HEAD -- runtime/wide-search/package.json
```

Observed package change:

```text
-    "prepublishOnly": "bun run typecheck && bun run check && bun test",
+    "quality": "bun run typecheck && bun run check && bun test",
+    "prepublishOnly": "bun run quality",
```

Result: PASS. No parser dependency was added. Extraction/parsing/normalization hits are either existing runtime boundaries or branch refactors with direct tests.

### Duplicate Helpers

Helper-ish file scan command:

```bash
git diff --name-only origin/main...HEAD -- runtime/wide-search/src runtime/wide-search/tests | rg '(^|/)(.*helpers?|.*utils?|.*shared.*|.*contract.*)\.ts$'
```

Output:

```text
runtime/wide-search/src/cli-contract.ts
runtime/wide-search/src/shared-runtime-options.ts
runtime/wide-search/src/shared-runtime.ts
runtime/wide-search/tests/cli-contract.test.ts
runtime/wide-search/tests/cli-test-utils.ts
runtime/wide-search/tests/distributed/runner-contract.test.ts
```

Definition scan command:

```bash
rg -n '^(export )?(function|const|class|interface|type) ' runtime/wide-search/src/cli-contract.ts runtime/wide-search/src/shared-runtime-options.ts runtime/wide-search/src/shared-runtime.ts runtime/wide-search/tests/cli-test-utils.ts runtime/wide-search/tests/distributed/runner-contract.test.ts
```

Result: PASS. `cli-contract.ts` owns CLI parsing/option construction, `shared-runtime-options.ts` owns option/result types, `shared-runtime.ts` owns runtime orchestration helpers, and `cli-test-utils.ts` owns repeated CLI subprocess setup. No duplicate helper for the markdown split was introduced.

### Public API Breakage

API diff command:

```bash
git diff --unified=3 origin/main...HEAD -- runtime/wide-search/src/types.ts
```

Reviewed result:

- Distributed types were moved to `src/distributed/types.ts`.
- `src/types.ts` re-exports `DistributedJob`, `DistributedJobStatus`, `DistributedRunOptions`, `DistributedTask`, `DistributedTaskStatus`, and `WorkerResult`.
- `RunWideSearchOptions` and `LoadSourcesOptions` gained optional `allowPublicReaderHostnames`.

Result: PASS. Public distributed type names remain exported from `src/types.ts`; no removal of public API was found.

## F2 Rerun Fix Review

Changed files:

- `runtime/wide-search/tests/markdown.test.ts`: removed the strict/high-risk rendering case from the general markdown suite.
- `runtime/wide-search/tests/markdown-strict.test.ts`: added the same strict/high-risk rendering case in a cohesive strict-claims markdown suite.

Behavior preservation:

- Assertions from the moved test are preserved:
  - verified high-risk claim appears in definitive claims.
  - unresolved, refuted, and unclassified high-risk claims do not appear in definitive claims.
  - strict claim artifacts section is rendered.
- The test still calls `renderMarkdownSynthesis` directly.
- No production files changed in this rerun fix.

Focused test command:

```bash
bun test tests/markdown.test.ts tests/markdown-strict.test.ts
```

Observed result:

```text
8 pass
0 fail
44 expect() calls
Ran 8 tests across 2 files.
```

## Final Verification Gates

- Markdown focused tests:
  - Scenario: old/new markdown rendering suites.
  - Invocation: `bun test tests/markdown.test.ts tests/markdown-strict.test.ts`
  - Observable: `8 pass`, `0 fail`, `44 expect() calls`.
  - Artifact path: this file.
- Runtime typecheck:
  - Scenario: TypeScript project type check.
  - Invocation: `bun run typecheck`
  - Observable: `tsc --noEmit` exited 0.
  - Artifact path: this file.
- Runtime lint/format:
  - Scenario: Biome check for runtime package.
  - Invocation: `bun run check`
  - Observable: `Checked 109 files`, no fixes applied, exit 0.
  - Artifact path: this file.
- Full runtime tests:
  - Scenario: full Bun test suite.
  - Invocation: `bun test`
  - Observable: `170 pass`, `9 skip`, `0 fail`, `578 expect() calls`.
  - Artifact path: this file.
- Root diff whitespace:
  - Scenario: repository diff whitespace check.
  - Invocation: `git diff --check`
  - Observable: no output, exit 0.
  - Artifact path: this file.
- Diff-only escape-hatch scan:
  - Scenario: new TypeScript escape hatches.
  - Invocation: `git diff --unified=0 -- '*.ts' '*.tsx' '*.mts' '*.cts' | rg '^\+.*(as any|as unknown|@ts-ignore|@ts-expect-error|eslint-disable|biome-ignore|no-excuse-ok|SIZE_OK|allow: SIZE_OK|debt:|ponytail:|!\.)'`
  - Observable: no matches.
  - Artifact path: this file.

## Residual Risks

- `runtime/wide-search/tests/providers/public-reader.test.ts` is 249 pure LOC. It is below the hard threshold but close enough that future additions should split by public-reader risk class.
- `runtime/wide-search/src/distributed/worker.ts` retains pre-existing escape hatches from `origin/main`.
- The branch contains earlier security/public-reader/completion-evidence changes that this rerun intentionally did not modify.

Final status: CLEAN.
