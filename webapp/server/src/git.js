// Git helpers for: (1) pulling the shared knowledge base (read-only - no push), and
// (2) preparing a local working clone + work branch for TRA project commits.
//
// Commit metadata for this flow is stored in a local-only config file under
// webapp/.local/, so it is never committed into either the webapp repository or the
// assessed project's repository.
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { basename, join } from 'node:path';
import { projectsDir, knowledgeBaseDir, webappRoot } from './paths.js';
import { STEP_FILES } from './artifacts.js';

const localGitRoot = join(webappRoot, '.local', 'git-workspaces');
const localGitConfigPath = join(localGitRoot, 'workspaces.json');
const PROTECTED_BRANCH = /^(main|master|develop|development|dev|trunk|release)$/i;
const STEP_DIRS = [...new Set(Object.values(STEP_FILES).map((p) => p.split('/')[0])), 'documents'];
const PROJECT_DATA_DIR = /^(\d{2}-|documents$)/;

function run(args, cwd) {
    return new Promise((resolve) => {
        execFile('git', args, { cwd, timeout: 60000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
            resolve({ ok: !err, stdout: String(stdout || '').trim(), stderr: String(stderr || '').trim() });
        });
    });
}

function normalizeGitUrl(url) {
    return String(url || '').trim().replace(/\.git\/?$/, '').replace(/\/$/, '');
}

function parseAzureDevOpsUrl(raw) {
    const value = String(raw || '').trim();
    if (!value) return null;
    try {
        const url = new URL(value);
        const repoMatch = url.pathname.match(/(.*?\/_git\/[^/?#]+)/);
        if (!repoMatch) return null;
        const repoUrl = `${url.origin}${repoMatch[1]}`;
        const version = url.searchParams.get('version') || '';
        const branch = version.startsWith('GB') ? decodeURIComponent(version.slice(2)) : '';
        return { repoUrl, branch: branch || null };
    } catch {
        return null;
    }
}

function normalizeRepoInput(raw) {
    const value = String(raw || '').trim();
    const parsed = parseAzureDevOpsUrl(value);
    return parsed?.repoUrl || value.replace(/[?#].*$/, '').replace(/\/$/, '');
}

function isValidBranchName(v) {
    return typeof v === 'string' && /^[A-Za-z0-9._/-]+$/.test(v) && !v.startsWith('-') && !v.includes('..') && !v.endsWith('/');
}

function isValidSubdir(v) {
    if (v == null) return true;
    const s = String(v).trim();
    if (!s) return true;
    if (s.startsWith('/') || s.startsWith('\\')) return false;
    if (s.includes('..')) return false;
    return /^[A-Za-z0-9._/-]+$/.test(s);
}

function slug(v) {
    const s = String(v || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    return s || 'project';
}

async function loadWorkspaceMap() {
    try {
        const txt = await fs.readFile(localGitConfigPath, 'utf8');
        const data = JSON.parse(txt);
        return data && typeof data === 'object' ? data : {};
    } catch {
        return {};
    }
}

async function saveWorkspaceMap(map) {
    await fs.mkdir(localGitRoot, { recursive: true });
    await fs.writeFile(localGitConfigPath, JSON.stringify(map, null, 2) + '\n', 'utf8');
}

async function hasGitRepo(dir) {
    try {
        await fs.access(join(dir, '.git'));
        return true;
    } catch {
        return false;
    }
}

async function remoteBranchExists(dir, branch) {
    const r = await run(['-C', dir, 'show-ref', '--verify', '--quiet', `refs/remotes/origin/${branch}`], dir);
    return r.ok;
}

async function localHead(dir) {
    const r = await run(['-C', dir, 'rev-parse', 'HEAD'], dir);
    return r.ok ? r.stdout : null;
}

async function remoteHead(dir, branch) {
    const r = await run(['-C', dir, 'ls-remote', '--heads', 'origin', `refs/heads/${branch}`], dir);
    if (!r.ok) return { ok: false, stderr: r.stderr || r.stdout, sha: null };
    const sha = r.stdout ? r.stdout.split(/\s+/)[0] : null;
    return { ok: true, stderr: '', sha };
}

async function pushAndVerify(dir, branch) {
    const before = await remoteHead(dir, branch);
    if (!before.ok) return { ok: false, stderr: before.stderr, remoteBefore: null, remoteAfter: null, localSha: null };
    const localSha = await localHead(dir);
    if (!localSha) return { ok: false, stderr: 'Could not resolve local HEAD before push.', remoteBefore: before.sha, remoteAfter: null, localSha: null };

    const push = await run(['-C', dir, 'push', 'origin', `HEAD:refs/heads/${branch}`], dir);
    if (!push.ok) {
        return { ok: false, stderr: push.stderr || push.stdout, stdout: push.stdout, remoteBefore: before.sha, remoteAfter: null, localSha };
    }

    const after = await remoteHead(dir, branch);
    if (!after.ok) return { ok: false, stderr: after.stderr, stdout: push.stdout, remoteBefore: before.sha, remoteAfter: null, localSha };
    if (after.sha !== localSha) {
        return {
            ok: false,
            stderr: `Push finished, but remote ${branch} points to ${after.sha || '<missing>'} instead of local ${localSha}.`,
            stdout: push.stdout,
            remoteBefore: before.sha,
            remoteAfter: after.sha,
            localSha,
        };
    }
    return { ok: true, stdout: push.stdout || push.stderr, stderr: '', remoteBefore: before.sha, remoteAfter: after.sha, localSha };
}

async function ensureRepoClone(localPath, repoUrl) {
    const exists = await hasGitRepo(localPath);
    if (!exists) {
        await fs.mkdir(join(localPath, '..'), { recursive: true });
        const clone = await run(['clone', repoUrl, localPath], join(localPath, '..'));
        if (!clone.ok) return clone;
        return { ok: true, stdout: 'cloned', stderr: '' };
    }

    const origin = await run(['-C', localPath, 'remote', 'get-url', 'origin'], localPath);
    if (!origin.ok) return origin;
    if (normalizeGitUrl(origin.stdout) !== normalizeGitUrl(repoUrl)) {
        await fs.rm(localPath, { recursive: true, force: true });
        await fs.mkdir(join(localPath, '..'), { recursive: true });
        const clone = await run(['clone', repoUrl, localPath], join(localPath, '..'));
        if (!clone.ok) return clone;
        return { ok: true, stdout: `recloned from ${repoUrl}`, stderr: '' };
    }
    return { ok: true, stdout: 'existing', stderr: '' };
}

async function syncProjectIntoWorkspace(projectId, workspace) {
    const source = join(projectsDir, projectId);
    const target = workspace.subdir ? join(workspace.localPath, workspace.subdir) : workspace.localPath;
    await fs.mkdir(target, { recursive: true });

    // Replace every managed TRA data folder so additions, edits and deletions in the
    // webapp are reflected in git. Numbered methodology folders cover current and
    // future steps (01-..., 10-...), and documents/ carries assessor-provided files.
    const targetEntries = await fs.readdir(target, { withFileTypes: true }).catch(() => []);
    for (const entry of targetEntries) {
        if (PROJECT_DATA_DIR.test(entry.name)) await fs.rm(join(target, entry.name), { recursive: true, force: true }).catch(() => { });
    }

    const sourceEntries = await fs.readdir(source, { withFileTypes: true }).catch(() => []);
    for (const entry of sourceEntries) {
        if (!PROJECT_DATA_DIR.test(entry.name)) continue;
        await fs.cp(join(source, entry.name), join(target, entry.name), { recursive: true, force: true });
    }

    // Keep compatibility with the canonical step map even if a step folder is absent
    // from fs.readdir() due to a race or future project scaffolding changes.
    for (const dir of STEP_DIRS) {
        const from = join(source, dir);
        try {
            await fs.access(from);
            await fs.cp(from, join(target, dir), { recursive: true, force: true });
        } catch {
            /* optional folder */
        }
    }
    return target;
}

async function workspaceStatus(workspace) {
    if (!workspace) return { configured: false };
    const repoOk = await hasGitRepo(workspace.localPath);
    if (!repoOk) return { configured: true, ready: false, reason: 'Missing local clone.' };
    const branch = await run(['-C', workspace.localPath, 'rev-parse', '--abbrev-ref', 'HEAD'], workspace.localPath);
    const dirty = await run(['-C', workspace.localPath, 'status', '--porcelain'], workspace.localPath);
    const remoteExists = await remoteBranchExists(workspace.localPath, workspace.workBranch);
    const aheadBehind = remoteExists ? await run(['-C', workspace.localPath, 'rev-list', '--left-right', '--count', `origin/${workspace.workBranch}...HEAD`], workspace.localPath) : { ok: false, stdout: '' };
    let ahead = 0;
    let behind = 0;
    if (aheadBehind.ok) {
        const parts = aheadBehind.stdout.split(/\s+/).map((v) => Number(v));
        behind = Number.isFinite(parts[0]) ? parts[0] : 0;
        ahead = Number.isFinite(parts[1]) ? parts[1] : 0;
    }
    return {
        configured: true,
        ready: branch.ok,
        branch: branch.ok ? branch.stdout : null,
        expectedBranch: workspace.workBranch,
        dirty: dirty.ok ? dirty.stdout.length > 0 : false,
        ahead,
        behind,
        remoteExists,
        onProtectedBranch: branch.ok ? PROTECTED_BRANCH.test(branch.stdout) : false,
    };
}

const isValidGitUrl = (u) =>
    typeof u === 'string' &&
    !/\s/.test(u) &&
    !u.includes('..') &&
    (/^(https?:\/\/|git@[\w.-]+:|ssh:\/\/)[\w.@:/\-~]+$/.test(u) || // remote (https / ssh)
        /^file:\/\/\/[\w./\-~]+$/.test(u) || // local repository as a file:// URL
        /^\/[\w./\-~]+$/.test(u)); // local repository as an absolute path (e.g. an on-disk demo KB)

/** Clone (first time) or fast-forward pull the shared knowledge base. Read-only. */
export async function pullKnowledgeBase(url) {
    if (!isValidGitUrl(url)) return { ok: false, stderr: 'Invalid or missing git URL.' };
    // A bare absolute path is not a git URL; use the file:// transport so --depth is honoured.
    const src = /^\//.test(url) ? `file://${url}` : url;
    const importedDir = join(knowledgeBaseDir, 'imported');
    await fs.mkdir(importedDir, { recursive: true });
    const name = (basename(url).replace(/\.git$/, '').replace(/[^\w.-]/g, '') || 'kb').slice(0, 64);
    const dest = join(importedDir, name);
    let exists = false;
    try {
        await fs.access(join(dest, '.git'));
        exists = true;
    } catch {
        /* not cloned yet */
    }
    const res = exists ? await run(['-C', dest, 'pull', '--ff-only'], importedDir) : await run(['clone', '--depth', '1', src, dest], importedDir);
    return { ...res, dest: `imported/${name}`, action: exists ? 'pull' : 'clone' };
}

/** De-import (delete) a previously pulled/placed catalogue folder under knowledge-base/imported/<name>. */
export async function removeImportedCatalogue(name) {
    if (typeof name !== 'string' || !/^[\w.-]+$/.test(name) || name === '.' || name === '..') {
        return { ok: false, stderr: 'Invalid catalogue name.' };
    }
    const importedDir = join(knowledgeBaseDir, 'imported');
    const dest = join(importedDir, name);
    // Guard against path traversal even though the regex above already forbids "..".
    if (!dest.startsWith(importedDir + '/')) return { ok: false, stderr: 'Invalid catalogue path.' };
    try {
        await fs.access(dest);
    } catch {
        return { ok: false, stderr: 'Catalogue not found.' };
    }
    await fs.rm(dest, { recursive: true, force: true });
    return { ok: true };
}

export async function getProjectWorkspace(id) {
    const map = await loadWorkspaceMap();
    const workspace = map[id] || null;
    return {
        ok: true,
        configured: !!workspace,
        workspace,
        status: await workspaceStatus(workspace),
    };
}

export async function verifyProjectWorkspace(id) {
    const map = await loadWorkspaceMap();
    const workspace = map[id];
    if (!workspace) return { ok: false, stderr: 'No git workspace configured for this project. Prepare workspace first.' };
    const repoOk = await hasGitRepo(workspace.localPath);
    if (!repoOk) return { ok: false, stderr: 'Local clone is missing. Prepare workspace again.' };

    const status = await run(['-C', workspace.localPath, 'status', '--short', '--branch'], workspace.localPath);
    const read = await remoteHead(workspace.localPath, workspace.workBranch);
    if (!read.ok) return { ok: false, stderr: read.stderr, status: status.stdout || status.stderr };

    const dryRun = await run(['-C', workspace.localPath, 'push', '--dry-run', 'origin', `HEAD:refs/heads/${workspace.workBranch}`], workspace.localPath);
    return {
        ok: dryRun.ok,
        stderr: dryRun.ok ? '' : dryRun.stderr || dryRun.stdout,
        stdout: dryRun.stdout || dryRun.stderr,
        status: status.stdout || status.stderr,
        branch: workspace.workBranch,
        remoteSha: read.sha,
        localSha: await localHead(workspace.localPath),
    };
}

export async function prepareProjectWorkspace(id, input) {
    const parsed = parseAzureDevOpsUrl(input?.projectBranchUrl || input?.repoUrl || '');
    const repoUrl = normalizeRepoInput(input?.repoUrl || parsed?.repoUrl || input?.projectBranchUrl || '');
    const workBranch = String(input?.workBranch || parsed?.branch || '').trim();
    const baseBranch = String(input?.baseBranch || 'main').trim();
    const subdir = String(input?.subdir || '').trim();

    if (!isValidGitUrl(repoUrl)) return { ok: false, stderr: 'Invalid or missing repository URL.' };
    if (!isValidBranchName(workBranch)) return { ok: false, stderr: 'Invalid work branch name.' };
    if (!isValidBranchName(baseBranch)) return { ok: false, stderr: 'Invalid base branch name.' };
    if (PROTECTED_BRANCH.test(workBranch)) {
        return { ok: false, stderr: `Refusing to work on protected branch "${workBranch}". Use a feature/work branch.` };
    }
    if (!isValidSubdir(subdir)) return { ok: false, stderr: 'Invalid repository subdirectory.' };

    const map = await loadWorkspaceMap();
    const prev = map[id] || {};
    const localPath = prev.localPath || join(localGitRoot, slug(id), 'repo');
    const workspace = {
        repoUrl,
        workBranch,
        baseBranch,
        subdir,
        localPath,
        updatedAt: new Date().toISOString(),
    };

    const clone = await ensureRepoClone(localPath, repoUrl);
    if (!clone.ok) return clone;

    const fetch = await run(['-C', localPath, 'fetch', '--prune', 'origin'], localPath);
    if (!fetch.ok) return fetch;

    const remoteWorkExists = await remoteBranchExists(localPath, workBranch);
    if (remoteWorkExists) {
        const co = await run(['-C', localPath, 'checkout', workBranch], localPath);
        if (!co.ok) return co;
        const pull = await run(['-C', localPath, 'pull', '--ff-only', 'origin', workBranch], localPath);
        if (!pull.ok) return pull;
    } else {
        const remoteBaseExists = await remoteBranchExists(localPath, baseBranch);
        if (!remoteBaseExists) return { ok: false, stderr: `Base branch "${baseBranch}" does not exist on origin.` };
        const make = await run(['-C', localPath, 'checkout', '-B', workBranch, `origin/${baseBranch}`], localPath);
        if (!make.ok) return make;
    }

    map[id] = workspace;
    await saveWorkspaceMap(map);

    return {
        ok: true,
        workspace,
        status: await workspaceStatus(workspace),
        note: remoteWorkExists
            ? `Checked out existing branch ${workBranch} and fast-forwarded it.`
            : `Created branch ${workBranch} from origin/${baseBranch}.`,
    };
}

/** Commit project changes into the configured local workspace branch. */
export async function commitProject(id, opts) {
    const map = await loadWorkspaceMap();
    const workspace = map[id];
    if (!workspace) return { ok: false, stderr: 'No git workspace configured for this project. Prepare workspace first.' };

    const sourceDir = join(projectsDir, id);
    try {
        await fs.access(sourceDir);
    } catch {
        return { ok: false, stderr: 'Project not found.' };
    }

    const repoOk = await hasGitRepo(workspace.localPath);
    if (!repoOk) return { ok: false, stderr: 'Local clone is missing. Prepare workspace again.' };

    const currentBranch = await run(['-C', workspace.localPath, 'rev-parse', '--abbrev-ref', 'HEAD'], workspace.localPath);
    if (!currentBranch.ok) return currentBranch;
    if (PROTECTED_BRANCH.test(currentBranch.stdout)) {
        return { ok: false, stderr: `Refusing to commit directly on protected branch "${currentBranch.stdout}".` };
    }
    if (currentBranch.stdout !== workspace.workBranch) {
        return {
            ok: false,
            stderr: `Workspace is on branch "${currentBranch.stdout}" but expected "${workspace.workBranch}". Prepare workspace first.`,
        };
    }

    const target = await syncProjectIntoWorkspace(id, workspace);
    const add = await run(['-C', workspace.localPath, 'add', '-A', workspace.subdir || '.'], workspace.localPath);
    if (!add.ok) return add;

    const message = (opts?.message && String(opts.message).slice(0, 200)) || `TRA update ${new Date().toISOString()}`;
    const commit = await run(['-C', workspace.localPath, 'commit', '-m', message], workspace.localPath);
    const result = {
        ...commit,
        committed: commit.ok,
        message,
        branch: workspace.workBranch,
        target,
    };

    if (!commit.ok && /nothing to commit/i.test(commit.stdout + commit.stderr)) {
        result.ok = true;
        result.committed = false;
        result.note = 'Nothing to commit (working tree clean).';
    } else if (!commit.ok) {
        return result;
    }

    if (opts?.push) {
        const push = await pushAndVerify(workspace.localPath, workspace.workBranch);
        result.pushOk = push.ok;
        result.pushOutput = push.stdout || push.stderr;
        result.localSha = push.localSha;
        result.remoteBefore = push.remoteBefore;
        result.remoteAfter = push.remoteAfter;
        result.remoteVerified = push.ok && !!push.remoteAfter && push.remoteAfter === push.localSha;
        if (!push.ok) {
            result.ok = false;
            result.stderr = push.stderr || push.stdout || 'Push failed.';
        }
    }
    return result;
}

export async function gitStatus(id) {
    const dir = join(projectsDir, id);
    // Only report the project's OWN repository. Without this guard git would walk up to a
    // parent repository (e.g. the surrounding monorepo) and report its branch by mistake.
    try {
        await fs.access(join(dir, '.git'));
    } catch {
        return { isRepo: false, branch: null, dirty: false };
    }
    const branch = await run(['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'], dir);
    const status = await run(['-C', dir, 'status', '--porcelain'], dir);
    return {
        isRepo: branch.ok,
        branch: branch.ok ? branch.stdout : null,
        dirty: status.ok ? status.stdout.length > 0 : false,
    };
}

/** Short commit SHA of the shared knowledge base, so an assessment can pin the KB version used. */
export async function kbVersion() {
    const r = await run(['-C', knowledgeBaseDir, 'rev-parse', '--short', 'HEAD'], knowledgeBaseDir);
    return r.ok ? r.stdout : null;
}
