// Svelte stores for application state.

import { writable, derived } from 'svelte/store';
import type {
  Project,
  Goal,
  Step,
  AttackerProfile,
  CatalogEntry,
  Snapshot,
  TreeNodeData,
} from './types';

// ─── Current project ───────────────────────────────────────────
export const currentProject = writable<Project | null>(null);
export const projects = writable<Project[]>([]);

// ─── Attack tree ────────────────────────────────────────────────
export const goals = writable<Goal[]>([]);
export const selectedNodeId = writable<string | null>(null);
export const selectedNodeType = writable<string | null>(null);
export const treeData = writable<TreeNodeData[]>([]);

// ─── Attacker profiles ─────────────────────────────────────────
export const attackerProfiles = writable<AttackerProfile[]>([]);

// ─── Catalog ────────────────────────────────────────────────────
export const catalogEntries = writable<CatalogEntry[]>([]);
export const catalogSearchQuery = writable<string>('');

// ─── Versioning ─────────────────────────────────────────────────
export const snapshots = writable<Snapshot[]>([]);

// ─── UI state ───────────────────────────────────────────────────
export const sidebarOpen = writable<boolean>(true);
export const activeTab = writable<string>('tree');
export const loading = writable<boolean>(false);
export const dragDropEnabled = writable<boolean>(true);
export const errorMessage = writable<string | null>(null);
export const successMessage = writable<string | null>(null);

// ─── Derived ────────────────────────────────────────────────────
export const hasProject = derived(currentProject, ($p) => $p !== null);
export const projectName = derived(currentProject, ($p) => $p?.name ?? '');

// ─── Helpers ────────────────────────────────────────────────────
export function setError(msg: string) {
  errorMessage.set(msg);
  setTimeout(() => errorMessage.set(null), 5000);
}

export function setSuccess(msg: string) {
  successMessage.set(msg);
  setTimeout(() => successMessage.set(null), 3000);
}

export function clearMessages() {
  errorMessage.set(null);
  successMessage.set(null);
}
