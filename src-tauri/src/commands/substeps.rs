// Substep CRUD commands.

use crate::db::models::{CreateSubstep, Substep};
use crate::db::Database;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn create_substep(db: State<'_, Database>, data: CreateSubstep) -> Result<Substep, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let sort_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM substeps WHERE parent_step_id = ?1",
            params![data.parent_step_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    conn.execute(
        "INSERT INTO substeps (id, parent_step_id, conjunction, name, description, access_level, skill_level, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            id,
            data.parent_step_id,
            data.conjunction.unwrap_or_else(|| "OR".to_string()),
            data.name,
            data.description.unwrap_or_default(),
            data.access_level.unwrap_or(1),
            data.skill_level.unwrap_or(1),
            sort_order,
            now,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    get_substep_by_id(&conn, &id)
}

#[tauri::command]
pub fn list_substeps(
    db: State<'_, Database>,
    parent_step_id: String,
) -> Result<Vec<Substep>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    list_substeps_internal(&conn, &parent_step_id)
}

pub fn list_substeps_internal(
    conn: &rusqlite::Connection,
    parent_step_id: &str,
) -> Result<Vec<Substep>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, parent_step_id, conjunction, name, description, access_level, skill_level, sort_order, created_at, updated_at
             FROM substeps WHERE parent_step_id = ?1 ORDER BY sort_order",
        )
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(params![parent_step_id], |row| row_to_substep(row))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

#[tauri::command]
pub fn update_substep(
    db: State<'_, Database>,
    id: String,
    conjunction: Option<String>,
    name: Option<String>,
    description: Option<String>,
    access_level: Option<i32>,
    skill_level: Option<i32>,
    sort_order: Option<i32>,
) -> Result<Substep, String> {
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

    opt!("conjunction", conjunction);
    opt!("name", name);
    opt!("description", description);
    opt!("access_level", access_level);
    opt!("skill_level", skill_level);
    opt!("sort_order", sort_order);

    let sql = format!("UPDATE substeps SET {} WHERE id = ?{}", sets.join(", "), idx);
    params_vec.push(Box::new(id.clone()));

    let refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
    conn.execute(&sql, refs.as_slice())
        .map_err(|e| e.to_string())?;

    get_substep_by_id(&conn, &id)
}

#[tauri::command]
pub fn delete_substep(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    // Delete countermeasures, weaknesses, assessments, mappings, tags.
    conn.execute(
        "DELETE FROM countermeasures WHERE parent_id = ?1 AND parent_type = 'substep'",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM weaknesses WHERE parent_id = ?1 AND parent_type = 'substep'",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM assessments WHERE entity_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM attack_technique_mappings WHERE entity_id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tags WHERE entity_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM substeps WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn get_substep_by_id(conn: &rusqlite::Connection, id: &str) -> Result<Substep, String> {
    conn.query_row(
        "SELECT id, parent_step_id, conjunction, name, description, access_level, skill_level, sort_order, created_at, updated_at
         FROM substeps WHERE id = ?1",
        params![id],
        |row| row_to_substep(row),
    )
    .map_err(|e| format!("Substep not found: {}", e))
}

fn row_to_substep(row: &rusqlite::Row) -> rusqlite::Result<Substep> {
    Ok(Substep {
        id: row.get(0)?,
        parent_step_id: row.get(1)?,
        conjunction: row.get(2)?,
        name: row.get(3)?,
        description: row.get(4)?,
        access_level: row.get(5)?,
        skill_level: row.get(6)?,
        sort_order: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}
