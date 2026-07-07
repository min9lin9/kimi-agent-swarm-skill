# Fablize Procedure Reference

Purpose: import the transferable parts of the `fivetaku/fablize` workflow into Kimi Agent Swarm-style work without claiming that a harness raises model capability.

Use this reference when the request is multi-step, debugging/root-cause oriented, asks for "see it through" behavior, produces an executable/rendered artifact, or requires strong completion evidence.

## Transferable Disciplines

1. **Verification grounding**
   - Run or render the artifact when correctness depends on runtime behavior.
   - Observe the actual output before claiming completion.
   - Treat static parsing as necessary but insufficient for UI, SVG, HTML, game, chart, notebook, or CLI behavior.

2. **Multi-story completion gate**
   - Split work into sequential stories only when the task has two or more dependent stages.
   - Each story must have a verifiable outcome and concrete evidence.
   - The final story should be a verification story that cannot be marked complete without command/result evidence.

3. **Investigation protocol**
   - Reproduce first.
   - Form competing hypotheses.
   - Gather evidence that can reject each hypothesis.
   - Trace the causal chain, not only the visible symptom.
   - Verify before and after the fix.

4. **Early-stop prevention**
   - Do not say "I'll do X" unless X has been done or is explicitly waiting on user approval.
   - Completion claims must cite current-session evidence: command output, run ledger, verifier report, rendered observation, or reviewed diff.

## Capability Boundary

This procedure improves follow-through; it does not create model capability. If the task needs open-ended creative quality, out-of-spec defect discovery, or repeated self-started propagation beyond the current model's ability, report the limit and recommend escalation rather than pretending the harness solved it.

## Reporting Contract

For any task routed through this procedure, include:

- outcome first
- story/checklist status when applicable
- commands or tools used
- evidence paths or direct observations
- verification result
- unresolved risks and next human check
