# Launch contract for existing TRA projects

This document defines the single launch contract for opening EmbedRisk against an existing TRA
project location. Later entry points must implement this behavior consistently instead of each
adding their own folder-resolution rules.

## Scope

- This contract covers launching the webapp for an existing project root.
- This contract does not define new-project onboarding. Goal 2 may build on the same resolved target and any optional preselection described here.
- This contract does not replace the current low-level server behavior of `npm start`; it defines the canonical resolution behavior that future launchers must share.

## Folder shapes

EmbedRisk must accept exactly two input folder shapes:

1. Projects container folder

A directory whose immediate children are TRA project folders. Each child project folder contains
the standard step directories such as `01-project-description` through `09-defects`.

Example shape:

```text
/projects-root/
  device-a/
    01-project-description/
    ...
    09-defects/
  device-b/
    01-project-description/
    ...
    09-defects/
```

2. Single project folder

A directory that is itself one TRA project because it directly contains the standard step
directories `01-project-description` through `09-defects`.

Example shape:

```text
/device-a/
  01-project-description/
  ...
  09-defects/
```

Any other folder shape is out of contract for Goal 1 and must be treated as unsupported until a
later step defines broader discovery behavior.

## Canonical resolution result

Every launcher must resolve the chosen target folder into one of these canonical outcomes:

- Container mode: serve the target folder as the effective `projects root` and show the normal project list.
- Single-project mode: serve the parent of the target folder as the effective `projects root` and carry the target folder name as a `preselected project id` so the UI can open that project directly.

This adaptation keeps the server model unchanged: the server still operates on a folder that holds
one subfolder per project. A single project is made compatible by shifting the effective projects
root to its parent and remembering which project should be preselected.

## Resolution precedence

For the canonical shell launcher, the target folder is selected in this order:

1. Explicit CLI path argument

If the user passes a path explicitly, that path is authoritative.

2. `TRA_PROJECTS_DIR`

If no explicit path argument is provided, use `TRA_PROJECTS_DIR` when it is set.

3. Current working directory

If neither an explicit path argument nor `TRA_PROJECTS_DIR` is provided, inspect the current
working directory.

After choosing the target folder from the precedence order above, classify it using the two folder
shapes defined in this document:

- If it is a projects container folder, serve it directly.
- If it is a single project folder, serve its parent as the effective projects root and preselect that project.

## Entry points

These entry points must exist independently of VS Code:

- Shell CLI

This is the canonical user-facing launcher. It owns the precedence rules above and is the source
of truth for turning an input folder into an effective projects root plus optional preselected
project.

These entry points are conveniences only:

- VS Code command

The VS Code command must shell out to the same CLI instead of reimplementing folder resolution in
the extension. VS Code may contribute UI for selecting a folder, but once a folder is chosen it
must invoke the shared CLI contract.

The existing low-level server entry point remains available:

- `npm start` in `webapp/`

This remains the direct server start path used today. It must preserve its current behavior:
`TRA_PROJECTS_DIR` overrides the default bundled `webapp/projects` root, `PORT` defaults to
`4317`, and the server binds to `0.0.0.0` unless `HOST` overrides it.

`npm start` is not the canonical folder-resolving launcher. Future launchers may call into the
server through this path, but they must first apply the shared resolution contract above.

## Compatibility requirements

- Preserve current `TRA_PROJECTS_DIR` semantics for the existing `npm start` flow.
- Preserve the default port `4317`.
- Preserve the default bind address `0.0.0.0`.
- Do not require VS Code for launching an existing project.

## Consequences for later work

- Goal 1 implementation work should produce one shared CLI launcher that returns or applies the effective projects root plus optional preselected project.
- Goal 2 onboarding can build on the same resolution result without redefining project-root discovery.
