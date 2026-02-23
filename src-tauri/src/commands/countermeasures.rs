// Countermeasure CRUD commands.

use crate::db::models::{Countermeasure, CreateCountermeasure};
use crate::db::Database;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn create_countermeasure(
    db: State<'_, Database>,
    data: CreateCountermeasure,
) -> Result<Countermeasure, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let sort_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM countermeasures WHERE parent_id = ?1 AND parent_type = ?2",
            params![data.parent_id, data.parent_type],
            |row| row.get(0),
        )
        .unwrap_or(0);

    conn.execute(
        "INSERT INTO countermeasures (id, parent_id, parent_type, name, description, effectiveness, implementation_cost, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            id,
            data.parent_id,
            data.parent_type,
            data.name,
            data.description.unwrap_or_default(),
            data.effectiveness.unwrap_or(3),
            data.implementation_cost.unwrap_or(3),
            sort_order,
            now,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    get_cm_by_id(&conn, &id)
}

#[tauri::command]
pub fn list_countermeasures(
    db: State<'_, Database>,
    parent_id: String,
    parent_type: String,
) -> Result<Vec<Countermeasure>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    list_countermeasures_internal(&conn, &parent_id, &parent_type)
}

pub fn list_countermeasures_internal(
    conn: &rusqlite::Connection,
    parent_id: &str,
    parent_type: &str,
) -> Result<Vec<Countermeasure>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, parent_id, parent_type, name, description, effectiveness, implementation_cost, sort_order, created_at, updated_at
             FROM countermeasures WHERE parent_id = ?1 AND parent_type = ?2 ORDER BY sort_order",
        )
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(params![parent_id, parent_type], |row| {
            Ok(Countermeasure {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                parent_type: row.get(2)?,
                name: row.get(3)?,
                description: row.get(4)?,
                effectiveness: row.get(5)?,
                implementation_cost: row.get(6)?,
                sort_order: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

#[tauri::command]
pub fn update_countermeasure(
    db: State<'_, Database>,
    id: String,
    name: Option<String>,
    description: Option<String>,
    effectiveness: Option<i32>,
    implementation_cost: Option<i32>,
) -> Result<Countermeasure, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let mut sets = vec!["updated_at = ?1".to_string()];
    let mut idx = 2u32;
    let mut pv: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(now)];

    macro_rules! opt { ($f:expr,$v:expr) => { if let Some(v) = $v { sets.push(format!("{} = ?{}", $f, idx)); pv.push(Box::new(v)); idx+=1; } } }
    opt!("name", name);
    opt!("description", description);
    opt!("effectiveness", effectiveness);
    opt!("implementation_cost", implementation_cost);

    let sql = format!("UPDATE countermeasures SET {} WHERE id = ?{}", sets.join(", "), idx);
    pv.push(Box::new(id.clone()));
    let refs: Vec<&dyn rusqlite::types::ToSql> = pv.iter().map(|b| b.as_ref()).collect();
    conn.execute(&sql, refs.as_slice()).map_err(|e| e.to_string())?;

    get_cm_by_id(&conn, &id)
}

#[tauri::command]
pub fn delete_countermeasure(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM countermeasures WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_countermeasure(db: State<'_, Database>, id: String) -> Result<Countermeasure, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    get_cm_by_id(&conn, &id)
}

fn get_cm_by_id(conn: &rusqlite::Connection, id: &str) -> Result<Countermeasure, String> {
    conn.query_row(
        "SELECT id, parent_id, parent_type, name, description, effectiveness, implementation_cost, sort_order, created_at, updated_at
         FROM countermeasures WHERE id = ?1",
        params![id],
        |row| {
            Ok(Countermeasure {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                parent_type: row.get(2)?,
                name: row.get(3)?,
                description: row.get(4)?,
                effectiveness: row.get(5)?,
                implementation_cost: row.get(6)?,
                sort_order: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        },
    )
    .map_err(|e| format!("Countermeasure not found: {}", e))
}
