# Problem & solution (under 500 words)

Code review happens on the diff, but a pull request's damage usually sits in code the diff doesn't show. A reviewer sees nineteen tidy files. They miss the twentieth caller that still passes its arguments in the old order, and the team rule the new endpoint quietly breaks. CI stays green because the types line up.

BlastRadius is for teams who review pull requests every day: reviewers and tech leads. It turns each PR into a map of what it can break, and gives that map to IBM Bob, which does the review.

A deterministic engine parses the base and head of the branch with tree-sitter into a code graph. On our sample app that is 237 units and 412 edges in under a second.
- It walks reverse call and render edges from every changed unit to its dependents, and names the affected subsystems.
- It compares signatures before and after. For each caller the PR didn't update, it checks whether the arguments still match the old parameter order. That catches the bug TypeScript misses when two parameters share a type.
- It finds untested units and the ADR sections in scope.
- It produces a 0–100 risk score where every point has a written reason.

A BlastRadius MCP server gives Bob all of this as eight tools. A custom BlastRadius Reviewer mode and a reusable skill tell Bob to:
- Stop for a human when risk is high or a caller was left behind.
- Judge each rule in the team's ADRs.
- Send one subagent per affected subsystem to write a vitest regression test and run it against a real in-memory database.
- Apply fixes only after a yes.
IBM Granite on watsonx.ai writes the summary from the evidence.

People use it three ways:
- In Bob IDE: switch to the Reviewer mode and say "review branch X".
- On the command line: `blastradius review --head X --fail-on 70` prints the score and reasons and exits 2.
- In GitHub Actions: the CLI gates the merge and Bob Shell writes the review.

We measured three seeded PRs on our sample app:
- A copy change scores 6 and Bob approves it in one pass.
- Three lines in the session check score 70. They reach 34 units in 13 subsystems.
- The hero PR scores 95. BlastRadius flags the one missed caller at comments/[commentId]/route.ts:18. Bob's subagent writes a test that fails with "expected 403 to be 200" and passes after the fix. Bob also flags that the new archive route breaks ADR-002 by skipping the activity log.
- Across the three PRs, the diffs showed 21 files and the blast radius covered 56.

Other PR-risk tools score the diff and ask a model for an opinion. BlastRadius hands the model evidence with a file and line for every claim. Bob acts as a reviewer that proves what it says, with tests it wrote and ran and rules it checked against written team decisions.
