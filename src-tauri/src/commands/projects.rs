// Project CRUD commands.

use crate::db::models::{CreateProject, Project, UpdateProject};
use crate::db::Database;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn create_project(db: State<'_, Database>, data: CreateProject) -> Result<Project, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT INTO projects (id, name, description, device_type, architecture, interfaces, assets, deployment_context, factor_weights, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            id,
            data.name,
            data.description.unwrap_or_default(),
            data.device_type.unwrap_or_default(),
            data.architecture.unwrap_or_default(),
            data.interfaces.unwrap_or_else(|| "[]".to_string()),
            data.assets.unwrap_or_else(|| "[]".to_string()),
            data.deployment_context.unwrap_or_else(|| "{}".to_string()),
            data.factor_weights.unwrap_or_else(|| "{\"time_effort\":0.25,\"exploitability\":0.20,\"window_of_opportunity\":0.15,\"detection_probability\":0.15,\"prior_knowledge\":0.10,\"preparation_effort\":0.10,\"abort_risk\":0.05}".to_string()),
            now,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    get_project_by_id(&conn, &id)
}

#[tauri::command]
pub fn list_projects(db: State<'_, Database>) -> Result<Vec<Project>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, description, device_type, architecture, interfaces, assets, deployment_context, factor_weights, access_probabilities, created_at, updated_at FROM projects ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;

    let projects = stmt
        .query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                device_type: row.get(3)?,
                architecture: row.get(4)?,
                interfaces: row.get(5)?,
                assets: row.get(6)?,
                deployment_context: row.get(7)?,
                factor_weights: row.get(8)?,
                access_probabilities: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(projects)
}

#[tauri::command]
pub fn get_project(db: State<'_, Database>, id: String) -> Result<Project, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    get_project_by_id(&conn, &id)
}

#[tauri::command]
pub fn update_project(db: State<'_, Database>, data: UpdateProject) -> Result<Project, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Build dynamic update query.
    let mut sets = vec!["updated_at = ?1".to_string()];
    let mut param_idx = 2u32;
    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(now)];

    macro_rules! add_field {
        ($field:expr, $val:expr) => {
            if let Some(v) = $val {
                sets.push(format!("{} = ?{}", $field, param_idx));
                params_vec.push(Box::new(v));
                param_idx += 1;
            }
        };
    }

    add_field!("name", data.name);
    add_field!("description", data.description);
    add_field!("device_type", data.device_type);
    add_field!("architecture", data.architecture);
    add_field!("interfaces", data.interfaces);
    add_field!("assets", data.assets);
    add_field!("deployment_context", data.deployment_context);
    add_field!("factor_weights", data.factor_weights);
    add_field!("access_probabilities", data.access_probabilities);

    let sql = format!(
        "UPDATE projects SET {} WHERE id = ?{}",
        sets.join(", "),
        param_idx
    );
    params_vec.push(Box::new(data.id.clone()));

    let params_refs: Vec<&dyn rusqlite::types::ToSql> =
        params_vec.iter().map(|b| b.as_ref()).collect();
    conn.execute(&sql, params_refs.as_slice())
        .map_err(|e| e.to_string())?;

    get_project_by_id(&conn, &data.id)
}

#[tauri::command]
pub fn delete_project(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM projects WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Internal helper to fetch a project by ID.
fn get_project_by_id(conn: &rusqlite::Connection, id: &str) -> Result<Project, String> {
    conn.query_row(
        "SELECT id, name, description, device_type, architecture, interfaces, assets, deployment_context, factor_weights, access_probabilities, created_at, updated_at FROM projects WHERE id = ?1",
        params![id],
        |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                device_type: row.get(3)?,
                architecture: row.get(4)?,
                interfaces: row.get(5)?,
                assets: row.get(6)?,
                deployment_context: row.get(7)?,
                factor_weights: row.get(8)?,
                access_probabilities: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        },
    )
    .map_err(|e| format!("Project not found: {}", e))
}
