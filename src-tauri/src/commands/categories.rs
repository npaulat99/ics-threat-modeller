// Category CRUD commands.

use crate::db::models::{Category, CreateCategory};
use crate::db::Database;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn create_category(db: State<'_, Database>, data: CreateCategory) -> Result<Category, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let sort_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM categories WHERE parent_id = ?1 AND parent_type = ?2",
            params![data.parent_id, data.parent_type],
            |row| row.get(0),
        )
        .unwrap_or(0);

    conn.execute(
        "INSERT INTO categories (id, parent_id, parent_type, name, description, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            id,
            data.parent_id,
            data.parent_type,
            data.name,
            data.description.unwrap_or_default(),
            sort_order,
            now,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    get_category_by_id(&conn, &id)
}

#[tauri::command]
pub fn list_categories(
    db: State<'_, Database>,
    parent_id: String,
    parent_type: String,
) -> Result<Vec<Category>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, parent_id, parent_type, name, description, sort_order, created_at, updated_at
             FROM categories WHERE parent_id = ?1 AND parent_type = ?2 ORDER BY sort_order",
        )
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(params![parent_id, parent_type], |row| {
            Ok(Category {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                parent_type: row.get(2)?,
                name: row.get(3)?,
                description: row.get(4)?,
                sort_order: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

#[tauri::command]
pub fn update_category(
    db: State<'_, Database>,
    id: String,
    name: Option<String>,
    description: Option<String>,
    sort_order: Option<i32>,
    parent_id: Option<String>,
    parent_type: Option<String>,
) -> Result<Category, String> {
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

    opt!("name", name);
    opt!("description", description);
    opt!("sort_order", sort_order);
    opt!("parent_id", parent_id);
    opt!("parent_type", parent_type);

    let sql = format!(
        "UPDATE categories SET {} WHERE id = ?{}",
        sets.join(", "),
        idx
    );
    params_vec.push(Box::new(id.clone()));

    let refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
    conn.execute(&sql, refs.as_slice())
        .map_err(|e| e.to_string())?;

    get_category_by_id(&conn, &id)
}

#[tauri::command]
pub fn delete_category(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    delete_category_cascade(&conn, &id)
}

/// Recursively delete a category and all its children.
pub fn delete_category_cascade(conn: &rusqlite::Connection, cat_id: &str) -> Result<(), String> {
    // Delete steps under this category.
    let step_ids: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT id FROM steps WHERE parent_id = ?1 AND parent_type = 'category'")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![cat_id], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        rows.filter_map(|r| r.ok()).collect()
    };
    for sid in &step_ids {
        super::steps::delete_step_cascade(conn, sid)?;
    }

    // Delete subcategories recursively.
    let sub_ids: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT id FROM categories WHERE parent_id = ?1 AND parent_type = 'category'")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![cat_id], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        rows.filter_map(|r| r.ok()).collect()
    };
    for sid in &sub_ids {
        delete_category_cascade(conn, sid)?;
    }

    conn.execute("DELETE FROM categories WHERE id = ?1", params![cat_id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_category(db: State<'_, Database>, id: String) -> Result<Category, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    get_category_by_id(&conn, &id)
}

fn get_category_by_id(conn: &rusqlite::Connection, id: &str) -> Result<Category, String> {
    conn.query_row(
        "SELECT id, parent_id, parent_type, name, description, sort_order, created_at, updated_at
         FROM categories WHERE id = ?1",
        params![id],
        |row| {
            Ok(Category {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                parent_type: row.get(2)?,
                name: row.get(3)?,
                description: row.get(4)?,
                sort_order: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        },
    )
    .map_err(|e| format!("Category not found: {}", e))
}
