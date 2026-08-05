#!/usr/bin/env node
import { realpathSync, statSync } from 'node:fs';
import { dirname, basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function resolveProjectsDir(argv = process.argv.slice(2), env = process.env, cwd = process.cwd()) {
    const args = Array.isArray(argv) ? argv.filter(Boolean) : [];
    if (args.length > 1) {
        throw new Error('Usage: embedrisk [projects-root]');
    }

    const explicitPath = args[0];
    const sourcePath = explicitPath || env.TRA_PROJECTS_DIR || cwd;
    return resolve(cwd, sourcePath);
}

export function resolveLaunchTarget(argv = process.argv.slice(2), env = process.env, cwd = process.cwd()) {
    const target = resolveProjectsDir(argv, env, cwd);
    try {
        const stepOne = join(target, '01-project-description');
        if (statSync(stepOne).isDirectory()) {
            return { projectsRoot: dirname(target), preselectId: basename(target) };
        }
    } catch {
        // Fall back to container mode on any filesystem error.
    }
    return { projectsRoot: target, preselectId: null };
}

async function main() {
    const { projectsRoot, preselectId } = resolveLaunchTarget();
    process.env.TRA_PROJECTS_DIR = projectsRoot;
    if (preselectId) process.env.TRA_PRESELECT_PROJECT = preselectId;
    else delete process.env.TRA_PRESELECT_PROJECT;
    await import('../server/src/index.js');
}

const isMain = (() => {
    if (!process.argv[1]) return false;
    try {
        return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
    } catch {
        return false;
    }
})();

if (isMain) {
    main().catch((error) => {
        console.error(error?.message || error);
        process.exitCode = 1;
    });
}
