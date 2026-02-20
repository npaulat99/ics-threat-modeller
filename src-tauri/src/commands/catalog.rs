// Catalog management commands.

use crate::db::models::{CatalogEntry, CreateCatalogEntry};
use crate::db::Database;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn create_catalog_entry(
    db: State<'_, Database>,
    data: CreateCatalogEntry,
) -> Result<CatalogEntry, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT INTO catalog_entries (id, entry_type, name, description, tree_data, source_framework, version, tags, created_at, updated_at)
         VALUES (?1, 'attack_tree', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            id,
            data.name,
            data.description.unwrap_or_default(),
            data.tree_data,
            data.source_framework.unwrap_or_default(),
            data.version.unwrap_or_else(|| "1.0".to_string()),
            data.tags.unwrap_or_else(|| "[]".to_string()),
            now,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    get_entry_by_id(&conn, &id)
}

#[tauri::command]
pub fn list_catalog_entries(db: State<'_, Database>) -> Result<Vec<CatalogEntry>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, entry_type, name, description, tree_data, source_framework, version, tags, created_at, updated_at FROM catalog_entries ORDER BY name")
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map([], |row| row_to_entry(row))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

#[tauri::command]
pub fn get_catalog_entry(db: State<'_, Database>, id: String) -> Result<CatalogEntry, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    get_entry_by_id(&conn, &id)
}

#[tauri::command]
pub fn search_catalog(db: State<'_, Database>, query: String) -> Result<Vec<CatalogEntry>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let search = format!("%{}%", query);

    let mut stmt = conn
        .prepare(
            "SELECT id, entry_type, name, description, tree_data, source_framework, version, tags, created_at, updated_at
             FROM catalog_entries
             WHERE name LIKE ?1 OR description LIKE ?1 OR tree_data LIKE ?1 OR tags LIKE ?1
             ORDER BY name",
        )
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(params![search], |row| row_to_entry(row))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

#[tauri::command]
pub fn delete_catalog_entry(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM catalog_entries WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Import a catalog entry's tree into a project.
/// Creates goals, steps, substeps, countermeasures, weaknesses, and assessments
/// from the catalog entry's tree_data JSON.
#[tauri::command]
pub fn import_catalog_entry(
    db: State<'_, Database>,
    catalog_id: String,
    project_id: String,
) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let entry = get_entry_by_id(&conn, &catalog_id)?;
    let tree: serde_json::Value =
        serde_json::from_str(&entry.tree_data).map_err(|e| e.to_string())?;

    let goal_id = import_tree_node(&conn, &project_id, &catalog_id, &tree)?;

    Ok(goal_id)
}

/// Recursively import a tree node (from catalog JSON) into the project database.
fn import_tree_node(
    conn: &rusqlite::Connection,
    project_id: &str,
    catalog_id: &str,
    tree: &serde_json::Value,
) -> Result<String, String> {
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Import the goal.
    let goal_id = Uuid::new_v4().to_string();
    let goal_name = tree["name"].as_str().unwrap_or("Imported Goal");
    let goal_desc = tree["description"].as_str().unwrap_or("");
    let impact_cat = tree["impact_category"].as_str().unwrap_or("");

    conn.execute(
        "INSERT INTO goals (id, project_id, name, description, impact_category, catalog_source_id, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?8)",
        params![goal_id, project_id, goal_name, goal_desc, impact_cat, catalog_id, now, now],
    )
    .map_err(|e| e.to_string())?;

    // Import steps.
    if let Some(steps) = tree["steps"].as_array() {
        for (i, step_val) in steps.iter().enumerate() {
            import_step(conn, project_id, &goal_id, "goal", step_val, i as i32, &now)?;
        }
    }

    Ok(goal_id)
}

fn import_step(
    conn: &rusqlite::Connection,
    project_id: &str,
    parent_id: &str,
    parent_type: &str,
    step_val: &serde_json::Value,
    sort_order: i32,
    now: &str,
) -> Result<String, String> {
    let step_id = Uuid::new_v4().to_string();
    let name = step_val["name"].as_str().unwrap_or("Step");
    let desc = step_val["description"].as_str().unwrap_or("");
    let conj = step_val["conjunction"].as_str().unwrap_or("OR");
    let access = step_val["access_level"].as_i64().unwrap_or(1) as i32;
    let skill = step_val["skill_level"].as_i64().unwrap_or(1) as i32;

    conn.execute(
        "INSERT INTO steps (id, parent_id, parent_type, conjunction, name, description, access_level, skill_level, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![step_id, parent_id, parent_type, conj, name, desc, access, skill, sort_order, now, now],
    )
    .map_err(|e| e.to_string())?;

    // Import assessment if present.
    if let Some(assess) = step_val.get("assessment") {
        let assess_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO assessments (id, entity_id, entity_type, is_reference, time_effort, prior_knowledge, exploitability, window_of_opportunity, detection_probability, preparation_effort, abort_risk, rationale_json, created_at, updated_at) VALUES (?1, ?2, 'step', 1, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                assess_id,
                step_id,
                assess["time_effort"].as_i64().map(|v| v as i32),
                assess["prior_knowledge"].as_i64().map(|v| v as i32),
                assess["exploitability"].as_i64().map(|v| v as i32),
                assess["window_of_opportunity"].as_i64().map(|v| v as i32),
                assess["detection_probability"].as_i64().map(|v| v as i32),
                assess["preparation_effort"].as_i64().map(|v| v as i32),
                assess["abort_risk"].as_i64().map(|v| v as i32),
                assess.get("rationale").and_then(|v| v.as_str()).unwrap_or("{}"),
                now,
                now,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    // Import countermeasures.
    if let Some(cms) = step_val["countermeasures"].as_array() {
        for (j, cm_val) in cms.iter().enumerate() {
            let cm_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO countermeasures (id, parent_id, parent_type, name, description, effectiveness, implementation_cost, sort_order, created_at, updated_at) VALUES (?1, ?2, 'step', ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    cm_id,
                    step_id,
                    cm_val["name"].as_str().unwrap_or("Countermeasure"),
                    cm_val["description"].as_str().unwrap_or(""),
                    cm_val["effectiveness"].as_i64().unwrap_or(3) as i32,
                    cm_val["implementation_cost"].as_i64().unwrap_or(3) as i32,
                    j as i32,
                    now,
                    now,
                ],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    // Import technique mappings.
    if let Some(mappings) = step_val["technique_mappings"].as_array() {
        for m in mappings {
            let m_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO attack_technique_mappings (id, entity_id, entity_type, framework, technique_id, technique_name, created_at) VALUES (?1, ?2, 'step', ?3, ?4, ?5, ?6)",
                params![
                    m_id,
                    step_id,
                    m["framework"].as_str().unwrap_or("ATT&CK ICS"),
                    m["technique_id"].as_str().unwrap_or(""),
                    m["technique_name"].as_str().unwrap_or(""),
                    now,
                ],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    // Recurse into substeps.
    if let Some(substeps) = step_val["substeps"].as_array() {
        for (k, ss_val) in substeps.iter().enumerate() {
            let ss_id = Uuid::new_v4().to_string();
            let ss_name = ss_val["name"].as_str().unwrap_or("Substep");
            let ss_desc = ss_val["description"].as_str().unwrap_or("");
            let ss_conj = ss_val["conjunction"].as_str().unwrap_or("OR");
            let ss_access = ss_val["access_level"].as_i64().unwrap_or(1) as i32;
            let ss_skill = ss_val["skill_level"].as_i64().unwrap_or(1) as i32;

            conn.execute(
                "INSERT INTO substeps (id, parent_step_id, conjunction, name, description, access_level, skill_level, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![ss_id, step_id, ss_conj, ss_name, ss_desc, ss_access, ss_skill, k as i32, now, now],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    // Recurse into child steps.
    if let Some(child_steps) = step_val["steps"].as_array() {
        for (i, child_val) in child_steps.iter().enumerate() {
            import_step(conn, project_id, &step_id, "step", child_val, i as i32, now)?;
        }
    }

    Ok(step_id)
}

/// Seed the catalog with starter entries.
pub fn seed_catalog(conn: &rusqlite::Connection) -> Result<(), String> {
    // Check if catalog already has entries.
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM catalog_entries", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    if count > 0 {
        return Ok(());
    }

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let entries = crate::catalog::starter_data::get_starter_entries();

    for entry in entries {
        conn.execute(
            "INSERT INTO catalog_entries (id, entry_type, name, description, tree_data, source_framework, version, tags, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                entry.id,
                entry.entry_type,
                entry.name,
                entry.description,
                entry.tree_data,
                entry.source_framework,
                entry.version,
                entry.tags,
                now,
                now,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn get_entry_by_id(conn: &rusqlite::Connection, id: &str) -> Result<CatalogEntry, String> {
    conn.query_row(
        "SELECT id, entry_type, name, description, tree_data, source_framework, version, tags, created_at, updated_at FROM catalog_entries WHERE id = ?1",
        params![id],
        |row| row_to_entry(row),
    )
    .map_err(|e| format!("Catalog entry not found: {}", e))
}

fn row_to_entry(row: &rusqlite::Row) -> rusqlite::Result<CatalogEntry> {
    Ok(CatalogEntry {
        id: row.get(0)?,
        entry_type: row.get(1)?,
        name: row.get(2)?,
        description: row.get(3)?,
        tree_data: row.get(4)?,
        source_framework: row.get(5)?,
        version: row.get(6)?,
        tags: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}
