// Dedicated, self-contained tutorial fixture. None of this data is loaded from /projects or
// persisted into real artifacts — it only drives the animated onboarding walkthrough.

export const tutorialStorageKey = 'tra-tutorial-choice';

/** A single cursor keyframe expressed in percent of the animation stage. */
export interface CursorKey {
    /** Normalized time within the step, 0..1. */
    t: number;
    /** Horizontal position, percent of stage width. */
    x: number;
    /** Vertical position, percent of stage height. */
    y: number;
    /** Emit a click pulse when the cursor reaches this key. */
    click?: boolean;
    /** Reveal progress to apply from this key onward (see screen renderers). */
    reveal?: number;
    /** Show a typing caret in the focused field around this key. */
    typing?: boolean;
}

export type ScreenKey =
    | 'intro'
    | 'project'
    | 'assumptions'
    | 'impact'
    | 'system'
    | 'assets'
    | 'dfd'
    | 'threats'
    | 'attacktree'
    | 'requirements'
    | 'countermeasures'
    | 'review'
    | 'outro';

export type NavKey =
    | 'project'
    | 'assumptions'
    | 'system'
    | 'dfd'
    | 'requirements'
    | 'threats'
    | 'attackTrees'
    | 'countermeasures'
    | 'review';

export interface TutorialStep {
    key: string;
    /** Original tool/step number shown in the interface, even when the tutorial order differs. */
    toolNum: string;
    /** Which methodology item is highlighted in the mock navigation. */
    navKey?: NavKey;
    screen: ScreenKey;
    title: string;
    /** Workshop phase this step belongs to. */
    phase: string;
    /** Typical (not mandatory) participants for this phase. */
    participants: string[];
    /** Iteration indicator, e.g. "First pass". */
    iteration?: string;
    what: string;
    why: string;
    /** Total animation duration in ms. */
    duration: number;
    path: CursorKey[];
}

// --- Realistic small OT example -------------------------------------------------------------
// FlowGuard FC-300: a connected flow controller in a drinking-water pump station. Small enough
// to follow, technically plausible (Modbus TCP, HART service port, cellular backhaul to a
// vendor cloud), and rich enough to show a full traceability chain.
export const tutorialProject = {
    title: 'FlowGuard FC-300 Smart Flow Controller',
    device: 'FC-300 controller',
    domain: 'Drinking-water pump station',
    slTarget: 'SL 2',
    status: 'In development',
};

export const tutorialAssumptions = [
    { id: 'A-01', tag: 'Deployment', text: 'Installed in a locked cabinet inside a fenced pump station.' },
    { id: 'A-02', tag: 'Network', text: 'Plant network is segmented; Modbus TCP is not internet-exposed.' },
    { id: 'A-03', tag: 'Trust', text: 'Vendor cloud link uses mutual TLS with per-device certificates.' },
    { id: 'A-04', tag: 'Attacker', text: 'Adversary can reach the HART service port during a maintenance visit.' },
];

export const tutorialImpacts = [
    { id: 'IMP-1', dim: 'Safety', text: 'Falsified flow readings cause chemical over-dosing.' },
    { id: 'IMP-2', dim: 'Availability', text: 'Loss of control halts the pump station for hours.' },
    { id: 'IMP-3', dim: 'Integrity', text: 'Fleet-wide firmware compromise via the vendor cloud.' },
];

export const tutorialAttackRoots = [
    { id: 'AT-1', text: 'Falsify the flow measurement shown to the SCADA operator', from: 'IMP-1' },
    { id: 'AT-2', text: 'Take over the controller remotely', from: 'IMP-3' },
];

export const tutorialComponents = [
    { id: 'C-MCU', name: 'Main controller (MCU)', zone: 'Device' },
    { id: 'C-MB', name: 'Modbus TCP interface', zone: 'Plant network' },
    { id: 'C-HART', name: 'HART service port', zone: 'Field / physical' },
    { id: 'C-CELL', name: 'Cellular backhaul modem', zone: 'Untrusted WAN' },
];

export const tutorialAssets = [
    { id: 'AS-FW', name: 'Firmware image', c: '–', i: 'High', a: 'Med', s: 'High' },
    { id: 'AS-CAL', name: 'Calibration parameters', c: 'Low', i: 'High', a: 'Med', s: 'High' },
    { id: 'AS-MEAS', name: 'Flow measurement data', c: 'Low', i: 'High', a: 'High', s: 'High' },
    { id: 'AS-CRED', name: 'Maintenance credentials', c: 'High', i: 'High', a: 'Low', s: '–' },
];

export const tutorialThreats = [
    { id: 'T-1', title: 'Spoofed flow values over Modbus TCP', stride: 'T · I', root: 'AT-1', l: 3, i: 5, risk: 15 },
    { id: 'T-2', title: 'Unauthenticated firmware update via HART port', stride: 'T · E', root: 'AT-2', l: 2, i: 5, risk: 10 },
    { id: 'T-3', title: 'Credential replay on maintenance session', stride: 'S', root: 'AT-2', l: 3, i: 4, risk: 12 },
];

export const tutorialRequirements = [
    { id: 'REQ-1', text: 'Sign and verify firmware images before activation.', rationale: 'Risk reduction · T-2' },
    { id: 'REQ-2', text: 'Authenticate Modbus writes with signed session tokens.', rationale: 'Risk reduction · T-1' },
    { id: 'REQ-3', text: 'Apply IEC 62443-4-2 CR 1.5 to the service port.', rationale: 'Standard compliance' },
];

export const tutorialCountermeasures = [
    { id: 'CM-1', text: 'Secure boot with signed firmware', threat: 'T-2', from: 10, to: 3 },
    { id: 'CM-2', text: 'Signed Modbus write tokens + rate limiting', threat: 'T-1', from: 15, to: 6 },
    { id: 'CM-3', text: 'Mutual auth + replay window on service port', threat: 'T-3', from: 12, to: 4 },
];

// The methodology navigation shown inside the mock window (mirrors the real StepNav numbering).
export const tutorialNav: { key: NavKey; num: string; label: string }[] = [
    { key: 'project', num: '01', label: 'Project' },
    { key: 'assumptions', num: '02', label: 'Assumptions' },
    { key: 'system', num: '03', label: 'System & Assets' },
    { key: 'dfd', num: '04', label: 'Data Flow Diagram' },
    { key: 'requirements', num: '05', label: 'Requirements' },
    { key: 'threats', num: '06', label: 'Threats' },
    { key: 'attackTrees', num: '07', label: 'Attack trees' },
    { key: 'countermeasures', num: '08', label: 'Countermeasures' },
    { key: 'review', num: '09', label: 'Review & Report' },
];

// Typical workshop sequence — shown as an example, explicitly not a mandatory process.
export const tutorialWorkshops = [
    { phase: 'Kickoff', focus: 'Scope and initial assumptions', who: 'Project lead · architect · facilitator' },
    { phase: 'Impact workshop', focus: 'Worst-case scenarios · attack-tree roots', who: 'Product owner · business · facilitator' },
    { phase: 'Technical modeling', focus: 'System, assets, DFD', who: 'Architects · developers · testers' },
    { phase: 'Threat analysis', focus: 'Threats · attack-tree refinement', who: 'Technical team · facilitator' },
    { phase: 'Requirements & mitigations', focus: 'Security requirements · controls', who: 'Technical team · product owner' },
    { phase: 'Review', focus: 'Validate risk, assumptions, decisions', who: 'Project stakeholders' },
];

// Nav-rail row centers (percent of stage height) used to steer the cursor to a step.
const NAV_Y: Record<NavKey, number> = {
    project: 26,
    assumptions: 32.5,
    system: 39,
    dfd: 45.5,
    requirements: 52,
    threats: 58.5,
    attackTrees: 65,
    countermeasures: 71.5,
    review: 78,
};
const NAV_X = 8.5;

export const tutorialSteps: TutorialStep[] = [
    {
        key: 'intro',
        toolNum: '',
        screen: 'intro',
        title: 'A realistic threat & risk analysis',
        phase: 'How to read this tutorial',
        participants: ['Project lead', 'Architects & developers', 'Business stakeholders', 'Security facilitator'],
        iteration: 'Iterative, not a one-way checklist',
        what: 'Watch an experienced team run an iterative TRA on a real connected field device.',
        why: 'A TRA is revisited across several workshops — assumptions, attack trees and requirements keep evolving.',
        duration: 3200,
        path: [
            { t: 0, x: 50, y: 20, reveal: 0 },
            { t: 0.5, x: 50, y: 46, reveal: 3 },
            { t: 1, x: 50, y: 60, reveal: 6 },
        ],
    },
    {
        key: 'project',
        toolNum: '01',
        navKey: 'project',
        screen: 'project',
        title: 'Kickoff — define the device boundary',
        phase: 'Kickoff',
        participants: ['Project lead', 'System architect', 'Security facilitator'],
        iteration: 'First pass',
        what: 'The team scopes the **FC-300** controller: intended use, lifecycle status and a security-level target.',
        why: 'A precise **scope** keeps later analysis focused and prevents blind spots.',
        duration: 4200,
        path: [
            { t: 0, x: 55, y: 12, reveal: 0 },
            { t: 0.18, x: NAV_X, y: NAV_Y.project, click: true, reveal: 0 },
            { t: 0.4, x: 46, y: 34, click: true, typing: true, reveal: 1 },
            { t: 0.62, x: 46, y: 48, typing: true, reveal: 2 },
            { t: 0.82, x: 46, y: 62, typing: true, reveal: 3 },
            { t: 0.95, x: 72, y: 82, click: true, reveal: 4 },
            { t: 1, x: 66, y: 78, reveal: 4 },
        ],
    },
    {
        key: 'assumptions',
        toolNum: '02',
        navKey: 'assumptions',
        screen: 'assumptions',
        title: 'Assumptions — a living artifact',
        phase: 'Kickoff → maintained throughout',
        participants: ['System architect', 'Security facilitator'],
        iteration: 'First pass · updated throughout the TRA',
        what: 'Deployment, network, trust and attacker **assumptions** are captured — and revisited as the analysis grows.',
        why: 'Assumptions make risk reasoning **auditable** and are refined whenever the picture changes.',
        duration: 4600,
        path: [
            { t: 0, x: 60, y: 14, reveal: 0 },
            { t: 0.16, x: NAV_X, y: NAV_Y.assumptions, click: true, reveal: 0 },
            { t: 0.34, x: 70, y: 22, click: true, reveal: 1 },
            { t: 0.52, x: 70, y: 22, click: true, reveal: 2 },
            { t: 0.7, x: 70, y: 22, click: true, reveal: 3 },
            { t: 0.88, x: 70, y: 22, click: true, reveal: 4 },
            { t: 1, x: 55, y: 40, reveal: 4 },
        ],
    },
    {
        key: 'impact',
        toolNum: '07',
        navKey: 'attackTrees',
        screen: 'impact',
        title: 'Impact workshop — worst-case first',
        phase: 'Impact workshop',
        participants: ['Product owner', 'Business / operations', 'Security facilitator'],
        iteration: 'First pass — only attack-tree roots are created here',
        what: 'Before any deep modeling, stakeholders name the **worst-case impacts** and turn them into attack-tree **root nodes**.',
        why: 'Starting from **impact** anchors the whole analysis on what actually matters to the business.',
        duration: 5000,
        path: [
            { t: 0, x: 55, y: 14, reveal: 0 },
            { t: 0.14, x: NAV_X, y: NAV_Y.attackTrees, click: true, reveal: 0 },
            { t: 0.34, x: 40, y: 34, click: true, reveal: 1 },
            { t: 0.5, x: 40, y: 44, click: true, reveal: 2 },
            { t: 0.66, x: 40, y: 54, click: true, reveal: 3 },
            { t: 0.84, x: 72, y: 40, click: true, reveal: 4 },
            { t: 1, x: 68, y: 58, reveal: 5 },
        ],
    },
    {
        key: 'system',
        toolNum: '03',
        navKey: 'system',
        screen: 'system',
        title: 'Technical modeling — components',
        phase: 'Technical modeling',
        participants: ['Architects', 'Developers', 'Testers'],
        iteration: 'Reveals new assumptions',
        what: 'Interfaces and zones are modeled: MCU, **Modbus TCP**, HART service port and the cellular backhaul.',
        why: 'Modeling the architecture exposes where **trust boundaries** are crossed — and often new assumptions.',
        duration: 4600,
        path: [
            { t: 0, x: 55, y: 14, reveal: 0 },
            { t: 0.16, x: NAV_X, y: NAV_Y.system, click: true, reveal: 0 },
            { t: 0.36, x: 72, y: 22, click: true, reveal: 1 },
            { t: 0.54, x: 72, y: 22, click: true, reveal: 2 },
            { t: 0.72, x: 72, y: 22, click: true, reveal: 3 },
            { t: 0.9, x: 72, y: 22, click: true, reveal: 4 },
            { t: 1, x: 55, y: 48, reveal: 4 },
        ],
    },
    {
        key: 'assets',
        toolNum: '03',
        navKey: 'system',
        screen: 'assets',
        title: 'Assets — connect impact to CIA + Safety',
        phase: 'Technical modeling',
        participants: ['Architects', 'Developers', 'Product owner'],
        iteration: 'Links back to the impact workshop',
        what: 'Business-relevant **assets** get **C/I/A + Safety** objectives — firmware, calibration, measurements, credentials.',
        why: 'Rating assets ties architecture to the **impacts** identified earlier.',
        duration: 4400,
        path: [
            { t: 0, x: 50, y: 16, reveal: 0 },
            { t: 0.2, x: 55, y: 30, click: true, reveal: 1 },
            { t: 0.42, x: 74, y: 40, click: true, reveal: 2 },
            { t: 0.64, x: 74, y: 50, click: true, reveal: 3 },
            { t: 0.86, x: 74, y: 60, click: true, reveal: 4 },
            { t: 1, x: 60, y: 55, reveal: 4 },
        ],
    },
    {
        key: 'dfd',
        toolNum: '04',
        navKey: 'dfd',
        screen: 'dfd',
        title: 'Data flow diagram — where paths emerge',
        phase: 'Technical modeling',
        participants: ['Architects', 'Developers'],
        iteration: 'Refined with the system model',
        what: 'Flows are drawn between the operator, the controller and the cloud, marking **trust-boundary crossings**.',
        why: 'Boundary crossings are exactly where **attacker paths** appear.',
        duration: 4800,
        path: [
            { t: 0, x: 55, y: 14, reveal: 0 },
            { t: 0.16, x: NAV_X, y: NAV_Y.dfd, click: true, reveal: 0 },
            { t: 0.38, x: 34, y: 38, click: true, reveal: 1 },
            { t: 0.58, x: 58, y: 42, click: true, reveal: 2 },
            { t: 0.8, x: 78, y: 60, click: true, reveal: 3 },
            { t: 1, x: 56, y: 52, reveal: 4 },
        ],
    },
    {
        key: 'threats',
        toolNum: '06',
        navKey: 'threats',
        screen: 'threats',
        title: 'Threat analysis — rate & link to impact',
        phase: 'Threat analysis',
        participants: ['Technical team', 'Security facilitator'],
        iteration: 'Connected back to impact scenarios',
        what: 'STRIDE threats are rated by **likelihood × impact** and linked to the attack-tree **roots**.',
        why: 'Linking threats to impact keeps priorities **comparable** and defensible.',
        duration: 5000,
        path: [
            { t: 0, x: 55, y: 14, reveal: 0 },
            { t: 0.16, x: NAV_X, y: NAV_Y.threats, click: true, reveal: 0 },
            { t: 0.4, x: 72, y: 22, click: true, reveal: 1 },
            { t: 0.62, x: 72, y: 22, click: true, reveal: 2 },
            { t: 0.84, x: 72, y: 22, click: true, reveal: 3 },
            { t: 1, x: 50, y: 46, reveal: 3 },
        ],
    },
    {
        key: 'attacktree',
        toolNum: '07',
        navKey: 'attackTrees',
        screen: 'attacktree',
        title: 'Attack trees — refined later',
        phase: 'Threat analysis',
        participants: ['Technical team', 'Security facilitator'],
        iteration: 'Refined later — technical branches added now',
        what: 'The root **AT-1** grows concrete branches: spoof Modbus, replay a session, tamper with calibration.',
        why: 'Depth shows **where controls cut risk fastest** — the roots came from the impact workshop.',
        duration: 5200,
        path: [
            { t: 0, x: 55, y: 14, reveal: 0 },
            { t: 0.14, x: NAV_X, y: NAV_Y.attackTrees, click: true, reveal: 1 },
            { t: 0.36, x: 46, y: 44, click: true, reveal: 2 },
            { t: 0.58, x: 66, y: 52, click: true, reveal: 3 },
            { t: 0.8, x: 46, y: 64, click: true, reveal: 4 },
            { t: 1, x: 58, y: 56, reveal: 4 },
        ],
    },
    {
        key: 'requirements',
        toolNum: '05',
        navKey: 'requirements',
        screen: 'requirements',
        title: 'Requirements — with a rationale',
        phase: 'Requirements & mitigations',
        participants: ['Technical team', 'Product owner'],
        iteration: 'Each requirement records why it exists',
        what: 'Security requirements are written with an explicit **rationale**: risk reduction or standard compliance.',
        why: 'Documented rationale keeps requirements **traceable** through later reassessment.',
        duration: 4600,
        path: [
            { t: 0, x: 55, y: 14, reveal: 0 },
            { t: 0.16, x: NAV_X, y: NAV_Y.requirements, click: true, reveal: 0 },
            { t: 0.42, x: 72, y: 22, click: true, reveal: 1 },
            { t: 0.66, x: 72, y: 22, click: true, reveal: 2 },
            { t: 0.9, x: 72, y: 22, click: true, reveal: 3 },
            { t: 1, x: 52, y: 44, reveal: 3 },
        ],
    },
    {
        key: 'countermeasures',
        toolNum: '08',
        navKey: 'countermeasures',
        screen: 'countermeasures',
        title: 'Mitigations — estimate residual risk',
        phase: 'Requirements & mitigations',
        participants: ['Technical team', 'Product owner'],
        iteration: 'Residual risk is estimated per control',
        what: 'Controls are selected and each threat’s **residual risk** is re-estimated — e.g. 15 → 6 for spoofed flow.',
        why: 'This justifies the **residual risk** and the sign-off decision.',
        duration: 4800,
        path: [
            { t: 0, x: 55, y: 14, reveal: 0 },
            { t: 0.16, x: NAV_X, y: NAV_Y.countermeasures, click: true, reveal: 0 },
            { t: 0.4, x: 40, y: 34, click: true, reveal: 1 },
            { t: 0.62, x: 40, y: 46, click: true, reveal: 2 },
            { t: 0.84, x: 40, y: 58, click: true, reveal: 3 },
            { t: 1, x: 70, y: 50, reveal: 3 },
        ],
    },
    {
        key: 'review',
        toolNum: '09',
        navKey: 'review',
        screen: 'review',
        title: 'Review — validate and revisit',
        phase: 'Review',
        participants: ['Project stakeholders'],
        iteration: 'Repeated after significant changes',
        what: 'Stakeholders validate risks, assumptions and decisions, then mark the TRA **reviewed**.',
        why: 'The review confirms the chain **asset → threat → requirement → control → residual risk**.',
        duration: 4600,
        path: [
            { t: 0, x: 55, y: 14, reveal: 0 },
            { t: 0.18, x: NAV_X, y: NAV_Y.review, click: true, reveal: 1 },
            { t: 0.5, x: 55, y: 40, reveal: 2 },
            { t: 0.82, x: 72, y: 80, click: true, reveal: 3 },
            { t: 1, x: 66, y: 76, reveal: 3 },
        ],
    },
    {
        key: 'outro',
        toolNum: '',
        screen: 'outro',
        title: 'A TRA is never truly finished',
        phase: 'Keep it alive',
        participants: ['Whole team', 'Revisited over the product lifecycle'],
        iteration: 'Revisit after significant changes',
        what: 'Assumptions evolve, attack trees are refined and requirements change as the product matures.',
        why: 'Revisit the TRA after **architecture changes, new interfaces, vulnerabilities or operational changes**.',
        duration: 3400,
        path: [
            { t: 0, x: 50, y: 22, reveal: 0 },
            { t: 0.5, x: 50, y: 46, reveal: 2 },
            { t: 1, x: 50, y: 62, reveal: 4 },
        ],
    },
];
