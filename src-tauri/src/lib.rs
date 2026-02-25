// ICS Threat Modeller — Tauri Application Library

pub mod catalog;
pub mod commands;
pub mod db;

use db::Database;
use std::path::Path;

/// Build and configure the Tauri application.
pub fn run() {
    // Use /app/data/ directory if it exists (Docker volume mount), otherwise current directory.
    let db_path = if Path::new("/app/data").is_dir() {
        std::path::PathBuf::from("/app/data/ics_threat_modeller.db")
    } else {
        std::path::PathBuf::from("ics_threat_modeller.db")
    };
    let database = Database::open(&db_path).expect("Failed to open database");

    // Seed catalog on first run.
    {
        let conn = database.conn.lock().unwrap();
        commands::catalog::seed_catalog(&conn).ok();
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(database)
        .invoke_handler(tauri::generate_handler![
            // Projects
            commands::projects::create_project,
            commands::projects::list_projects,
            commands::projects::get_project,
            commands::projects::update_project,
            commands::projects::delete_project,
            // Attacker profiles
            commands::attacker_profiles::create_attacker_profile,
            commands::attacker_profiles::list_attacker_profiles,
            commands::attacker_profiles::get_attacker_profile,
            commands::attacker_profiles::update_attacker_profile,
            commands::attacker_profiles::delete_attacker_profile,
            // Goals
            commands::goals::create_goal,
            commands::goals::list_goals,
            commands::goals::get_goal,
            commands::goals::update_goal,
            commands::goals::delete_goal,
            // Categories
            commands::categories::create_category,
            commands::categories::list_categories,
            commands::categories::get_category,
            commands::categories::update_category,
            commands::categories::delete_category,
            // Steps
            commands::steps::create_step,
            commands::steps::list_steps,
            commands::steps::get_step,
            commands::steps::update_step,
            commands::steps::delete_step,
            commands::steps::delete_step_reparent,
            // Substeps
            commands::substeps::create_substep,
            commands::substeps::list_substeps,
            commands::substeps::get_substep,
            commands::substeps::update_substep,
            commands::substeps::delete_substep,
            // Countermeasures
            commands::countermeasures::create_countermeasure,
            commands::countermeasures::list_countermeasures,
            commands::countermeasures::get_countermeasure,
            commands::countermeasures::update_countermeasure,
            commands::countermeasures::delete_countermeasure,
            // Weaknesses
            commands::weaknesses::create_weakness,
            commands::weaknesses::list_weaknesses,
            commands::weaknesses::get_weakness,
            commands::weaknesses::update_weakness,
            commands::weaknesses::delete_weakness,
            // Assessments
            commands::assessments::create_assessment,
            commands::assessments::get_assessments,
            commands::assessments::update_assessment,
            commands::assessments::delete_assessment,
            commands::assessments::upsert_assessment,
            // Calculations
            commands::calculations::calculate_step_probability,
            commands::calculations::calculate_attack_paths,
            commands::calculations::calculate_aggregated_probability,
            // Tags
            commands::tags::create_tag,
            commands::tags::list_tags,
            commands::tags::delete_tag,
            commands::tags::create_technique_mapping,
            commands::tags::list_technique_mappings,
            commands::tags::delete_technique_mapping,
            // Catalog
            commands::catalog::list_catalog_entries,
            commands::catalog::get_catalog_entry,
            commands::catalog::create_catalog_entry,
            commands::catalog::update_catalog_entry,
            commands::catalog::delete_catalog_entry,
            commands::catalog::search_catalog,
            commands::catalog::import_catalog_entry,
            commands::catalog::seed_catalog_command,
            // Export / Import
            commands::export_import::export_project_json,
            commands::export_import::export_project_yaml,
            commands::export_import::export_project_directory,
            commands::export_import::import_project_json,
            commands::export_import::import_project_yaml,
            // Versioning
            commands::versioning::create_snapshot,
            commands::versioning::list_snapshots,
            commands::versioning::get_snapshot,
            commands::versioning::restore_snapshot,
            commands::versioning::delete_snapshot,
            commands::versioning::compare_snapshots,
            commands::versioning::log_change,
            commands::versioning::get_change_log,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}
