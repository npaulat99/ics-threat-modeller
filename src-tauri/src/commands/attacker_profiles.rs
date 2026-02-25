// Attacker Profile CRUD commands.

use crate::db::models::{AttackerProfile, CreateAttackerProfile};
use crate::db::Database;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn create_attacker_profile(
    db: State<'_, Database>,
    data: CreateAttackerProfile,
) -> Result<AttackerProfile, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT INTO attacker_profiles (id, project_id, name, skill_level, access_level, description, is_active, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?8)",
        params![
            id,
            data.project_id,
            data.name,
            data.skill_level.unwrap_or(1),
            data.access_level.unwrap_or(1),
            data.description.unwrap_or_default(),
            now,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    get_profile_by_id(&conn, &id)
}

#[tauri::command]
pub fn list_attacker_profiles(
    db: State<'_, Database>,
    project_id: String,
) -> Result<Vec<AttackerProfile>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, name, skill_level, access_level, description, created_at, updated_at, is_active
             FROM attacker_profiles WHERE project_id = ?1 ORDER BY name",
        )
        .map_err(|e| e.to_string())?;

    let profiles = stmt
        .query_map(params![project_id], |row| {
            Ok(AttackerProfile {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                skill_level: row.get(3)?,
                access_level: row.get(4)?,
                description: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                is_active: row.get::<_, i32>(8).unwrap_or(1) != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(profiles)
}

#[tauri::command]
pub fn update_attacker_profile(
    db: State<'_, Database>,
    id: String,
    name: Option<String>,
    skill_level: Option<i32>,
    access_level: Option<i32>,
    description: Option<String>,
    is_active: Option<bool>,
) -> Result<AttackerProfile, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let mut sets = vec!["updated_at = ?1".to_string()];
    let mut param_idx = 2u32;
    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(now)];

    if let Some(v) = name {
        sets.push(format!("name = ?{}", param_idx));
        params_vec.push(Box::new(v));
        param_idx += 1;
    }
    if let Some(v) = skill_level {
        sets.push(format!("skill_level = ?{}", param_idx));
        params_vec.push(Box::new(v));
        param_idx += 1;
    }
    if let Some(v) = access_level {
        sets.push(format!("access_level = ?{}", param_idx));
        params_vec.push(Box::new(v));
        param_idx += 1;
    }
    if let Some(v) = description {
        sets.push(format!("description = ?{}", param_idx));
        params_vec.push(Box::new(v));
        param_idx += 1;
    }
    if let Some(v) = is_active {
        sets.push(format!("is_active = ?{}", param_idx));
        params_vec.push(Box::new(v as i32));
        param_idx += 1;
    }

    let sql = format!(
        "UPDATE attacker_profiles SET {} WHERE id = ?{}",
        sets.join(", "),
        param_idx
    );
    params_vec.push(Box::new(id.clone()));

    let params_refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
    conn.execute(&sql, params_refs.as_slice())
        .map_err(|e| e.to_string())?;

    get_profile_by_id(&conn, &id)
}

#[tauri::command]
pub fn delete_attacker_profile(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM attacker_profiles WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_attacker_profile(db: State<'_, Database>, id: String) -> Result<AttackerProfile, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    get_profile_by_id(&conn, &id)
}

fn get_profile_by_id(conn: &rusqlite::Connection, id: &str) -> Result<AttackerProfile, String> {
    conn.query_row(
        "SELECT id, project_id, name, skill_level, access_level, description, created_at, updated_at, is_active
         FROM attacker_profiles WHERE id = ?1",
        params![id],
        |row| {
            Ok(AttackerProfile {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                skill_level: row.get(3)?,
                access_level: row.get(4)?,
                description: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                is_active: row.get::<_, i32>(8).unwrap_or(1) != 0,
            })
        },
    )
    .map_err(|e| format!("Attacker profile not found: {}", e))
}
