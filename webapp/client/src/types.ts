// Shared TypeScript types mirroring the TRA JSON schemas (tra/.assets/schema/*).
export type StepKey = 'project' | 'assumptions' | 'system' | 'dfd' | 'useCases' | 'threats' | 'requirements' | 'countermeasures' | 'attackTrees' | 'defects';
export type ViewKey = StepKey | 'review' | 'versions';
export type ChangeReason = 'initial' | 'functional changes' | 'new vulnerabilities' | 'regular reassessment';

export interface ChangeTrackerEntry {
    version: string;
    reason: ChangeReason;
    assessedAt: string;
    assessors: string[];
    summary?: string;
    changedSteps?: StepKey[];
    changedFiles?: string[];
    hasChanges?: boolean;
    snapshotPath?: string;
}

export interface ChangeTracker {
    currentVersion: string | null;
    entries: ChangeTrackerEntry[];
}

export interface VersionDiffItem {
    path: string;
    value?: unknown;
    before?: unknown;
    after?: unknown;
}

export interface VersionDiffFile {
    step: StepKey;
    path: string;
    diff: {
        added: VersionDiffItem[];
        removed: VersionDiffItem[];
        changed: VersionDiffItem[];
    };
}

export interface VersionDiff {
    fromVersion: string;
    toVersion: string;
    changedFiles: { step: StepKey; path: string }[];
    files: VersionDiffFile[];
}

export interface DeviceInfo {
    name?: string;
    type?: string;
    modelReference?: string;
    purdueLevel?: string;
    version?: string;
}
export interface Scope {
    mode?: 'blackbox' | 'graybox' | 'whitebox';
    boundary?: string;
    inScope?: string[];
    outOfScope?: string[];
}
export interface RepoLinks {
    projectBranchUrl?: string; // link to the project's branch / PR in DevOps/GitHub
    kbUrl?: string; // git URL of the shared knowledge base (pull-only)
}
export interface SbomConfig {
    mode?: 'external' | 'in-tool'; // reference an external SBOM tool, or generate the SBOM here
    format?: 'cyclonedx' | 'spdx'; // only when mode = in-tool
    url?: string; // only when mode = external: link to the SBOM in the external tool
}
export interface Project {
    traVersion?: string;
    projectId?: string;
    title?: string;
    device?: DeviceInfo;
    scope?: Scope;
    slTarget?: string;
    intendedUse?: string; // CRA: the manufacturer's intended purpose of the product
    foreseeableUse?: string[]; // CRA: reasonably foreseeable use scenarios
    repo?: RepoLinks;
    sbom?: SbomConfig;
    rigorousMode?: boolean; // when on, the structured Bug Bar + factor rubric is mandatory per threat
    acceptableRisk?: number; // residual risk at or below this value is acceptable; above it the checker warns (default 12)
    acceptedNotices?: string[]; // keys of plausibility notices the user has explicitly accepted (no longer open points)
    reportOptions?: ReportOptions;
    steps?: Record<string, string>;
    status?: 'draft' | 'in-progress' | 'review' | 'released';
}

/** Report-generation toggles (Settings) — what optional sections to include in the HTML report. */
export interface ReportOptions {
    includeStrideBoundaryAnalysis?: boolean; // include the per-trust-boundary STRIDE strengths/weaknesses tables
    includeUseCases?: boolean; // include persisted use-case diagrams in the generated report
}

export type UseCaseEntityKind = 'actor' | 'misuse-actor' | 'action' | 'misuse-action';
export type UseCaseArrow = 'none' | 'forward' | 'backward' | 'both';

export interface UseCaseEntity {
    id: string;
    kind: UseCaseEntityKind;
    name: string;
    x?: number;
    y?: number;
}

export interface UseCaseConnection {
    id: string;
    from: string;
    to: string;
    dashed?: boolean;
    arrow?: UseCaseArrow;
    label?: string;
}

export interface UseCaseGroup {
    id: string;
    name: string;
    members: string[];
}

export interface UseCaseDiagram {
    id: string;
    name: string;
    entities: UseCaseEntity[];
    connections: UseCaseConnection[];
    groups: UseCaseGroup[];
    drawioXml?: string;
}

export interface UseCasesDoc {
    diagrams: UseCaseDiagram[];
}

export const DEFAULT_ACCEPTABLE_RISK = 12;

export interface Assumption {
    id: string;
    text: string;
    rationale?: string;
    confidence?: 'low' | 'medium' | 'high';
}
export interface AttackerProfile {
    id: string;
    name: string;
    capability: number;
    access: 'remote' | 'adjacent' | 'local' | 'physical';
    motivation?: string;
    resources?: string;
    text?: string;
}
export interface Assumptions {
    device: Assumption[];
    system: Assumption[];
    environment: Assumption[];
    operational: Assumption[];
    attacker: AttackerProfile[];
}

export type ComponentKind = 'device' | 'hardware' | 'software' | 'interface' | 'external-entity' | 'store';
export type Provenance = 'own' | 'third-party';
export interface Component {
    id: string;
    name: string;
    kind: string; // suggested values in ComponentKind; free text allowed
    provenance?: string; // 'own' vs. third-party (OSS / commercial); free text allowed
    layer: number;
    parent?: string | null;
    trustZone?: string;
    description?: string;
    version?: string; // SBOM: component/package version
    supplier?: string; // SBOM: supplier / author
    license?: string; // SBOM: license (SPDX id)
    cpe?: string; // SBOM: CPE or purl identifier for CVE matching
}
export type InterfaceCategory = 'network' | 'external' | 'user';
export interface Interface {
    id: string;
    name: string;
    component?: string;
    category?: string; // suggested: network / external / user; free text allowed
    exposure: 'physical' | 'local' | 'adjacent' | 'remote';
    tag?: string; // short chip tag shown in the DFD (e.g. BLE, HMI, JTAG)
    protocol?: string;
    hidden?: boolean; // optional DFD presentation flag (true = hidden from step-04 rendering)
}
export interface TrustBoundary {
    id: string;
    name: string;
    members?: string[];
}

// ---- Per-trust-boundary STRIDE strengths/weaknesses analysis (a structured brainstorming aid) ----
// One table per *pair of entities* that communicate across a trust boundary (e.g. HART ⇄ Plant DCS
// vs. Bluetooth ⇄ maintenance app on the device-housing boundary), because different protocols give
// different security properties, so each pair may be analysed differently. For both sides of the
// pair and each STRIDE category, the strengths and weaknesses seen from that side's perspective.
// Stored in `system.strideAnalyses` keyed by trust-boundary id, then by a pair key derived from the
// two communicating endpoints; the side labels (entity names) are auto-derived and can be
// overridden. Only user-authored text is persisted, so it survives DFD/system reconciliation.
export interface StrideCategoryCell {
    strengths?: string[];
    weaknesses?: string[];
}
export interface StrideSideAnalysis {
    label?: string; // optional override of the auto-derived entity name for this endpoint
    cells?: Partial<Record<Stride, StrideCategoryCell>>;
}
export interface StridePairAnalysis {
    // Keyed by endpoint id (boundary-independent). The inside/outside role depends on which
    // boundary is being viewed, but the security properties of each endpoint are always shared.
    endpoints?: Record<string, StrideSideAnalysis>;
}
export interface Objectives {
    confidentiality?: number;
    integrity?: number;
    availability?: number;
    safety?: number;
}
export interface Asset {
    id: string;
    name: string;
    type?: string; // suggested: data | function | credential | firmware | config | physical-process
    components?: string[];
    storage?: string; // where the data/asset is stored (e.g. internal flash, secure element)
    objectives: Objectives;
}
export interface SystemDef {
    components: Component[];
    interfaces: Interface[];
    trustBoundaries: TrustBoundary[];
    assets: Asset[];
    // pairKey -> analysis; shared across every boundary that the pair's flow crosses, because
    // the channel's security properties are the same regardless of which boundary you view it from.
    strideAnalyses?: Record<string, StridePairAnalysis>;
}

export type DfdNodeType = 'external-entity' | 'process' | 'multiprocess' | 'store' | 'trust-boundary';
export interface DfdNode {
    id: string;
    label: string;
    type: DfdNodeType;
    layer: number;
    parent?: string | null;
    componentRef?: string;
    members?: string[];
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}
export interface Flow {
    id: string;
    label?: string;
    from: string;
    to: string;
    crossesBoundary?: string | null;
    sourceHandle?: string | null;
    targetHandle?: string | null;
}
export interface Dfd {
    nodes: DfdNode[];
    flows: Flow[];
    ifacePos?: Record<string, { x: number; y: number }>; // user-positioned interface chips, keyed "${parentId ?? 'root'}:${ifaceId}"
    ifaceRot?: Record<string, number>; // user-rotated interface chips in degrees, keyed "${parentId ?? 'root'}:${ifaceId}"
    ifaceLink?: Record<string, { sourceHandle?: string | null; targetHandle?: string | null }>; // dashed interface link handle overrides, keyed "${parentId ?? 'root'}:${ifaceId}"
    portPos?: Record<string, { x: number; y: number }>; // user-positioned deeper-layer context ports, keyed "${parentId ?? 'root'}:${endpointId}"
}

export type Stride = 'S' | 'T' | 'R' | 'I' | 'D' | 'E';
export interface Threat {
    id: string;
    title: string;
    description?: string;
    stride: Stride[];
    components: string[];
    assets?: string[];
    attackerRef?: string;
    attackTreeRef?: string | null;
    likelihood: number;
    impact: number;
    likelihoodRationale?: string;
    impactRationale?: string;
    assumptionRefs?: string[]; // assumption IDs that justify threat feasibility/risk assessment
    interfaceRef?: string; // primary interface/attack vector id (system.interfaces) the threat enters through
    interfaceRefs?: string[]; // additional affected interfaces/vectors assessed together with the same threat
    interfaceLabel?: string; // free-text interface/vector when not in the interface list
    impactDimensions?: Objectives; // Bug Bar per-dimension impact (C/I/A/Safety); impact = max(...)
    // Likelihood = f(Exposure × Exploitability), decomposing a single coarse "likelihood" into two
    // objectively-rateable factors (both 1-5, higher = more likely). Exposure = attack-surface
    // reachability; Exploitability = ease of exploitation once the surface is reached.
    likelihoodFactors?: { exposure?: number; exploitability?: number };
    cvss?: { baseScore?: number; vector?: string; version?: string }; // CVSS 3.1 or 4.0
    countermeasures?: string[];
    residualLikelihood?: number | null;
    residualImpact?: number | null;
    status?: 'open' | 'mitigated' | 'accepted' | 'transferred';
    ratedBy?: string; // inter-rater provenance: who rated this threat
    ratedAt?: string; // ISO timestamp of the last rating
    acceptedBy?: string; // residual-risk sign-off owner (required when status = accepted)
    acceptanceRationale?: string; // justification for accepting the residual risk
    reviewDate?: string; // next lifecycle re-assessment date (YYYY-MM-DD)
}
export interface ThreatsDoc {
    threats: Threat[];
}

export interface CmAddress {
    threat: string;
    residualLikelihood?: number;
    residualImpact?: number;
    attackerRef?: string;
    interfaceRef?: string;
    interfaceRefs?: string[];
    interfaceLabel?: string;
    likelihoodFactors?: { exposure?: number; exploitability?: number };
    impactDimensions?: Objectives;
    cvss?: { baseScore?: number; vector?: string; version?: string };
    ratedBy?: string;
    ratedAt?: string;
}
export interface Countermeasure {
    id: string;
    title: string;
    description?: string;
    type?: 'preventive' | 'detective' | 'corrective' | 'organizational';
    addresses: CmAddress[];
    components?: string[];
    iec62443Ref?: string;
    status?: 'proposed' | 'planned' | 'implemented' | 'verified';
    selected?: boolean; // chosen to be implemented — only selected controls appear in the main overview (undefined = selected, for backward compatibility)
    negativeEffects?: string[]; // consequences of adopting this control (e.g. extra implementation effort, higher compute, reduced throughput)
    ticketUrl?: string; // required once status is implemented/verified — proof of implementation
    ticketUrls?: string[]; // optional additional implementation tickets linked to the same control
    verificationUrl?: string; // link to the verification/test evidence
}
export interface CountermeasuresDoc {
    countermeasures: Countermeasure[];
}

// ---- Attack-Defense Trees (Kordy et al. 2010; Jhawar et al. 2015 SAND) -------------------
export type AdGate = 'AND' | 'OR' | 'SAND';
export type AdKind = 'goal' | 'step' | 'substep' | 'category' | 'countermeasure' | 'vulnerability';
/** Per-substep cost factors (1=very low … 5=very high), from notes/topics/bewertung.typ. */
export interface AdCost {
    time?: number;
    exploitability?: number;
    window?: number;
    detection?: number;
    notoriety?: number;
    prep?: number;
    abort?: number;
}
export interface AdNode {
    id: string;
    kind: AdKind;
    label: string;
    gate?: AdGate; // combination of children, for goal/step/substep/category nodes
    access?: number; // 1-5 required access (step/substep)
    skill?: number; // 1-5 required attacker skill (step/substep)
    cost?: AdCost;
    countermeasureRef?: string; // for kind 'countermeasure' -> links an existing countermeasure id
    note?: string;
    children?: AdNode[];
}
export interface AttackTree {
    id: string;
    title: string;
    threatRef?: string; // the threat this tree decomposes
    description?: string;
    root: AdNode;
}
export interface AttackTreesDoc {
    trees: AttackTree[];
}

export interface ProjectData {
    project: Project;
    assumptions: Assumptions;
    system: SystemDef;
    dfd: Dfd;
    useCases: UseCasesDoc;
    threats: ThreatsDoc;
    requirements: RequirementsDoc;
    countermeasures: CountermeasuresDoc;
    attackTrees: AttackTreesDoc;
    defects: DefectsDoc;
    changeTracker: ChangeTracker;
}

// ---- Security requirements (step 05) — the threat -> risk -> requirement -> control chain ----
export interface Requirement {
    id: string;
    text: string;
    standardRef?: string; // e.g. IEC 62443-4-2 CR 1.2, ETSI EN 303 645 provision
    derivedFromThreat?: string[]; // threats that motivate this requirement
    satisfiedByCM?: string[]; // countermeasures that satisfy it
    fromCountermeasure?: boolean; // "is CM": this requirement realises a countermeasure and therefore reduces a threat's risk
    slFr?: string; // SL / Foundational Requirement reference (e.g. FR1 SL2)
}
export interface RequirementsDoc {
    requirements: Requirement[];
}

// ---- Defect / vulnerability register (lifecycle DM/SUM) ----
export interface Defect {
    id: string;
    title: string;
    cve?: string;
    component?: string; // affected component id
    threatRef?: string; // threat to re-assess when this defect is open (lifecycle DM/SUM)
    severity?: 'low' | 'medium' | 'high' | 'critical';
    status?: 'open' | 'triaged' | 'fixed' | 'wont-fix';
    discovered?: string; // ISO date
    fixedIn?: string; // firmware/version the fix ships in
    note?: string;
}
export interface DefectsDoc {
    defects: Defect[];
}

export interface ProjectSummary {
    id: string;
    title: string;
    device: DeviceInfo | null;
    status: string;
    slTarget: string;
}

export interface LaunchConfig {
    preselectProjectId: string | null;
}

export interface RiskBand {
    name: string;
    min: number;
    max: number;
    color: string;
}
export interface RiskScheme {
    likelihood: {
        scale: { score: number; label: string; desc: string }[];
        factors: string[];
        factorScale?: Record<string, { score: number; label: string }[]>;
        derivation?: string;
    };
    impact: { scale: { score: number; label: string; desc: string }[]; bugBarDimensions: string[]; rule: string };
    matrix: { axes: string; bands: RiskBand[] };
    cvss?: { role?: string; suggestion?: string };
    attackTree?: { description?: string; costFactors?: { key: string; label: string; weight: number }[] };
}
