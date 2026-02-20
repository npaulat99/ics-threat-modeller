// Tauri invoke wrappers for all backend commands.

import { invoke } from '@tauri-apps/api/core';
import type {
  Project, CreateProject, UpdateProject,
  AttackerProfile, CreateAttackerProfile, UpdateAttackerProfile,
  Goal, CreateGoal, UpdateGoal,
  Category, CreateCategory, UpdateCategory,
  Step, CreateStep, UpdateStep,
  Substep, CreateSubstep, UpdateSubstep,
  Countermeasure, CreateCountermeasure, UpdateCountermeasure,
  Weakness, CreateWeakness, UpdateWeakness,
  Assessment, CreateAssessment, UpdateAssessment, UpsertAssessment,
  StepCalculation, AttackPath,
  Tag, CreateTag,
  AttackTechniqueMapping, CreateTechniqueMapping,
  CatalogEntry, CreateCatalogEntry,
  Snapshot, CreateSnapshot, DiffResult,
  ChangeLogEntry,
} from './types';

// ─── Projects ───────────────────────────────────────────────────
export const createProject = (data: CreateProject) =>
  invoke<Project>('create_project', { data });

export const listProjects = () =>
  invoke<Project[]>('list_projects');

export const getProject = (id: string) =>
  invoke<Project>('get_project', { id });

export const updateProject = (data: UpdateProject) =>
  invoke<Project>('update_project', { data });

export const deleteProject = (id: string) =>
  invoke<void>('delete_project', { id });

// ─── Attacker Profiles ─────────────────────────────────────────
export const createAttackerProfile = (data: CreateAttackerProfile) =>
  invoke<AttackerProfile>('create_attacker_profile', { data });

export const listAttackerProfiles = (projectId: string) =>
  invoke<AttackerProfile[]>('list_attacker_profiles', { projectId });

export const getAttackerProfile = (id: string) =>
  invoke<AttackerProfile>('get_attacker_profile', { id });

export const updateAttackerProfile = (data: UpdateAttackerProfile) =>
  invoke<AttackerProfile>('update_attacker_profile', { data });

export const deleteAttackerProfile = (id: string) =>
  invoke<void>('delete_attacker_profile', { id });

// ─── Goals ──────────────────────────────────────────────────────
export const createGoal = (data: CreateGoal) =>
  invoke<Goal>('create_goal', { data });

export const listGoals = (projectId: string) =>
  invoke<Goal[]>('list_goals', { projectId });

export const getGoal = (id: string) =>
  invoke<Goal>('get_goal', { id });

export const updateGoal = (data: UpdateGoal) =>
  invoke<Goal>('update_goal', { data });

export const deleteGoal = (id: string) =>
  invoke<void>('delete_goal', { id });

// ─── Categories ─────────────────────────────────────────────────
export const createCategory = (data: CreateCategory) =>
  invoke<Category>('create_category', { data });

export const listCategories = (parentId: string, parentType: string) =>
  invoke<Category[]>('list_categories', { parentId, parentType });

export const getCategory = (id: string) =>
  invoke<Category>('get_category', { id });

export const updateCategory = (data: UpdateCategory) =>
  invoke<Category>('update_category', { data });

export const deleteCategory = (id: string) =>
  invoke<void>('delete_category', { id });

// ─── Steps ──────────────────────────────────────────────────────
export const createStep = (data: CreateStep) =>
  invoke<Step>('create_step', { data });

export const listSteps = (parentId: string, parentType: string) =>
  invoke<Step[]>('list_steps', { parentId, parentType });

export const getStep = (id: string) =>
  invoke<Step>('get_step', { id });

export const updateStep = (data: UpdateStep) =>
  invoke<Step>('update_step', { data });

export const deleteStep = (id: string) =>
  invoke<void>('delete_step', { id });

// ─── Substeps ───────────────────────────────────────────────────
export const createSubstep = (data: CreateSubstep) =>
  invoke<Substep>('create_substep', { data });

export const listSubsteps = (stepId: string) =>
  invoke<Substep[]>('list_substeps', { stepId });

export const getSubstep = (id: string) =>
  invoke<Substep>('get_substep', { id });

export const updateSubstep = (data: UpdateSubstep) =>
  invoke<Substep>('update_substep', { data });

export const deleteSubstep = (id: string) =>
  invoke<void>('delete_substep', { id });

// ─── Countermeasures ────────────────────────────────────────────
export const createCountermeasure = (data: CreateCountermeasure) =>
  invoke<Countermeasure>('create_countermeasure', { data });

export const listCountermeasures = (parentId: string, parentType: string) =>
  invoke<Countermeasure[]>('list_countermeasures', { parentId, parentType });

export const getCountermeasure = (id: string) =>
  invoke<Countermeasure>('get_countermeasure', { id });

export const updateCountermeasure = (data: UpdateCountermeasure) =>
  invoke<Countermeasure>('update_countermeasure', { data });

export const deleteCountermeasure = (id: string) =>
  invoke<void>('delete_countermeasure', { id });

// ─── Weaknesses ─────────────────────────────────────────────────
export const createWeakness = (data: CreateWeakness) =>
  invoke<Weakness>('create_weakness', { data });

export const listWeaknesses = (parentId: string, parentType: string) =>
  invoke<Weakness[]>('list_weaknesses', { parentId, parentType });

export const getWeakness = (id: string) =>
  invoke<Weakness>('get_weakness', { id });

export const updateWeakness = (data: UpdateWeakness) =>
  invoke<Weakness>('update_weakness', { data });

export const deleteWeakness = (id: string) =>
  invoke<void>('delete_weakness', { id });

// ─── Assessments ────────────────────────────────────────────────
export const createAssessment = (data: CreateAssessment) =>
  invoke<Assessment>('create_assessment', { data });

export const listAssessments = (stepId: string) =>
  invoke<Assessment[]>('list_assessments', { stepId });

export const getAssessment = (id: string) =>
  invoke<Assessment>('get_assessment', { id });

export const updateAssessment = (data: UpdateAssessment) =>
  invoke<Assessment>('update_assessment', { data });

export const deleteAssessment = (id: string) =>
  invoke<void>('delete_assessment', { id });

export const upsertAssessment = (data: UpsertAssessment) =>
  invoke<Assessment>('upsert_assessment', { data });

// ─── Calculations ───────────────────────────────────────────────
export const calculateStepProbability = (stepId: string, projectId: string) =>
  invoke<StepCalculation>('calculate_step_probability', { stepId, projectId });

export const calculateAttackPaths = (goalId: string, projectId: string) =>
  invoke<AttackPath[]>('calculate_attack_paths', { goalId, projectId });

export const calculateAggregatedProbability = (goalId: string, projectId: string) =>
  invoke<number>('calculate_aggregated_probability', { goalId, projectId });

// ─── Tags ───────────────────────────────────────────────────────
export const createTag = (data: CreateTag) =>
  invoke<Tag>('create_tag', { data });

export const listTags = (entityId: string, entityType: string) =>
  invoke<Tag[]>('list_tags', { entityId, entityType });

export const deleteTag = (id: string) =>
  invoke<void>('delete_tag', { id });

// ─── Technique Mappings ─────────────────────────────────────────
export const createTechniqueMapping = (data: CreateTechniqueMapping) =>
  invoke<AttackTechniqueMapping>('create_technique_mapping', { data });

export const listTechniqueMappings = (stepId: string) =>
  invoke<AttackTechniqueMapping[]>('list_technique_mappings', { stepId });

export const deleteTechniqueMapping = (id: string) =>
  invoke<void>('delete_technique_mapping', { id });

// ─── Catalog ────────────────────────────────────────────────────
export const listCatalogEntries = () =>
  invoke<CatalogEntry[]>('list_catalog_entries');

export const getCatalogEntry = (id: string) =>
  invoke<CatalogEntry>('get_catalog_entry', { id });

export const createCatalogEntry = (data: CreateCatalogEntry) =>
  invoke<CatalogEntry>('create_catalog_entry', { data });

export const updateCatalogEntry = (id: string, data: CreateCatalogEntry) =>
  invoke<CatalogEntry>('update_catalog_entry', { id, data });

export const deleteCatalogEntry = (id: string) =>
  invoke<void>('delete_catalog_entry', { id });

export const searchCatalog = (query: string) =>
  invoke<CatalogEntry[]>('search_catalog', { query });

export const importCatalogEntry = (catalogId: string, projectId: string) =>
  invoke<string>('import_catalog_entry', { catalogId, projectId });

export const seedCatalog = () =>
  invoke<number>('seed_catalog');

// ─── Export / Import ────────────────────────────────────────────
export const exportProjectJson = (projectId: string) =>
  invoke<string>('export_project_json', { projectId });

export const exportProjectYaml = (projectId: string) =>
  invoke<string>('export_project_yaml', { projectId });

export const exportProjectDirectory = (projectId: string) =>
  invoke<Record<string, string>>('export_project_directory', { projectId });

export const importProjectJson = (jsonData: string) =>
  invoke<string>('import_project_json', { jsonData });

export const importProjectYaml = (yamlData: string) =>
  invoke<string>('import_project_yaml', { yamlData });

// ─── Versioning ─────────────────────────────────────────────────
export const createSnapshot = (data: CreateSnapshot) =>
  invoke<Snapshot>('create_snapshot', { data });

export const listSnapshots = (projectId: string) =>
  invoke<Snapshot[]>('list_snapshots', { projectId });

export const getSnapshot = (id: string) =>
  invoke<Snapshot>('get_snapshot', { id });

export const restoreSnapshot = (snapshotId: string) =>
  invoke<string>('restore_snapshot', { snapshotId });

export const deleteSnapshot = (id: string) =>
  invoke<void>('delete_snapshot', { id });

export const compareSnapshots = (snapshotAId: string, snapshotBId: string) =>
  invoke<DiffResult>('compare_snapshots', { snapshotAId, snapshotBId });

export const logChange = (
  projectId: string,
  entityId: string,
  entityType: string,
  changeType: string,
  oldValue?: string,
  newValue?: string,
  author?: string,
  rationale?: string,
) =>
  invoke<void>('log_change', {
    projectId, entityId, entityType, changeType,
    oldValue: oldValue ?? null,
    newValue: newValue ?? null,
    author: author ?? null,
    rationale: rationale ?? null,
  });

export const getChangeLog = (projectId: string) =>
  invoke<ChangeLogEntry[]>('get_change_log', { projectId });
