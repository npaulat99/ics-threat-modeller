# Run implementation loop

Read:

* `.ai/current-goal.md`
* `.ai/goals.md`
* `.ai/context.md`
* `.github/copilot-instructions.md`

Execute exactly one implementation step.

Loop procedure:

1. Identify the single current step from `.ai/current-goal.md`.
2. Read only the owning files, nearby code, and any directly relevant tests for that step.
3. If the step touches a shared JSON schema or the methodology step order, inspect every consumer
   in the webapp and VS Code extension before editing.
4. Implement only that step.
5. Modify only files required for that step.
6. Add or update tests required by the acceptance criteria.
7. After the first substantive edit, run the narrowest executable validation available for the
   touched slice before doing any more searching or editing.
8. Review your own implementation against the acceptance criteria.
9. If the step is complete:

   * update `.ai/current-goal.md`
   * update `.ai/progress.md`
   * mark the step complete
   * activate the next step
10. If the step is not complete:

   * document the blocker in `.ai/progress.md`
   * do not continue to another step

Validation guidance:

- Prefer a targeted test, typecheck, lint, or build command for the touched package.
- For docs-only steps, use a careful diff review when no executable check exists.
- For webapp client changes, prefer `npm --workspace client run typecheck` or `npm run build`.
- For server or schema changes, prefer the narrowest project-specific check that exercises the
  touched files.
- For extension changes, prefer the extension compile command.

Do not broaden scope to a second step even if adjacent issues are visible.

Output:

* files changed
* validations run
* review result
* next active step

Never work on multiple steps in one loop.
