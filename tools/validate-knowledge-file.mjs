#!/usr/bin/env node
// Lightweight, dependency-free structural check for a .tra-knowledge.json sidecar file against
// the schema in .ai/knowledge/tra-knowledge.schema.json. Hand-written on purpose (mirrors the
// style of webapp/server/src/validate.js) rather than pulling in a JSON-Schema library for one file.
//
// Usage: node tools/validate-knowledge-file.mjs <path-to-.tra-knowledge.json>
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUESTION_KINDS = ['fact', 'assumption', 'recommendation-accepted', 'recommendation-rejected'];
const QUESTION_STATUSES = ['pending', 'answered', 'deferred'];
const CONTEXT_CATEGORIES = ['assets', 'communicationPaths', 'trustBoundaries', 'authenticationMethods', 'maintenanceAccess', 'availabilityRequirements', 'constraints'];

const isString = (v) => typeof v === 'string';
const isArray = Array.isArray;
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function checkOpenQuestion(q, index, issues) {
    const at = `interview.openQuestions[${index}]`;
    if (!isString(q?.id)) issues.push(`${at}.id must be a string.`);
    if (!isString(q?.step)) issues.push(`${at}.step must be a string.`);
    if (!isString(q?.question)) issues.push(`${at}.question must be a string.`);
    if (q?.status !== undefined && !QUESTION_STATUSES.includes(q.status))
        issues.push(`${at}.status must be one of ${QUESTION_STATUSES.join(', ')}.`);
}

function checkAnsweredQuestion(q, index, issues) {
    const at = `interview.answeredQuestions[${index}]`;
    if (!isString(q?.id)) issues.push(`${at}.id must be a string.`);
    if (!isString(q?.question)) issues.push(`${at}.question must be a string.`);
    if (!isString(q?.answer)) issues.push(`${at}.answer must be a string.`);
    if (!QUESTION_KINDS.includes(q?.kind)) issues.push(`${at}.kind must be one of ${QUESTION_KINDS.join(', ')}.`);
}

function checkContextEntry(entry, category, index, issues) {
    const at = `confirmedContext.${category}[${index}]`;
    if (!isString(entry?.note)) issues.push(`${at}.note must be a string.`);
}

function checkDecisionLogEntry(entry, index, issues) {
    const at = `decisionLog[${index}]`;
    if (!isString(entry?.date)) issues.push(`${at}.date must be a string.`);
    if (!isString(entry?.change)) issues.push(`${at}.change must be a string.`);
    if (!isArray(entry?.affectedFiles)) issues.push(`${at}.affectedFiles must be an array.`);
    if (!isString(entry?.approvedBy)) issues.push(`${at}.approvedBy must be a string.`);
}

/** Returns a list of human-readable issues; an empty list means the document is valid. */
export function validateKnowledgeFile(doc) {
    const issues = [];
    if (!isObject(doc)) return ['Root value must be an object.'];

    if (doc.schemaVersion !== 1) issues.push('schemaVersion must be the number 1.');
    if (!isString(doc.projectId)) issues.push('projectId is required and must be a string.');
    if (!isString(doc.updatedAt)) issues.push('updatedAt is required and must be a string (ISO-8601 timestamp).');

    if (!isObject(doc.interview)) {
        issues.push('interview is required and must be an object.');
    } else {
        if (doc.interview.currentStep != null && !isString(doc.interview.currentStep))
            issues.push('interview.currentStep must be a string or null.');
        if (doc.interview.completedSteps !== undefined && !isArray(doc.interview.completedSteps))
            issues.push('interview.completedSteps must be an array.');
        if (!isArray(doc.interview.openQuestions)) issues.push('interview.openQuestions is required and must be an array.');
        else doc.interview.openQuestions.forEach((q, i) => checkOpenQuestion(q, i, issues));
        if (!isArray(doc.interview.answeredQuestions)) issues.push('interview.answeredQuestions is required and must be an array.');
        else doc.interview.answeredQuestions.forEach((q, i) => checkAnsweredQuestion(q, i, issues));
    }

    if (!isObject(doc.confirmedContext)) {
        issues.push('confirmedContext is required and must be an object.');
    } else {
        for (const category of CONTEXT_CATEGORIES) {
            const list = doc.confirmedContext[category];
            if (list === undefined) continue;
            if (!isArray(list)) issues.push(`confirmedContext.${category} must be an array when present.`);
            else list.forEach((entry, i) => checkContextEntry(entry, category, i, issues));
        }
    }

    if (doc.decisionLog !== undefined) {
        if (!isArray(doc.decisionLog)) issues.push('decisionLog must be an array when present.');
        else doc.decisionLog.forEach((entry, i) => checkDecisionLogEntry(entry, i, issues));
    }

    return issues;
}

function main() {
    const target = process.argv[2];
    if (!target) {
        console.error('Usage: node tools/validate-knowledge-file.mjs <path-to-.tra-knowledge.json>');
        process.exitCode = 2;
        return;
    }
    const doc = JSON.parse(readFileSync(target, 'utf8'));
    const issues = validateKnowledgeFile(doc);
    if (!issues.length) {
        console.log(`ok - ${target} matches the .tra-knowledge.json schema.`);
        return;
    }
    for (const issue of issues) console.error(`- ${issue}`);
    console.error(`\n${issues.length} issue(s) found in ${target}.`);
    process.exitCode = 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) main();
