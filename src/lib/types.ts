// TypeScript types matching Rust backend models.
// Field names use snake_case to match Rust's serde serialization.

// ─── Project ────────────────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  description: string;
  device_type: string;
  architecture: string;
  interfaces: string;          // JSON array
  assets: string;              // JSON array
  deployment_context: string;  // JSON object
  factor_weights: string;      // JSON object
  access_probabilities: string; // JSON object
  created_at: string;
  updated_at: string;
}

export interface CreateProject {
  name: string;
  description?: string;
  device_type?: string;
  architecture?: string;
  interfaces?: string;
  assets?: string;
  deployment_context?: string;
  factor_weights?: string;
}

export interface UpdateProject {
  id: string;
  name?: string;
  description?: string;
  device_type?: string;
  architecture?: string;
  interfaces?: string;
  assets?: string;
  deployment_context?: string;
  factor_weights?: string;
  access_probabilities?: string;
}

// ─── Attacker Profile ───────────────────────────────────────────
export interface AttackerProfile {
  id: string;
  project_id: string;
  name: string;
  skill_level: number;
  access_level: number;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAttackerProfile {
  project_id: string;
  name: string;
  skill_level?: number;
  access_level?: number;
  description?: string;
}

// UpdateAttackerProfile — Rust command takes individual params, not a struct.
export interface UpdateAttackerProfile {
  id: string;
  name?: string;
  skill_level?: number;
  access_level?: number;
  description?: string;
}

// ─── Goal ───────────────────────────────────────────────────────
export interface Goal {
  id: string;
  project_id: string;
  name: string;
  description: string;
  impact_category: string;
  impact_scores: string;
  catalog_source_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateGoal {
  project_id: string;
  name: string;
  description?: string;
  impact_category?: string;
  impact_scores?: string;
  catalog_source_id?: string;
}

// UpdateGoal — Rust command takes individual params.
export interface UpdateGoal {
  id: string;
  name?: string;
  description?: string;
  impact_category?: string;
  impact_scores?: string;
  sort_order?: number;
}

// ─── Category ───────────────────────────────────────────────────
export interface Category {
  id: string;
  parent_id: string;
  parent_type: string;
  name: string;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCategory {
  parent_id: string;
  parent_type: string;  // "goal" | "category"
  name: string;
  description?: string;
}

// UpdateCategory — Rust command takes individual params.
export interface UpdateCategory {
  id: string;
  name?: string;
  description?: string;
  sort_order?: number;
  parent_id?: string;
  parent_type?: string;
}

// ─── Step ───────────────────────────────────────────────────────
export interface Step {
  id: string;
  parent_id: string;
  parent_type: string;
  conjunction: string;
  name: string;
  description: string;
  access_level: number;
  skill_level: number;
  catalog_source_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateStep {
  parent_id: string;
  parent_type: string;  // "goal" | "category" | "step"
  conjunction?: string;
  name: string;
  description?: string;
  access_level?: number;
  skill_level?: number;
  catalog_source_id?: string;
}

export interface UpdateStep {
  id: string;
  conjunction?: string;
  name?: string;
  description?: string;
  access_level?: number;
  skill_level?: number;
  parent_id?: string;
  parent_type?: string;
  sort_order?: number;
}

// ─── Substep ────────────────────────────────────────────────────
export interface Substep {
  id: string;
  parent_step_id: string;
  conjunction: string;
  name: string;
  description: string;
  access_level: number;
  skill_level: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSubstep {
  parent_step_id: string;
  conjunction?: string;
  name: string;
  description?: string;
  access_level?: number;
  skill_level?: number;
}

// UpdateSubstep — Rust command takes individual params.
export interface UpdateSubstep {
  id: string;
  conjunction?: string;
  name?: string;
  description?: string;
  access_level?: number;
  skill_level?: number;
  sort_order?: number;
}

// ─── Countermeasure ─────────────────────────────────────────────
export interface Countermeasure {
  id: string;
  parent_id: string;
  parent_type: string;
  name: string;
  description: string;
  effectiveness: number;
  implementation_cost: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCountermeasure {
  parent_id: string;
  parent_type: string;  // "step" | "substep"
  name: string;
  description?: string;
  effectiveness?: number;
  implementation_cost?: number;
}

// UpdateCountermeasure — Rust command takes individual params.
export interface UpdateCountermeasure {
  id: string;
  name?: string;
  description?: string;
  effectiveness?: number;
  implementation_cost?: number;
}

// ─── Weakness ───────────────────────────────────────────────────
export interface Weakness {
  id: string;
  parent_id: string;
  parent_type: string;
  name: string;
  description: string;
  severity: number;
  cve_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateWeakness {
  parent_id: string;
  parent_type: string;
  name: string;
  description?: string;
  severity?: number;
  cve_id?: string;
}

// UpdateWeakness — Rust command takes individual params.
export interface UpdateWeakness {
  id: string;
  name?: string;
  description?: string;
  severity?: number;
  cve_id?: string;
}

// ─── Assessment ─────────────────────────────────────────────────
export interface Assessment {
  id: string;
  entity_id: string;
  entity_type: string;
  is_reference: boolean;
  time_effort: number | null;
  prior_knowledge: number | null;
  exploitability: number | null;
  window_of_opportunity: number | null;
  detection_probability: number | null;
  preparation_effort: number | null;
  abort_risk: number | null;
  rationale_json: string;
  override_rationale: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAssessment {
  entity_id: string;
  entity_type: string;
  is_reference?: boolean;
  time_effort?: number;
  prior_knowledge?: number;
  exploitability?: number;
  window_of_opportunity?: number;
  detection_probability?: number;
  preparation_effort?: number;
  abort_risk?: number;
  rationale_json?: string;
  override_rationale?: string;
}

export interface UpdateAssessment {
  id: string;
  time_effort?: number;
  prior_knowledge?: number;
  exploitability?: number;
  window_of_opportunity?: number;
  detection_probability?: number;
  preparation_effort?: number;
  abort_risk?: number;
  rationale_json?: string;
  override_rationale?: string;
}

// ─── Calculation Results ────────────────────────────────────────
export interface StepCalculation {
  entity_id: string;
  entity_type: string;
  weighted_cost: number;       // C(s_i) ∈ [1, 5]
  cost_probability: number;    // P_cost(s_i) ∈ [0.2, 1.0]
  factor_contributions: FactorContribution[];
}

export interface FactorContribution {
  factor_name: string;
  value: number;
  weight: number;
  contribution: number;
}

export interface AttackPath {
  path_id: string;
  goal_id: string;
  goal_name: string;
  steps: PathStep[];
  max_access_level: number;
  max_skill_level: number;
  access_probability: number;
  cost_probability: number;
  is_realistic: boolean;
  overall_probability: number;
}

export interface PathStep {
  entity_id: string;
  entity_type: string;
  name: string;
  access_level: number;
  skill_level: number;
  cost_probability: number;
}

// ─── Tags ───────────────────────────────────────────────────────
export interface Tag {
  id: string;
  entity_id: string;
  entity_type: string;
  key: string;
  value: string;
  created_at: string;
}

export interface CreateTag {
  entity_id: string;
  entity_type: string;
  key: string;
  value: string;
}

export interface AttackTechniqueMapping {
  id: string;
  entity_id: string;
  entity_type: string;
  framework: string;
  technique_id: string;
  technique_name: string;
  created_at: string;
}

export interface CreateTechniqueMapping {
  entity_id: string;
  entity_type: string;
  framework?: string;
  technique_id: string;
  technique_name?: string;
}

// ─── Catalog ────────────────────────────────────────────────────
export interface CatalogEntry {
  id: string;
  entry_type: string;
  name: string;
  description: string;
  tree_data: string;         // JSON blob
  source_framework: string;
  version: string;
  tags: string;              // JSON array
  created_at: string;
  updated_at: string;
}

export interface CreateCatalogEntry {
  name: string;
  description?: string;
  tree_data: string;
  source_framework?: string;
  version?: string;
  tags?: string;
}

// ─── Versioning ─────────────────────────────────────────────────
export interface Snapshot {
  id: string;
  project_id: string;
  name: string;
  description: string;
  author: string;
  snapshot_data: string;
  created_at: string;
}

export interface CreateSnapshot {
  project_id: string;
  name: string;
  description?: string;
  author?: string;
}

export interface DiffResult {
  changes: DiffChange[];
}

export interface DiffChange {
  entity_id: string;
  entity_type: string;
  entity_name: string;
  change_type: string;
  field_changes: FieldChange[];
}

export interface FieldChange {
  field: string;
  old_value: string | null;
  new_value: string | null;
}

export interface ChangeLogEntry {
  id: string;
  project_id: string;
  entity_id: string;
  entity_type: string;
  change_type: string;
  old_value: string | null;
  new_value: string | null;
  author: string;
  rationale: string | null;
  created_at: string;
}

// ─── Export Types ────────────────────────────────────────────────
export interface ProjectExport {
  project: Project;
  attacker_profiles: AttackerProfile[];
  goals: GoalExport[];
  catalog_sources: CatalogEntry[];
  change_log: ChangeLogEntry[];
}

export interface GoalExport {
  goal: Goal;
  categories: CategoryExport[];
  steps: StepExport[];
  technique_mappings: AttackTechniqueMapping[];
  tags: Tag[];
}

export interface CategoryExport {
  category: Category;
  subcategories: CategoryExport[];
  steps: StepExport[];
}

export interface StepExport {
  step: Step;
  substeps: SubstepExport[];
  countermeasures: Countermeasure[];
  weaknesses: Weakness[];
  assessments: Assessment[];
  technique_mappings: AttackTechniqueMapping[];
  tags: Tag[];
}

export interface SubstepExport {
  substep: Substep;
  countermeasures: Countermeasure[];
  weaknesses: Weakness[];
  assessments: Assessment[];
  technique_mappings: AttackTechniqueMapping[];
  tags: Tag[];
}

// ─── Factor Definitions ─────────────────────────────────────────
// The 7 cost factors used by the Rust backend (scored 1–5 each).
export const DEFAULT_FACTORS = [
  'time_effort',
  'prior_knowledge',
  'exploitability',
  'window_of_opportunity',
  'detection_probability',
  'preparation_effort',
  'abort_risk',
] as const;

export type FactorName = (typeof DEFAULT_FACTORS)[number];

export const DEFAULT_FACTOR_WEIGHTS: Record<FactorName, number> = {
  time_effort: 0.25,
  prior_knowledge: 0.10,
  exploitability: 0.20,
  window_of_opportunity: 0.15,
  detection_probability: 0.15,
  preparation_effort: 0.10,
  abort_risk: 0.05,
};

// ─── Tree node for UI ───────────────────────────────────────────
export interface TreeNodeData {
  id: string;
  name: string;
  type: 'goal' | 'category' | 'step' | 'substep';
  children: TreeNodeData[];
  expanded?: boolean;
  data?: Goal | Category | Step | Substep;
}
