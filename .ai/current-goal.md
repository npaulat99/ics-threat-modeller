# Current goal (whole-feature execute prompt)

> Workflow: this file now holds an **entire goal** as one large execute prompt, not a single micro
> step. Implement the whole remaining feature in one pass, run the validations at the end, then do a
> single verify/review. When this goal is done, paste the next goal's block from `.ai/backlog.md`
> into this file. Keep the shared-schema guardrails from `.github/copilot-instructions.md` and
> `.ai/context.md`.

# === Goal 2: New-project tutorial onboarding ===

Goal: 2 — Show a start/skip tutorial when a user opens a new project, and guide them through a tiny
example with a central animated walkthrough. (Webapp/React feature.)

## Feature summary

When a user opens a **new** project in the webapp, show a popup that explains this is a tutorial with
`Start tutorial` and `Skip tutorial`. If started, present a central animated walkthrough that guides
the user through a tiny example project, explaining every methodology step in the correct order
(what / how / why). The animation window sits in the middle and shows a cursor-driven actor using
EmbedRisk — **no visible keyboard**. Around the animation are short texts with the most important
information in **bold**. Keep it visually clean and balanced (window/background/text proportions,
focus on the animation, not too much text).

## Read first

- `webapp/client/src/App.tsx` — the `+ New project` flow (`promptNewProject` → `newProject(name)`).
- `webapp/client/src/state/store.ts` — `newProject`/`createProject` and `init` (where to trigger the
	popup and persist the "seen tutorial" choice, e.g. via `localStorage`).
- `webapp/client/src/components/SettingsModal.tsx` and `index.css` / `tra-ui.css` for existing modal
	and styling patterns to reuse.

## Implementation parts

### Part A — Dedicated tutorial folder

- Create a dedicated tutorial folder (e.g. `webapp/tutorial/` or `webapp/client/src/tutorial/`) that
	holds the tutorial's own example project data, its tutorial risk data, and any assets (SVG/CSS)
	for the animation. Tutorial resources must NOT pollute `webapp/projects/` or regular project
	content, and must not be picked up by `listProjects()`.

### Part B — Tutorial popup on new-project open

- After a new project is created, show a modal with a short intro and two actions: `Start tutorial`
	and `Skip tutorial`. Persist the choice (e.g. `localStorage` key) so it does not reappear every
	time; only trigger on genuinely new projects, not on opening an existing one.

### Part C — Central animated walkthrough

- Build a centered overlay: a focused **animation window** in the middle showing a cursor/hand actor
	performing EmbedRisk actions (no visible keyboard), surrounded by concise captions with key points
	in **bold**. Provide next/back/close controls and a step indicator.
- Sequence the walkthrough through the methodology steps in order (`01-project-description` …
	`09-defects`), each with a one- or two-line what/how/why. Keep animations lightweight (CSS/SVG or
	small JS), not a heavy dependency.

### Part D — Visual polish

- Balanced proportions and consistent theme (light/dark) with the rest of the app; readable, not
	text-heavy; the animation is the focal point.

## Acceptance criteria

- Opening a new project shows the start/skip popup; the choice is remembered.
- Starting the tutorial runs a centered animated walkthrough covering every step in order with short,
	bold-highlighted captions and no visible keyboard.
- Tutorial resources live in a dedicated folder and never appear as a real project.
- The onboarding is visually clean, proportionate, and readable in both themes.

## Required tests / validation

- `npm --workspace client run typecheck` and `npm run build` succeed.
- Manual: create a new project → popup appears → Start runs the walkthrough end-to-end; Skip dismisses
	and is remembered; existing-project open does not show it.

## Risks / guardrails

- Do not let tutorial data leak into `webapp/projects/` or `listProjects()`.
- Keep animation dependencies minimal; prefer CSS/SVG over a large animation library.
- Respect the "no visible keyboard" and "focus on the animation, minimal text" constraints.