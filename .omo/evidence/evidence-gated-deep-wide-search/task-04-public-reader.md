# Task 04 - Public Reader

## RED

- Added deterministic provider tests for URL protocol rejection, private/metadata IP rejection, DNS revalidation, redirect revalidation, and HTML extraction.
- Initial run failed because `PublicReaderProvider` and `src/providers/public-reader.ts` did not exist.

## GREEN

- Added `public-reader` provider with explicit URL extraction, HTTP(S)-only validation, private-network blocking, DNS revalidation, redirect revalidation, response-size cap, and auth-wall status handling.
- Added registry/export wiring.
- Focused check: `bun test tests/providers/public-reader.test.ts tests/providers/index.test.ts` passed.
