# Prompt Contract

A prompt contract turns a rough user request into an explicit, verifiable work specification before execution.

## Shape

```markdown
## Goal
- What we are trying to discover, decide, or build

## Scope
- Include:
- Exclude:
- Language / region:
- Freshness window:

## Success Criteria
- What makes the output acceptable

## Execution Mode
- prompt-only | wide-search | kimi-code | hybrid

## Output
- Expected deliverables and format

## Evidence
- What artifacts or verification will be produced

## Risks
- Coverage, freshness, source bias, quota, cost, or runtime availability
```

## Usage

1. Draft the contract from the user's request.
2. Fill optional fields with safe assumptions if the user did not specify them.
3. Show the contract to the user before executing network-heavy, paid, or write-capable work.
4. Use the contract as the source of truth for subagent prompts and swarm item design.
