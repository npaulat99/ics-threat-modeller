// Versioning & snapshotting commands.

use crate::db::models::{CreateSnapshot, DiffChange, DiffResult, FieldChange, Snapshot};
use crate::db::Database;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

/// Save a named snapshot of the entire project.
#[tauri::command]
pub fn create_snapshot(db: State<'_, Database>, data: CreateSnapshot) -> Result<Snapshot, String> {
    // Build the full project export as JSON for the snapshot.
    let json = super::export_import::export_project_json(
        State::from(&*db),
        data.project_id.clone(),
    )?;

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT INTO snapshots (id, project_id, name, description, author, snapshot_data, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            id,
            data.project_id,
            data.name,
            data.description.unwrap_or_default(),
            data.author.unwrap_or_default(),
            json,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    get_snapshot_by_id(&conn, &id)
}

/// List all snapshots for a project.
#[tauri::command]
pub fn list_snapshots(
    db: State<'_, Database>,
    project_id: String,
) -> Result<Vec<Snapshot>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, name, description, author, snapshot_data, created_at FROM snapshots WHERE project_id = ?1 ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(params![project_id], |row| row_to_snapshot(row))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

/// Get a single snapshot.
#[tauri::command]
pub fn get_snapshot(db: State<'_, Database>, id: String) -> Result<Snapshot, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    get_snapshot_by_id(&conn, &id)
}

/// Restore a snapshot: replace all project data with the snapshot's data.
#[tauri::command]
pub fn restore_snapshot(db: State<'_, Database>, snapshot_id: String) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let snapshot = get_snapshot_by_id(&conn, &snapshot_id)?;

    // We need to drop the conn lock and call import_project_json.
    let project_id = snapshot.project_id.clone();
    drop(conn);

    // Delete existing data for this project first.
    {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        // Delete all children (goals cascade via the goals delete).
        let goal_ids: Vec<String> = {
            let mut stmt = conn
                .prepare("SELECT id FROM goals WHERE project_id = ?1")
                .map_err(|e| e.to_string())?;
            stmt.query_map(params![project_id], |row| row.get(0))
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect()
        };

        for gid in &goal_ids {
            // Delete steps, categories, etc. under each goal.
            conn.execute("DELETE FROM steps WHERE parent_id = ?1", params![gid])
                .ok();
            conn.execute("DELETE FROM categories WHERE parent_id = ?1", params![gid])
                .ok();
        }

        conn.execute("DELETE FROM goals WHERE project_id = ?1", params![project_id])
            .ok();
        conn.execute("DELETE FROM attacker_profiles WHERE project_id = ?1", params![project_id])
            .ok();
        conn.execute("DELETE FROM change_log WHERE project_id = ?1", params![project_id])
            .ok();
    }

    // Re-import the snapshot data.
    super::export_import::import_project_json(
        State::from(&*db),
        snapshot.snapshot_data,
    )
}

/// Delete a snapshot.
#[tauri::command]
pub fn delete_snapshot(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM snapshots WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Compare two snapshots and return a semantic diff.
#[tauri::command]
pub fn compare_snapshots(
    db: State<'_, Database>,
    snapshot_a_id: String,
    snapshot_b_id: String,
) -> Result<DiffResult, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let snap_a = get_snapshot_by_id(&conn, &snapshot_a_id)?;
    let snap_b = get_snapshot_by_id(&conn, &snapshot_b_id)?;

    let data_a: serde_json::Value =
        serde_json::from_str(&snap_a.snapshot_data).map_err(|e| e.to_string())?;
    let data_b: serde_json::Value =
        serde_json::from_str(&snap_b.snapshot_data).map_err(|e| e.to_string())?;

    let changes = compute_diff(&data_a, &data_b);

    Ok(DiffResult { changes })
}

/// Record a change in the change log.
#[tauri::command]
pub fn log_change(
    db: State<'_, Database>,
    project_id: String,
    entity_id: String,
    entity_type: String,
    change_type: String,
    old_value: Option<String>,
    new_value: Option<String>,
    author: Option<String>,
    rationale: Option<String>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT INTO change_log (id, project_id, entity_id, entity_type, change_type, old_value, new_value, author, rationale, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![id, project_id, entity_id, entity_type, change_type, old_value, new_value, author.unwrap_or_default(), rationale, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Get the change log for a project.
#[tauri::command]
pub fn get_change_log(
    db: State<'_, Database>,
    project_id: String,
) -> Result<Vec<crate::db::models::ChangeLogEntry>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, entity_id, entity_type, change_type, old_value, new_value, author, rationale, created_at FROM change_log WHERE project_id = ?1 ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(params![project_id], |row| {
            Ok(crate::db::models::ChangeLogEntry {
                id: row.get(0)?,
                project_id: row.get(1)?,
                entity_id: row.get(2)?,
                entity_type: row.get(3)?,
                change_type: row.get(4)?,
                old_value: row.get(5)?,
                new_value: row.get(6)?,
                author: row.get(7)?,
                rationale: row.get(8)?,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

/// Compute a semantic diff between two JSON snapshots.
fn compute_diff(a: &serde_json::Value, b: &serde_json::Value) -> Vec<DiffChange> {
    let mut changes = Vec::new();

    // Extract entity maps from both snapshots.
    let entities_a = extract_entities(a);
    let entities_b = extract_entities(b);

    // Find additions (in B but not in A).
    for (id, (entity_type, name, val_b)) in &entities_b {
        if !entities_a.contains_key(id) {
            changes.push(DiffChange {
                entity_id: id.clone(),
                entity_type: entity_type.clone(),
                entity_name: name.clone(),
                change_type: "added".to_string(),
                field_changes: vec![],
            });
        }
    }

    // Find removals (in A but not in B).
    for (id, (entity_type, name, _val_a)) in &entities_a {
        if !entities_b.contains_key(id) {
            changes.push(DiffChange {
                entity_id: id.clone(),
                entity_type: entity_type.clone(),
                entity_name: name.clone(),
                change_type: "removed".to_string(),
                field_changes: vec![],
            });
        }
    }

    // Find modifications (in both but different).
    for (id, (entity_type, name, val_a)) in &entities_a {
        if let Some((_et_b, _name_b, val_b)) = entities_b.get(id) {
            if val_a != val_b {
                let field_changes = diff_objects(val_a, val_b);
                if !field_changes.is_empty() {
                    changes.push(DiffChange {
                        entity_id: id.clone(),
                        entity_type: entity_type.clone(),
                        entity_name: name.clone(),
                        change_type: "modified".to_string(),
                        field_changes,
                    });
                }
            }
        }
    }

    changes
}

/// Extract all entities from a project export JSON, keyed by ID.
fn extract_entities(
    val: &serde_json::Value,
) -> std::collections::HashMap<String, (String, String, serde_json::Value)> {
    let mut map = std::collections::HashMap::new();

    // Project itself.
    if let Some(project) = val.get("project") {
        if let Some(id) = project.get("id").and_then(|v| v.as_str()) {
            let name = project.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
            map.insert(id.to_string(), ("project".to_string(), name, project.clone()));
        }
    }

    // Attacker profiles.
    if let Some(profiles) = val.get("attacker_profiles").and_then(|v| v.as_array()) {
        for p in profiles {
            if let Some(id) = p.get("id").and_then(|v| v.as_str()) {
                let name = p.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                map.insert(id.to_string(), ("attacker_profile".to_string(), name, p.clone()));
            }
        }
    }

    // Goals and their children.
    if let Some(goals) = val.get("goals").and_then(|v| v.as_array()) {
        for ge in goals {
            if let Some(goal) = ge.get("goal") {
                if let Some(id) = goal.get("id").and_then(|v| v.as_str()) {
                    let name = goal.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    map.insert(id.to_string(), ("goal".to_string(), name, goal.clone()));
                }
            }
            // Recurse into steps.
            if let Some(steps) = ge.get("steps").and_then(|v| v.as_array()) {
                for se in steps {
                    extract_step_entities(se, &mut map);
                }
            }
        }
    }

    map
}

fn extract_step_entities(
    se: &serde_json::Value,
    map: &mut std::collections::HashMap<String, (String, String, serde_json::Value)>,
) {
    if let Some(step) = se.get("step") {
        if let Some(id) = step.get("id").and_then(|v| v.as_str()) {
            let name = step.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
            map.insert(id.to_string(), ("step".to_string(), name, step.clone()));
        }
    }

    // Substeps.
    if let Some(substeps) = se.get("substeps").and_then(|v| v.as_array()) {
        for ss in substeps {
            if let Some(substep) = ss.get("substep") {
                if let Some(id) = substep.get("id").and_then(|v| v.as_str()) {
                    let name = substep.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    map.insert(id.to_string(), ("substep".to_string(), name, substep.clone()));
                }
            }
        }
    }

    // Assessments.
    if let Some(assessments) = se.get("assessments").and_then(|v| v.as_array()) {
        for a in assessments {
            if let Some(id) = a.get("id").and_then(|v| v.as_str()) {
                map.insert(id.to_string(), ("assessment".to_string(), "Assessment".to_string(), a.clone()));
            }
        }
    }
}

/// Diff two JSON objects field by field.
fn diff_objects(a: &serde_json::Value, b: &serde_json::Value) -> Vec<FieldChange> {
    let mut changes = Vec::new();

    if let (Some(obj_a), Some(obj_b)) = (a.as_object(), b.as_object()) {
        // Fields changed or removed.
        for (key, val_a) in obj_a {
            if key == "created_at" || key == "updated_at" {
                continue; // Skip timestamps.
            }
            match obj_b.get(key) {
                Some(val_b) if val_a != val_b => {
                    changes.push(FieldChange {
                        field: key.clone(),
                        old_value: Some(val_a.to_string()),
                        new_value: Some(val_b.to_string()),
                    });
                }
                None => {
                    changes.push(FieldChange {
                        field: key.clone(),
                        old_value: Some(val_a.to_string()),
                        new_value: None,
                    });
                }
                _ => {}
            }
        }
        // Fields added.
        for (key, val_b) in obj_b {
            if !obj_a.contains_key(key) && key != "created_at" && key != "updated_at" {
                changes.push(FieldChange {
                    field: key.clone(),
                    old_value: None,
                    new_value: Some(val_b.to_string()),
                });
            }
        }
    }

    changes
}

fn get_snapshot_by_id(conn: &rusqlite::Connection, id: &str) -> Result<Snapshot, String> {
    conn.query_row(
        "SELECT id, project_id, name, description, author, snapshot_data, created_at FROM snapshots WHERE id = ?1",
        params![id],
        |row| row_to_snapshot(row),
    )
    .map_err(|e| format!("Snapshot not found: {}", e))
}

fn row_to_snapshot(row: &rusqlite::Row) -> rusqlite::Result<Snapshot> {
    Ok(Snapshot {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        description: row.get(3)?,
        author: row.get(4)?,
        snapshot_data: row.get(5)?,
        created_at: row.get(6)?,
    })
}
