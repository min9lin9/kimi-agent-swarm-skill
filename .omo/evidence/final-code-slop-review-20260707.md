# Final Code / Slop Review - 2026-07-07

## Verdict

Status: PASS after final F2 assertion blocker fix.

Scope reviewed:

- Full changed TypeScript/test set from `origin/main...HEAD`.
- Current working-tree F2 fix: `runtime/wide-search/tests/markdown.test.ts` split into `runtime/wide-search/tests/markdown-strict.test.ts`.
- Current working-tree F2 assertion fix: listed plain TypeScript assertions were replaced with typed parser helpers and JSON boundary decoders.
- Final F2 assertion blocker fix: `runtime/wide-search/tests/strict-claims.test.ts` now reads generated claim artifacts through typed JSON boundary helpers instead of `as Claim[] | undefined` assertions.
- Current working-tree F4 fix: public-reader auth-wall and oversized-response tests now use opt-in HTTP hostname fetches that reach the fetcher.

## F2/F4 Blocker Fix Update

Changed files:

- `runtime/wide-search/src/cli-contract.ts`: replaced generic enum assertions with an `isAllowedValue` type guard.
- `runtime/wide-search/src/cli.ts`: replaced inspect JSON assertions with typed JSON boundary parsers.
- `runtime/wide-search/src/cli-inspect-json.ts`: added typed inspect run/report decoders.
- `runtime/wide-search/src/distributed/job-json.ts`: added a typed distributed-job decoder for inspect.
- `runtime/wide-search/tests/cli-test-utils.ts`: added object/string JSON helpers for CLI tests.
- `runtime/wide-search/tests/cli-inspect.test.ts`: removed plain output-shape assertions.
- `runtime/wide-search/tests/cli-leaderboard-export.test.ts`: removed the `runDir` output assertion.
- `runtime/wide-search/tests/strict-claims.test.ts`: removed the five multiline `as Claim[] | undefined` assertions and replaced them with `readClaimArray`, `isClaim`, and small value-set boundary checks.
- `runtime/wide-search/tests/providers/public-reader.test.ts`: keeps provider fetch-path tests; auth-wall and oversized tests now use `http://example.com/...`, assert the fetcher was called through `http://93.184.216.34/...`, and the HTTPS hostname fail-closed test separately asserts no fetch.
- `runtime/wide-search/tests/providers/public-reader-url.test.ts`: split URL/IP validation tests out of the provider fetch-path file to keep both files below the LOC ceiling.

F4 behavior coverage:

- Scenario: auth-wall rejection after a real provider fetch path.
- Invocation: `bun test tests/providers/public-reader.test.ts`.
- Binary observable: `drops auth walls without returning a source` passed and asserts `fetchLog.fetchedUrls` equals `['http://93.184.216.34/auth-wall']`.
- Captured artifact path: this file.

- Scenario: oversized-response rejection after a real provider fetch path.
- Invocation: `bun test tests/providers/public-reader.test.ts`.
- Binary observable: `drops oversized responses without buffering them as sources` passed and asserts `fetchLog.fetchedUrls` equals `['http://93.184.216.34/large']`.
- Captured artifact path: this file.

- Scenario: HTTPS hostname fail-closed behavior remains separate.
- Invocation: `bun test tests/providers/public-reader.test.ts`.
- Binary observable: `fails closed for explicit HTTPS hostnames because IP fetch cannot preserve TLS host verification` passed and asserts `fetchLog.fetchedUrls` equals `[]`.
- Captured artifact path: this file.

F2 assertion coverage:

- Scenario: added TypeScript plain assertions and assertion escape hatches.
- Invocation:

```bash
files=$({ git diff --name-only origin/main...HEAD -- '*.ts' '*.tsx' '*.mts' '*.cts'; git diff --name-only -- '*.ts' '*.tsx' '*.mts' '*.cts'; git ls-files --others --exclude-standard -- '*.ts' '*.tsx' '*.mts' '*.cts'; } | sort -u); rg -n 'as any|as unknown|@ts-ignore|@ts-expect-error|eslint-disable|biome-ignore|no-excuse-ok|SIZE_OK|allow: SIZE_OK|debt:|ponytail:|!\.' $files || true
bun --eval "<AST diff scan using TypeScript parser; see Final F2 Assertion Blocker Verification below>"
```

- Binary observable: escape-hatch scan only reported pre-existing `runtime/wide-search/src/distributed/worker.ts` escape hatches already present on `origin/main`; AST diff scan for added plain assertions, including multiline `as` expressions, had no output.
- Captured artifact path: this file.

## Skill Lenses Applied

### `omo:programming`

- TypeScript reference was loaded before editing.
- New code stayed in TypeScript source/test files and replaces assertion escape hatches with typed boundaries.
- No new `as any`, `as unknown`, plain `as T`, `@ts-ignore`, `@ts-expect-error`, `SIZE_OK`, `no-excuse-ok`, or non-null assertions were added.
- Changed TypeScript/test files are below the 250 pure-LOC ceiling after the public-reader URL/provider test split.

### `omo:remove-ai-slops`

- This pass did not weaken production security behavior.
- The oversized-test blocker was handled by cohesive extraction: strict/high-risk markdown rendering coverage moved to `tests/markdown-strict.test.ts`.
- Existing assertions were preserved and still drive the real renderer surface.
- No parser dependency was added; small typed JSON helpers are used only at CLI/test JSON boundaries.

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
 240 runtime/wide-search/src/distributed/runner.ts
 237 runtime/wide-search/src/providers/public-reader.ts
 221 runtime/wide-search/src/shared-runtime.ts
 217 runtime/wide-search/src/types.ts
 216 runtime/wide-search/src/verifier.ts
 210 runtime/wide-search/src/cli.ts
 204 runtime/wide-search/tests/strict-claims.test.ts
 203 runtime/wide-search/src/cli-contract.ts
 191 runtime/wide-search/src/markdown.ts
 169 runtime/wide-search/tests/providers/public-reader.test.ts
 162 runtime/wide-search/tests/cli-inspect.test.ts
 110 runtime/wide-search/tests/markdown-strict.test.ts
 105 runtime/wide-search/src/distributed/job-json.ts
  84 runtime/wide-search/tests/providers/public-reader-url.test.ts
  49 runtime/wide-search/src/cli-inspect-json.ts
```

Result: PASS. No changed TypeScript/test file is at or above 250 pure LOC. `tests/strict-claims.test.ts` is 204 pure LOC, in the warning band but below the defect threshold; split before adding more cases there. `tests/providers/public-reader.test.ts` is now 169 pure LOC; `tests/providers/public-reader-url.test.ts` is 84 pure LOC.

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

## Final F2 Assertion Blocker Verification

Strict-claims assertion fix:

- Scenario: generated strict-claim artifact assertions in `tests/strict-claims.test.ts`.
- Invocation: `bun test tests/strict-claims.test.ts`
- Binary observable: `2 pass`, `0 fail`, `14 expect() calls`.
- Captured artifact path: this file.

Diff-only plain assertion scan:

- Scenario: newly added TypeScript `as T` assertions in the diff from `origin/main`, including multiline assertions where the `as` keyword and asserted type span separate added lines.
- Invocation:

```bash
bun --eval "
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const diff = execFileSync('git', ['diff', '--unified=0', 'origin/main', '--', '*.ts', '*.tsx', '*.mts', '*.cts'], { encoding: 'utf8' });
const addedLinesByFile = new Map();
let file = '';
let line = 0;
for (const diffLine of diff.split('\n')) {
  const fileMatch = /^\+\+\+ b\/(.+)$/.exec(diffLine);
  if (fileMatch?.[1]) { file = fileMatch[1]; if (!addedLinesByFile.has(file)) addedLinesByFile.set(file, new Set()); continue; }
  const hunkMatch = /^@@ .* \+(\d+)(?:,\d+)? @@/.exec(diffLine);
  if (hunkMatch?.[1]) { line = Number(hunkMatch[1]); continue; }
  if (diffLine.startsWith('+++') || file === '') continue;
  if (diffLine.startsWith('+')) { addedLinesByFile.get(file)?.add(line); line += 1; continue; }
  if (!diffLine.startsWith('-') && line > 0) line += 1;
}
const findings = [];
for (const [path, addedLines] of addedLinesByFile) {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  const visit = (node) => {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      const start = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      const end = source.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
      const touchesAddedLine = Array.from(addedLines).some((addedLine) => start <= addedLine && addedLine <= end);
      const assertionText = node.getText(source);
      if (touchesAddedLine && !/\bas const\b/.test(assertionText)) findings.push(path + ':' + start + ': ' + assertionText.split('\n')[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
if (findings.length > 0) { console.log(findings.join('\n')); process.exit(1); }
"
```

- Binary observable: no output, exit 0.
- Captured artifact path: this file.

Diff-only escape-hatch scan:

- Scenario: newly added TypeScript escape hatches in the diff from `origin/main`.
- Invocation:

```bash
bash -lc "git diff --unified=0 origin/main -- '*.ts' '*.tsx' '*.mts' '*.cts' | rg '^\+.*(as any|as unknown|@ts-ignore|@ts-expect-error|eslint-disable|biome-ignore|no-excuse-ok|SIZE_OK|allow: SIZE_OK|debt:|ponytail:|!\.)'; status=$?; if [ $status -eq 1 ]; then exit 0; fi; exit $status"
```

- Binary observable: no output, exit 0.
- Captured artifact path: this file.

## Final Verification Gates

- Strict-claims focused tests:
  - Scenario: strict claim verification JSON artifacts.
  - Invocation: `bun test tests/strict-claims.test.ts`
  - Observable: `2 pass`, `0 fail`, `14 expect() calls`.
  - Artifact path: this file.
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
  - Observable: `Checked 112 files`, no fixes applied, exit 0.
  - Artifact path: this file.
- Full runtime tests:
  - Scenario: full Bun test suite.
  - Invocation: `bun test`
  - Observable: `170 pass`, `9 skip`, `0 fail`, `577 expect() calls`.
  - Artifact path: this file.
- Root diff whitespace:
  - Scenario: repository diff whitespace check.
  - Invocation: `git diff --check`
  - Observable: no output, exit 0.
  - Artifact path: this file.
- Diff-only escape-hatch scan:
  - Scenario: new TypeScript escape hatches.
  - Invocation: `bash -lc "git diff --unified=0 origin/main -- '*.ts' '*.tsx' '*.mts' '*.cts' | rg '^\+.*(as any|as unknown|@ts-ignore|@ts-expect-error|eslint-disable|biome-ignore|no-excuse-ok|SIZE_OK|allow: SIZE_OK|debt:|ponytail:|!\.)'; status=$?; if [ $status -eq 1 ]; then exit 0; fi; exit $status"`
  - Observable: no matches.
  - Artifact path: this file.

## Residual Risks

- Highest changed TypeScript pure LOC is `runtime/wide-search/src/distributed/runner.ts` at 240, below the hard threshold.
- `runtime/wide-search/src/distributed/worker.ts` retains pre-existing escape hatches from `origin/main`.
- The branch contains earlier security/public-reader/completion-evidence changes that this rerun intentionally did not modify.

Final status: CLEAN.
