// Artifact (per-step JSON file) access layer.
//
// Every TRA project is a folder under `projectsDir` containing one sub-folder per
// methodology step. This module is the single place that maps the logical step keys
// used by the UI/API to the canonical file paths on disk, reads and writes them, and
// tracks a content hash per file so the file-system watcher can distinguish a change
// that *we* just wrote (echo) from a change made externally (e.g. the user editing the
// JSON in an editor). Only external changes are pushed back to the browser.
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, sep } from 'node:path';
import { projectsDir } from './paths.js';

/** Logical step key -> canonical relative file path inside a project folder. */
export const STEP_FILES = {
    project: '01-project-description/project.json',
    assumptions: '02-assumptions/assumptions.json',
    system: '03-system-assets/system.json',
    dfd: '04-dfd/dfd.json',
    threats: '06-threats/threats.json',
    requirements: '05-requirements/requirements.json',
    countermeasures: '08-countermeasures/countermeasures.json',
    attackTrees: '07-attack-trees/attack-trees.json',
    defects: '09-defects/defects.json',
};
export const STEP_KEYS = Object.keys(STEP_FILES);

/** Empty-but-valid skeletons used when a step file does not exist yet. */
export const DEFAULTS = {
    project: () => ({ traVersion: '1.0', device: {}, scope: {}, steps: {} }),
    assumptions: () => ({ device: [], system: [], environment: [], operational: [], attacker: [] }),
    system: () => ({ components: [], interfaces: [], trustBoundaries: [], assets: [] }),
    dfd: () => ({ nodes: [], flows: [] }),
    threats: () => ({ threats: [] }),
    requirements: () => ({ requirements: [] }),
    countermeasures: () => ({ countermeasures: [] }),
    attackTrees: () => ({ trees: [] }),
    defects: () => ({ defects: [] }),
};

const sha1 = (s) => createHash('sha1').update(s).digest('hex');
const hashes = new Map(); // absolute path -> last known content hash
const fileOf = (id, step) => join(projectsDir, id, STEP_FILES[step]);

export async function readArtifact(id, step) {
    const p = fileOf(id, step);
    try {
        const txt = await fs.readFile(p, 'utf8');
        hashes.set(p, sha1(txt));
        return JSON.parse(txt);
    } catch {
        return DEFAULTS[step] ? DEFAULTS[step]() : null;
    }
}

export async function writeArtifact(id, step, data) {
    const p = fileOf(id, step);
    const txt = JSON.stringify(data, null, 2) + '\n';
    // Record the expected hash *before* writing so the watcher recognises the echo.
    hashes.set(p, sha1(txt));
    await fs.mkdir(dirname(p), { recursive: true });
    await fs.writeFile(p, txt, 'utf8');
    return data;
}

export async function readProject(id) {
    const entries = await Promise.all(STEP_KEYS.map(async (k) => [k, await readArtifact(id, k)]));
    return Object.fromEntries(entries);
}

export async function listProjects() {
    let dirs = [];
    try {
        dirs = await fs.readdir(projectsDir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out = [];
    for (const d of dirs) {
        if (!d.isDirectory()) continue;
        const proj = await readArtifact(d.name, 'project');
        out.push({
            id: d.name,
            title: proj?.title || d.name,
            device: proj?.device || null,
            status: proj?.status || 'draft',
            slTarget: proj?.slTarget || '',
        });
    }
    return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** Map an absolute changed-file path back to {id, step}, or null if it is not a step file. */
export function pathToStep(absPath) {
    const rel = relative(projectsDir, absPath);
    if (!rel || rel.startsWith('..')) return null;
    const parts = rel.split(sep);
    if (parts.length < 2) return null;
    const id = parts[0];
    const stepRel = parts.slice(1).join('/');
    const step = STEP_KEYS.find((k) => STEP_FILES[k] === stepRel);
    return step ? { id, step } : null;
}

/** True when the on-disk text differs from what we last wrote (i.e. an external edit). */
export function isExternalChange(absPath, txt) {
    return hashes.get(absPath) !== sha1(txt);
}
export function recordHash(absPath, txt) {
    hashes.set(absPath, sha1(txt));
}

const slugify = (name) =>
    String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `project-${Date.now()}`;

/** Create a new project skeleton mirroring the example layout. Returns the project id (slug). */
export async function scaffoldProject(name) {
    let slug = slugify(name);
    let n = 1;
    // Ensure a unique folder name.
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            await fs.access(join(projectsDir, slug));
            slug = `${slugify(name)}-${++n}`;
        } catch {
            break;
        }
    }
    await writeArtifact(slug, 'project', {
        traVersion: '1.0',
        projectId: slug,
        title: `TRA: ${name}`,
        device: { name, type: 'field device' },
        scope: { mode: 'graybox', boundary: '', inScope: [], outOfScope: [] },
        slTarget: 'SL2',
        steps: Object.fromEntries(STEP_KEYS.map((k) => [STEP_FILES[k].split('/')[0], STEP_FILES[k]])),
        status: 'draft',
    });
    await writeArtifact(slug, 'assumptions', {
        device: [],
        system: [],
        environment: [],
        operational: [],
        attacker: [
            { id: 'ATK-1', name: 'Opportunistic attacker', capability: 2, access: 'local', motivation: 'disruption', text: '' },
        ],
    });
    await writeArtifact(slug, 'system', {
        components: [{ id: 'C-DEV', name, kind: 'device', layer: 1, parent: null, trustZone: 'device' }],
        interfaces: [],
        trustBoundaries: [],
        assets: [
            {
                id: 'AS-1',
                name: 'Primary function',
                type: 'function',
                components: ['C-DEV'],
                objectives: { confidentiality: 1, integrity: 3, availability: 3, safety: 1 },
            },
        ],
    });
    await writeArtifact(slug, 'dfd', {
        nodes: [{ id: 'N-DEV', label: name, type: 'process', layer: 1, parent: null, componentRef: 'C-DEV', x: 320, y: 200 }],
        flows: [],
    });
    await writeArtifact(slug, 'threats', { threats: [] });
    await writeArtifact(slug, 'countermeasures', { countermeasures: [] });
    await writeArtifact(slug, 'attackTrees', { trees: [] });
    return slug;
}
