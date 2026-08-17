# Third-Party Notices

This repository contains original EmbedRisk code and bundled third-party components.

## Licensing model used by this repository

- The original EmbedRisk code is licensed under GNU GPLv3 (see LICENSE).
- Third-party code and assets keep their own licenses.
- Nothing in this repository attempts to relicense third-party materials.

## Bundled draw.io (diagrams.net) webapp

EmbedRisk vendors the draw.io webapp for the optional VS Code draw.io editor mode.

- Location: `vscode-extension/media/drawio/`
- Vendoring script: `tools/vendor-drawio.ps1`
- Upstream source repository: https://github.com/jgraph/drawio
- Upstream project license: Apache License 2.0
- Copying mechanism in this repository: download upstream release archive and copy `src/main/webapp` into the extension media folder.

The vendored draw.io subtree contains its own embedded license notices and third-party attributions in individual files and subfolders. Those notices must be preserved.

## Notable license files in vendored draw.io subtree

- `vscode-extension/media/drawio/img/LICENSE` (Creative Commons Attribution 4.0)
- `vscode-extension/media/drawio/resources/README.md`
- `vscode-extension/media/drawio/js/deflate/README.md`
- `vscode-extension/media/drawio/js/rough/README.md`
- `vscode-extension/media/drawio/js/cryptojs/README.md`
- `vscode-extension/media/drawio/js/freehand/README.md`
- `vscode-extension/media/drawio/math/README.md`

In addition, some minified vendored files contain license headers for dependencies such as DOMPurify, JSZip, pako, and others.

## Distribution obligations when publishing

When distributing this repository, package, or binary artifacts:

- Include the root `LICENSE` (GPLv3) for EmbedRisk code.
- Keep all license and copyright headers in vendored third-party files.
- Include this `THIRD_PARTY_NOTICES.md` file.
- Do not state or imply that all files are GPLv3-only.
- If you modify vendored draw.io files, document modifications and keep upstream notices intact.

## Knowledge base datasets (`knowledge_base/`)

The `knowledge_base/` folder contains data derived from the following external sources. These
datasets are **not** under GPLv3. They retain their respective upstream licenses and are accessed
by EmbedRisk code at runtime only (runtime data coupling — no static linking or compilation).

### EMB3D™ — The MITRE Corporation

- **Required notice:** ©2026 The MITRE Corporation. This work is reproduced and distributed with
  the permission of The MITRE Corporation.
- **License:** MITRE custom permissive license. Derivative works permitted with attribution.
  Notify [EMB3D@mitre.org](mailto:EMB3D@mitre.org) of use.
- **Upstream:** https://emb3d.mitre.org

### CAPEC™ — Common Attack Pattern Enumeration and Classification

- **Copyright:** © The MITRE Corporation. CAPEC™ is a trademark of The MITRE Corporation.
- **License:** MITRE custom permissive license. Derivative works permitted with attribution.
- **Upstream:** https://capec.mitre.org

### CWE™ — Common Weakness Enumeration

- **Copyright:** © The MITRE Corporation. CWE™ is a trademark of The MITRE Corporation.
- **License:** MITRE custom permissive license. Free to use for any research, development, or
  commercial purpose with attribution.
- **Upstream:** https://cwe.mitre.org

### ESTM — Embedded Systems Techniques Matrix

- **Copyright:** ©2025 The MITRE Corporation. All rights reserved.
- **Distribution:** Distribution Statement A — Approved for public release: distribution is
  unlimited. (Case 25-2080, Contract FA8702-24-C-0001.)
- **Upstream:** Produced by The MITRE Corporation under U.S. Government contract.

### OWASP Top Ten 2025

- **Copyright:** © Copyright 2021–2025 OWASP Top 10 Team.
- **License:** [Creative Commons Attribution 3.0 Unported (CC BY 3.0)](http://creativecommons.org/licenses/by/3.0/deed.en_US).
- **Upstream:** https://owasp.org/Top10/

Full verbatim disclaimer blocks, complete license summaries, and redistribution obligations for all
datasets are in [`knowledge_base/README.md`](knowledge_base/README.md).

## Practical scope statement

Unless explicitly stated otherwise in a file or subdirectory, repository-authored files are intended to be under GPLv3. Third-party folders and files remain under their upstream licenses.
