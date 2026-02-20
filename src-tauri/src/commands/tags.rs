// Tag CRUD commands.

use crate::db::models::{CreateTag, Tag};
use crate::db::Database;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn create_tag(db: State<'_, Database>, data: CreateTag) -> Result<Tag, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT INTO tags (id, entity_id, entity_type, key, value, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, data.entity_id, data.entity_type, data.key, data.value, now],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, entity_id, entity_type, key, value, created_at FROM tags WHERE id = ?1",
        params![id],
        |row| {
            Ok(Tag {
                id: row.get(0)?,
                entity_id: row.get(1)?,
                entity_type: row.get(2)?,
                key: row.get(3)?,
                value: row.get(4)?,
                created_at: row.get(5)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_tags(
    db: State<'_, Database>,
    entity_id: String,
    entity_type: String,
) -> Result<Vec<Tag>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    list_tags_internal(&conn, &entity_id, &entity_type)
}

pub fn list_tags_internal(
    conn: &rusqlite::Connection,
    entity_id: &str,
    entity_type: &str,
) -> Result<Vec<Tag>, String> {
    let mut stmt = conn
        .prepare("SELECT id, entity_id, entity_type, key, value, created_at FROM tags WHERE entity_id = ?1 AND entity_type = ?2")
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(params![entity_id, entity_type], |row| {
            Ok(Tag {
                id: row.get(0)?,
                entity_id: row.get(1)?,
                entity_type: row.get(2)?,
                key: row.get(3)?,
                value: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

#[tauri::command]
pub fn delete_tag(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tags WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ATT&CK technique mapping commands.

use crate::db::models::{AttackTechniqueMapping, CreateAttackTechniqueMapping};

#[tauri::command]
pub fn create_technique_mapping(
    db: State<'_, Database>,
    data: CreateAttackTechniqueMapping,
) -> Result<AttackTechniqueMapping, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT INTO attack_technique_mappings (id, entity_id, entity_type, framework, technique_id, technique_name, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            id,
            data.entity_id,
            data.entity_type,
            data.framework.unwrap_or_else(|| "ATT&CK ICS".to_string()),
            data.technique_id,
            data.technique_name.unwrap_or_default(),
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, entity_id, entity_type, framework, technique_id, technique_name, created_at FROM attack_technique_mappings WHERE id = ?1",
        params![id],
        |row| {
            Ok(AttackTechniqueMapping {
                id: row.get(0)?,
                entity_id: row.get(1)?,
                entity_type: row.get(2)?,
                framework: row.get(3)?,
                technique_id: row.get(4)?,
                technique_name: row.get(5)?,
                created_at: row.get(6)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_technique_mappings(
    db: State<'_, Database>,
    entity_id: String,
    entity_type: String,
) -> Result<Vec<AttackTechniqueMapping>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    list_technique_mappings_internal(&conn, &entity_id, &entity_type)
}

pub fn list_technique_mappings_internal(
    conn: &rusqlite::Connection,
    entity_id: &str,
    entity_type: &str,
) -> Result<Vec<AttackTechniqueMapping>, String> {
    let mut stmt = conn
        .prepare("SELECT id, entity_id, entity_type, framework, technique_id, technique_name, created_at FROM attack_technique_mappings WHERE entity_id = ?1 AND entity_type = ?2")
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(params![entity_id, entity_type], |row| {
            Ok(AttackTechniqueMapping {
                id: row.get(0)?,
                entity_id: row.get(1)?,
                entity_type: row.get(2)?,
                framework: row.get(3)?,
                technique_id: row.get(4)?,
                technique_name: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

#[tauri::command]
pub fn delete_technique_mapping(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM attack_technique_mappings WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
