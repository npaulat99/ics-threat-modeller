// Tauri invoke wrappers for all backend commands.
// Top-level invoke arguments use camelCase (Tauri auto-converts to snake_case).
// Struct fields within data objects use snake_case (matching Rust serde serialization).

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
  Assessment, CreateAssessment, UpdateAssessment,
  StepCalculation, AttackPath,
  Tag, CreateTag,
  AttackTechniqueMapping, CreateTechniqueMapping,
  CatalogEntry, CreateCatalogEntry,
  TagCatalogEntry, CreateTagCatalogEntry,
  Snapshot, CreateSnapshot, DiffResult,
  ChangeLogEntry,
  ProjectDirectoryInfo, CatalogRepoInfo, DataPaths,
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
  invoke<AttackerProfile>('update_attacker_profile', {
    id: data.id,
    name: data.name,
    skillLevel: data.skill_level,
    accessLevel: data.access_level,
    description: data.description,
    isActive: data.is_active,
    tag: data.tag,
  });

export const deleteAttackerProfile = (id: string) =>
  invoke<void>('delete_attacker_profile', { id });

// ─── Goals ──────────────────────────────────────────────────────
export const createGoal = (data: CreateGoal) =>
  invoke<Goal>('create_goal', { data });

export const listGoals = (projectId: string) =>
  invoke<Goal[]>('list_goals', { projectId });

export const getGoal = (id: string) =>
  invoke<Goal>('get_goal', { id });

// Rust takes individual params, not a struct.
export const updateGoal = (data: UpdateGoal) =>
  invoke<Goal>('update_goal', {
    id: data.id,
    name: data.name,
    description: data.description,
    impactCategory: data.impact_category,
    impactScores: data.impact_scores,
    sortOrder: data.sort_order,
  });

export const deleteGoal = (id: string) =>
  invoke<void>('delete_goal', { id });

// ─── Categories ─────────────────────────────────────────────────
export const createCategory = (data: CreateCategory) =>
  invoke<Category>('create_category', { data });

export const listCategories = (parentId: string, parentType: string) =>
  invoke<Category[]>('list_categories', { parentId, parentType });

export const getCategory = (id: string) =>
  invoke<Category>('get_category', { id });

// Rust takes individual params, not a struct.
export const updateCategory = (data: UpdateCategory) =>
  invoke<Category>('update_category', {
    id: data.id,
    name: data.name,
    description: data.description,
    sortOrder: data.sort_order,
    parentId: data.parent_id,
    parentType: data.parent_type,
  });

export const deleteCategory = (id: string) =>
  invoke<void>('delete_category', { id });

// ─── Steps ──────────────────────────────────────────────────────
export const createStep = (data: CreateStep) =>
  invoke<Step>('create_step', { data });

export const listSteps = (parentId: string, parentType: string) =>
  invoke<Step[]>('list_steps', { parentId, parentType });

export const getStep = (id: string) =>
  invoke<Step>('get_step', { id });

// Rust takes a data struct (UpdateStep).
export const updateStep = (data: UpdateStep) =>
  invoke<Step>('update_step', { data });

export const deleteStep = (id: string) =>
  invoke<void>('delete_step', { id });

export const deleteStepReparent = (id: string) =>
  invoke<void>('delete_step_reparent', { id });

// ─── Substeps ───────────────────────────────────────────────────
export const createSubstep = (data: CreateSubstep) =>
  invoke<Substep>('create_substep', { data });

export const listSubsteps = (parentStepId: string) =>
  invoke<Substep[]>('list_substeps', { parentStepId });

export const getSubstep = (id: string) =>
  invoke<Substep>('get_substep', { id });

// Rust takes individual params, not a struct.
export const updateSubstep = (data: UpdateSubstep) =>
  invoke<Substep>('update_substep', {
    id: data.id,
    conjunction: data.conjunction,
    name: data.name,
    description: data.description,
    accessLevel: data.access_level,
    skillLevel: data.skill_level,
    sortOrder: data.sort_order,
  });

export const deleteSubstep = (id: string) =>
  invoke<void>('delete_substep', { id });

// ─── Countermeasures ────────────────────────────────────────────
export const createCountermeasure = (data: CreateCountermeasure) =>
  invoke<Countermeasure>('create_countermeasure', { data });

export const listCountermeasures = (parentId: string, parentType: string) =>
  invoke<Countermeasure[]>('list_countermeasures', { parentId, parentType });

export const getCountermeasure = (id: string) =>
  invoke<Countermeasure>('get_countermeasure', { id });

// Rust takes individual params, not a struct.
export const updateCountermeasure = (data: UpdateCountermeasure) =>
  invoke<Countermeasure>('update_countermeasure', {
    id: data.id,
    name: data.name,
    description: data.description,
    effectiveness: data.effectiveness,
    implementationCost: data.implementation_cost,
  });

export const deleteCountermeasure = (id: string) =>
  invoke<void>('delete_countermeasure', { id });

// ─── Weaknesses ─────────────────────────────────────────────────
export const createWeakness = (data: CreateWeakness) =>
  invoke<Weakness>('create_weakness', { data });

export const listWeaknesses = (parentId: string, parentType: string) =>
  invoke<Weakness[]>('list_weaknesses', { parentId, parentType });

export const getWeakness = (id: string) =>
  invoke<Weakness>('get_weakness', { id });

// Rust takes individual params, not a struct.
export const updateWeakness = (data: UpdateWeakness) =>
  invoke<Weakness>('update_weakness', {
    id: data.id,
    name: data.name,
    description: data.description,
    severity: data.severity,
    cveId: data.cve_id,
  });

export const deleteWeakness = (id: string) =>
  invoke<void>('delete_weakness', { id });

// ─── Assessments ────────────────────────────────────────────────
export const createAssessment = (data: CreateAssessment) =>
  invoke<Assessment>('create_assessment', { data });

export const getAssessments = (entityId: string, entityType: string) =>
  invoke<Assessment[]>('get_assessments', { entityId, entityType });

export const updateAssessment = (data: UpdateAssessment) =>
  invoke<Assessment>('update_assessment', { data });

export const deleteAssessment = (id: string) =>
  invoke<void>('delete_assessment', { id });

// Upsert uses CreateAssessment struct (same as create).
export const upsertAssessment = (data: CreateAssessment) =>
  invoke<Assessment>('upsert_assessment', { data });

// ─── Calculations ───────────────────────────────────────────────
export const calculateStepProbability = (entityId: string, entityType: string, projectId: string) =>
  invoke<StepCalculation>('calculate_step_probability', { entityId, entityType, projectId });

export const calculateAttackPaths = (
  projectId: string,
  goalId: string,
  attackerSkill?: number,
  attackerAccess?: number,
) =>
  invoke<AttackPath[]>('calculate_attack_paths', {
    projectId, goalId, attackerSkill, attackerAccess,
  });

export const calculateAggregatedProbability = (projectId: string, parentId: string, parentType: string) =>
  invoke<number>('calculate_aggregated_probability', { projectId, parentId, parentType });

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

export const listTechniqueMappings = (entityId: string, entityType: string) =>
  invoke<AttackTechniqueMapping[]>('list_technique_mappings', { entityId, entityType });

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
  invoke<void>('seed_catalog_command');

// ─── Tag Catalog ────────────────────────────────────────────────
export const createTagCatalogEntry = (data: CreateTagCatalogEntry) =>
  invoke<TagCatalogEntry>('create_tag_catalog_entry', { data });

export const listTagCatalog = (category?: string) =>
  invoke<TagCatalogEntry[]>('list_tag_catalog', { category: category ?? null });

export const deleteTagCatalogEntry = (id: string) =>
  invoke<void>('delete_tag_catalog_entry', { id });

export const searchTagCatalog = (query: string, category?: string) =>
  invoke<TagCatalogEntry[]>('search_tag_catalog', { query, category: category ?? null });

export const seedTagCatalog = () =>
  invoke<void>('seed_tag_catalog_command');

// ─── Export / Import ────────────────────────────────────────────
export const exportProjectJson = (projectId: string) =>
  invoke<string>('export_project_json', { projectId });

export const exportProjectYaml = (projectId: string) =>
  invoke<string>('export_project_yaml', { projectId });

export const exportProjectDirectory = (projectId: string) =>
  invoke<string>('export_project_directory', { projectId });

export const importProjectJson = (jsonStr: string) =>
  invoke<string>('import_project_json', { jsonStr });

export const importProjectYaml = (yamlStr: string) =>
  invoke<string>('import_project_yaml', { yamlStr });

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

// ─── Filesystem / Git Workflow ──────────────────────────────────
export const saveProjectToDirectory = (projectId: string) =>
  invoke<string>('save_project_to_directory', { projectId });

export const loadProjectFromDirectory = (dirName: string) =>
  invoke<string>('load_project_from_directory', { dirName });

export const listProjectDirectories = () =>
  invoke<ProjectDirectoryInfo[]>('list_project_directories');

export const getCatalogRepoInfo = () =>
  invoke<CatalogRepoInfo>('get_catalog_repo_info');

export const syncCatalogFromRepo = () =>
  invoke<string>('sync_catalog_from_repo');

export const getDataPaths = () =>
  invoke<DataPaths>('get_data_paths');
