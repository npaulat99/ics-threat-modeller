// Weakness CRUD commands.

use crate::db::models::{CreateWeakness, Weakness};
use crate::db::Database;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn create_weakness(db: State<'_, Database>, data: CreateWeakness) -> Result<Weakness, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let sort_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM weaknesses WHERE parent_id = ?1 AND parent_type = ?2",
            params![data.parent_id, data.parent_type],
            |row| row.get(0),
        )
        .unwrap_or(0);

    conn.execute(
        "INSERT INTO weaknesses (id, parent_id, parent_type, name, description, severity, cve_id, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            id,
            data.parent_id,
            data.parent_type,
            data.name,
            data.description.unwrap_or_default(),
            data.severity.unwrap_or(3),
            data.cve_id,
            sort_order,
            now,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    get_weakness_by_id(&conn, &id)
}

#[tauri::command]
pub fn list_weaknesses(
    db: State<'_, Database>,
    parent_id: String,
    parent_type: String,
) -> Result<Vec<Weakness>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    list_weaknesses_internal(&conn, &parent_id, &parent_type)
}

pub fn list_weaknesses_internal(
    conn: &rusqlite::Connection,
    parent_id: &str,
    parent_type: &str,
) -> Result<Vec<Weakness>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, parent_id, parent_type, name, description, severity, cve_id, sort_order, created_at, updated_at
             FROM weaknesses WHERE parent_id = ?1 AND parent_type = ?2 ORDER BY sort_order",
        )
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(params![parent_id, parent_type], |row| {
            Ok(Weakness {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                parent_type: row.get(2)?,
                name: row.get(3)?,
                description: row.get(4)?,
                severity: row.get(5)?,
                cve_id: row.get(6)?,
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
pub fn update_weakness(
    db: State<'_, Database>,
    id: String,
    name: Option<String>,
    description: Option<String>,
    severity: Option<i32>,
    cve_id: Option<String>,
) -> Result<Weakness, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let mut sets = vec!["updated_at = ?1".to_string()];
    let mut idx = 2u32;
    let mut pv: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(now)];

    macro_rules! opt { ($f:expr,$v:expr) => { if let Some(v) = $v { sets.push(format!("{} = ?{}", $f, idx)); pv.push(Box::new(v)); idx+=1; } } }
    opt!("name", name);
    opt!("description", description);
    opt!("severity", severity);
    opt!("cve_id", cve_id);

    let sql = format!("UPDATE weaknesses SET {} WHERE id = ?{}", sets.join(", "), idx);
    pv.push(Box::new(id.clone()));
    let refs: Vec<&dyn rusqlite::types::ToSql> = pv.iter().map(|b| b.as_ref()).collect();
    conn.execute(&sql, refs.as_slice()).map_err(|e| e.to_string())?;

    get_weakness_by_id(&conn, &id)
}

#[tauri::command]
pub fn delete_weakness(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM weaknesses WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_weakness(db: State<'_, Database>, id: String) -> Result<Weakness, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    get_weakness_by_id(&conn, &id)
}

fn get_weakness_by_id(conn: &rusqlite::Connection, id: &str) -> Result<Weakness, String> {
    conn.query_row(
        "SELECT id, parent_id, parent_type, name, description, severity, cve_id, sort_order, created_at, updated_at
         FROM weaknesses WHERE id = ?1",
        params![id],
        |row| {
            Ok(Weakness {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                parent_type: row.get(2)?,
                name: row.get(3)?,
                description: row.get(4)?,
                severity: row.get(5)?,
                cve_id: row.get(6)?,
                sort_order: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        },
    )
    .map_err(|e| format!("Weakness not found: {}", e))
}
