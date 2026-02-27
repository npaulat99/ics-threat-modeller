// SQLite schema definition — all DDL statements for the ICS Threat Modeller.
//
// Tables follow the three-layer architecture:
//   Structural: projects, goals, categories, steps, substeps, countermeasures, weaknesses
//   Assessment: assessments (7 cost factors per step/substep)
//   Context:    attacker_profiles, tags, attack_technique_mappings, change_log

use rusqlite::{Connection, Result};

/// Create all tables if they do not already exist, then run migrations.
pub fn initialize(conn: &Connection) -> Result<()> {
    conn.execute_batch(SCHEMA_SQL)?;
    run_migrations(conn)?;
    Ok(())
}

/// Run schema migrations for existing databases.
fn run_migrations(conn: &Connection) -> Result<()> {
    // Migration: Add impact_scores column to goals table.
    let has_impact_scores: bool = conn
        .prepare("SELECT impact_scores FROM goals LIMIT 0")
        .is_ok();
    if !has_impact_scores {
        conn.execute_batch(
            "ALTER TABLE goals ADD COLUMN impact_scores TEXT NOT NULL DEFAULT '{}'",
        )?;
    }

    // Migration: Allow categories under steps (parent_type 'step').
    // SQLite doesn't support altering CHECK constraints, so we recreate the table if needed.
    let sql: String = conn.query_row(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='categories'",
        [],
        |row| row.get(0),
    )?;
    if !sql.contains("'step'") {
        conn.execute_batch(
            "
            CREATE TABLE categories_new (
                id          TEXT PRIMARY KEY,
                parent_id   TEXT NOT NULL,
                parent_type TEXT NOT NULL CHECK(parent_type IN ('goal', 'category', 'step')),
                name        TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                sort_order  INTEGER NOT NULL DEFAULT 0,
                created_at  TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );
            INSERT INTO categories_new SELECT * FROM categories;
            DROP TABLE categories;
            ALTER TABLE categories_new RENAME TO categories;
            ",
        )?;
    }

    // Migration: Allow assessments on countermeasures and weaknesses (entity_type).
    let sql: String = conn.query_row(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='assessments'",
        [],
        |row| row.get(0),
    )?;
    if !sql.contains("'countermeasure'") {
        conn.execute_batch(
            "
            CREATE TABLE assessments_new (
                id                    TEXT PRIMARY KEY,
                entity_id             TEXT NOT NULL,
                entity_type           TEXT NOT NULL CHECK(entity_type IN ('step', 'substep', 'countermeasure', 'weakness')),
                is_reference          INTEGER NOT NULL DEFAULT 0,
                time_effort           INTEGER,
                prior_knowledge       INTEGER,
                exploitability        INTEGER,
                window_of_opportunity INTEGER,
                detection_probability INTEGER,
                preparation_effort    INTEGER,
                abort_risk            INTEGER,
                rationale_json        TEXT NOT NULL DEFAULT '{}',
                override_rationale    TEXT,
                created_at            TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
            );
            INSERT INTO assessments_new SELECT * FROM assessments;
            DROP TABLE assessments;
            ALTER TABLE assessments_new RENAME TO assessments;
            "
        )?;
    }

    // Migration: Add step_type column to steps table.
    let has_step_type: bool = conn.prepare("SELECT step_type FROM steps LIMIT 0").is_ok();
    if !has_step_type {
        conn.execute_batch("ALTER TABLE steps ADD COLUMN step_type TEXT NOT NULL DEFAULT 'step'")?;
    }

    // Migration: Add is_active column to attacker_profiles table.
    let has_is_active: bool = conn
        .prepare("SELECT is_active FROM attacker_profiles LIMIT 0")
        .is_ok();
    if !has_is_active {
        conn.execute_batch(
            "ALTER TABLE attacker_profiles ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1",
        )?;
    }

    // Migration: Add tag column to attacker_profiles table.
    let has_tag: bool = conn
        .prepare("SELECT tag FROM attacker_profiles LIMIT 0")
        .is_ok();
    if !has_tag {
        conn.execute_batch(
            "ALTER TABLE attacker_profiles ADD COLUMN tag TEXT NOT NULL DEFAULT ''",
        )?;
    }

    // Migration: Add third_party_software column to projects table.
    let has_tps: bool = conn
        .prepare("SELECT third_party_software FROM projects LIMIT 0")
        .is_ok();
    if !has_tps {
        conn.execute_batch(
            "ALTER TABLE projects ADD COLUMN third_party_software TEXT NOT NULL DEFAULT '[]'",
        )?;
    }

    // Migration: Allow steps to have countermeasures as parents (Attack-Defense Tree).
    let steps_sql: String = conn.query_row(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='steps'",
        [],
        |row| row.get(0),
    )?;
    if !steps_sql.contains("'countermeasure'") {
        conn.execute_batch(
            "
            CREATE TABLE steps_new (
                id                TEXT PRIMARY KEY,
                parent_id         TEXT NOT NULL,
                parent_type       TEXT NOT NULL CHECK(parent_type IN ('goal', 'category', 'step', 'countermeasure')),
                conjunction       TEXT NOT NULL DEFAULT 'OR' CHECK(conjunction IN ('AND', 'OR')),
                name              TEXT NOT NULL,
                description       TEXT NOT NULL DEFAULT '',
                access_level      INTEGER NOT NULL DEFAULT 1 CHECK(access_level BETWEEN 1 AND 5),
                skill_level       INTEGER NOT NULL DEFAULT 1 CHECK(skill_level BETWEEN 1 AND 5),
                catalog_source_id TEXT,
                sort_order        INTEGER NOT NULL DEFAULT 0,
                created_at        TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
                step_type         TEXT NOT NULL DEFAULT 'step'
            );
            INSERT INTO steps_new SELECT * FROM steps;
            DROP TABLE steps;
            ALTER TABLE steps_new RENAME TO steps;
            ",
        )?;
    }

    // Migration: Create tag_catalog table if not exists.
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS tag_catalog (
            id          TEXT PRIMARY KEY,
            category    TEXT NOT NULL CHECK(category IN ('asset', 'interface', 'third_party_software')),
            name        TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_tag_catalog_category ON tag_catalog(category);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tag_catalog_unique ON tag_catalog(category, name);",
    )?;

    Ok(())
}

const SCHEMA_SQL: &str = r#"
-- ============================================================
-- STRUCTURAL LAYER
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
    id              TEXT PRIMARY KEY,           -- UUID
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    device_type     TEXT NOT NULL DEFAULT '',
    architecture    TEXT NOT NULL DEFAULT '',
    interfaces      TEXT NOT NULL DEFAULT '[]', -- JSON array of interface objects
    assets          TEXT NOT NULL DEFAULT '[]', -- JSON array of asset objects
    deployment_context TEXT NOT NULL DEFAULT '{}', -- JSON object
    factor_weights  TEXT NOT NULL DEFAULT '{"time_effort":0.25,"exploitability":0.20,"window_of_opportunity":0.15,"detection_probability":0.15,"prior_knowledge":0.10,"preparation_effort":0.10,"abort_risk":0.05}',
    access_probabilities TEXT NOT NULL DEFAULT '{"1":0.9,"2":0.7,"3":0.5,"4":0.3,"5":0.1}',
    third_party_software TEXT NOT NULL DEFAULT '[]', -- JSON array of third-party software
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS goals (
    id                TEXT PRIMARY KEY,          -- UUID
    project_id        TEXT NOT NULL,
    name              TEXT NOT NULL,
    description       TEXT NOT NULL DEFAULT '',
    impact_category   TEXT NOT NULL DEFAULT '',
    impact_scores     TEXT NOT NULL DEFAULT '{}', -- JSON: OWASP impact factors {financial, reputation, compliance, safety, operational}
    catalog_source_id TEXT,                      -- nullable FK to catalog_entries
    sort_order        INTEGER NOT NULL DEFAULT 0,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
    id          TEXT PRIMARY KEY,                 -- UUID
    parent_id   TEXT NOT NULL,                    -- FK to goals, categories, or steps
    parent_type TEXT NOT NULL CHECK(parent_type IN ('goal', 'category', 'step')),
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS steps (
    id                TEXT PRIMARY KEY,           -- UUID
    parent_id         TEXT NOT NULL,              -- FK to goals, categories, steps or countermeasures
    parent_type       TEXT NOT NULL CHECK(parent_type IN ('goal', 'category', 'step', 'countermeasure')),
    conjunction       TEXT NOT NULL DEFAULT 'OR' CHECK(conjunction IN ('AND', 'OR')),
    name              TEXT NOT NULL,
    description       TEXT NOT NULL DEFAULT '',
    access_level      INTEGER NOT NULL DEFAULT 1 CHECK(access_level BETWEEN 1 AND 5),
    skill_level       INTEGER NOT NULL DEFAULT 1 CHECK(skill_level BETWEEN 1 AND 5),
    catalog_source_id TEXT,
    sort_order        INTEGER NOT NULL DEFAULT 0,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS substeps (
    id              TEXT PRIMARY KEY,             -- UUID
    parent_step_id  TEXT NOT NULL,
    conjunction     TEXT NOT NULL DEFAULT 'OR' CHECK(conjunction IN ('AND', 'OR')),
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    access_level    INTEGER NOT NULL DEFAULT 1 CHECK(access_level BETWEEN 1 AND 5),
    skill_level     INTEGER NOT NULL DEFAULT 1 CHECK(skill_level BETWEEN 1 AND 5),
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (parent_step_id) REFERENCES steps(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS countermeasures (
    id                  TEXT PRIMARY KEY,         -- UUID
    parent_id           TEXT NOT NULL,
    parent_type         TEXT NOT NULL CHECK(parent_type IN ('step', 'substep')),
    name                TEXT NOT NULL,
    description         TEXT NOT NULL DEFAULT '',
    effectiveness       INTEGER NOT NULL DEFAULT 3 CHECK(effectiveness BETWEEN 1 AND 5),
    implementation_cost INTEGER NOT NULL DEFAULT 3 CHECK(implementation_cost BETWEEN 1 AND 5),
    sort_order          INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS weaknesses (
    id          TEXT PRIMARY KEY,                 -- UUID
    parent_id   TEXT NOT NULL,
    parent_type TEXT NOT NULL CHECK(parent_type IN ('step', 'substep')),
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    severity    INTEGER NOT NULL DEFAULT 3 CHECK(severity BETWEEN 1 AND 5),
    cve_id      TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- ASSESSMENT LAYER
-- ============================================================

CREATE TABLE IF NOT EXISTS assessments (
    id                    TEXT PRIMARY KEY,       -- UUID
    entity_id             TEXT NOT NULL,
    entity_type           TEXT NOT NULL CHECK(entity_type IN ('step', 'substep', 'countermeasure', 'weakness')),
    is_reference          INTEGER NOT NULL DEFAULT 0,  -- boolean: 1 = catalog ref, 0 = project override
    time_effort           INTEGER CHECK(time_effort BETWEEN 1 AND 5),
    prior_knowledge       INTEGER CHECK(prior_knowledge BETWEEN 1 AND 5),
    exploitability        INTEGER CHECK(exploitability BETWEEN 1 AND 5),
    window_of_opportunity INTEGER CHECK(window_of_opportunity BETWEEN 1 AND 5),
    detection_probability INTEGER CHECK(detection_probability BETWEEN 1 AND 5),
    preparation_effort    INTEGER CHECK(preparation_effort BETWEEN 1 AND 5),
    abort_risk            INTEGER CHECK(abort_risk BETWEEN 1 AND 5),
    rationale_json        TEXT NOT NULL DEFAULT '{}', -- JSON: per-factor rationale comments
    override_rationale    TEXT,                       -- mandatory when overriding a reference
    created_at            TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(entity_id, is_reference)
);

-- ============================================================
-- CONTEXT LAYER
-- ============================================================

CREATE TABLE IF NOT EXISTS attacker_profiles (
    id          TEXT PRIMARY KEY,                 -- UUID
    project_id  TEXT NOT NULL,
    name        TEXT NOT NULL,
    skill_level INTEGER NOT NULL DEFAULT 1 CHECK(skill_level BETWEEN 1 AND 5),
    access_level INTEGER NOT NULL DEFAULT 1 CHECK(access_level BETWEEN 1 AND 5),
    description TEXT NOT NULL DEFAULT '',
    tag         TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attack_technique_mappings (
    id              TEXT PRIMARY KEY,             -- UUID
    entity_id       TEXT NOT NULL,
    entity_type     TEXT NOT NULL CHECK(entity_type IN ('step', 'substep', 'goal')),
    framework       TEXT NOT NULL DEFAULT 'ATT&CK ICS',
    technique_id    TEXT NOT NULL,
    technique_name  TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
    id          TEXT PRIMARY KEY,                 -- UUID
    entity_id   TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    key         TEXT NOT NULL,
    value       TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- CATALOG
-- ============================================================

CREATE TABLE IF NOT EXISTS catalog_entries (
    id               TEXT PRIMARY KEY,            -- UUID
    entry_type       TEXT NOT NULL DEFAULT 'attack_tree',
    name             TEXT NOT NULL,
    description      TEXT NOT NULL DEFAULT '',
    tree_data        TEXT NOT NULL DEFAULT '{}',  -- JSON: full tree structure
    source_framework TEXT NOT NULL DEFAULT '',
    version          TEXT NOT NULL DEFAULT '1.0',
    tags             TEXT NOT NULL DEFAULT '[]',  -- JSON array of {key, value}
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- TAG CATALOG (Assets / Interfaces / 3rd Party Software)
-- ============================================================

CREATE TABLE IF NOT EXISTS tag_catalog (
    id          TEXT PRIMARY KEY,                 -- UUID
    category    TEXT NOT NULL CHECK(category IN ('asset', 'interface', 'third_party_software')),
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- VERSIONING & CHANGE TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS snapshots (
    id          TEXT PRIMARY KEY,                 -- UUID
    project_id  TEXT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    author      TEXT NOT NULL DEFAULT '',
    snapshot_data TEXT NOT NULL,                  -- JSON: full project serialization
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS change_log (
    id          TEXT PRIMARY KEY,                 -- UUID
    project_id  TEXT NOT NULL,
    entity_id   TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    change_type TEXT NOT NULL CHECK(change_type IN ('add', 'modify', 'remove', 'override')),
    old_value   TEXT,                             -- JSON
    new_value   TEXT,                             -- JSON
    author      TEXT NOT NULL DEFAULT '',
    rationale   TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_goals_project ON goals(project_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id, parent_type);
CREATE INDEX IF NOT EXISTS idx_steps_parent ON steps(parent_id, parent_type);
CREATE INDEX IF NOT EXISTS idx_substeps_parent ON substeps(parent_step_id);
CREATE INDEX IF NOT EXISTS idx_countermeasures_parent ON countermeasures(parent_id, parent_type);
CREATE INDEX IF NOT EXISTS idx_weaknesses_parent ON weaknesses(parent_id, parent_type);
CREATE INDEX IF NOT EXISTS idx_assessments_entity ON assessments(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_attacker_profiles_project ON attacker_profiles(project_id);
CREATE INDEX IF NOT EXISTS idx_attack_technique_mappings_entity ON attack_technique_mappings(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_tags_entity ON tags(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_snapshots_project ON snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_change_log_project ON change_log(project_id);
CREATE INDEX IF NOT EXISTS idx_change_log_entity ON change_log(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_tag_catalog_category ON tag_catalog(category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tag_catalog_unique ON tag_catalog(category, name);
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_schema_initialization() {
        let conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        // Verify tables exist by querying sqlite_master.
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        // We expect 15 tables.
        assert_eq!(count, 15);
    }

    #[test]
    fn test_schema_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        initialize(&conn).unwrap(); // Should not fail on second call.
    }
}
