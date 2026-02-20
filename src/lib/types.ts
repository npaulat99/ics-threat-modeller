// TypeScript types matching Rust backend models.

// ─── Project ────────────────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  description: string;
  device_type: string;
  network_connectivity: string;
  firmware_update_mechanism: string;
  access_probability: number;
  entry_point_probability: number;
  factor_weights: string; // JSON string
  created_at: string;
  updated_at: string;
}

export interface CreateProject {
  name: string;
  description?: string;
  device_type?: string;
  network_connectivity?: string;
  firmware_update_mechanism?: string;
  access_probability?: number;
  entry_point_probability?: number;
  factor_weights?: string;
}

export interface UpdateProject {
  id: string;
  name?: string;
  description?: string;
  device_type?: string;
  network_connectivity?: string;
  firmware_update_mechanism?: string;
  access_probability?: number;
  entry_point_probability?: number;
  factor_weights?: string;
}

// ─── Attacker Profile ───────────────────────────────────────────
export interface AttackerProfile {
  id: string;
  project_id: string;
  name: string;
  description: string;
  motivation: string;
  capability_level: number;
  resources: string;
  created_at: string;
}

export interface CreateAttackerProfile {
  project_id: string;
  name: string;
  description?: string;
  motivation?: string;
  capability_level?: number;
  resources?: string;
}

export interface UpdateAttackerProfile {
  id: string;
  name?: string;
  description?: string;
  motivation?: string;
  capability_level?: number;
  resources?: string;
}

// ─── Goal ───────────────────────────────────────────────────────
export interface Goal {
  id: string;
  project_id: string;
  name: string;
  description: string;
  aggregation_type: string;
  sort_order: number;
  created_at: string;
}

export interface CreateGoal {
  project_id: string;
  name: string;
  description?: string;
  aggregation_type?: string;
  sort_order?: number;
}

export interface UpdateGoal {
  id: string;
  name?: string;
  description?: string;
  aggregation_type?: string;
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
}

export interface CreateCategory {
  parent_id: string;
  parent_type: string;
  name: string;
  description?: string;
  sort_order?: number;
}

export interface UpdateCategory {
  id: string;
  name?: string;
  description?: string;
  sort_order?: number;
}

// ─── Step ───────────────────────────────────────────────────────
export interface Step {
  id: string;
  parent_id: string;
  parent_type: string;
  name: string;
  description: string;
  is_leaf: boolean;
  conjunction: string;
  sort_order: number;
  created_at: string;
}

export interface CreateStep {
  parent_id: string;
  parent_type: string;
  name: string;
  description?: string;
  is_leaf?: boolean;
  conjunction?: string;
  sort_order?: number;
}

export interface UpdateStep {
  id: string;
  name?: string;
  description?: string;
  is_leaf?: boolean;
  conjunction?: string;
  sort_order?: number;
}

// ─── Substep ────────────────────────────────────────────────────
export interface Substep {
  id: string;
  step_id: string;
  name: string;
  description: string;
  sort_order: number;
  created_at: string;
}

export interface CreateSubstep {
  step_id: string;
  name: string;
  description?: string;
  sort_order?: number;
}

export interface UpdateSubstep {
  id: string;
  name?: string;
  description?: string;
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
  created_at: string;
}

export interface CreateCountermeasure {
  parent_id: string;
  parent_type: string;
  name: string;
  description?: string;
  effectiveness?: number;
}

export interface UpdateCountermeasure {
  id: string;
  name?: string;
  description?: string;
  effectiveness?: number;
}

// ─── Weakness ───────────────────────────────────────────────────
export interface Weakness {
  id: string;
  parent_id: string;
  parent_type: string;
  name: string;
  description: string;
  severity: number;
  created_at: string;
}

export interface CreateWeakness {
  parent_id: string;
  parent_type: string;
  name: string;
  description?: string;
  severity?: number;
}

export interface UpdateWeakness {
  id: string;
  name?: string;
  description?: string;
  severity?: number;
}

// ─── Assessment ─────────────────────────────────────────────────
export interface Assessment {
  id: string;
  step_id: string;
  factor_name: string;
  factor_value: number;
  rationale: string;
  is_reference: boolean;
  reference_step_id: string;
  created_at: string;
}

export interface CreateAssessment {
  step_id: string;
  factor_name: string;
  factor_value: number;
  rationale?: string;
  is_reference?: boolean;
  reference_step_id?: string;
}

export interface UpdateAssessment {
  id: string;
  factor_name?: string;
  factor_value?: number;
  rationale?: string;
  is_reference?: boolean;
  reference_step_id?: string;
}

export interface UpsertAssessment {
  step_id: string;
  factor_name: string;
  factor_value: number;
  rationale?: string;
}

// ─── Calculation Results ────────────────────────────────────────
export interface StepCalculation {
  step_id: string;
  step_name: string;
  cost_value: number;
  probability: number;
  factor_contributions: FactorContribution[];
}

export interface FactorContribution {
  factor_name: string;
  raw_value: number;
  weight: number;
  weighted_value: number;
}

export interface AttackPath {
  path_id: string;
  goal_id: string;
  goal_name: string;
  steps: PathStep[];
  path_probability: number;
  access_probability: number;
  entry_point_probability: number;
}

export interface PathStep {
  step_id: string;
  step_name: string;
  probability: number;
}

// ─── Tags ───────────────────────────────────────────────────────
export interface Tag {
  id: string;
  entity_id: string;
  entity_type: string;
  tag_name: string;
  tag_value: string;
  created_at: string;
}

export interface CreateTag {
  entity_id: string;
  entity_type: string;
  tag_name: string;
  tag_value?: string;
}

export interface AttackTechniqueMapping {
  id: string;
  step_id: string;
  technique_id: string;
  technique_name: string;
  source: string;
  created_at: string;
}

export interface CreateTechniqueMapping {
  step_id: string;
  technique_id: string;
  technique_name: string;
  source?: string;
}

// ─── Catalog ────────────────────────────────────────────────────
export interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: string;
  tree_data: string; // JSON blob
  source: string;
  created_at: string;
}

export interface CreateCatalogEntry {
  name: string;
  description?: string;
  category?: string;
  severity?: string;
  tree_data?: string;
  source?: string;
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
}

export interface GoalExport {
  goal: Goal;
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
  children: StepExport[];
}

export interface SubstepExport {
  substep: Substep;
  countermeasures: Countermeasure[];
  weaknesses: Weakness[];
}

// ─── Factor Definitions ─────────────────────────────────────────
export const DEFAULT_FACTORS = [
  'Elapsed Time',
  'Expertise',
  'Knowledge of Target',
  'Window of Opportunity',
  'Equipment',
] as const;

export type FactorName = (typeof DEFAULT_FACTORS)[number];

export const DEFAULT_FACTOR_WEIGHTS: Record<FactorName, number> = {
  'Elapsed Time': 0.2,
  'Expertise': 0.25,
  'Knowledge of Target': 0.2,
  'Window of Opportunity': 0.15,
  'Equipment': 0.2,
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
