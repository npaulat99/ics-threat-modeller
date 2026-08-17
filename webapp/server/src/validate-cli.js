#!/usr/bin/env node
// Runs the TRA schema/plausibility validator (validate.js) against a single project folder,
// without mutating any files. Suitable for local checks and CI.
//
// Usage: node src/validate-cli.js <path-to-project-folder>
import { basename, dirname, resolve } from 'node:path';

async function main() {
    const target = process.argv[2];
    if (!target) {
        console.error('Usage: node src/validate-cli.js <path-to-project-folder>');
        process.exitCode = 2;
        return;
    }

    const projectPath = resolve(target);
    const projectId = basename(projectPath);
    // paths.js reads TRA_PROJECTS_DIR at import time, so it must be set before importing it
    // (directly, or transitively via artifacts.js).
    process.env.TRA_PROJECTS_DIR = dirname(projectPath);

    const { STEP_KEYS, readArtifact } = await import('./artifacts.js');
    const { validate } = await import('./validate.js');

    const entries = await Promise.all(STEP_KEYS.map(async (step) => [step, await readArtifact(projectId, step)]));
    const project = Object.fromEntries(entries);
    const issues = validate(project);

    for (const issue of issues) console.log(`[${issue.severity}] ${issue.message}`);

    const errorCount = issues.filter((i) => i.severity === 'error').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;
    const noticeCount = issues.filter((i) => i.severity === 'notice').length;
    console.log(`\n${errorCount} error(s), ${warningCount} warning(s), ${noticeCount} notice(s).`);

    // Only structural errors fail the command; warnings/notices are for human review.
    process.exitCode = errorCount > 0 ? 1 : 0;
}

main().catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
});
