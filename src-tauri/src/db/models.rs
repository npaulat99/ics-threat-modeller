// Data models — Rust structs for all database entities.
// Each struct derives Serialize + Deserialize for Tauri IPC and JSON/YAML export.

use serde::{Deserialize, Serialize};

// ─── Project ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: String,
    pub device_type: String,
    pub architecture: String,
    pub interfaces: String,       // JSON array
    pub assets: String,           // JSON array
    pub deployment_context: String, // JSON object
    pub factor_weights: String,   // JSON object
    pub access_probabilities: String, // JSON object
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProject {
    pub name: String,
    pub description: Option<String>,
    pub device_type: Option<String>,
    pub architecture: Option<String>,
    pub interfaces: Option<String>,
    pub assets: Option<String>,
    pub deployment_context: Option<String>,
    pub factor_weights: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProject {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub device_type: Option<String>,
    pub architecture: Option<String>,
    pub interfaces: Option<String>,
    pub assets: Option<String>,
    pub deployment_context: Option<String>,
    pub factor_weights: Option<String>,
    pub access_probabilities: Option<String>,
}

// ─── Goal ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Goal {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub description: String,
    pub impact_category: String,
    pub catalog_source_id: Option<String>,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGoal {
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
    pub impact_category: Option<String>,
    pub catalog_source_id: Option<String>,
}

// ─── Category ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub parent_id: String,
    pub parent_type: String,
    pub name: String,
    pub description: String,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCategory {
    pub parent_id: String,
    pub parent_type: String, // "goal" | "category"
    pub name: String,
    pub description: Option<String>,
}

// ─── Step ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Step {
    pub id: String,
    pub parent_id: String,
    pub parent_type: String,
    pub conjunction: String,
    pub name: String,
    pub description: String,
    pub access_level: i32,
    pub skill_level: i32,
    pub catalog_source_id: Option<String>,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateStep {
    pub parent_id: String,
    pub parent_type: String, // "goal" | "category" | "step"
    pub conjunction: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub access_level: Option<i32>,
    pub skill_level: Option<i32>,
    pub catalog_source_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStep {
    pub id: String,
    pub conjunction: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub access_level: Option<i32>,
    pub skill_level: Option<i32>,
    pub parent_id: Option<String>,
    pub parent_type: Option<String>,
    pub sort_order: Option<i32>,
}

// ─── Substep ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Substep {
    pub id: String,
    pub parent_step_id: String,
    pub conjunction: String,
    pub name: String,
    pub description: String,
    pub access_level: i32,
    pub skill_level: i32,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSubstep {
    pub parent_step_id: String,
    pub conjunction: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub access_level: Option<i32>,
    pub skill_level: Option<i32>,
}

// ─── Countermeasure ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Countermeasure {
    pub id: String,
    pub parent_id: String,
    pub parent_type: String,
    pub name: String,
    pub description: String,
    pub effectiveness: i32,
    pub implementation_cost: i32,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCountermeasure {
    pub parent_id: String,
    pub parent_type: String, // "step" | "substep"
    pub name: String,
    pub description: Option<String>,
    pub effectiveness: Option<i32>,
    pub implementation_cost: Option<i32>,
}

// ─── Weakness ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Weakness {
    pub id: String,
    pub parent_id: String,
    pub parent_type: String,
    pub name: String,
    pub description: String,
    pub severity: i32,
    pub cve_id: Option<String>,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateWeakness {
    pub parent_id: String,
    pub parent_type: String,
    pub name: String,
    pub description: Option<String>,
    pub severity: Option<i32>,
    pub cve_id: Option<String>,
}

// ─── Assessment ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Assessment {
    pub id: String,
    pub entity_id: String,
    pub entity_type: String,
    pub is_reference: bool,
    pub time_effort: Option<i32>,
    pub prior_knowledge: Option<i32>,
    pub exploitability: Option<i32>,
    pub window_of_opportunity: Option<i32>,
    pub detection_probability: Option<i32>,
    pub preparation_effort: Option<i32>,
    pub abort_risk: Option<i32>,
    pub rationale_json: String,
    pub override_rationale: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAssessment {
    pub entity_id: String,
    pub entity_type: String,
    pub is_reference: Option<bool>,
    pub time_effort: Option<i32>,
    pub prior_knowledge: Option<i32>,
    pub exploitability: Option<i32>,
    pub window_of_opportunity: Option<i32>,
    pub detection_probability: Option<i32>,
    pub preparation_effort: Option<i32>,
    pub abort_risk: Option<i32>,
    pub rationale_json: Option<String>,
    pub override_rationale: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAssessment {
    pub id: String,
    pub time_effort: Option<i32>,
    pub prior_knowledge: Option<i32>,
    pub exploitability: Option<i32>,
    pub window_of_opportunity: Option<i32>,
    pub detection_probability: Option<i32>,
    pub preparation_effort: Option<i32>,
    pub abort_risk: Option<i32>,
    pub rationale_json: Option<String>,
    pub override_rationale: Option<String>,
}

// ─── Attacker Profile ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttackerProfile {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub skill_level: i32,
    pub access_level: i32,
    pub description: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAttackerProfile {
    pub project_id: String,
    pub name: String,
    pub skill_level: Option<i32>,
    pub access_level: Option<i32>,
    pub description: Option<String>,
}

// ─── Attack Technique Mapping ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttackTechniqueMapping {
    pub id: String,
    pub entity_id: String,
    pub entity_type: String,
    pub framework: String,
    pub technique_id: String,
    pub technique_name: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAttackTechniqueMapping {
    pub entity_id: String,
    pub entity_type: String,
    pub framework: Option<String>,
    pub technique_id: String,
    pub technique_name: Option<String>,
}

// ─── Tag ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub entity_id: String,
    pub entity_type: String,
    pub key: String,
    pub value: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTag {
    pub entity_id: String,
    pub entity_type: String,
    pub key: String,
    pub value: String,
}

// ─── Catalog Entry ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogEntry {
    pub id: String,
    pub entry_type: String,
    pub name: String,
    pub description: String,
    pub tree_data: String,  // JSON
    pub source_framework: String,
    pub version: String,
    pub tags: String,       // JSON array
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCatalogEntry {
    pub name: String,
    pub description: Option<String>,
    pub tree_data: String,
    pub source_framework: Option<String>,
    pub version: Option<String>,
    pub tags: Option<String>,
}

// ─── Snapshot ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub snapshot_data: String, // JSON
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSnapshot {
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
    pub author: Option<String>,
}

// ─── Change Log Entry ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeLogEntry {
    pub id: String,
    pub project_id: String,
    pub entity_id: String,
    pub entity_type: String,
    pub change_type: String,
    pub old_value: Option<String>,
    pub new_value: Option<String>,
    pub author: String,
    pub rationale: Option<String>,
    pub created_at: String,
}

// ─── Calculation Results ───────────────────────────────────────────────────

/// Result of computing costs & probabilities for a single step/substep.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepCalculation {
    pub entity_id: String,
    pub entity_type: String,
    pub weighted_cost: f64,      // C(s_i) ∈ [1, 5]
    pub cost_probability: f64,   // P_cost(s_i) ∈ [0.2, 1.0]
    pub factor_contributions: Vec<FactorContribution>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FactorContribution {
    pub factor_name: String,
    pub value: i32,
    pub weight: f64,
    pub contribution: f64,
}

/// A single extractable attack path through the tree.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttackPath {
    pub path_id: String,
    pub goal_id: String,
    pub goal_name: String,
    pub steps: Vec<PathStep>,
    pub max_access_level: i32,
    pub max_skill_level: i32,
    pub access_probability: f64,   // P_access
    pub cost_probability: f64,     // P_cost(P) = product of step probabilities
    pub is_realistic: bool,        // E_P
    pub overall_probability: f64,  // P(P|A)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathStep {
    pub entity_id: String,
    pub entity_type: String,
    pub name: String,
    pub access_level: i32,
    pub skill_level: i32,
    pub cost_probability: f64,
}

// ─── Export/Import ─────────────────────────────────────────────────────────

/// Full project serialization for export.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectExport {
    pub project: Project,
    pub attacker_profiles: Vec<AttackerProfile>,
    pub goals: Vec<GoalExport>,
    pub catalog_sources: Vec<CatalogEntry>,
    pub change_log: Vec<ChangeLogEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoalExport {
    pub goal: Goal,
    pub categories: Vec<CategoryExport>,
    pub steps: Vec<StepExport>,
    pub technique_mappings: Vec<AttackTechniqueMapping>,
    pub tags: Vec<Tag>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryExport {
    pub category: Category,
    pub subcategories: Vec<CategoryExport>,
    pub steps: Vec<StepExport>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepExport {
    pub step: Step,
    pub substeps: Vec<SubstepExport>,
    pub countermeasures: Vec<Countermeasure>,
    pub weaknesses: Vec<Weakness>,
    pub assessments: Vec<Assessment>,
    pub technique_mappings: Vec<AttackTechniqueMapping>,
    pub tags: Vec<Tag>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubstepExport {
    pub substep: Substep,
    pub countermeasures: Vec<Countermeasure>,
    pub weaknesses: Vec<Weakness>,
    pub assessments: Vec<Assessment>,
    pub technique_mappings: Vec<AttackTechniqueMapping>,
    pub tags: Vec<Tag>,
}

// ─── Semantic Diff ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffResult {
    pub changes: Vec<DiffChange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffChange {
    pub entity_id: String,
    pub entity_type: String,
    pub entity_name: String,
    pub change_type: String, // "added" | "modified" | "removed"
    pub field_changes: Vec<FieldChange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldChange {
    pub field: String,
    pub old_value: Option<String>,
    pub new_value: Option<String>,
}
