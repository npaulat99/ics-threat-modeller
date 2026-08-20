import type { AttackerProfile, Threat } from '../types';

export const SLC_ATTACKERS: Record<number, AttackerProfile> = {
    1: { id: 'ATK-SLC-1', name: 'Threat Actor 1: Casual or Coincidental Violation', capability: 1, motivation: 'Unintentional or accidental misconduct', resources: 'Normal operation and routine handling', text: 'SL-C 1 attacker profile managed by EmbedRisk.' },
    2: { id: 'ATK-SLC-2', name: 'Threat Actor 2: Simple Intentional Attacks', capability: 2, motivation: 'Intentional attack using simple means', resources: 'Low resources, general IT knowledge, low motivation', text: 'SL-C 2 attacker profile managed by EmbedRisk.' },
    3: { id: 'ATK-SLC-3', name: 'Threat Actor 3: Sophisticated ACS Attacks', capability: 3, motivation: 'Intentional sophisticated ACS attack', resources: 'Moderate resources, specific ACS expertise, moderate motivation', text: 'SL-C 3 attacker profile managed by EmbedRisk.' },
    4: { id: 'ATK-SLC-4', name: 'Threat Actor 4: State-Sponsored/Professional Attacks', capability: 5, motivation: 'Intentional highly sophisticated attack', resources: 'Extensive resources, deep ACS expertise, very high motivation', text: 'SL-C 4 attacker profile managed by EmbedRisk.' },
};

export function slcLevel(value?: string): number | null {
    const match = /(?:SL(?:-C)?\s*)?([1-4])/i.exec(value || '');
    return match ? Number(match[1]) : null;
}

export function attackerForSlc(value?: string): AttackerProfile | null {
    const level = slcLevel(value);
    return level ? SLC_ATTACKERS[level] : null;
}

export function syncThreatFeasibility(threat: Threat, capability: number): Threat {
    if (typeof threat.requiredSkill !== 'number') return threat;
    if (threat.requiredSkill > capability) return { ...threat, status: 'unfeasible' };
    return threat.status === 'unfeasible' ? { ...threat, status: 'open' } : threat;
}