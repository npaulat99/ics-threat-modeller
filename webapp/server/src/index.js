// TRA web application backend.
//
// Responsibilities:
//   1. Serve the built React client and a small REST API.
//   2. Provide a WebSocket channel for live, bidirectional synchronisation:
//        - UI edits arrive as {type:'save'} -> written to disk -> broadcast to *other*
//          subscribed clients (so multiple tabs stay in sync without echoing to the sender).
//        - External edits to the JSON files (detected by chokidar) -> broadcast to *all*
//          subscribed clients, so editing a file by hand updates the UI live.
//   3. Generate the HTML report on demand.
import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import chokidar from 'chokidar';
import { promises as fs } from 'node:fs';
import { join, basename } from 'node:path';
import os from 'node:os';
import { PORT, projectsDir, clientDist, fieldLibraryPath, bugBarPath, riskSchemePath, knowledgeBaseDir } from './paths.js';
import {
    STEP_KEYS,
    listProjects,
    readProject,
    writeArtifact,
    scaffoldProject,
    pathToStep,
    isExternalChange,
    recordHash,
} from './artifacts.js';
import { loadScheme } from './risk.js';
import { validate } from './validate.js';
import { generateReport, buildReport } from './report.js';
import { pullKnowledgeBase, commitProject, gitStatus } from './git.js';

const app = express();
app.use(express.json({ limit: '8mb' }));

/**
 * The importable threat/countermeasure library: the shared field-device library plus the threats
 * and countermeasures contributed by any git-pulled catalogue under knowledge-base/imported/*.
 * This is what makes a pulled knowledge-base repo actually usable (importable), not just browsable.
 * Entries need a unique `key` and a `title`; duplicate keys (base wins) are skipped.
 */
async function loadImportableLibrary() {
    const readJson = async (p) => {
        try {
            return JSON.parse(await fs.readFile(p, 'utf8'));
        } catch {
            return null;
        }
    };
    const base = (await readJson(fieldLibraryPath)) || {};
    const threats = [...(base.threats || [])];
    const countermeasures = [...(base.countermeasures || [])];
    const seenT = new Set(threats.map((t) => t.key));
    const seenC = new Set(countermeasures.map((c) => c.key));
    try {
        const importedDir = join(knowledgeBaseDir, 'imported');
        for (const e of await fs.readdir(importedDir, { withFileTypes: true })) {
            if (!e.isDirectory()) continue;
            const dir = join(importedDir, e.name);
            for (const f of await fs.readdir(dir).catch(() => [])) {
                if (!f.endsWith('.json')) continue;
                const doc = await readJson(join(dir, f));
                if (!doc) continue;
                for (const t of doc.threats || []) if (t && t.key && t.title && !seenT.has(t.key)) (seenT.add(t.key), threats.push(t));
                for (const c of doc.countermeasures || []) if (c && c.key && c.title && !seenC.has(c.key)) (seenC.add(c.key), countermeasures.push(c));
            }
        }
    } catch {
        /* no imported catalogues */
    }
    return { ...base, threats, countermeasures };
}

// ---- REST API -------------------------------------------------------------
app.get('/api/risk-scheme', async (_req, res) => res.json(await loadScheme()));

app.get('/api/kb', async (_req, res) => {
    try {
        res.json(await loadImportableLibrary());
    } catch {
        res.json({ threats: [], countermeasures: [] });
    }
});

app.get('/api/bug-bar', async (_req, res) => {
    try {
        res.json(JSON.parse(await fs.readFile(bugBarPath, 'utf8')));
    } catch {
        res.json({ dimensions: [] });
    }
});

// Full knowledge base for the browse page: library + bug bar + risk scheme + imported catalogues.
app.get('/api/kb/full', async (_req, res) => {
    const readJson = async (p) => {
        try {
            return JSON.parse(await fs.readFile(p, 'utf8'));
        } catch {
            return null;
        }
    };
    const out = { library: await readJson(fieldLibraryPath), bugBar: await readJson(bugBarPath), riskScheme: await readJson(riskSchemePath), imported: [] };
    try {
        const importedDir = join(knowledgeBaseDir, 'imported');
        for (const e of await fs.readdir(importedDir, { withFileTypes: true })) {
            if (!e.isDirectory()) continue;
            const dir = join(importedDir, e.name);
            const files = {};
            for (const f of await fs.readdir(dir).catch(() => [])) if (f.endsWith('.json')) files[f] = await readJson(join(dir, f));
            out.imported.push({ name: e.name, files });
        }
    } catch {
        /* no imported catalogues */
    }
    res.json(out);
});

app.post('/api/kb/git/pull', async (req, res) => res.json(await pullKnowledgeBase(req.body?.url)));
app.post('/api/projects/:id/git/commit', async (req, res) => res.json(await commitProject(req.params.id, req.body?.message, !!req.body?.push)));
app.get('/api/projects/:id/git/status', async (req, res) => res.json(await gitStatus(req.params.id)));

app.get('/api/projects', async (_req, res) => res.json(await listProjects()));

app.post('/api/projects', async (req, res) => {
    const id = await scaffoldProject(req.body?.name || 'New device');
    broadcastProjects();
    res.json({ id });
});

app.get('/api/projects/:id', async (req, res) => {
    const data = await readProject(req.params.id);
    res.json(data);
});

app.put('/api/projects/:id/:step', async (req, res) => {
    const { id, step } = req.params;
    if (!STEP_KEYS.includes(step)) return res.status(400).json({ error: 'unknown step' });
    await writeArtifact(id, step, req.body);
    broadcastArtifact(id, step, req.body, null);
    res.json({ ok: true });
});

app.post('/api/projects/:id/validate', async (req, res) => {
    const data = await readProject(req.params.id);
    res.json({ issues: validate(data) });
});

app.post('/api/projects/:id/report', async (req, res) => {
    const { html, issues } = await generateReport(req.params.id);
    res.json({ ok: true, path: `projects/${req.params.id}/report/index.html`, html, issues });
});

// Machine-readable exports for auditors / downstream tooling.
app.get('/api/projects/:id/export/traceability.csv', async (req, res) => {
    const { files } = await buildReport(req.params.id);
    res.type('text/csv').set('Content-Disposition', `attachment; filename="${req.params.id}-traceability.csv"`).send(files['traceability.csv']);
});
app.get('/api/projects/:id/export/traceability.json', async (req, res) => {
    const { files } = await buildReport(req.params.id);
    res.type('application/json').send(files['traceability.json']);
});
app.get('/api/projects/:id/export/sbom.cdx.json', async (req, res) => {
    const { files } = await buildReport(req.params.id);
    if (!files['sbom.cdx.json']) return res.status(404).json({ error: 'CycloneDX SBOM not generated for this project (check the SBOM settings on the Project page).' });
    res.type('application/json').set('Content-Disposition', `attachment; filename="${req.params.id}-sbom.cdx.json"`).send(files['sbom.cdx.json']);
});
app.get('/api/projects/:id/export/sbom.spdx.json', async (req, res) => {
    const { files } = await buildReport(req.params.id);
    if (!files['sbom.spdx.json']) return res.status(404).json({ error: 'SPDX SBOM not generated for this project (check the SBOM settings on the Project page).' });
    res.type('application/json').set('Content-Disposition', `attachment; filename="${req.params.id}-sbom.spdx.json"`).send(files['sbom.spdx.json']);
});

// ---- AI/assistive workflow seam (rule-based, human-reviewed) ---------------
// Users drop specifications / manuals into projects/<id>/documents/. The suggestion endpoint
// matches the shared knowledge-base library against the project model + document text and
// proposes threats/countermeasures for the engineer to accept (never auto-applied).
async function readDocuments(id) {
    const dir = join(projectsDir, id, 'documents');
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const names = [];
        const texts = [];
        for (const e of entries) {
            if (!e.isFile()) continue;
            names.push(e.name);
            if (/\.(md|txt|json|csv|log)$/i.test(e.name)) {
                try {
                    texts.push(await fs.readFile(join(dir, e.name), 'utf8'));
                } catch {
                    /* skip unreadable */
                }
            }
        }
        return { names, text: texts.join('\n') };
    } catch {
        return { names: [], text: '' };
    }
}

app.get('/api/projects/:id/documents', async (req, res) => {
    const dir = join(projectsDir, req.params.id, 'documents');
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const out = [];
        for (const e of entries) {
            if (!e.isFile()) continue;
            const st = await fs.stat(join(dir, e.name));
            out.push({ name: e.name, size: st.size });
        }
        res.json(out);
    } catch {
        res.json([]);
    }
});

app.get('/api/projects/:id/documents/:name', async (req, res) => {
    try {
        res.type('text/plain').send(await fs.readFile(join(projectsDir, req.params.id, 'documents', basename(req.params.name)), 'utf8'));
    } catch {
        res.status(404).send('');
    }
});

app.post('/api/projects/:id/suggest', async (req, res) => {
    let kb;
    try {
        kb = JSON.parse(await fs.readFile(fieldLibraryPath, 'utf8'));
    } catch {
        kb = { threats: [], countermeasures: [] };
    }
    const proj = await readProject(req.params.id);
    const docs = await readDocuments(req.params.id);
    const corpus = [
        ...(proj.system.components || []).flatMap((c) => [c.name, c.kind, c.provenance]),
        ...(proj.system.interfaces || []).flatMap((i) => [i.name, i.protocol, i.exposure, i.category]),
        ...(proj.system.assets || []).flatMap((a) => [a.name, a.type]),
        docs.text,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    const tok = (s) => (String(s).toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 3);
    const score = (e) => {
        const words = new Set([...tok(e.title), ...(e.appliesTo || []).flatMap(tok)]);
        let n = 0;
        for (const w of words) if (corpus.includes(w)) n++;
        return n;
    };
    const existing = new Set((proj.threats.threats || []).map((t) => (t.title || '').toLowerCase()));
    const threats = (kb.threats || [])
        .map((t) => ({ key: t.key, title: t.title, stride: t.stride || [], typicalImpact: t.typicalImpact, appliesTo: t.appliesTo || [], score: score(t) }))
        .filter((t) => t.score > 0 && !existing.has(t.title.toLowerCase()))
        .sort((a, b) => b.score - a.score);
    res.json({ threats, countermeasures: kb.countermeasures || [], documents: docs.names });
});

// ---- Static client (production build) -------------------------------------
app.use(express.static(clientDist));
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'not found' });
    res.sendFile(join(clientDist, 'index.html'), (err) => {
        if (err) res.status(404).send('Client not built yet. Run "npm run build" in tra-webapp.');
    });
});

// ---- HTTP + WebSocket server ----------------------------------------------
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set();

wss.on('connection', (ws) => {
    ws.subscribedId = null;
    clients.add(ws);
    ws.on('message', async (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        } catch {
            return;
        }
        if (msg.type === 'subscribe') {
            ws.subscribedId = msg.id;
        } else if (msg.type === 'save' && msg.id && STEP_KEYS.includes(msg.step)) {
            await writeArtifact(msg.id, msg.step, msg.data);
            broadcastArtifact(msg.id, msg.step, msg.data, ws);
            if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'saved', id: msg.id, step: msg.step }));
        }
    });
    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => clients.delete(ws));
});

function broadcastArtifact(id, step, data, except) {
    const payload = JSON.stringify({ type: 'artifact', id, step, data });
    for (const ws of clients) {
        if (ws !== except && ws.readyState === 1 && ws.subscribedId === id) ws.send(payload);
    }
}
function broadcastProjects() {
    const payload = JSON.stringify({ type: 'projects-changed' });
    for (const ws of clients) if (ws.readyState === 1) ws.send(payload);
}

// ---- File watcher: external edits -> live UI update -----------------------
const watcher = chokidar.watch(projectsDir, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 40 },
});
watcher.on('all', async (event, path) => {
    if (!path.endsWith('.json')) return;
    if (event !== 'add' && event !== 'change') return;
    const loc = pathToStep(path);
    if (!loc) return;
    let txt;
    try {
        txt = await fs.readFile(path, 'utf8');
    } catch {
        return;
    }
    if (!isExternalChange(path, txt)) return; // our own write — ignore the echo
    recordHash(path, txt);
    let data;
    try {
        data = JSON.parse(txt);
    } catch {
        return; // half-written / invalid JSON during manual editing — skip until valid
    }
    broadcastArtifact(loc.id, loc.step, data, null);
    if (loc.step === 'project') broadcastProjects();
});

// Bind to 0.0.0.0 so the app is reachable from outside the VM (e.g. the Windows host),
// not only from localhost inside the VM. Override the interface with HOST if needed.
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
    const lan = Object.values(os.networkInterfaces())
        .flat()
        .filter((n) => n && n.family === 'IPv4' && !n.internal)
        .map((n) => n.address);
    console.log(`TRA web app listening on http://${HOST}:${PORT}`);
    console.log(`  local:   http://localhost:${PORT}`);
    for (const ip of lan) console.log(`  network: http://${ip}:${PORT}  (reachable from the host)`);
    console.log(`Projects directory: ${projectsDir}`);
});
