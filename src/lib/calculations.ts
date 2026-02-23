// Client-side probability calculation utilities.
// Mirrors the Rust calculation logic for instant UI feedback.

import type { FactorContribution, StepCalculation } from './types';
import { DEFAULT_FACTORS, DEFAULT_FACTOR_WEIGHTS, type FactorName } from './types';

/**
 * Parse factor weights from a project's factor_weights JSON string.
 */
export function parseFactorWeights(json: string): Record<string, number> {
  try {
    return JSON.parse(json);
  } catch {
    return { ...DEFAULT_FACTOR_WEIGHTS };
  }
}

/**
 * Calculate the weighted cost value C(s_i) from a map of factor values.
 * factorValues maps factor name → value (1–5, nullable).
 * C(s_i) = sum(w_j * v_j) / sum(w_j) for all non-null factors.
 * Returns value in [1, 5].
 */
export function calculateCostValue(
  factorValues: Record<string, number | null>,
  weights: Record<string, number>,
): { costValue: number; contributions: FactorContribution[] } {
  const contributions: FactorContribution[] = [];
  let totalWeighted = 0;
  let totalWeight = 0;

  for (const factor of DEFAULT_FACTORS) {
    const v = factorValues[factor];
    if (v == null) continue;
    const w = weights[factor] ?? (1 / 7);
    const c = w * v;
    contributions.push({
      factor_name: factor,
      value: v,
      weight: w,
      contribution: c,
    });
    totalWeighted += c;
    totalWeight += w;
  }

  // Normalise if weights don't sum to 1.
  const costValue = totalWeight > 0 ? totalWeighted / totalWeight : 1;

  return { costValue: Math.min(5, Math.max(1, costValue)), contributions };
}

/**
 * Convert cost value to probability.
 * P_cost(s_i) = (6 - C) / 5
 * Maps [1, 5] → [1.0, 0.2].  Higher cost → lower probability.
 */
export function costToProbability(costValue: number): number {
  return Math.max(0, Math.min(1, (6 - costValue) / 5));
}

/**
 * Calculate step probability including all factors.
 */
export function calculateStepProbability(
  entityId: string,
  entityType: string,
  factorValues: Record<string, number | null>,
  weights: Record<string, number>,
): StepCalculation {
  const { costValue, contributions } = calculateCostValue(factorValues, weights);
  const probability = costToProbability(costValue);

  return {
    entity_id: entityId,
    entity_type: entityType,
    weighted_cost: costValue,
    cost_probability: probability,
    factor_contributions: contributions,
  };
}

/**
 * Calculate path probability.
 * P(Path) = P_access * product(P_cost(s_i)) for all steps in path.
 */
export function calculatePathProbability(
  stepProbabilities: number[],
  accessProbability: number,
): number {
  const pathProduct = stepProbabilities.reduce((acc, p) => acc * p, 1);
  return accessProbability * pathProduct;
}

/**
 * Aggregate probabilities for a goal.
 * AND: product of all path probabilities.
 * OR: max of all path probabilities (matches Rust backend).
 */
export function aggregateProbabilities(
  pathProbabilities: number[],
  aggregationType: 'and' | 'or',
): number {
  if (pathProbabilities.length === 0) return 0;

  if (aggregationType === 'and') {
    return pathProbabilities.reduce((acc, p) => acc * p, 1);
  } else {
    // OR: max probability across all paths.
    return Math.max(...pathProbabilities);
  }
}

/**
 * Format probability as percentage string.
 */
export function formatProbability(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

/**
 * Get a severity label based on probability.
 */
export function getSeverityLabel(p: number): string {
  if (p >= 0.75) return 'Critical';
  if (p >= 0.5) return 'High';
  if (p >= 0.25) return 'Medium';
  return 'Low';
}

/**
 * Get a CSS colour class based on probability.
 */
export function getSeverityColor(p: number): string {
  if (p >= 0.75) return 'severity-critical';
  if (p >= 0.5) return 'severity-high';
  if (p >= 0.25) return 'severity-medium';
  return 'severity-low';
}
