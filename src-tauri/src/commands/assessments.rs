// Assessment CRUD commands.

use crate::db::models::{Assessment, CreateAssessment, UpdateAssessment};
use crate::db::Database;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn create_assessment(
    db: State<'_, Database>,
    data: CreateAssessment,
) -> Result<Assessment, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let is_ref = if data.is_reference.unwrap_or(false) { 1 } else { 0 };

    conn.execute(
        "INSERT INTO assessments (id, entity_id, entity_type, is_reference, time_effort, prior_knowledge, exploitability, window_of_opportunity, detection_probability, preparation_effort, abort_risk, rationale_json, override_rationale, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        params![
            id,
            data.entity_id,
            data.entity_type,
            is_ref,
            data.time_effort,
            data.prior_knowledge,
            data.exploitability,
            data.window_of_opportunity,
            data.detection_probability,
            data.preparation_effort,
            data.abort_risk,
            data.rationale_json.unwrap_or_else(|| "{}".to_string()),
            data.override_rationale,
            now,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    get_assessment_by_id(&conn, &id)
}

#[tauri::command]
pub fn get_assessments(
    db: State<'_, Database>,
    entity_id: String,
    entity_type: String,
) -> Result<Vec<Assessment>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    get_assessments_internal(&conn, &entity_id, &entity_type)
}

pub fn get_assessments_internal(
    conn: &rusqlite::Connection,
    entity_id: &str,
    entity_type: &str,
) -> Result<Vec<Assessment>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, entity_id, entity_type, is_reference, time_effort, prior_knowledge, exploitability, window_of_opportunity, detection_probability, preparation_effort, abort_risk, rationale_json, override_rationale, created_at, updated_at
             FROM assessments WHERE entity_id = ?1 AND entity_type = ?2 ORDER BY is_reference DESC",
        )
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(params![entity_id, entity_type], |row| row_to_assessment(row))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

#[tauri::command]
pub fn update_assessment(
    db: State<'_, Database>,
    data: UpdateAssessment,
) -> Result<Assessment, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let mut sets = vec!["updated_at = ?1".to_string()];
    let mut idx = 2u32;
    let mut pv: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(now)];

    macro_rules! opt {
        ($f:expr, $v:expr) => {
            if let Some(v) = $v {
                sets.push(format!("{} = ?{}", $f, idx));
                pv.push(Box::new(v));
                idx += 1;
            }
        };
    }

    opt!("time_effort", data.time_effort);
    opt!("prior_knowledge", data.prior_knowledge);
    opt!("exploitability", data.exploitability);
    opt!("window_of_opportunity", data.window_of_opportunity);
    opt!("detection_probability", data.detection_probability);
    opt!("preparation_effort", data.preparation_effort);
    opt!("abort_risk", data.abort_risk);
    opt!("rationale_json", data.rationale_json);
    opt!("override_rationale", data.override_rationale);

    let sql = format!("UPDATE assessments SET {} WHERE id = ?{}", sets.join(", "), idx);
    pv.push(Box::new(data.id.clone()));
    let refs: Vec<&dyn rusqlite::types::ToSql> = pv.iter().map(|b| b.as_ref()).collect();
    conn.execute(&sql, refs.as_slice()).map_err(|e| e.to_string())?;

    get_assessment_by_id(&conn, &data.id)
}

#[tauri::command]
pub fn delete_assessment(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM assessments WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Upsert: create or update an assessment for the given entity.
/// If an assessment already exists for (entity_id, is_reference=0), update it.
/// Otherwise, create a new one.
#[tauri::command]
pub fn upsert_assessment(
    db: State<'_, Database>,
    data: CreateAssessment,
) -> Result<Assessment, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let is_ref = if data.is_reference.unwrap_or(false) { 1 } else { 0 };

    // Check if assessment exists.
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM assessments WHERE entity_id = ?1 AND entity_type = ?2 AND is_reference = ?3",
            params![data.entity_id, data.entity_type, is_ref],
            |row| row.get(0),
        )
        .ok();

    if let Some(existing_id) = existing {
        // Update existing.
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        conn.execute(
            "UPDATE assessments SET time_effort=?1, prior_knowledge=?2, exploitability=?3, window_of_opportunity=?4, detection_probability=?5, preparation_effort=?6, abort_risk=?7, rationale_json=?8, override_rationale=?9, updated_at=?10 WHERE id=?11",
            params![
                data.time_effort,
                data.prior_knowledge,
                data.exploitability,
                data.window_of_opportunity,
                data.detection_probability,
                data.preparation_effort,
                data.abort_risk,
                data.rationale_json.unwrap_or_else(|| "{}".to_string()),
                data.override_rationale,
                now,
                existing_id,
            ],
        )
        .map_err(|e| e.to_string())?;
        get_assessment_by_id(&conn, &existing_id)
    } else {
        // Create new.
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        conn.execute(
            "INSERT INTO assessments (id, entity_id, entity_type, is_reference, time_effort, prior_knowledge, exploitability, window_of_opportunity, detection_probability, preparation_effort, abort_risk, rationale_json, override_rationale, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                id,
                data.entity_id,
                data.entity_type,
                is_ref,
                data.time_effort,
                data.prior_knowledge,
                data.exploitability,
                data.window_of_opportunity,
                data.detection_probability,
                data.preparation_effort,
                data.abort_risk,
                data.rationale_json.unwrap_or_else(|| "{}".to_string()),
                data.override_rationale,
                now,
                now,
            ],
        )
        .map_err(|e| e.to_string())?;
        get_assessment_by_id(&conn, &id)
    }
}

fn get_assessment_by_id(conn: &rusqlite::Connection, id: &str) -> Result<Assessment, String> {
    conn.query_row(
        "SELECT id, entity_id, entity_type, is_reference, time_effort, prior_knowledge, exploitability, window_of_opportunity, detection_probability, preparation_effort, abort_risk, rationale_json, override_rationale, created_at, updated_at
         FROM assessments WHERE id = ?1",
        params![id],
        |row| row_to_assessment(row),
    )
    .map_err(|e| format!("Assessment not found: {}", e))
}

fn row_to_assessment(row: &rusqlite::Row) -> rusqlite::Result<Assessment> {
    let is_ref_int: i32 = row.get(3)?;
    Ok(Assessment {
        id: row.get(0)?,
        entity_id: row.get(1)?,
        entity_type: row.get(2)?,
        is_reference: is_ref_int != 0,
        time_effort: row.get(4)?,
        prior_knowledge: row.get(5)?,
        exploitability: row.get(6)?,
        window_of_opportunity: row.get(7)?,
        detection_probability: row.get(8)?,
        preparation_effort: row.get(9)?,
        abort_risk: row.get(10)?,
        rationale_json: row.get(11)?,
        override_rationale: row.get(12)?,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
    })
}
