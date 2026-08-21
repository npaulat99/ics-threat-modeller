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
    | 'useCases'
    | 'requirements'
    | 'threats'
    | 'attackTrees'
    | 'countermeasures'
    | 'review'
    | 'versions';

export interface TutorialStep {
    key: string;
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
    slTarget: 'SL-C 2',
    status: 'In development',
};

export const tutorialAssumptions = [
    { id: 'A-01', tag: 'Deployment', text: 'Installed in a locked cabinet inside a fenced pump station.' },
    { id: 'A-02', tag: 'Network', text: 'Plant network is segmented; Modbus TCP is not internet-exposed.' },
    { id: 'A-03', tag: 'Trust', text: 'Vendor cloud link uses mutual TLS with per-device certificates.' },
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
    { id: 'REQ-1', text: 'The device shall support role-based operator accounts.', rationale: 'Project management', origin: 'pm' as const },
    { id: 'REQ-2', text: 'The controller shall verify a digital signature before activating firmware.', rationale: 'Implements CM-1', origin: 'cm' as const },
    { id: 'REQ-3', text: 'The controller shall reject unsigned Modbus write commands.', rationale: 'Implements CM-2', origin: 'cm' as const },
    { id: 'REQ-4', text: 'Maintenance access shall follow IEC 62443-4-2 CR 1.5.', rationale: 'Implements CM-3', origin: 'cm' as const },
];

export const tutorialCountermeasures = [
    { id: 'CM-1', text: 'Secure boot with signed firmware', threat: 'T-2', from: 10, to: 3, decision: 'implement' as const },
    { id: 'CM-2', text: 'Signed Modbus write tokens + rate limiting', threat: 'T-1', from: 15, to: 6, decision: 'implement' as const },
    { id: 'CM-3', text: 'Mutual auth + replay window on service port', threat: 'T-3', from: 12, to: 4, decision: 'implement' as const },
    { id: 'CM-4', text: 'Tamper-evident enclosure seal', threat: '—', from: 12, to: 12, decision: 'skip' as const },
];

// The methodology navigation shown inside the mock window (mirrors the real StepNav numbering).
export const tutorialNav: { key: NavKey; label: string }[] = [
    { key: 'project', label: 'Project' },
    { key: 'assumptions', label: 'Assumptions' },
    { key: 'system', label: 'System & Assets' },
    { key: 'dfd', label: 'Data Flow Diagram' },
    { key: 'useCases', label: '(Mis-)use cases' },
    { key: 'requirements', label: 'Requirements' },
    { key: 'threats', label: 'Threats' },
    { key: 'attackTrees', label: 'Attack trees' },
    { key: 'countermeasures', label: 'Countermeasures' },
    { key: 'review', label: 'Review & Report' },
    { key: 'versions', label: 'TRA Versions' },
];

// Typical workshop sequence — shown as an example, explicitly not a mandatory process.
export const tutorialWorkshops = [
    { phase: 'Kickoff', focus: 'Scope and initial assumptions', who: 'Project lead · architect · facilitator' },
    { phase: 'Impact workshop', focus: 'Worst-case scenarios · attack-tree roots', who: 'Product owner · business · facilitator' },
    { phase: 'Technical modeling', focus: 'System, assets, DFD · optional use cases', who: 'Architects · developers · testers' },
    { phase: 'Threat analysis', focus: 'Threats · attack-tree refinement', who: 'Technical team · facilitator' },
    { phase: 'Requirements → mitigations', focus: 'Capture requirements, then evaluate controls', who: 'Technical team · product owner' },
    { phase: 'Review and lifecycle', focus: 'Resolve findings · report · tag versions', who: 'Project stakeholders' },
];

// Cursor waypoints are in percent of the animation stage. Content is revealed on the click
// keyframes so that a click visibly adds the next row / fills the next field. The "+ Add"
// button sits at the panel's top-right; list rows appear below it.
const ADD_X = 90;
const ADD_Y = 14;

export const tutorialSteps: TutorialStep[] = [
    {
        key: 'intro',
        screen: 'intro',
        title: 'A realistic threat & risk analysis',
        phase: 'How to read this tutorial',
        participants: ['Project lead', 'Architects & developers', 'Business stakeholders', 'Security facilitator'],
        iteration: 'Iterative, not a one-way checklist',
        what: 'Watch an experienced team run an iterative TRA on a real connected field device. Use the live app from left to right, saving each step as you build the evidence.',
        why: 'A TRA is revisited across several workshops — assumptions, attack trees, requirements and risk decisions keep evolving.',
        duration: 3200,
        path: [
            { t: 0, x: 50, y: 20, reveal: 0 },
            { t: 0.5, x: 50, y: 46, reveal: 3 },
            { t: 1, x: 50, y: 60, reveal: 6 },
        ],
    },
    {
        key: 'project',
        navKey: 'project',
        screen: 'project',
        title: 'Kickoff — define the device boundary',
        phase: 'Kickoff',
        participants: ['Project lead', 'System architect', 'Security facilitator'],
        iteration: 'First pass',
        what: 'The team scopes the **FC-300** controller: intended use, lifecycle status and a security-level target.',
        why: 'A precise **scope** keeps later analysis focused and prevents blind spots.',
        duration: 4600,
        path: [
            { t: 0, x: 58, y: 16, reveal: 0 },
            { t: 0.24, x: 58, y: 22, click: true, typing: true, reveal: 1 },
            { t: 0.48, x: 58, y: 28, click: true, typing: true, reveal: 2 },
            { t: 0.72, x: 58, y: 34, click: true, typing: true, reveal: 3 },
            { t: 0.92, x: 29, y: 48, click: true, reveal: 4 },
            { t: 1, x: 33, y: 46, reveal: 4 },
        ],
    },
    {
        key: 'assumptions',
        navKey: 'assumptions',
        screen: 'assumptions',
        title: 'Assumptions — a living artifact',
        phase: 'Kickoff → maintained throughout',
        participants: ['System architect', 'Security facilitator'],
        iteration: 'First pass · updated throughout the TRA',
        what: 'Deployment, network and trust **assumptions** are captured — and revisited as the analysis grows. The attacker profile is supplied automatically by the selected **SL-C** level.',
        why: 'Assumptions make risk reasoning **auditable**, while the built-in SL-C attacker profile keeps likelihood ratings consistent.',
        duration: 4800,
        path: [
            { t: 0, x: 58, y: 14, reveal: 0 },
            { t: 0.22, x: ADD_X, y: ADD_Y, click: true, reveal: 1 },
            { t: 0.45, x: ADD_X, y: ADD_Y, click: true, reveal: 2 },
            { t: 0.68, x: ADD_X, y: ADD_Y, click: true, reveal: 3 },
            { t: 0.9, x: 60, y: 40, reveal: 3 },
            { t: 1, x: 60, y: 40, reveal: 3 },
        ],
    },
    {
        key: 'impact',
        navKey: 'attackTrees',
        screen: 'impact',
        title: 'Impact workshop — worst-case first',
        phase: 'Impact workshop',
        participants: ['Product owner', 'Business / operations', 'Security facilitator'],
        iteration: 'First pass — only attack-tree roots are created here',
        what: 'Before any deep modeling, stakeholders name the **worst-case impacts** and turn them into attack-tree **root nodes**.',
        why: 'Starting from **impact** anchors the whole analysis on what actually matters to the business.',
        duration: 5200,
        path: [
            { t: 0, x: 55, y: 14, reveal: 0 },
            { t: 0.2, x: 30, y: 34, click: true, reveal: 1 },
            { t: 0.38, x: 30, y: 45, click: true, reveal: 2 },
            { t: 0.55, x: 30, y: 56, click: true, reveal: 3 },
            { t: 0.76, x: ADD_X, y: ADD_Y, click: true, reveal: 4 },
            { t: 0.93, x: ADD_X, y: ADD_Y, click: true, reveal: 5 },
            { t: 1, x: 74, y: 40, reveal: 5 },
        ],
    },
    {
        key: 'system',
        navKey: 'system',
        screen: 'system',
        title: 'Technical modeling — components',
        phase: 'Technical modeling',
        participants: ['Architects', 'Developers', 'Testers'],
        iteration: 'Reveals new assumptions',
        what: 'Interfaces and zones are modeled: MCU, **Modbus TCP**, HART service port and the cellular backhaul.',
        why: 'Modeling the architecture exposes where **trust boundaries** are crossed — and often new assumptions.',
        duration: 4800,
        path: [
            { t: 0, x: 58, y: 14, reveal: 0 },
            { t: 0.24, x: ADD_X, y: ADD_Y, click: true, reveal: 1 },
            { t: 0.46, x: ADD_X, y: ADD_Y, click: true, reveal: 2 },
            { t: 0.68, x: ADD_X, y: ADD_Y, click: true, reveal: 3 },
            { t: 0.9, x: ADD_X, y: ADD_Y, click: true, reveal: 4 },
            { t: 1, x: 60, y: 46, reveal: 4 },
        ],
    },
    {
        key: 'assets',
        navKey: 'system',
        screen: 'assets',
        title: 'Assets — connect impact to CIA + Safety',
        phase: 'Technical modeling',
        participants: ['Architects', 'Developers', 'Product owner'],
        iteration: 'Links back to the impact workshop',
        what: 'Business-relevant **assets** get **C/I/A + Safety** objectives — firmware, calibration, measurements, credentials.',
        why: 'Rating assets ties architecture to the **impacts** identified earlier.',
        duration: 4800,
        path: [
            { t: 0, x: 58, y: 14, reveal: 0 },
            { t: 0.24, x: ADD_X, y: ADD_Y, click: true, reveal: 1 },
            { t: 0.46, x: ADD_X, y: ADD_Y, click: true, reveal: 2 },
            { t: 0.68, x: ADD_X, y: ADD_Y, click: true, reveal: 3 },
            { t: 0.9, x: ADD_X, y: ADD_Y, click: true, reveal: 4 },
            { t: 1, x: 60, y: 50, reveal: 4 },
        ],
    },
    {
        key: 'dfd',
        navKey: 'dfd',
        screen: 'dfd',
        title: 'Data flow diagram — where paths emerge',
        phase: 'Technical modeling',
        participants: ['Architects', 'Developers'],
        iteration: 'Refined with the system model',
        what: 'Flows are drawn between the operator, the controller and the vendor cloud, marking the **trust boundary** they cross.',
        why: 'Boundary crossings are exactly where **attacker paths** appear.',
        duration: 5200,
        path: [
            { t: 0, x: 22, y: 34, reveal: 0 },
            { t: 0.3, x: 34, y: 62, click: true, reveal: 1 },
            { t: 0.6, x: 60, y: 50, click: true, reveal: 2 },
            { t: 0.86, x: 62, y: 40, click: true, reveal: 3 },
            { t: 1, x: 52, y: 50, reveal: 3 },
        ],
    },
    {
        key: 'threats',
        navKey: 'threats',
        screen: 'threats',
        title: 'Threat analysis — rate & link to impact',
        phase: 'Threat analysis',
        participants: ['Technical team', 'Security facilitator'],
        iteration: 'Connected back to impact scenarios',
        what: 'STRIDE threats are rated and linked to affected components, interfaces, assets, requirements and attack-tree **roots**.',
        why: 'Use the configured scoring method — **Exposure × Exploitability × Impact** or **cost-based** — so priorities remain comparable and defensible.',
        duration: 5000,
        path: [
            { t: 0, x: 58, y: 14, reveal: 0 },
            { t: 0.3, x: ADD_X, y: ADD_Y, click: true, reveal: 1 },
            { t: 0.58, x: ADD_X, y: ADD_Y, click: true, reveal: 2 },
            { t: 0.86, x: ADD_X, y: ADD_Y, click: true, reveal: 3 },
            { t: 1, x: 55, y: 44, reveal: 3 },
        ],
    },
    {
        key: 'attacktree',
        navKey: 'attackTrees',
        screen: 'attacktree',
        title: 'Attack trees — refined later',
        phase: 'Threat analysis',
        participants: ['Technical team', 'Security facilitator'],
        iteration: 'Refined later — technical branches added now',
        what: 'The root **AT-1** grows concrete branches: spoof Modbus, replay a session, tamper with calibration.',
        why: 'Depth shows **where controls cut risk fastest** — the roots came from the impact workshop.',
        duration: 5000,
        path: [
            { t: 0, x: 55, y: 16, reveal: 1 },
            { t: 0.3, x: ADD_X, y: ADD_Y, click: true, reveal: 2 },
            { t: 0.58, x: ADD_X, y: ADD_Y, click: true, reveal: 3 },
            { t: 0.86, x: ADD_X, y: ADD_Y, click: true, reveal: 4 },
            { t: 1, x: 55, y: 58, reveal: 4 },
        ],
    },
    {
        key: 'countermeasures',
        navKey: 'countermeasures',
        screen: 'countermeasures',
        title: 'Mitigations — evaluate before implementing',
        phase: 'Mitigations → requirements',
        participants: ['Technical team', 'Security facilitator'],
        iteration: 'Implement a control only if it reduces real risk',
        what: 'Each control is evaluated by its **residual risk** against the linked threats. Select controls that reduce real risk, record their status and link the requirements they satisfy — CM-4 adds no value, so it is **skipped**.',
        why: 'Choosing controls based on residual risk keeps treatment proportionate, traceable and defensible.',
        duration: 5200,
        path: [
            { t: 0, x: 55, y: 16, reveal: 0 },
            { t: 0.22, x: 88, y: 25, click: true, reveal: 1 },
            { t: 0.44, x: 88, y: 33, click: true, reveal: 2 },
            { t: 0.66, x: 88, y: 40, click: true, reveal: 3 },
            { t: 0.88, x: 88, y: 48, click: true, reveal: 4 },
            { t: 1, x: 66, y: 42, reveal: 4 },
        ],
    },
    {
        key: 'requirements',
        navKey: 'requirements',
        screen: 'requirements',
        title: 'Requirements — derived from decisions',
        phase: 'Requirements → mitigations',
        participants: ['Technical team', 'Product owner'],
        iteration: 'Two origins: project management or a chosen control',
        what: 'Capture testable security requirements from **project management / compliance**, threats and the security context. Choosing a countermeasure can also create an **is CM** requirement automatically.',
        why: 'Linking requirements to threats and controls keeps the chain **traceable** through implementation and later reassessment.',
        duration: 5000,
        path: [
            { t: 0, x: 58, y: 14, reveal: 0 },
            { t: 0.24, x: ADD_X, y: ADD_Y, click: true, reveal: 1 },
            { t: 0.46, x: ADD_X, y: ADD_Y, click: true, reveal: 2 },
            { t: 0.68, x: ADD_X, y: ADD_Y, click: true, reveal: 3 },
            { t: 0.9, x: ADD_X, y: ADD_Y, click: true, reveal: 4 },
            { t: 1, x: 60, y: 46, reveal: 4 },
        ],
    },
    {
        key: 'review',
        navKey: 'review',
        screen: 'review',
        title: 'Review — validate and revisit',
        phase: 'Review',
        participants: ['Project stakeholders'],
        iteration: 'Repeated after significant changes',
        what: 'Resolve plausibility findings, review classifications and residual risks, then generate the report and export traceability data.',
        why: 'The review confirms the chain **asset → threat → requirement → countermeasure → residual risk** and makes exceptions explicit.',
        duration: 4600,
        path: [
            { t: 0, x: 55, y: 16, reveal: 1 },
            { t: 0.45, x: 55, y: 42, reveal: 2 },
            { t: 0.82, x: 90, y: 14, click: true, reveal: 3 },
            { t: 1, x: 80, y: 20, reveal: 3 },
        ],
    },
    {
        key: 'outro',
        screen: 'outro',
        title: 'A TRA is never truly finished',
        phase: 'Keep it alive',
        participants: ['Whole team', 'Revisited over the product lifecycle'],
        iteration: 'Revisit after significant changes',
        what: 'Assumptions evolve, attack trees are refined, requirements change and defects are tracked as the product matures. Tag a baseline in **TRA versions** when a review is complete.',
        why: 'Revisit the TRA after **architecture changes, new interfaces, vulnerabilities or operational changes**, then compare versions to preserve the audit trail.',
        duration: 3400,
        path: [
            { t: 0, x: 50, y: 22, reveal: 0 },
            { t: 0.5, x: 50, y: 46, reveal: 2 },
            { t: 1, x: 50, y: 62, reveal: 4 },
        ],
    },
];
