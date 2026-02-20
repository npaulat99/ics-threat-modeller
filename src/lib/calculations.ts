// Client-side probability calculation utilities.
// Mirrors the Rust calculation logic for instant UI feedback.

import type { Assessment, FactorContribution, StepCalculation } from './types';
import { DEFAULT_FACTOR_WEIGHTS, type FactorName } from './types';

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
 * Calculate the cost value C(s_i) for a step based on its assessments.
 * C(s_i) = sum( w_j * v_j ) for all factors j.
 * Returns value in [0, 10].
 */
export function calculateCostValue(
  assessments: Assessment[],
  weights: Record<string, number>,
): { costValue: number; contributions: FactorContribution[] } {
  const contributions: FactorContribution[] = [];
  let totalWeighted = 0;
  let totalWeight = 0;

  for (const a of assessments) {
    const w = weights[a.factor_name] ?? 0.2;
    const weighted = w * a.factor_value;
    contributions.push({
      factor_name: a.factor_name,
      raw_value: a.factor_value,
      weight: w,
      weighted_value: weighted,
    });
    totalWeighted += weighted;
    totalWeight += w;
  }

  // Normalise if weights don't sum to 1.
  const costValue = totalWeight > 0 ? totalWeighted / totalWeight : 0;

  return { costValue: Math.min(10, Math.max(0, costValue)), contributions };
}

/**
 * Convert cost value to probability.
 * P_cost(s_i) = 1 - C(s_i) / 10
 * Higher cost → lower probability of success.
 */
export function costToProbability(costValue: number): number {
  return Math.max(0, Math.min(1, 1 - costValue / 10));
}

/**
 * Calculate step probability including all factors.
 */
export function calculateStepProbability(
  assessments: Assessment[],
  weights: Record<string, number>,
): StepCalculation {
  const { costValue, contributions } = calculateCostValue(assessments, weights);
  const probability = costToProbability(costValue);

  return {
    step_id: assessments.length > 0 ? assessments[0].step_id : '',
    step_name: '',
    cost_value: costValue,
    probability,
    factor_contributions: contributions,
  };
}

/**
 * Calculate path probability.
 * P(Path) = E_P * P_access * product(P_cost(s_i)) for all steps in path.
 */
export function calculatePathProbability(
  stepProbabilities: number[],
  accessProbability: number,
  entryPointProbability: number,
): number {
  const pathProduct = stepProbabilities.reduce((acc, p) => acc * p, 1);
  return entryPointProbability * accessProbability * pathProduct;
}

/**
 * Aggregate probabilities for a goal.
 * AND: product of all path probabilities.
 * OR: 1 - product(1 - P_i) for all paths.
 */
export function aggregateProbabilities(
  pathProbabilities: number[],
  aggregationType: 'and' | 'or',
): number {
  if (pathProbabilities.length === 0) return 0;

  if (aggregationType === 'and') {
    return pathProbabilities.reduce((acc, p) => acc * p, 1);
  } else {
    // OR: at least one path succeeds = 1 - product(1 - p_i)
    return 1 - pathProbabilities.reduce((acc, p) => acc * (1 - p), 1);
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
