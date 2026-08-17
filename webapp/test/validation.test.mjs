import assert from 'node:assert/strict';
import { validate } from '../server/src/validate.js';

function baseProject() {
    return {
        project: {},
        assumptions: {
            attacker: [{ id: 'ATK-1', name: 'Remote attacker', capability: 3, access: 'remote' }],
            device: [],
            system: [],
            environment: [],
            operational: [],
        },
        system: {
            components: [{ id: 'C-1', name: 'Controller', kind: 'software', layer: 1, parent: null }],
            interfaces: [{ id: 'IF-1', name: 'Service port', component: 'C-1', exposure: 'remote' }],
            assets: [{ id: 'AS-1', name: 'Config', objectives: { confidentiality: 1, integrity: 2, availability: 1, safety: 0 } }],
            trustBoundaries: [],
        },
        threats: { threats: [] },
        requirements: { requirements: [] },
        countermeasures: { countermeasures: [] },
        dfd: { nodes: [], flows: [] },
        useCases: { diagrams: [] },
        attackTrees: { trees: [] },
        defects: { defects: [] },
    };
}

function issueMessages(issues, severity) {
    return issues.filter((issue) => !severity || issue.severity === severity).map((issue) => issue.message);
}

function testClassificationNoticeAndTransferRequirementWarning() {
    const project = baseProject();
    project.threats.threats.push({
        id: 'T-1',
        title: 'Spoofed service response',
        stride: ['S'],
        components: ['C-1'],
        assets: ['AS-1'],
        attackerRef: 'ATK-1',
        interfaceRef: 'IF-1',
        likelihood: 3,
        impact: 2,
        status: 'transferred',
    });

    const issues = validate(project);
    assert.ok(issueMessages(issues, 'notice').includes('T-1: classification is unset for a spoofing/tampering/information-disclosure threat; classify whether this is a product vulnerability, protocol limitation, deployment risk, or shared responsibility.'));
    assert.ok(issueMessages(issues, 'warning').includes('T-1: transferred risk requires a linked requirement documenting the risk transfer in the user guide.'));
}

function testDeploymentConstraintsRuleSkipsAcceptedOrTransferredAndFlagsOpen() {
    const project = baseProject();
    project.threats.threats.push(
        {
            id: 'T-1',
            title: 'Open protocol limitation',
            stride: ['I'],
            components: ['C-1'],
            assets: ['AS-1'],
            attackerRef: 'ATK-1',
            interfaceRef: 'IF-1',
            likelihood: 3,
            impact: 1,
            classification: 'protocol-limitation',
            status: 'open',
        },
        {
            id: 'T-2',
            title: 'Accepted protocol limitation',
            stride: ['I'],
            components: ['C-1'],
            assets: ['AS-1'],
            attackerRef: 'ATK-1',
            interfaceRef: 'IF-1',
            likelihood: 3,
            impact: 1,
            classification: 'protocol-limitation',
            status: 'accepted',
        },
        {
            id: 'T-3',
            title: 'Transferred shared responsibility',
            stride: ['T'],
            components: ['C-1'],
            assets: ['AS-1'],
            attackerRef: 'ATK-1',
            interfaceRef: 'IF-1',
            likelihood: 3,
            impact: 1,
            classification: 'shared-responsibility',
            status: 'transferred',
        },
    );

    const warnings = issueMessages(validate(project), 'warning');
    assert.ok(warnings.includes('T-1: protocol-limitation classification requires deploymentConstraints unless the risk is accepted or transferred.'));
    assert.ok(!warnings.includes('T-2: protocol-limitation classification requires deploymentConstraints unless the risk is accepted or transferred.'));
    assert.ok(!warnings.includes('T-3: shared-responsibility classification requires deploymentConstraints unless the risk is accepted or transferred.'));
}

function testContradictoryProductVulnerabilityClassification() {
    const project = baseProject();
    project.threats.threats.push({
        id: 'T-1',
        title: 'Misclassified product flaw',
        stride: ['T'],
        components: ['C-1'],
        assets: ['AS-1'],
        attackerRef: 'ATK-1',
        interfaceRef: 'IF-1',
        likelihood: 2,
        impact: 2,
        classification: 'product-vulnerability',
        responsibility: 'integrator-operator',
        deploymentConstraints: 'Segment the network.',
        status: 'open',
    });

    const warnings = issueMessages(validate(project), 'warning');
    assert.ok(warnings.includes('T-1: product-vulnerability with integrator-operator responsibility and deploymentConstraints is contradictory.'));
}

function testTransferredThreatWithLinkedRequirementDoesNotWarn() {
    const project = baseProject();
    project.threats.threats.push({
        id: 'T-1',
        title: 'Transferred threat',
        stride: ['S'],
        components: ['C-1'],
        assets: ['AS-1'],
        attackerRef: 'ATK-1',
        interfaceRef: 'IF-1',
        likelihood: 2,
        impact: 2,
        classification: 'deployment-risk',
        status: 'transferred',
    });
    project.requirements.requirements.push({
        id: 'R-1',
        text: 'The user guide shall document this transferred risk.',
        derivedFromThreat: ['T-1'],
    });

    const warnings = issueMessages(validate(project), 'warning');
    assert.ok(!warnings.includes('T-1: transferred risk requires a linked requirement documenting the risk transfer in the user guide.'));
}

testClassificationNoticeAndTransferRequirementWarning();
testDeploymentConstraintsRuleSkipsAcceptedOrTransferredAndFlagsOpen();
testContradictoryProductVulnerabilityClassification();
testTransferredThreatWithLinkedRequirementDoesNotWarn();

console.log('validation tests passed');
