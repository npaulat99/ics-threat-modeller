// Export and Import commands — JSON and YAML support.

use crate::db::models::*;
use crate::db::Database;
use rusqlite::params;
use tauri::State;

/// Export a complete project to JSON.
#[tauri::command]
pub fn export_project_json(db: State<'_, Database>, project_id: String) -> Result<String, String> {
    let export = build_project_export(&db, &project_id)?;
    serde_json::to_string_pretty(&export).map_err(|e| e.to_string())
}

/// Export a complete project to YAML.
#[tauri::command]
pub fn export_project_yaml(db: State<'_, Database>, project_id: String) -> Result<String, String> {
    let export = build_project_export(&db, &project_id)?;
    serde_yml::to_string(&export).map_err(|e| e.to_string())
}

/// Import a project from JSON string.
#[tauri::command]
pub fn import_project_json(db: State<'_, Database>, json_str: String) -> Result<String, String> {
    let export: ProjectExport =
        serde_json::from_str(&json_str).map_err(|e| format!("Invalid JSON: {}", e))?;
    import_project_data(&db, export)
}

/// Import a project from YAML string.
#[tauri::command]
pub fn import_project_yaml(db: State<'_, Database>, yaml_str: String) -> Result<String, String> {
    let export: ProjectExport =
        serde_yml::from_str(&yaml_str).map_err(|e| format!("Invalid YAML: {}", e))?;
    import_project_data(&db, export)
}

/// Export project as a directory structure (returns a JSON object mapping file paths to contents).
#[tauri::command]
pub fn export_project_directory(
    db: State<'_, Database>,
    project_id: String,
) -> Result<String, String> {
    let export = build_project_export(&db, &project_id)?;
    let mut files: serde_json::Map<String, serde_json::Value> = serde_json::Map::new();

    // meta.yaml
    let meta = serde_json::json!({
        "project": {
            "id": export.project.id,
            "name": export.project.name,
            "description": export.project.description,
            "device_type": export.project.device_type,
            "architecture": export.project.architecture,
            "interfaces": serde_json::from_str::<serde_json::Value>(&export.project.interfaces).unwrap_or_default(),
            "assets": serde_json::from_str::<serde_json::Value>(&export.project.assets).unwrap_or_default(),
            "deployment_context": serde_json::from_str::<serde_json::Value>(&export.project.deployment_context).unwrap_or_default(),
            "factor_weights": serde_json::from_str::<serde_json::Value>(&export.project.factor_weights).unwrap_or_default(),
            "access_probabilities": serde_json::from_str::<serde_json::Value>(&export.project.access_probabilities).unwrap_or_default(),
            "created_at": export.project.created_at,
            "updated_at": export.project.updated_at,
        }
    });
    let meta_yaml = serde_yml::to_string(&meta).map_err(|e| e.to_string())?;
    files.insert(
        "meta.yaml".to_string(),
        serde_json::Value::String(meta_yaml),
    );

    // Attacker profiles.
    for profile in &export.attacker_profiles {
        let yaml = serde_yml::to_string(profile).map_err(|e| e.to_string())?;
        let path = format!("attacker-profiles/profile-{}.yaml", profile.id);
        files.insert(path, serde_json::Value::String(yaml));
    }

    // Goals.
    for goal_export in &export.goals {
        let goal_dir = format!("goals/{}", goal_export.goal.id);
        let goal_yaml = serde_yml::to_string(&goal_export.goal).map_err(|e| e.to_string())?;
        files.insert(
            format!("{}/goal.yaml", goal_dir),
            serde_json::Value::String(goal_yaml),
        );

        // Steps under this goal.
        for step_export in &goal_export.steps {
            export_step_to_files(&step_export, &goal_dir, &mut files)?;
        }

        // Categories.
        for cat_export in &goal_export.categories {
            export_category_to_files(&cat_export, &goal_dir, &mut files)?;
        }
    }

    // Catalog sources.
    if !export.catalog_sources.is_empty() {
        let yaml = serde_yml::to_string(&export.catalog_sources).map_err(|e| e.to_string())?;
        files.insert(
            "catalog-sources.yaml".to_string(),
            serde_json::Value::String(yaml),
        );
    }

    // Change log.
    if !export.change_log.is_empty() {
        let yaml = serde_yml::to_string(&export.change_log).map_err(|e| e.to_string())?;
        files.insert(
            "changelog.yaml".to_string(),
            serde_json::Value::String(yaml),
        );
    }

    serde_json::to_string_pretty(&files).map_err(|e| e.to_string())
}

fn export_step_to_files(
    step_export: &StepExport,
    parent_dir: &str,
    files: &mut serde_json::Map<String, serde_json::Value>,
) -> Result<(), String> {
    let step_dir = format!("{}/steps/{}", parent_dir, step_export.step.id);

    // Step definition + assessments.
    let step_data = serde_json::json!({
        "step": step_export.step,
        "assessments": step_export.assessments,
        "technique_mappings": step_export.technique_mappings,
        "tags": step_export.tags,
    });
    let yaml = serde_yml::to_string(&step_data).map_err(|e| e.to_string())?;
    files.insert(
        format!("{}/step.yaml", step_dir),
        serde_json::Value::String(yaml),
    );

    // Substeps.
    for ss in &step_export.substeps {
        let yaml = serde_yml::to_string(&ss).map_err(|e| e.to_string())?;
        files.insert(
            format!("{}/substeps/{}.yaml", step_dir, ss.substep.id),
            serde_json::Value::String(yaml),
        );
    }

    // Countermeasures.
    for cm in &step_export.countermeasures {
        let yaml = serde_yml::to_string(cm).map_err(|e| e.to_string())?;
        files.insert(
            format!("{}/countermeasures/{}.yaml", step_dir, cm.id),
            serde_json::Value::String(yaml),
        );
    }

    // Weaknesses.
    for w in &step_export.weaknesses {
        let yaml = serde_yml::to_string(w).map_err(|e| e.to_string())?;
        files.insert(
            format!("{}/weaknesses/{}.yaml", step_dir, w.id),
            serde_json::Value::String(yaml),
        );
    }

    Ok(())
}

fn export_category_to_files(
    cat_export: &CategoryExport,
    parent_dir: &str,
    files: &mut serde_json::Map<String, serde_json::Value>,
) -> Result<(), String> {
    let cat_dir = format!("{}/categories", parent_dir);
    let yaml = serde_yml::to_string(&cat_export.category).map_err(|e| e.to_string())?;
    files.insert(
        format!("{}/{}.yaml", cat_dir, cat_export.category.id),
        serde_json::Value::String(yaml),
    );

    // Steps in this category.
    for step_export in &cat_export.steps {
        export_step_to_files(step_export, &cat_dir, files)?;
    }

    // Subcategories.
    for sub in &cat_export.subcategories {
        export_category_to_files(sub, &cat_dir, files)?;
    }

    Ok(())
}

/// Build the full ProjectExport structure from the database.
pub fn build_project_export(db: &Database, project_id: &str) -> Result<ProjectExport, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Project.
    let project: Project = conn
        .query_row(
            "SELECT id, name, description, device_type, architecture, interfaces, assets, deployment_context, factor_weights, access_probabilities, created_at, updated_at FROM projects WHERE id = ?1",
            params![project_id],
            |row| {
                Ok(Project {
                    id: row.get(0)?, name: row.get(1)?, description: row.get(2)?,
                    device_type: row.get(3)?, architecture: row.get(4)?,
                    interfaces: row.get(5)?, assets: row.get(6)?,
                    deployment_context: row.get(7)?, factor_weights: row.get(8)?,
                    access_probabilities: row.get(9)?, created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                })
            },
        )
        .map_err(|e| format!("Project not found: {e}"))?;

    // Attacker profiles.
    let attacker_profiles = list_entities::<AttackerProfile>(
        &conn,
        "SELECT id, project_id, name, skill_level, access_level, description, created_at, updated_at FROM attacker_profiles WHERE project_id = ?1",
        project_id,
        |row| Ok(AttackerProfile {
            id: row.get(0)?, project_id: row.get(1)?, name: row.get(2)?,
            skill_level: row.get(3)?, access_level: row.get(4)?,
            description: row.get(5)?, created_at: row.get(6)?, updated_at: row.get(7)?,
        }),
    )?;

    // Goals.
    let goal_rows = list_entities::<Goal>(
        &conn,
        "SELECT id, project_id, name, description, impact_category, catalog_source_id, sort_order, created_at, updated_at FROM goals WHERE project_id = ?1 ORDER BY sort_order",
        project_id,
        |row| Ok(Goal {
            id: row.get(0)?, project_id: row.get(1)?, name: row.get(2)?,
            description: row.get(3)?, impact_category: row.get(4)?,
            catalog_source_id: row.get(5)?, sort_order: row.get(6)?,
            created_at: row.get(7)?, updated_at: row.get(8)?,
        }),
    )?;

    let mut goals = Vec::new();
    for g in goal_rows {
        let goal_export = build_goal_export(&conn, g)?;
        goals.push(goal_export);
    }

    // Catalog sources referenced by this project.
    let catalog_sources = list_entities::<CatalogEntry>(
        &conn,
        "SELECT DISTINCT ce.id, ce.entry_type, ce.name, ce.description, ce.tree_data, ce.source_framework, ce.version, ce.tags, ce.created_at, ce.updated_at FROM catalog_entries ce INNER JOIN goals g ON g.catalog_source_id = ce.id WHERE g.project_id = ?1",
        project_id,
        |row| Ok(CatalogEntry {
            id: row.get(0)?, entry_type: row.get(1)?, name: row.get(2)?,
            description: row.get(3)?, tree_data: row.get(4)?,
            source_framework: row.get(5)?, version: row.get(6)?,
            tags: row.get(7)?, created_at: row.get(8)?, updated_at: row.get(9)?,
        }),
    )?;

    // Change log.
    let change_log = list_entities::<ChangeLogEntry>(
        &conn,
        "SELECT id, project_id, entity_id, entity_type, change_type, old_value, new_value, author, rationale, created_at FROM change_log WHERE project_id = ?1 ORDER BY created_at",
        project_id,
        |row| Ok(ChangeLogEntry {
            id: row.get(0)?, project_id: row.get(1)?, entity_id: row.get(2)?,
            entity_type: row.get(3)?, change_type: row.get(4)?,
            old_value: row.get(5)?, new_value: row.get(6)?,
            author: row.get(7)?, rationale: row.get(8)?, created_at: row.get(9)?,
        }),
    )?;

    Ok(ProjectExport {
        project,
        attacker_profiles,
        goals,
        catalog_sources,
        change_log,
    })
}

fn build_goal_export(conn: &rusqlite::Connection, goal: Goal) -> Result<GoalExport, String> {
    let goal_id = goal.id.clone();

    // Categories under this goal.
    let cats = build_categories_export(conn, &goal_id, "goal")?;

    // Steps directly under this goal.
    let steps = build_steps_export(conn, &goal_id, "goal")?;

    let technique_mappings = super::tags::list_technique_mappings_internal(conn, &goal_id, "goal")?;
    let tags = super::tags::list_tags_internal(conn, &goal_id, "goal")?;

    Ok(GoalExport {
        goal,
        categories: cats,
        steps,
        technique_mappings,
        tags,
    })
}

fn build_categories_export(
    conn: &rusqlite::Connection,
    parent_id: &str,
    parent_type: &str,
) -> Result<Vec<CategoryExport>, String> {
    let mut stmt = conn
        .prepare("SELECT id, parent_id, parent_type, name, description, sort_order, created_at, updated_at FROM categories WHERE parent_id = ?1 AND parent_type = ?2 ORDER BY sort_order")
        .map_err(|e| e.to_string())?;

    let cat_rows: Vec<Category> = stmt
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

    let mut result = Vec::new();
    for cat in cat_rows {
        let cat_id = cat.id.clone();
        let subcats = build_categories_export(conn, &cat_id, "category")?;
        let steps = build_steps_export(conn, &cat_id, "category")?;
        result.push(CategoryExport {
            category: cat,
            subcategories: subcats,
            steps,
        });
    }

    Ok(result)
}

fn build_steps_export(
    conn: &rusqlite::Connection,
    parent_id: &str,
    parent_type: &str,
) -> Result<Vec<StepExport>, String> {
    let steps = super::steps::list_steps_internal(conn, parent_id, parent_type)?;
    let mut result = Vec::new();

    for step in steps {
        let step_id = step.id.clone();

        let substep_rows = super::substeps::list_substeps_internal(conn, &step_id)?;
        let mut substeps = Vec::new();
        for ss in substep_rows {
            let ss_id = ss.id.clone();
            let ss_cms =
                super::countermeasures::list_countermeasures_internal(conn, &ss_id, "substep")?;
            let ss_ws = super::weaknesses::list_weaknesses_internal(conn, &ss_id, "substep")?;
            let ss_assessments =
                super::assessments::get_assessments_internal(conn, &ss_id, "substep")?;
            let ss_mappings =
                super::tags::list_technique_mappings_internal(conn, &ss_id, "substep")?;
            let ss_tags = super::tags::list_tags_internal(conn, &ss_id, "substep")?;
            substeps.push(SubstepExport {
                substep: ss,
                countermeasures: ss_cms,
                weaknesses: ss_ws,
                assessments: ss_assessments,
                technique_mappings: ss_mappings,
                tags: ss_tags,
            });
        }

        let cms = super::countermeasures::list_countermeasures_internal(conn, &step_id, "step")?;
        let ws = super::weaknesses::list_weaknesses_internal(conn, &step_id, "step")?;
        let assessments = super::assessments::get_assessments_internal(conn, &step_id, "step")?;
        let mappings = super::tags::list_technique_mappings_internal(conn, &step_id, "step")?;
        let tags = super::tags::list_tags_internal(conn, &step_id, "step")?;

        result.push(StepExport {
            step,
            substeps,
            countermeasures: cms,
            weaknesses: ws,
            assessments,
            technique_mappings: mappings,
            tags,
        });
    }

    Ok(result)
}

/// Import a full ProjectExport into the database, assigning new IDs to avoid conflicts.
pub fn import_project_data(db: &Database, data: ProjectExport) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Insert the project (use existing ID to preserve references).
    let pid = &data.project.id;
    conn.execute(
        "INSERT OR REPLACE INTO projects (id, name, description, device_type, architecture, interfaces, assets, deployment_context, factor_weights, access_probabilities, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            pid, data.project.name, data.project.description,
            data.project.device_type, data.project.architecture,
            data.project.interfaces, data.project.assets,
            data.project.deployment_context, data.project.factor_weights,
            data.project.access_probabilities, data.project.created_at, now,
        ],
    ).map_err(|e| e.to_string())?;

    // Attacker profiles.
    for ap in &data.attacker_profiles {
        conn.execute(
            "INSERT OR REPLACE INTO attacker_profiles (id, project_id, name, skill_level, access_level, description, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![ap.id, ap.project_id, ap.name, ap.skill_level, ap.access_level, ap.description, ap.created_at, now],
        ).map_err(|e| e.to_string())?;
    }

    // Catalog sources — must be imported BEFORE goals which reference them via catalog_source_id.
    for cs in &data.catalog_sources {
        conn.execute(
            "INSERT OR REPLACE INTO catalog_entries (id, entry_type, name, description, tree_data, source_framework, version, tags, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![cs.id, cs.entry_type, cs.name, cs.description, cs.tree_data, cs.source_framework, cs.version, cs.tags, cs.created_at, now],
        ).map_err(|e| e.to_string())?;
    }

    // Goals — catalog_source_id may reference a catalog entry that wasn't exported.
    // Set to NULL if the referenced catalog entry doesn't exist.
    for ge in &data.goals {
        let catalog_source_id = if let Some(ref csid) = ge.goal.catalog_source_id {
            let exists: bool = conn
                .query_row(
                    "SELECT COUNT(*) FROM catalog_entries WHERE id = ?1",
                    params![csid],
                    |row| row.get::<_, i64>(0),
                )
                .map(|c| c > 0)
                .unwrap_or(false);
            if exists { Some(csid.clone()) } else { None }
        } else {
            None
        };
        conn.execute(
            "INSERT OR REPLACE INTO goals (id, project_id, name, description, impact_category, catalog_source_id, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![ge.goal.id, ge.goal.project_id, ge.goal.name, ge.goal.description, ge.goal.impact_category, catalog_source_id, ge.goal.sort_order, ge.goal.created_at, now],
        ).map_err(|e| e.to_string())?;

        import_categories_data(&conn, &ge.categories, &now)?;
        import_steps_data(&conn, &ge.steps, &now)?;
    }

    // Change log.
    for cl in &data.change_log {
        conn.execute(
            "INSERT OR REPLACE INTO change_log (id, project_id, entity_id, entity_type, change_type, old_value, new_value, author, rationale, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![cl.id, cl.project_id, cl.entity_id, cl.entity_type, cl.change_type, cl.old_value, cl.new_value, cl.author, cl.rationale, cl.created_at],
        ).map_err(|e| e.to_string())?;
    }

    Ok(pid.clone())
}

fn import_categories_data(
    conn: &rusqlite::Connection,
    categories: &[CategoryExport],
    now: &str,
) -> Result<(), String> {
    for ce in categories {
        conn.execute(
            "INSERT OR REPLACE INTO categories (id, parent_id, parent_type, name, description, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![ce.category.id, ce.category.parent_id, ce.category.parent_type, ce.category.name, ce.category.description, ce.category.sort_order, ce.category.created_at, now],
        ).map_err(|e| e.to_string())?;

        import_categories_data(conn, &ce.subcategories, now)?;
        import_steps_data(conn, &ce.steps, now)?;
    }
    Ok(())
}

fn import_steps_data(
    conn: &rusqlite::Connection,
    steps: &[StepExport],
    now: &str,
) -> Result<(), String> {
    for se in steps {
        conn.execute(
            "INSERT OR REPLACE INTO steps (id, parent_id, parent_type, conjunction, name, description, access_level, skill_level, catalog_source_id, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![se.step.id, se.step.parent_id, se.step.parent_type, se.step.conjunction, se.step.name, se.step.description, se.step.access_level, se.step.skill_level, se.step.catalog_source_id, se.step.sort_order, se.step.created_at, now],
        ).map_err(|e| e.to_string())?;

        // Substeps.
        for ss in &se.substeps {
            conn.execute(
                "INSERT OR REPLACE INTO substeps (id, parent_step_id, conjunction, name, description, access_level, skill_level, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![ss.substep.id, ss.substep.parent_step_id, ss.substep.conjunction, ss.substep.name, ss.substep.description, ss.substep.access_level, ss.substep.skill_level, ss.substep.sort_order, ss.substep.created_at, now],
            ).map_err(|e| e.to_string())?;

            for a in &ss.assessments {
                let is_ref = if a.is_reference { 1 } else { 0 };
                conn.execute(
                    "INSERT OR REPLACE INTO assessments (id, entity_id, entity_type, is_reference, time_effort, prior_knowledge, exploitability, window_of_opportunity, detection_probability, preparation_effort, abort_risk, rationale_json, override_rationale, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)",
                    params![a.id, a.entity_id, a.entity_type, is_ref, a.time_effort, a.prior_knowledge, a.exploitability, a.window_of_opportunity, a.detection_probability, a.preparation_effort, a.abort_risk, a.rationale_json, a.override_rationale, a.created_at, now],
                ).map_err(|e| e.to_string())?;
            }
        }

        // Countermeasures.
        for cm in &se.countermeasures {
            conn.execute(
                "INSERT OR REPLACE INTO countermeasures (id, parent_id, parent_type, name, description, effectiveness, implementation_cost, sort_order, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
                params![cm.id, cm.parent_id, cm.parent_type, cm.name, cm.description, cm.effectiveness, cm.implementation_cost, cm.sort_order, cm.created_at, now],
            ).map_err(|e| e.to_string())?;
        }

        // Weaknesses.
        for w in &se.weaknesses {
            conn.execute(
                "INSERT OR REPLACE INTO weaknesses (id, parent_id, parent_type, name, description, severity, cve_id, sort_order, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
                params![w.id, w.parent_id, w.parent_type, w.name, w.description, w.severity, w.cve_id, w.sort_order, w.created_at, now],
            ).map_err(|e| e.to_string())?;
        }

        // Assessments.
        for a in &se.assessments {
            let is_ref = if a.is_reference { 1 } else { 0 };
            conn.execute(
                "INSERT OR REPLACE INTO assessments (id, entity_id, entity_type, is_reference, time_effort, prior_knowledge, exploitability, window_of_opportunity, detection_probability, preparation_effort, abort_risk, rationale_json, override_rationale, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)",
                params![a.id, a.entity_id, a.entity_type, is_ref, a.time_effort, a.prior_knowledge, a.exploitability, a.window_of_opportunity, a.detection_probability, a.preparation_effort, a.abort_risk, a.rationale_json, a.override_rationale, a.created_at, now],
            ).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// Helper to list entities with a parameterized query.
fn list_entities<T>(
    conn: &rusqlite::Connection,
    sql: &str,
    param: &str,
    mapper: impl Fn(&rusqlite::Row) -> rusqlite::Result<T>,
) -> Result<Vec<T>, String> {
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let items = stmt
        .query_map(params![param], |row| mapper(row))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(items)
}
