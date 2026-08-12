#!/usr/bin/env node
// Structural acceptance check for the TRA agent framework: proves the write restriction is wired
// (only the Facilitator can write files) and that the default-write policy (with its explicit-review
// opt-in) is documented consistently, and that the one-question-at-a-time interview rule is present.
// This exercises the framework's *mechanism*, not the full TRA domain model or a live model run —
// mirrors the plain-assert style of tools/test-models.js.
//
// Usage: node tools/test-tra-framework.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const agentsDir = join(root, '.github', 'agents');
const instructionsDir = join(root, '.github', 'instructions');

const FACILITATOR = 'tra-facilitator';
const READ_ONLY_AGENTS = ['tra-context-extractor', 'tra-threat-analyst', 'tra-mitigation-advisor', 'tra-reviewer', 'tra-sparring-partner'];

function readAgent(name) {
    return readFileSync(join(agentsDir, `${name}.agent.md`), 'utf8');
}

/** Extracts the frontmatter `tools: [a, b, c]` list; returns [] if the key is absent. */
function frontmatterTools(source) {
    const match = /^tools:\s*\[(.*)\]\s*$/m.exec(source);
    if (!match) return [];
    return match[1].split(',').map((t) => t.trim()).filter(Boolean);
}

function testOnlyFacilitatorCanEdit() {
    const facilitatorTools = frontmatterTools(readAgent(FACILITATOR));
    assert.ok(facilitatorTools.includes('edit'), 'tra-facilitator must keep the edit tool — it is the only agent allowed to write TRA JSON.');

    for (const name of READ_ONLY_AGENTS) {
        const tools = frontmatterTools(readAgent(name));
        assert.ok(!tools.includes('edit'), `${name} must stay read-only (no 'edit' tool) — no other agent may write TRA JSON directly.`);
    }
}

function testWritePolicyIsDocumented() {
    const body = readAgent(FACILITATOR);
    assert.match(body, /by default, write each change immediately after presenting its summary/i, 'tra-facilitator instructions must document the default write-immediately policy.');
    assert.match(body, /explicitly requests review before writing/i, 'tra-facilitator instructions must document the explicit-review exception to the default write policy.');

    const instructions = readFileSync(join(instructionsDir, 'tra-json-editing.instructions.md'), 'utf8');
    assert.match(
        instructions,
        /by default, write each change immediately after presenting its summary/i,
        'tra-json-editing.instructions.md must restate the default write policy in the same terms as the Facilitator.',
    );
    assert.match(
        instructions,
        /explicitly requests review before writing/i,
        'tra-json-editing.instructions.md must restate the explicit-review exception in the same terms as the Facilitator.',
    );
}

function testOneQuestionAtATime() {
    const body = readAgent(FACILITATOR);
    assert.match(body, /one focused question/i, 'tra-facilitator instructions must require one focused question at a time during the interview.');
    assert.match(body, /wait for the answer before moving on/i, 'tra-facilitator instructions must require waiting for the answer before continuing.');
    assert.match(body, /do not batch/i, 'tra-facilitator instructions must explicitly forbid batching multiple questions in one message.');
}

function testTrustBoundaryAliasExceptionIsConsistent() {
    const instructions = readFileSync(join(instructionsDir, 'tra-json-editing.instructions.md'), 'utf8');
    const reviewer = readFileSync(join(agentsDir, 'tra-reviewer.agent.md'), 'utf8');
    assert.match(instructions, /trust-boundary.*reuse the id|reuse the id.*trust boundary/is, 'tra-json-editing.instructions.md must document the DFD trust-boundary id-alias exception.');
    assert.match(reviewer, /trust-boundary.*reuses the id|reuses the id.*trust boundary/is, 'tra-reviewer.agent.md must document the same DFD trust-boundary id-alias exception as the validator.');
}

const tests = [testOnlyFacilitatorCanEdit, testWritePolicyIsDocumented, testOneQuestionAtATime, testTrustBoundaryAliasExceptionIsConsistent];

let failures = 0;
for (const test of tests) {
    try {
        test();
        console.log(`ok - ${test.name}`);
    } catch (error) {
        failures++;
        console.error(`not ok - ${test.name}\n  ${error.message}`);
    }
}

console.log(`\n${tests.length - failures}/${tests.length} checks passed.`);

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) process.exitCode = failures ? 1 : 0;
