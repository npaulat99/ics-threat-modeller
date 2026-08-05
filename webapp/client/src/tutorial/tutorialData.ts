export interface TutorialStep {
    key:
    | 'project'
    | 'assumptions'
    | 'system'
    | 'dfd'
    | 'requirements'
    | 'threats'
    | 'attackTrees'
    | 'countermeasures'
    | 'defects';
    title: string;
    what: string;
    how: string;
    why: string;
    cursor: { x: number; y: number };
}

export const tutorialStorageKey = 'tra-tutorial-choice';

// Dedicated tutorial-only fixture data. This is not loaded from /projects and is never persisted
// into regular project artifacts.
export const tutorialExampleProject = {
    project: {
        title: 'Tutorial: Bottle-filling sensor',
        device: { name: 'Bottle sensor', type: 'field device' },
        slTarget: 'SL2',
    },
    assumptions: {
        device: [{ id: 'A-DEV-1', text: 'Firmware signing key remains protected.' }],
        system: [{ id: 'A-SYS-1', text: 'Plant VPN enforces operator identity.' }],
    },
};

export const tutorialRiskData = {
    threatId: 'T-1',
    threatTitle: 'Spoofed operator command over maintenance link',
    initialRisk: 16,
    residualRisk: 6,
    requirementId: 'REQ-3',
    countermeasureId: 'CM-2',
};

export const tutorialSteps: TutorialStep[] = [
    {
        key: 'project',
        title: '01 Project description',
        what: 'Define the device boundary and intended use.',
        how: 'Capture scope, lifecycle status, and security level target.',
        why: 'A precise scope prevents accidental blind spots later.',
        cursor: { x: 86, y: 62 },
    },
    {
        key: 'assumptions',
        title: '02 Assumptions',
        what: 'List trusted conditions and attacker baseline.',
        how: 'Record confidence and rationale for each assumption.',
        why: 'Assumptions make your risk reasoning auditable.',
        cursor: { x: 112, y: 112 },
    },
    {
        key: 'system',
        title: '03 System & assets',
        what: 'Model components, interfaces, trust boundaries, and assets.',
        how: 'Attach CIA+Safety objectives to business-relevant assets.',
        why: 'This connects architecture to measurable impact.',
        cursor: { x: 140, y: 160 },
    },
    {
        key: 'dfd',
        title: '04 DFD',
        what: 'Visualize data movement and trust crossings.',
        how: 'Lay out nodes/flows and inspect boundary crossings.',
        why: 'Flows reveal where attacker paths can emerge.',
        cursor: { x: 272, y: 168 },
    },
    {
        key: 'requirements',
        title: '05 Requirements',
        what: 'Define security requirements linked to threats.',
        how: 'Map each requirement to one or more motivating threats.',
        why: 'Traceability ties security intent to risk treatment.',
        cursor: { x: 220, y: 226 },
    },
    {
        key: 'threats',
        title: '06 Threats',
        what: 'Rate threats with STRIDE and likelihood/impact.',
        how: 'Use attacker exposure and exploitability factors.',
        why: 'Consistent ratings make decisions comparable over time.',
        cursor: { x: 300, y: 248 },
    },
    {
        key: 'attackTrees',
        title: '07 Attack trees',
        what: 'Decompose high-priority threats into attack paths.',
        how: 'Structure goals, steps, and defensive branches.',
        why: 'Tree depth clarifies where controls reduce risk fastest.',
        cursor: { x: 182, y: 286 },
    },
    {
        key: 'countermeasures',
        title: '08 Countermeasures',
        what: 'Select controls and estimate residual risk.',
        how: 'Link each control to addressed threats and requirements.',
        why: 'You can justify residual risk and sign-off decisions.',
        cursor: { x: 320, y: 302 },
    },
    {
        key: 'defects',
        title: '09 Defects',
        what: 'Track discovered vulnerabilities and reassessment points.',
        how: 'Tie defect state back to affected threats.',
        why: 'Lifecycle updates keep the TRA live after release.',
        cursor: { x: 94, y: 336 },
    },
];
