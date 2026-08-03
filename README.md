# EmbedRisk

<div align="center">
  <img src="vscode-extension/media/embedrisk-logo.svg" alt="EmbedRisk" width="120" />
  <h1>EmbedRisk</h1>
  <p><strong>Threat and Risk Assessment (TRA) for embedded OT field devices, built for engineering teams.</strong></p>
</div>

EmbedRisk provides a practical TRA workflow with two tools that share one JSON-based project format:

- a web application for collaborative modeling and review,
- a VS Code extension for native editor-based workflows.

Both tools focus on structured, traceable assessments for IEC 62443-oriented product security engineering.

## Repository contents

| Directory | Purpose |
|---|---|
| [webapp/](webapp/) | TRA web application (React + Node): guided workflow, layered DFD canvas, risk logic, report generation |
| [vscode-extension/](vscode-extension/) | EmbedRisk VS Code extension: guided wizard, native DFD and attack-tree editors, report command |
| [knowledge-base/](knowledge-base/) | Reusable OT attacker, threat, and countermeasure examples |
| [tools/](tools/) | Utility scripts (DFD conversion, report generation, model tests) |

## What EmbedRisk supports

- Structured TRA steps with one artifact file per step.
- STRIDE-based threat modeling grounded in OT device context.
- Layered DFD modeling with trust boundaries and interfaces.
- Risk scoring with a configurable 5x5 scheme (Likelihood x Impact).
- Optional attack trees for deeper threat decomposition.
- Threat to requirement to countermeasure traceability.
- HTML report generation from project artifacts.

## Quick start

### Web app

1. Open a terminal in [webapp/](webapp/).
2. Install dependencies.
3. Build the client.
4. Start the server.

Commands:

    cd webapp
    npm install
    npm run build
    npm start

Default URL: http://localhost:4317

### VS Code extension

Install the latest VSIX from [vscode-extension/](vscode-extension/) or build from source:

    cd vscode-extension
    npm install
    npm run compile

Then in VS Code run the command: EmbedRisk: New Project

## Shared project format

The web app and extension read and write the same on-disk format (one folder per TRA project):

    <project-root>/
      01-project-description/project.json
      02-assumptions/assumptions.json
      03-system-assets/system.json
      04-dfd/dfd.json
      05-requirements/requirements.json
      06-threats/threats.json
      07-attack-trees/attack-trees.json
      08-countermeasures/countermeasures.json
      09-defects/defects.json
      report/index.html

Use either tool interchangeably, or edit JSON directly when needed.

## How to perform TRA with EmbedRisk

Read [docs/HOW-TO-TRA.md](docs/HOW-TO-TRA.md) for:

- what TRA is and where it fits in development,
- what to prepare before modeling in EmbedRisk,
- a practical step-by-step modeling workflow,
- a short list of high-value further reading.

## Methodology and compliance context

EmbedRisk is designed to support secure product development workflows aligned with IEC 62443-4-1 and related regulatory expectations (for example, CRA-aligned traceability and evidence generation).

The risk method uses:

- Likelihood x Impact on a 5x5 matrix,
- impact dimensions across Confidentiality, Integrity, Availability, and Safety,
- attacker-profile-grounded assumptions to reduce subjective scoring.

## Knowledge base

The repository-level examples in [knowledge-base/](knowledge-base/) are intended as starter content. Teams should adapt and extend them with product-specific attacker assumptions, threat patterns, and approved controls.

## License

EmbedRisk repository-authored code is licensed under GNU GPLv3. See [LICENSE](LICENSE).

This repository also ships third-party materials (notably the optional vendored draw.io webapp in `vscode-extension/media/drawio/`) that remain under their own upstream licenses.

For details and distribution obligations, see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
