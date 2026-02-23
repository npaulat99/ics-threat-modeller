// Probability calculation engine.
//
// Implements the assessment methodology from §4 of the requirements:
//   - Weighted cost score:  C(s) = Σ w_k · f_k(s)
//   - Cost probability:     P_cost(s) = (6 - C(s)) / 5
//   - Path cost probability: P_cost(P) = Π P_cost(s_i)
//   - Overall path prob:    P(P|A) = E_P · P_access(access_P) · P_cost(P)
//   - AND aggregation:      product of children
//   - OR aggregation:       max of children

use crate::db::models::{AttackPath, FactorContribution, PathStep, StepCalculation};
use crate::db::Database;
use rusqlite::params;
use serde::Deserialize;
use std::collections::HashMap;
use tauri::State;

/// Default factor weights per §4.5.
const DEFAULT_WEIGHTS: [(&str, f64); 7] = [
    ("time_effort", 0.25),
    ("exploitability", 0.20),
    ("window_of_opportunity", 0.15),
    ("detection_probability", 0.15),
    ("prior_knowledge", 0.10),
    ("preparation_effort", 0.10),
    ("abort_risk", 0.05),
];

/// Default access probabilities per §4.4.
const DEFAULT_ACCESS_PROBS: [(i32, f64); 5] = [(1, 0.9), (2, 0.7), (3, 0.5), (4, 0.3), (5, 0.1)];

#[derive(Debug, Deserialize)]
struct FactorWeights {
    time_effort: f64,
    exploitability: f64,
    window_of_opportunity: f64,
    detection_probability: f64,
    prior_knowledge: f64,
    preparation_effort: f64,
    abort_risk: f64,
}

/// Compute the weighted cost score and cost probability for a single step/substep.
#[tauri::command]
pub fn calculate_step_probability(
    db: State<'_, Database>,
    entity_id: String,
    entity_type: String,
    project_id: String,
) -> Result<StepCalculation, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    calculate_step_prob_internal(&conn, &entity_id, &entity_type, &project_id)
}

pub fn calculate_step_prob_internal(
    conn: &rusqlite::Connection,
    entity_id: &str,
    entity_type: &str,
    project_id: &str,
) -> Result<StepCalculation, String> {
    // Get project's factor weights.
    let weights = get_factor_weights(conn, project_id)?;

    // Get the active assessment (prefer override, fall back to reference).
    let assessment = conn
        .query_row(
            "SELECT time_effort, prior_knowledge, exploitability, window_of_opportunity, detection_probability, preparation_effort, abort_risk
             FROM assessments WHERE entity_id = ?1 AND entity_type = ?2
             ORDER BY is_reference ASC LIMIT 1",
            params![entity_id, entity_type],
            |row| {
                Ok((
                    row.get::<_, Option<i32>>(0)?,
                    row.get::<_, Option<i32>>(1)?,
                    row.get::<_, Option<i32>>(2)?,
                    row.get::<_, Option<i32>>(3)?,
                    row.get::<_, Option<i32>>(4)?,
                    row.get::<_, Option<i32>>(5)?,
                    row.get::<_, Option<i32>>(6)?,
                ))
            },
        )
        .ok();

    let (te, pk, ex, wo, dp, pe, ar) =
        assessment.unwrap_or((None, None, None, None, None, None, None));

    let factors = [
        ("time_effort", te.unwrap_or(3), weights.time_effort),
        ("exploitability", ex.unwrap_or(3), weights.exploitability),
        (
            "window_of_opportunity",
            wo.unwrap_or(3),
            weights.window_of_opportunity,
        ),
        (
            "detection_probability",
            dp.unwrap_or(3),
            weights.detection_probability,
        ),
        ("prior_knowledge", pk.unwrap_or(3), weights.prior_knowledge),
        (
            "preparation_effort",
            pe.unwrap_or(3),
            weights.preparation_effort,
        ),
        ("abort_risk", ar.unwrap_or(3), weights.abort_risk),
    ];

    let mut weighted_cost = 0.0;
    let mut contributions = Vec::new();

    for (name, value, weight) in &factors {
        let contribution = *weight * (*value as f64);
        weighted_cost += contribution;
        contributions.push(FactorContribution {
            factor_name: name.to_string(),
            value: *value,
            weight: *weight,
            contribution,
        });
    }

    let cost_probability = (6.0 - weighted_cost) / 5.0;

    Ok(StepCalculation {
        entity_id: entity_id.to_string(),
        entity_type: entity_type.to_string(),
        weighted_cost,
        cost_probability: cost_probability.max(0.0).min(1.0),
        factor_contributions: contributions,
    })
}

/// Compute all attack paths for a given goal, with probabilities.
#[tauri::command]
pub fn calculate_attack_paths(
    db: State<'_, Database>,
    project_id: String,
    goal_id: String,
    attacker_skill: Option<i32>,
    _attacker_access: Option<i32>,
) -> Result<Vec<AttackPath>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let access_probs = get_access_probabilities(&conn, &project_id)?;
    let _attacker_skill = attacker_skill.unwrap_or(5);

    // Get goal name.
    let goal_name: String = conn
        .query_row(
            "SELECT name FROM goals WHERE id = ?1",
            params![goal_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Goal not found: {}", e))?;

    // Build tree structure and extract paths.
    let paths = extract_paths_for_goal(
        &conn,
        &project_id,
        &goal_id,
        &goal_name,
        &access_probs,
        _attacker_skill,
    )?;

    Ok(paths)
}

/// Extract all leaf-to-root paths through the attack tree for a goal.
fn extract_paths_for_goal(
    conn: &rusqlite::Connection,
    project_id: &str,
    goal_id: &str,
    goal_name: &str,
    access_probs: &HashMap<i32, f64>,
    attacker_skill: i32,
) -> Result<Vec<AttackPath>, String> {
    // Get all direct children (steps and categories) of this goal.
    let steps = get_child_steps(conn, goal_id, "goal")?;
    let categories = get_child_categories(conn, goal_id, "goal")?;

    let mut all_leaf_paths: Vec<Vec<PathStepInfo>> = Vec::new();

    // Collect paths from direct steps.
    for step in &steps {
        let mut current_path = Vec::new();
        collect_leaf_paths(
            conn,
            project_id,
            step,
            &mut current_path,
            &mut all_leaf_paths,
        )?;
    }

    // Collect paths from categories (recursively down to steps).
    for cat in &categories {
        collect_category_paths(conn, project_id, &cat.0, &mut all_leaf_paths)?;
    }

    // Build AttackPath for each extracted path.
    let mut result = Vec::new();
    for (idx, path_steps) in all_leaf_paths.iter().enumerate() {
        if path_steps.is_empty() {
            continue;
        }

        let max_access = path_steps.iter().map(|s| s.access_level).max().unwrap_or(1);
        let max_skill = path_steps.iter().map(|s| s.skill_level).max().unwrap_or(1);
        let is_realistic = max_skill <= attacker_skill;
        let access_prob = access_probs.get(&max_access).copied().unwrap_or(0.5);

        let mut cost_prob = 1.0;
        let mut path_step_results = Vec::new();

        for ps in path_steps {
            let calc = calculate_step_prob_internal(conn, &ps.id, &ps.entity_type, project_id)?;
            cost_prob *= calc.cost_probability;
            path_step_results.push(PathStep {
                entity_id: ps.id.clone(),
                entity_type: ps.entity_type.clone(),
                name: ps.name.clone(),
                access_level: ps.access_level,
                skill_level: ps.skill_level,
                cost_probability: calc.cost_probability,
            });
        }

        let overall = if is_realistic {
            access_prob * cost_prob
        } else {
            0.0
        };

        result.push(AttackPath {
            path_id: format!("path-{}", idx + 1),
            goal_id: goal_id.to_string(),
            goal_name: goal_name.to_string(),
            steps: path_step_results,
            max_access_level: max_access,
            max_skill_level: max_skill,
            access_probability: access_prob,
            cost_probability: cost_prob,
            is_realistic,
            overall_probability: overall,
        });
    }

    // Sort by overall probability descending.
    result.sort_by(|a, b| {
        b.overall_probability
            .partial_cmp(&a.overall_probability)
            .unwrap()
    });

    Ok(result)
}

#[derive(Debug, Clone)]
struct PathStepInfo {
    id: String,
    entity_type: String,
    name: String,
    access_level: i32,
    skill_level: i32,
    conjunction: String,
}

struct ChildStep {
    id: String,
    name: String,
    access_level: i32,
    skill_level: i32,
    conjunction: String,
}

fn get_child_steps(
    conn: &rusqlite::Connection,
    parent_id: &str,
    parent_type: &str,
) -> Result<Vec<ChildStep>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, access_level, skill_level, conjunction FROM steps WHERE parent_id = ?1 AND parent_type = ?2 ORDER BY sort_order",
        )
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(params![parent_id, parent_type], |row| {
            Ok(ChildStep {
                id: row.get(0)?,
                name: row.get(1)?,
                access_level: row.get(2)?,
                skill_level: row.get(3)?,
                conjunction: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

fn get_child_categories(
    conn: &rusqlite::Connection,
    parent_id: &str,
    parent_type: &str,
) -> Result<Vec<(String,)>, String> {
    let mut stmt = conn
        .prepare("SELECT id FROM categories WHERE parent_id = ?1 AND parent_type = ?2 ORDER BY sort_order")
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(params![parent_id, parent_type], |row| {
            Ok((row.get::<_, String>(0)?,))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

fn collect_category_paths(
    conn: &rusqlite::Connection,
    project_id: &str,
    cat_id: &str,
    all_paths: &mut Vec<Vec<PathStepInfo>>,
) -> Result<(), String> {
    let steps = get_child_steps(conn, cat_id, "category")?;
    for step in &steps {
        let mut current_path = Vec::new();
        collect_leaf_paths(conn, project_id, step, &mut current_path, all_paths)?;
    }

    // Recurse into subcategories.
    let subcats = get_child_categories(conn, cat_id, "category")?;
    for (sub_id,) in &subcats {
        collect_category_paths(conn, project_id, sub_id, all_paths)?;
    }

    Ok(())
}

fn collect_leaf_paths(
    conn: &rusqlite::Connection,
    project_id: &str,
    step: &ChildStep,
    current_path: &mut Vec<PathStepInfo>,
    all_paths: &mut Vec<Vec<PathStepInfo>>,
) -> Result<(), String> {
    let info = PathStepInfo {
        id: step.id.clone(),
        entity_type: "step".to_string(),
        name: step.name.clone(),
        access_level: step.access_level,
        skill_level: step.skill_level,
        conjunction: step.conjunction.clone(),
    };
    current_path.push(info);

    // Get substeps.
    let substeps: Vec<(String, String, i32, i32, String)> = {
        let mut stmt = conn
            .prepare("SELECT id, name, access_level, skill_level, conjunction FROM substeps WHERE parent_step_id = ?1 ORDER BY sort_order")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![step.id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i32>(2)?,
                    row.get::<_, i32>(3)?,
                    row.get::<_, String>(4)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };

    // Get child steps (steps with parent_type='step').
    let child_steps = get_child_steps(conn, &step.id, "step")?;

    if substeps.is_empty() && child_steps.is_empty() {
        // This is a leaf node — record the path.
        all_paths.push(current_path.clone());
    } else {
        // Add substeps to the path.
        for (ss_id, ss_name, ss_access, ss_skill, ss_conj) in &substeps {
            let sub_info = PathStepInfo {
                id: ss_id.clone(),
                entity_type: "substep".to_string(),
                name: ss_name.clone(),
                access_level: *ss_access,
                skill_level: *ss_skill,
                conjunction: ss_conj.clone(),
            };
            let mut extended = current_path.clone();
            extended.push(sub_info);
            all_paths.push(extended);
        }

        // Recurse into child steps.
        for child in &child_steps {
            collect_leaf_paths(conn, project_id, child, current_path, all_paths)?;
        }

        // If there were substeps but no child steps, path was already recorded.
        // If no substeps but child steps exist, recursion handled it.
        // If both exist, both are recorded.
        if substeps.is_empty() && !child_steps.is_empty() {
            // Already handled by recursion.
        } else if !substeps.is_empty() && child_steps.is_empty() {
            // Already handled above.
        }
    }

    current_path.pop();
    Ok(())
}

/// Get the factor weights for a project, with defaults.
fn get_factor_weights(
    conn: &rusqlite::Connection,
    project_id: &str,
) -> Result<FactorWeights, String> {
    let json: String = conn
        .query_row(
            "SELECT factor_weights FROM projects WHERE id = ?1",
            params![project_id],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| {
            r#"{"time_effort":0.25,"exploitability":0.20,"window_of_opportunity":0.15,"detection_probability":0.15,"prior_knowledge":0.10,"preparation_effort":0.10,"abort_risk":0.05}"#.to_string()
        });

    serde_json::from_str(&json).map_err(|e| format!("Failed to parse factor weights: {}", e))
}

/// Get the access probabilities for a project, with defaults.
fn get_access_probabilities(
    conn: &rusqlite::Connection,
    project_id: &str,
) -> Result<HashMap<i32, f64>, String> {
    let json: String = conn
        .query_row(
            "SELECT access_probabilities FROM projects WHERE id = ?1",
            params![project_id],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| r#"{"1":0.9,"2":0.7,"3":0.5,"4":0.3,"5":0.1}"#.to_string());

    let map: HashMap<String, f64> =
        serde_json::from_str(&json).map_err(|e| format!("Failed to parse access probs: {}", e))?;

    Ok(map
        .into_iter()
        .filter_map(|(k, v)| k.parse::<i32>().ok().map(|k| (k, v)))
        .collect())
}

/// Compute aggregated probability for a parent node using AND/OR logic.
#[tauri::command]
pub fn calculate_aggregated_probability(
    db: State<'_, Database>,
    project_id: String,
    parent_id: String,
    parent_type: String, // "goal" | "category" | "step"
) -> Result<f64, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    calc_aggregated_internal(&conn, &project_id, &parent_id, &parent_type)
}

fn calc_aggregated_internal(
    conn: &rusqlite::Connection,
    project_id: &str,
    parent_id: &str,
    parent_type: &str,
) -> Result<f64, String> {
    let steps = get_child_steps(conn, parent_id, parent_type)?;

    if steps.is_empty() {
        return Ok(0.0);
    }

    // Determine conjunction from the first step (siblings share conjunction).
    let conjunction = &steps[0].conjunction;

    let mut probabilities: Vec<f64> = Vec::new();
    for step in &steps {
        let calc = calculate_step_prob_internal(conn, &step.id, "step", project_id)?;

        // Check if this step has children — if so, recurse.
        let child_steps = get_child_steps(conn, &step.id, "step")?;
        if !child_steps.is_empty() {
            let child_prob = calc_aggregated_internal(conn, project_id, &step.id, "step")?;
            probabilities.push(calc.cost_probability * child_prob);
        } else {
            probabilities.push(calc.cost_probability);
        }
    }

    let result = match conjunction.as_str() {
        "AND" => probabilities.iter().product(),
        "OR" | _ => probabilities.iter().cloned().fold(0.0_f64, f64::max),
    };

    Ok(result)
}
