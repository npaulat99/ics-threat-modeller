// File-system based project and catalog management.
// Reads catalog data from YAML files in a catalog-repo directory.
// Saves/loads projects to/from project directories for Git workflows.
//
// Directory layout:
//   /app/data/
//   ├── ics_threat_modeller.db
//   ├── catalog-repo/               ← clone a Git repo here
//   │   ├── catalog/                ← attack-tree catalog YAML files
//   │   │   ├── firmware-compromise.yaml
//   │   │   └── ...
//   │   └── tag-catalog/            ← tag suggestion YAML files
//   │       ├── assets.yaml
//   │       ├── interfaces.yaml
//   │       └── third-party-software.yaml
//   └── projects/                   ← each sub-dir can be a Git repo
//       └── my-project/
//           ├── meta.yaml
//           ├── project-export.yaml  ← combined file for reliable import
//           ├── attacker-profiles/
//           ├── goals/
//           └── ...

use crate::db::models::*;
use crate::db::Database;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::State;
use uuid::Uuid;

// ─── Path Helpers ──────────────────────────────────────────────

/// Base data directory. Uses /app/data inside Docker, otherwise cwd.
pub fn get_data_dir() -> PathBuf {
    if Path::new("/app/data").is_dir() {
        PathBuf::from("/app/data")
    } else {
        std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
    }
}

pub fn get_catalog_repo_dir() -> PathBuf {
    get_data_dir().join("catalog-repo")
}

pub fn get_projects_dir() -> PathBuf {
    get_data_dir().join("projects")
}

fn slugify(name: &str) -> String {
    let s: String = name
        .to_lowercase()
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' {
                c
            } else {
                '-'
            }
        })
        .collect();
    // Collapse multiple dashes and trim.
    let mut result = String::new();
    let mut prev_dash = false;
    for c in s.chars() {
        if c == '-' {
            if !prev_dash && !result.is_empty() {
                result.push('-');
            }
            prev_dash = true;
        } else {
            result.push(c);
            prev_dash = false;
        }
    }
    result.trim_end_matches('-').to_string()
}

// ═════════════════════════════════════════════════════════════════
// CATALOG REPO — Initialize and sync
// ═════════════════════════════════════════════════════════════════

/// Initialize catalog-repo directory with default YAML files if empty.
pub fn init_catalog_repo() -> Result<(), String> {
    let repo_dir = get_catalog_repo_dir();
    let catalog_dir = repo_dir.join("catalog");
    let tag_dir = repo_dir.join("tag-catalog");

    fs::create_dir_all(&catalog_dir).map_err(|e| format!("Failed to create catalog dir: {e}"))?;
    fs::create_dir_all(&tag_dir).map_err(|e| format!("Failed to create tag-catalog dir: {e}"))?;

    // Check if catalog already has YAML files.
    let has_catalog_files = fs::read_dir(&catalog_dir)
        .map(|rd| rd.filter_map(|e| e.ok()).any(|e| is_yaml_file(&e.path())))
        .unwrap_or(false);

    if has_catalog_files {
        return Ok(());
    }

    // Write default catalog entries.
    write_default_catalog_entries(&catalog_dir)?;
    write_default_tag_catalog(&tag_dir)?;

    Ok(())
}

fn is_yaml_file(path: &Path) -> bool {
    path.extension()
        .map(|ext| ext == "yaml" || ext == "yml")
        .unwrap_or(false)
}

fn write_default_catalog_entries(catalog_dir: &Path) -> Result<(), String> {
    let entries = crate::catalog::starter_data::get_starter_entries();

    for entry in &entries {
        let tree_data: serde_json::Value =
            serde_json::from_str(&entry.tree_data).unwrap_or_default();
        let tags: serde_json::Value = serde_json::from_str(&entry.tags).unwrap_or_default();

        let file_data = serde_json::json!({
            "name": entry.name,
            "description": entry.description,
            "entry_type": entry.entry_type,
            "source_framework": entry.source_framework,
            "version": entry.version,
            "tags": tags,
            "tree_data": tree_data,
        });

        let yaml = serde_yml::to_string(&file_data).map_err(|e| e.to_string())?;
        let filename = format!("{}.yaml", slugify(&entry.name));
        fs::write(catalog_dir.join(&filename), &yaml)
            .map_err(|e| format!("Failed to write {filename}: {e}"))?;
    }

    Ok(())
}

fn write_default_tag_catalog(tag_dir: &Path) -> Result<(), String> {
    let (assets, interfaces, third_party) = crate::commands::tag_catalog::get_default_tag_data();

    // assets.yaml
    let assets_data: Vec<serde_json::Value> = assets
        .iter()
        .map(|(name, desc)| serde_json::json!({ "name": name, "description": desc }))
        .collect();
    let yaml = serde_yml::to_string(&assets_data).map_err(|e| e.to_string())?;
    fs::write(tag_dir.join("assets.yaml"), yaml)
        .map_err(|e| format!("Failed to write assets.yaml: {e}"))?;

    // interfaces.yaml
    let iface_data: Vec<serde_json::Value> = interfaces
        .iter()
        .map(|(name, desc)| serde_json::json!({ "name": name, "description": desc }))
        .collect();
    let yaml = serde_yml::to_string(&iface_data).map_err(|e| e.to_string())?;
    fs::write(tag_dir.join("interfaces.yaml"), yaml)
        .map_err(|e| format!("Failed to write interfaces.yaml: {e}"))?;

    // third-party-software.yaml
    let tp_data: Vec<serde_json::Value> = third_party
        .iter()
        .map(|(name, desc)| serde_json::json!({ "name": name, "description": desc }))
        .collect();
    let yaml = serde_yml::to_string(&tp_data).map_err(|e| e.to_string())?;
    fs::write(tag_dir.join("third-party-software.yaml"), yaml)
        .map_err(|e| format!("Failed to write third-party-software.yaml: {e}"))?;

    Ok(())
}

// ─── Catalog Sync from Repo ────────────────────────────────────

/// Deserialization struct for catalog YAML files.
#[derive(Deserialize)]
struct CatalogFileEntry {
    name: String,
    description: String,
    entry_type: String,
    source_framework: String,
    version: String,
    tags: serde_json::Value,
    tree_data: serde_json::Value,
}

/// Load catalog entries from YAML files in catalog-repo/catalog/ and upsert into DB.
/// Entries in the DB that are not present in the YAML files are deleted.
/// The catalog-repo is the single source of truth.
pub fn sync_catalog_entries_from_repo(conn: &rusqlite::Connection) -> Result<usize, String> {
    let catalog_dir = get_catalog_repo_dir().join("catalog");
    if !catalog_dir.is_dir() {
        // No catalog directory — clear all catalog entries from DB.
        conn.execute("DELETE FROM catalog_entries", [])
            .map_err(|e| e.to_string())?;
        return Ok(0);
    }

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let mut count = 0;
    let mut synced_names: Vec<String> = Vec::new();

    let entries = fs::read_dir(&catalog_dir).map_err(|e| e.to_string())?;

    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if !is_yaml_file(&path) {
            continue;
        }

        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read {}: {e}", path.display()))?;

        let file_entry: CatalogFileEntry = serde_yml::from_str(&content)
            .map_err(|e| format!("Failed to parse {}: {e}", path.display()))?;

        let tree_data_str =
            serde_json::to_string(&file_entry.tree_data).map_err(|e| e.to_string())?;
        let tags_str = serde_json::to_string(&file_entry.tags).map_err(|e| e.to_string())?;

        synced_names.push(file_entry.name.clone());

        // Upsert by name: if entry with same name exists, update; otherwise insert.
        let existing_id: Option<String> = conn
            .query_row(
                "SELECT id FROM catalog_entries WHERE name = ?1",
                params![file_entry.name],
                |row| row.get(0),
            )
            .ok();

        if let Some(id) = existing_id {
            conn.execute(
                "UPDATE catalog_entries SET description = ?1, entry_type = ?2, tree_data = ?3, \
                 source_framework = ?4, version = ?5, tags = ?6, updated_at = ?7 WHERE id = ?8",
                params![
                    file_entry.description,
                    file_entry.entry_type,
                    tree_data_str,
                    file_entry.source_framework,
                    file_entry.version,
                    tags_str,
                    now,
                    id,
                ],
            )
            .map_err(|e| e.to_string())?;
        } else {
            let id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO catalog_entries (id, entry_type, name, description, tree_data, \
                 source_framework, version, tags, created_at, updated_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    id,
                    file_entry.entry_type,
                    file_entry.name,
                    file_entry.description,
                    tree_data_str,
                    file_entry.source_framework,
                    file_entry.version,
                    tags_str,
                    now,
                    now,
                ],
            )
            .map_err(|e| e.to_string())?;
        }

        count += 1;
    }

    // Delete catalog entries from DB that are no longer present in the YAML files.
    if synced_names.is_empty() {
        conn.execute("DELETE FROM catalog_entries", [])
            .map_err(|e| e.to_string())?;
    } else {
        let placeholders: Vec<String> = synced_names
            .iter()
            .enumerate()
            .map(|(i, _)| format!("?{}", i + 1))
            .collect();
        let sql = format!(
            "DELETE FROM catalog_entries WHERE name NOT IN ({})",
            placeholders.join(", ")
        );
        let params: Vec<&dyn rusqlite::types::ToSql> = synced_names
            .iter()
            .map(|s| s as &dyn rusqlite::types::ToSql)
            .collect();
        conn.execute(&sql, params.as_slice())
            .map_err(|e| e.to_string())?;
    }

    Ok(count)
}

/// Deserialization struct for tag catalog YAML files.
#[derive(Deserialize)]
struct TagCatalogFileEntry {
    name: String,
    description: String,
}

/// Load tag catalog entries from YAML files in catalog-repo/tag-catalog/ and upsert into DB.
/// Entries in the DB that are not present in the YAML files are deleted.
/// The catalog-repo is the single source of truth.
pub fn sync_tag_catalog_from_repo(conn: &rusqlite::Connection) -> Result<usize, String> {
    let tag_dir = get_catalog_repo_dir().join("tag-catalog");
    if !tag_dir.is_dir() {
        // No tag-catalog directory — clear all tag catalog entries from DB.
        conn.execute("DELETE FROM tag_catalog", [])
            .map_err(|e| e.to_string())?;
        return Ok(0);
    }

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let mut count = 0;
    // Track all (category, name) pairs that were synced so we can delete stale ones.
    let mut synced_pairs: Vec<(String, String)> = Vec::new();

    // Map filenames to categories.
    let category_files: Vec<(&str, &str)> = vec![
        ("assets.yaml", "asset"),
        ("assets.yml", "asset"),
        ("interfaces.yaml", "interface"),
        ("interfaces.yml", "interface"),
        ("third-party-software.yaml", "third_party_software"),
        ("third-party-software.yml", "third_party_software"),
    ];

    for (filename, category) in &category_files {
        let path = tag_dir.join(filename);
        if !path.exists() {
            continue;
        }

        let content =
            fs::read_to_string(&path).map_err(|e| format!("Failed to read {filename}: {e}"))?;

        let entries: Vec<TagCatalogFileEntry> = serde_yml::from_str(&content)
            .map_err(|e| format!("Failed to parse {filename}: {e}"))?;

        for entry in &entries {
            synced_pairs.push((category.to_string(), entry.name.clone()));

            // Upsert by (category, name).
            let existing_id: Option<String> = conn
                .query_row(
                    "SELECT id FROM tag_catalog WHERE category = ?1 AND name = ?2",
                    params![category, entry.name],
                    |row| row.get(0),
                )
                .ok();

            if let Some(id) = existing_id {
                conn.execute(
                    "UPDATE tag_catalog SET description = ?1 WHERE id = ?2",
                    params![entry.description, id],
                )
                .map_err(|e| e.to_string())?;
            } else {
                let id = Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT INTO tag_catalog (id, category, name, description, created_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![id, category, entry.name, entry.description, now],
                )
                .map_err(|e| e.to_string())?;
            }

            count += 1;
        }
    }

    // Delete tag catalog entries from DB that are no longer present in the YAML files.
    if synced_pairs.is_empty() {
        conn.execute("DELETE FROM tag_catalog", [])
            .map_err(|e| e.to_string())?;
    } else {
        // Build a WHERE clause that excludes all synced (category, name) pairs.
        let conditions: Vec<String> = synced_pairs
            .iter()
            .enumerate()
            .map(|(i, _)| format!("(category = ?{} AND name = ?{})", i * 2 + 1, i * 2 + 2))
            .collect();
        let sql = format!(
            "DELETE FROM tag_catalog WHERE NOT ({})",
            conditions.join(" OR ")
        );
        let params: Vec<&dyn rusqlite::types::ToSql> = synced_pairs
            .iter()
            .flat_map(|(cat, name)| {
                vec![
                    cat as &dyn rusqlite::types::ToSql,
                    name as &dyn rusqlite::types::ToSql,
                ]
            })
            .collect();
        conn.execute(&sql, params.as_slice())
            .map_err(|e| e.to_string())?;
    }

    Ok(count)
}

// ═════════════════════════════════════════════════════════════════
// PROJECT DIRECTORY — Save and Load
// ═════════════════════════════════════════════════════════════════

/// Info about a project directory.
#[derive(Debug, Clone, Serialize)]
pub struct ProjectDirectoryInfo {
    pub dir_name: String,
    pub project_name: String,
    pub last_modified: String,
    pub has_git: bool,
    pub has_export: bool,
    pub dir_path: String,
}

/// Info about the catalog repo directory.
#[derive(Debug, Clone, Serialize)]
pub struct CatalogRepoInfo {
    pub path: String,
    pub exists: bool,
    pub has_git: bool,
    pub catalog_file_count: usize,
    pub tag_catalog_file_count: usize,
}

/// Save a project to a directory under /app/data/projects/<dir_name>/.
/// If `dir_name` is provided, saves into that directory (allowing arbitrary repo names).
/// Otherwise falls back to a slugified version of the project name.
/// Writes individual YAML files (for Git readability) and a combined
/// project-export.yaml (for reliable import).
#[tauri::command]
pub fn save_project_to_directory(
    db: State<'_, Database>,
    project_id: String,
    dir_name: Option<String>,
) -> Result<String, String> {
    let export = super::export_import::build_project_export(&db, &project_id)?;
    let target_name = dir_name
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| slugify(&export.project.name));
    let project_dir = get_projects_dir().join(&target_name);

    fs::create_dir_all(&project_dir).map_err(|e| format!("Failed to create project dir: {e}"))?;

    // 1) Write combined project-export.yaml (source of truth for import).
    let combined_yaml = serde_yml::to_string(&export).map_err(|e| e.to_string())?;
    fs::write(project_dir.join("project-export.yaml"), &combined_yaml)
        .map_err(|e| format!("Failed to write project-export.yaml: {e}"))?;

    // 2) Write individual files (for Git-friendly diffs).
    write_project_individual_files(&export, &project_dir)?;

    Ok(project_dir.to_string_lossy().to_string())
}

/// Write individual YAML files for a project export.
fn write_project_individual_files(export: &ProjectExport, dir: &Path) -> Result<(), String> {
    // meta.yaml — project metadata with expanded JSON fields.
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
            "third_party_software": serde_json::from_str::<serde_json::Value>(&export.project.third_party_software).unwrap_or_default(),
            "created_at": export.project.created_at,
            "updated_at": export.project.updated_at,
        }
    });
    let meta_yaml = serde_yml::to_string(&meta).map_err(|e| e.to_string())?;
    fs::write(dir.join("meta.yaml"), meta_yaml)
        .map_err(|e| format!("Failed to write meta.yaml: {e}"))?;

    // Attacker profiles.
    if !export.attacker_profiles.is_empty() {
        let ap_dir = dir.join("attacker-profiles");
        fs::create_dir_all(&ap_dir).map_err(|e| e.to_string())?;
        for profile in &export.attacker_profiles {
            let yaml = serde_yml::to_string(profile).map_err(|e| e.to_string())?;
            fs::write(ap_dir.join(format!("profile-{}.yaml", profile.id)), yaml)
                .map_err(|e| e.to_string())?;
        }
    }

    // Goals.
    for goal_export in &export.goals {
        let goal_dir = dir.join("goals").join(&goal_export.goal.id);
        fs::create_dir_all(&goal_dir).map_err(|e| e.to_string())?;

        let goal_yaml = serde_yml::to_string(&goal_export.goal).map_err(|e| e.to_string())?;
        fs::write(goal_dir.join("goal.yaml"), goal_yaml).map_err(|e| e.to_string())?;

        // Steps under this goal.
        for step_export in &goal_export.steps {
            write_step_files(step_export, &goal_dir)?;
        }

        // Categories.
        for cat_export in &goal_export.categories {
            write_category_files(cat_export, &goal_dir)?;
        }
    }

    // Catalog sources.
    if !export.catalog_sources.is_empty() {
        let yaml = serde_yml::to_string(&export.catalog_sources).map_err(|e| e.to_string())?;
        fs::write(dir.join("catalog-sources.yaml"), yaml).map_err(|e| e.to_string())?;
    }

    // Change log.
    if !export.change_log.is_empty() {
        let yaml = serde_yml::to_string(&export.change_log).map_err(|e| e.to_string())?;
        fs::write(dir.join("changelog.yaml"), yaml).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn write_step_files(step_export: &StepExport, parent_dir: &Path) -> Result<(), String> {
    let step_dir = parent_dir.join("steps").join(&step_export.step.id);
    fs::create_dir_all(&step_dir).map_err(|e| e.to_string())?;

    // Step definition + assessments + tags + technique_mappings.
    let step_data = serde_json::json!({
        "step": step_export.step,
        "assessments": step_export.assessments,
        "technique_mappings": step_export.technique_mappings,
        "tags": step_export.tags,
    });
    let yaml = serde_yml::to_string(&step_data).map_err(|e| e.to_string())?;
    fs::write(step_dir.join("step.yaml"), yaml).map_err(|e| e.to_string())?;

    // Substeps.
    if !step_export.substeps.is_empty() {
        let ss_dir = step_dir.join("substeps");
        fs::create_dir_all(&ss_dir).map_err(|e| e.to_string())?;
        for ss in &step_export.substeps {
            let yaml = serde_yml::to_string(ss).map_err(|e| e.to_string())?;
            fs::write(ss_dir.join(format!("{}.yaml", ss.substep.id)), yaml)
                .map_err(|e| e.to_string())?;
        }
    }

    // Countermeasures.
    if !step_export.countermeasures.is_empty() {
        let cm_dir = step_dir.join("countermeasures");
        fs::create_dir_all(&cm_dir).map_err(|e| e.to_string())?;
        for cm in &step_export.countermeasures {
            let yaml = serde_yml::to_string(cm).map_err(|e| e.to_string())?;
            fs::write(cm_dir.join(format!("{}.yaml", cm.id)), yaml).map_err(|e| e.to_string())?;
        }
    }

    // Weaknesses.
    if !step_export.weaknesses.is_empty() {
        let w_dir = step_dir.join("weaknesses");
        fs::create_dir_all(&w_dir).map_err(|e| e.to_string())?;
        for w in &step_export.weaknesses {
            let yaml = serde_yml::to_string(w).map_err(|e| e.to_string())?;
            fs::write(w_dir.join(format!("{}.yaml", w.id)), yaml).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

fn write_category_files(cat_export: &CategoryExport, parent_dir: &Path) -> Result<(), String> {
    let cat_dir = parent_dir.join("categories");
    fs::create_dir_all(&cat_dir).map_err(|e| e.to_string())?;

    let yaml = serde_yml::to_string(&cat_export.category).map_err(|e| e.to_string())?;
    fs::write(
        cat_dir.join(format!("{}.yaml", cat_export.category.id)),
        yaml,
    )
    .map_err(|e| e.to_string())?;

    // Steps in this category.
    for step_export in &cat_export.steps {
        write_step_files(step_export, &cat_dir)?;
    }

    // Subcategories.
    for sub in &cat_export.subcategories {
        write_category_files(sub, &cat_dir)?;
    }

    Ok(())
}

/// Load a project from a directory into the database.
/// Reads the project-export.yaml combined file.
#[tauri::command]
pub fn load_project_from_directory(
    db: State<'_, Database>,
    dir_name: String,
) -> Result<String, String> {
    let project_dir = get_projects_dir().join(&dir_name);
    let export_file = project_dir.join("project-export.yaml");

    if !export_file.exists() {
        return Err(format!(
            "project-export.yaml not found in {}",
            project_dir.display()
        ));
    }

    let yaml_str = fs::read_to_string(&export_file)
        .map_err(|e| format!("Failed to read project-export.yaml: {e}"))?;

    let export: ProjectExport =
        serde_yml::from_str(&yaml_str).map_err(|e| format!("Invalid project-export.yaml: {e}"))?;

    super::export_import::import_project_data(&db, export)
}

/// List all project directories under /app/data/projects/.
#[tauri::command]
pub fn list_project_directories() -> Result<Vec<ProjectDirectoryInfo>, String> {
    let projects_dir = get_projects_dir();
    fs::create_dir_all(&projects_dir).map_err(|e| e.to_string())?;

    let mut dirs = Vec::new();

    let entries = fs::read_dir(&projects_dir).map_err(|e| e.to_string())?;
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let dir_name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        // Try to read project name from meta.yaml.
        let project_name = read_project_name_from_meta(&path).unwrap_or_else(|| dir_name.clone());

        let has_git = path.join(".git").exists();
        let has_export = path.join("project-export.yaml").exists();

        let last_modified = fs::metadata(&path)
            .and_then(|m| m.modified())
            .map(|t| {
                let dt: chrono::DateTime<chrono::Utc> = t.into();
                dt.format("%Y-%m-%d %H:%M:%S").to_string()
            })
            .unwrap_or_default();

        dirs.push(ProjectDirectoryInfo {
            dir_name,
            project_name,
            last_modified,
            has_git,
            has_export,
            dir_path: path.to_string_lossy().to_string(),
        });
    }

    // Sort by name.
    dirs.sort_by(|a, b| a.project_name.cmp(&b.project_name));

    Ok(dirs)
}

fn read_project_name_from_meta(dir: &Path) -> Option<String> {
    let meta_path = dir.join("meta.yaml");
    if !meta_path.exists() {
        return None;
    }
    let content = fs::read_to_string(&meta_path).ok()?;
    let value: serde_json::Value = serde_yml::from_str(&content).ok()?;
    value["project"]["name"].as_str().map(|s| s.to_string())
}

/// Get info about the catalog repo directory.
#[tauri::command]
pub fn get_catalog_repo_info() -> Result<CatalogRepoInfo, String> {
    let repo_dir = get_catalog_repo_dir();
    let catalog_dir = repo_dir.join("catalog");
    let tag_dir = repo_dir.join("tag-catalog");

    let catalog_count = if catalog_dir.is_dir() {
        fs::read_dir(&catalog_dir)
            .map(|rd| {
                rd.filter_map(|e| e.ok())
                    .filter(|e| is_yaml_file(&e.path()))
                    .count()
            })
            .unwrap_or(0)
    } else {
        0
    };

    let tag_count = if tag_dir.is_dir() {
        fs::read_dir(&tag_dir)
            .map(|rd| {
                rd.filter_map(|e| e.ok())
                    .filter(|e| is_yaml_file(&e.path()))
                    .count()
            })
            .unwrap_or(0)
    } else {
        0
    };

    Ok(CatalogRepoInfo {
        path: repo_dir.to_string_lossy().to_string(),
        exists: repo_dir.is_dir(),
        has_git: repo_dir.join(".git").exists(),
        catalog_file_count: catalog_count,
        tag_catalog_file_count: tag_count,
    })
}

/// Re-sync catalog entries from YAML files in catalog-repo/ into the database.
#[tauri::command]
pub fn sync_catalog_from_repo(db: State<'_, Database>) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let catalog_count = sync_catalog_entries_from_repo(&conn)?;
    let tag_count = sync_tag_catalog_from_repo(&conn)?;
    Ok(format!(
        "Synced {} catalog entries and {} tag catalog entries from repo.",
        catalog_count, tag_count
    ))
}

/// Internal wrapper for startup use (no Tauri State needed).
pub fn sync_all_from_repo(conn: &rusqlite::Connection) -> Result<(usize, usize), String> {
    let catalog_count = sync_catalog_entries_from_repo(conn)?;
    let tag_count = sync_tag_catalog_from_repo(conn)?;
    Ok((catalog_count, tag_count))
}

/// Get the filesystem paths info (for display in UI).
#[tauri::command]
pub fn get_data_paths() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "data_dir": get_data_dir().to_string_lossy(),
        "catalog_repo_dir": get_catalog_repo_dir().to_string_lossy(),
        "projects_dir": get_projects_dir().to_string_lossy(),
    }))
}
