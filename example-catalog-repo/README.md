# Example Catalog Repository

This folder contains an example of the catalog-repo directory structure expected by the ICS Threat Modeller application.

## Purpose

This is **not** used by the application directly. It serves as a reference/template that you can copy into a new Git repository to create your own catalog repo.

## Usage

```bash
# 1. Create a new Git repository for your catalog
mkdir my-ics-catalog && cd my-ics-catalog
git init

# 2. Copy the example content
cp -r /path/to/ics-threat-modeller/example-catalog-repo/* .

# 3. Customize the catalog entries and tag catalog to your needs
# 4. Commit and push
git add .
git commit -m "Initial catalog"
git remote add origin git@github.com:<your-org>/ics-catalog.git
git push -u origin main
```

Then inside the running Docker container:

```bash
cd /app/data
rm -rf catalog-repo
git clone git@github.com:<your-org>/ics-catalog.git catalog-repo
```

Re-sync in the app via **Projects page → 🔄 Re-sync from Files**, or restart the container.

## Directory Structure

```
catalog-repo/
├── catalog/                        ← Attack-Tree templates (one YAML file each)
│   ├── firmware-compromise.yaml
│   ├── credential-theft.yaml
│   └── ...
└── tag-catalog/                    ← Tag suggestions by category
    ├── assets.yaml                 ← ICS asset types
    ├── interfaces.yaml             ← Protocols and communication interfaces
    └── third-party-software.yaml   ← Vendor software products
```

## File Formats

### Catalog Entries (`catalog/*.yaml`)

Each YAML file defines one attack-tree template. Required fields:

| Field | Type | Description |
|---|---|---|
| `name` | string | Unique display name of the catalog entry |
| `description` | string | Brief description of the attack scenario |
| `entry_type` | string | Always `"attack_tree"` |
| `source_framework` | string | Reference framework (e.g., "MITRE ATT&CK for ICS") |
| `version` | string | Version string (e.g., "1.0") |
| `tags` | array | Optional list of tags |
| `tree_data` | object | The attack tree structure (see below) |

#### `tree_data` Structure

```yaml
tree_data:
  goal:
    name: "Goal Name"
    description: "Goal description."
    aggregation_type: or          # "or" or "and"
  steps:
    - name: "Step Name"
      description: "Step description."
      is_leaf: true               # true = leaf step (has assessments)
      assessments:                # Assessment factors (1-5 scale)
        - factor_name: Elapsed Time
          factor_value: 3
          rationale: "Explanation."
        - factor_name: Expertise
          factor_value: 4
          rationale: "Explanation."
        - factor_name: Knowledge of Target
          factor_value: 5
          rationale: "Explanation."
        - factor_name: Window of Opportunity
          factor_value: 3
          rationale: "Explanation."
        - factor_name: Equipment
          factor_value: 4
          rationale: "Explanation."
      countermeasures:            # Optional
        - name: "Countermeasure Name"
          description: "Description."
          effectiveness: 4        # 1-5 scale
      technique_mappings:         # Optional: MITRE ATT&CK mappings
        - technique_id: "T0839"
          technique_name: "Module Firmware"
          source: "MITRE ATT&CK for ICS"
      steps:                      # Optional: nested sub-steps
        - name: "Sub-step"
          ...
```

### Tag Catalog (`tag-catalog/*.yaml`)

Each YAML file is an array of `{name, description}` objects:

```yaml
- name: PLC
  description: Programmable Logic Controller
- name: RTU
  description: Remote Terminal Unit
```

**Recognized files** (filename → category mapping):

| Filename | Category in DB |
|---|---|
| `assets.yaml` / `assets.yml` | `asset` |
| `interfaces.yaml` / `interfaces.yml` | `interface` |
| `third-party-software.yaml` / `third-party-software.yml` | `third_party_software` |
