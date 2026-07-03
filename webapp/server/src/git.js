// Git helpers for: (1) pulling the shared knowledge base (read-only — no push), and
// (2) committing a project so it can be raised as a PR. Uses execFile with argument
// arrays (never a shell string) so a user-supplied URL cannot inject commands.
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { basename, join } from 'node:path';
import { knowledgeBaseDir, projectsDir } from './paths.js';

function run(args, cwd) {
    return new Promise((resolve) => {
        execFile('git', args, { cwd, timeout: 60000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
            resolve({ ok: !err, stdout: String(stdout || '').trim(), stderr: String(stderr || '').trim() });
        });
    });
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

/** Commit all changes in a project folder (initialising a repo if needed). Optional push. */
export async function commitProject(id, message, push) {
    const dir = join(projectsDir, id);
    try {
        await fs.access(dir);
    } catch {
        return { ok: false, stderr: 'Project not found.' };
    }
    let isRepo = false;
    try {
        await fs.access(join(dir, '.git'));
        isRepo = true;
    } catch {
        /* will init */
    }
    if (!isRepo) {
        const init = await run(['init'], dir);
        if (!init.ok) return init;
        await fs.writeFile(join(dir, '.gitignore'), 'report/\n').catch(() => { });
    }
    const add = await run(['add', '-A'], dir);
    if (!add.ok) return add;
    const msg = (message && String(message).slice(0, 200)) || `TRA update ${new Date().toISOString()}`;
    const commit = await run(['commit', '-m', msg], dir);
    const result = { ...commit, committed: commit.ok, message: msg };
    if (push) {
        const p = await run(['push'], dir);
        result.pushOk = p.ok;
        result.pushOutput = p.stdout || p.stderr;
    }
    // "nothing to commit" returns non-zero but is not an error worth surfacing harshly.
    if (!commit.ok && /nothing to commit/i.test(commit.stdout + commit.stderr)) {
        result.ok = true;
        result.committed = false;
        result.note = 'Nothing to commit (working tree clean).';
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
