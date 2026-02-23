// Goal CRUD commands.

use crate::db::models::{CreateGoal, Goal};
use crate::db::Database;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn create_goal(db: State<'_, Database>, data: CreateGoal) -> Result<Goal, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Get next sort_order.
    let sort_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM goals WHERE project_id = ?1",
            params![data.project_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    conn.execute(
        "INSERT INTO goals (id, project_id, name, description, impact_category, catalog_source_id, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            id,
            data.project_id,
            data.name,
            data.description.unwrap_or_default(),
            data.impact_category.unwrap_or_default(),
            data.catalog_source_id,
            sort_order,
            now,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    get_goal_by_id(&conn, &id)
}

#[tauri::command]
pub fn list_goals(db: State<'_, Database>, project_id: String) -> Result<Vec<Goal>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, name, description, impact_category, catalog_source_id, sort_order, created_at, updated_at
             FROM goals WHERE project_id = ?1 ORDER BY sort_order",
        )
        .map_err(|e| e.to_string())?;

    let goals = stmt
        .query_map(params![project_id], |row| {
            Ok(Goal {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                impact_category: row.get(4)?,
                catalog_source_id: row.get(5)?,
                sort_order: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(goals)
}

#[tauri::command]
pub fn update_goal(
    db: State<'_, Database>,
    id: String,
    name: Option<String>,
    description: Option<String>,
    impact_category: Option<String>,
    sort_order: Option<i32>,
) -> Result<Goal, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let mut sets = vec!["updated_at = ?1".to_string()];
    let mut idx = 2u32;
    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(now)];

    macro_rules! opt {
        ($field:expr, $val:expr) => {
            if let Some(v) = $val {
                sets.push(format!("{} = ?{}", $field, idx));
                params_vec.push(Box::new(v));
                idx += 1;
            }
        };
    }

    opt!("name", name);
    opt!("description", description);
    opt!("impact_category", impact_category);
    opt!("sort_order", sort_order);

    let sql = format!("UPDATE goals SET {} WHERE id = ?{}", sets.join(", "), idx);
    params_vec.push(Box::new(id.clone()));

    let refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
    conn.execute(&sql, refs.as_slice())
        .map_err(|e| e.to_string())?;

    get_goal_by_id(&conn, &id)
}

#[tauri::command]
pub fn delete_goal(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    // Cascade: delete all children (categories, steps, etc.) manually since SQLite
    // only cascades for direct FKs.
    delete_goal_cascade(&conn, &id)
}

fn delete_goal_cascade(conn: &rusqlite::Connection, goal_id: &str) -> Result<(), String> {
    // Delete steps under this goal.
    let step_ids: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT id FROM steps WHERE parent_id = ?1 AND parent_type = 'goal'")
            .map_err(|e| e.to_string())?;
        stmt.query_map(params![goal_id], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect()
    };
    for sid in &step_ids {
        super::steps::delete_step_cascade(conn, sid)?;
    }

    // Delete categories under this goal.
    let cat_ids: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT id FROM categories WHERE parent_id = ?1 AND parent_type = 'goal'")
            .map_err(|e| e.to_string())?;
        stmt.query_map(params![goal_id], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect()
    };
    for cid in &cat_ids {
        super::categories::delete_category_cascade(conn, cid)?;
    }

    // Delete technique mappings and tags for this goal.
    conn.execute(
        "DELETE FROM attack_technique_mappings WHERE entity_id = ?1",
        params![goal_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tags WHERE entity_id = ?1", params![goal_id])
        .map_err(|e| e.to_string())?;

    // Delete the goal itself.
    conn.execute("DELETE FROM goals WHERE id = ?1", params![goal_id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_goal(db: State<'_, Database>, id: String) -> Result<Goal, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    get_goal_by_id(&conn, &id)
}

fn get_goal_by_id(conn: &rusqlite::Connection, id: &str) -> Result<Goal, String> {
    conn.query_row(
        "SELECT id, project_id, name, description, impact_category, catalog_source_id, sort_order, created_at, updated_at
         FROM goals WHERE id = ?1",
        params![id],
        |row| {
            Ok(Goal {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                impact_category: row.get(4)?,
                catalog_source_id: row.get(5)?,
                sort_order: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        },
    )
    .map_err(|e| format!("Goal not found: {}", e))
}
