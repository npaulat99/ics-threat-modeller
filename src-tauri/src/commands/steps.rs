// Step CRUD commands.

use crate::db::models::{CreateStep, Step, UpdateStep};
use crate::db::Database;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn create_step(db: State<'_, Database>, data: CreateStep) -> Result<Step, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let sort_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM steps WHERE parent_id = ?1 AND parent_type = ?2",
            params![data.parent_id, data.parent_type],
            |row| row.get(0),
        )
        .unwrap_or(0);

    conn.execute(
        "INSERT INTO steps (id, parent_id, parent_type, conjunction, step_type, name, description, access_level, skill_level, catalog_source_id, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            id,
            data.parent_id,
            data.parent_type,
            data.conjunction.unwrap_or_else(|| "OR".to_string()),
            data.step_type.unwrap_or_else(|| "step".to_string()),
            data.name,
            data.description.unwrap_or_default(),
            data.access_level.unwrap_or(1),
            data.skill_level.unwrap_or(1),
            data.catalog_source_id,
            sort_order,
            now,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    get_step_by_id(&conn, &id)
}

#[tauri::command]
pub fn list_steps(
    db: State<'_, Database>,
    parent_id: String,
    parent_type: String,
) -> Result<Vec<Step>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    list_steps_internal(&conn, &parent_id, &parent_type)
}

pub fn list_steps_internal(
    conn: &rusqlite::Connection,
    parent_id: &str,
    parent_type: &str,
) -> Result<Vec<Step>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, parent_id, parent_type, conjunction, name, description, access_level, skill_level, catalog_source_id, sort_order, created_at, updated_at, step_type
             FROM steps WHERE parent_id = ?1 AND parent_type = ?2 ORDER BY sort_order",
        )
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(params![parent_id, parent_type], |row| row_to_step(row))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

#[tauri::command]
pub fn get_step(db: State<'_, Database>, id: String) -> Result<Step, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    get_step_by_id(&conn, &id)
}

#[tauri::command]
pub fn update_step(db: State<'_, Database>, data: UpdateStep) -> Result<Step, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let mut sets = vec!["updated_at = ?1".to_string()];
    let mut idx = 2u32;
    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(now)];

    macro_rules! opt {
        ($f:expr, $v:expr) => {
            if let Some(v) = $v {
                sets.push(format!("{} = ?{}", $f, idx));
                params_vec.push(Box::new(v));
                idx += 1;
            }
        };
    }

    opt!("conjunction", data.conjunction);
    opt!("step_type", data.step_type);
    opt!("name", data.name);
    opt!("description", data.description);
    opt!("access_level", data.access_level);
    opt!("skill_level", data.skill_level);
    opt!("parent_id", data.parent_id);
    opt!("parent_type", data.parent_type);
    opt!("sort_order", data.sort_order);

    let sql = format!("UPDATE steps SET {} WHERE id = ?{}", sets.join(", "), idx);
    params_vec.push(Box::new(data.id.clone()));

    let refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
    conn.execute(&sql, refs.as_slice())
        .map_err(|e| e.to_string())?;

    get_step_by_id(&conn, &data.id)
}

#[tauri::command]
pub fn delete_step(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    delete_step_cascade(&conn, &id)
}

/// Delete a step but re-parent its child steps to the deleted step's parent,
/// preserving the chain. E.g. A→B→C becomes A→C when B is deleted.
#[tauri::command]
pub fn delete_step_reparent(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let step = get_step_by_id(&conn, &id)?;

    // Re-parent child steps to the deleted step's parent
    conn.execute(
        "UPDATE steps SET parent_id = ?1, parent_type = ?2 WHERE parent_id = ?3 AND parent_type = 'step'",
        params![step.parent_id, step.parent_type, id],
    )
    .map_err(|e| e.to_string())?;

    // Now delete only this step (and its own attachments, but NOT its reparented children)
    // Delete substeps
    conn.execute(
        "DELETE FROM substeps WHERE parent_step_id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    // Delete countermeasures attached to this step
    conn.execute(
        "DELETE FROM countermeasures WHERE parent_id = ?1 AND parent_type = 'step'",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    // Delete weaknesses attached to this step
    conn.execute(
        "DELETE FROM weaknesses WHERE parent_id = ?1 AND parent_type = 'step'",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    // Delete assessments
    conn.execute("DELETE FROM assessments WHERE entity_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    // Delete technique mappings and tags
    conn.execute(
        "DELETE FROM attack_technique_mappings WHERE entity_id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tags WHERE entity_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    // Delete categories under this step
    let cat_ids: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT id FROM categories WHERE parent_id = ?1 AND parent_type = 'step'")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![id], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        rows.filter_map(|r| r.ok()).collect()
    };
    for cid in &cat_ids {
        super::categories::delete_category_cascade(&conn, cid)?;
    }
    // Delete the step itself
    conn.execute("DELETE FROM steps WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Recursively delete a step and all its children.
pub fn delete_step_cascade(conn: &rusqlite::Connection, step_id: &str) -> Result<(), String> {
    // Delete substeps.
    conn.execute(
        "DELETE FROM substeps WHERE parent_step_id = ?1",
        params![step_id],
    )
    .map_err(|e| e.to_string())?;

    // Delete countermeasures attached to this step.
    conn.execute(
        "DELETE FROM countermeasures WHERE parent_id = ?1 AND parent_type = 'step'",
        params![step_id],
    )
    .map_err(|e| e.to_string())?;

    // Delete weaknesses attached to this step.
    conn.execute(
        "DELETE FROM weaknesses WHERE parent_id = ?1 AND parent_type = 'step'",
        params![step_id],
    )
    .map_err(|e| e.to_string())?;

    // Delete assessments.
    conn.execute(
        "DELETE FROM assessments WHERE entity_id = ?1",
        params![step_id],
    )
    .map_err(|e| e.to_string())?;

    // Delete technique mappings and tags.
    conn.execute(
        "DELETE FROM attack_technique_mappings WHERE entity_id = ?1",
        params![step_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tags WHERE entity_id = ?1", params![step_id])
        .map_err(|e| e.to_string())?;

    // Delete child steps (steps with parent_type='step').
    let child_ids: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT id FROM steps WHERE parent_id = ?1 AND parent_type = 'step'")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![step_id], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        rows.filter_map(|r| r.ok()).collect()
    };
    for cid in &child_ids {
        delete_step_cascade(conn, cid)?;
    }

    // Delete categories under this step.
    let cat_ids: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT id FROM categories WHERE parent_id = ?1 AND parent_type = 'step'")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![step_id], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        rows.filter_map(|r| r.ok()).collect()
    };
    for cid in &cat_ids {
        super::categories::delete_category_cascade(conn, cid)?;
    }

    // Delete the step itself.
    conn.execute("DELETE FROM steps WHERE id = ?1", params![step_id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn get_step_by_id(conn: &rusqlite::Connection, id: &str) -> Result<Step, String> {
    conn.query_row(
        "SELECT id, parent_id, parent_type, conjunction, name, description, access_level, skill_level, catalog_source_id, sort_order, created_at, updated_at, step_type
         FROM steps WHERE id = ?1",
        params![id],
        |row| row_to_step(row),
    )
    .map_err(|e| format!("Step not found: {}", e))
}

fn row_to_step(row: &rusqlite::Row) -> rusqlite::Result<Step> {
    Ok(Step {
        id: row.get(0)?,
        parent_id: row.get(1)?,
        parent_type: row.get(2)?,
        conjunction: row.get(3)?,
        name: row.get(4)?,
        description: row.get(5)?,
        access_level: row.get(6)?,
        skill_level: row.get(7)?,
        catalog_source_id: row.get(8)?,
        sort_order: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
        step_type: row
            .get::<_, String>(12)
            .unwrap_or_else(|_| "step".to_string()),
    })
}
