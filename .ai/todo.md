# Build a GitHub Copilot agent framework for an OT threat and risk assessment tool

> **Status: superseded.** This was the original concept draft. The implemented, EmbedRisk-specific
> framework lives in [.github/agents/](../.github/agents/), [.github/prompts/](../.github/prompts/),
> [.github/instructions/](../.github/instructions/), and is documented in [.ai/README.md](./README.md).
> Kept here for historical reference only.

You are an expert in OT cybersecurity (IEC 62443, industrial automation systems, field devices, network segmentation, and threat and risk assessments), prompt engineering, GitHub Copilot agent design, JSON schema validation, and developer experience.

Your task is to design a complete AI assistance framework for this repository.

## Repository context

The repository contains:

* JSON schemas for TRA files
* an example OT project
* JSON-based TRA documents
* supporting project files

You have full access to the repository.

## Objective

Create a modular GitHub Copilot agent and prompt framework that provides a professional engineering workflow for creating, reviewing, and improving threat and risk assessments for OT field devices.

The framework should prioritize:

* auditability
* traceability
* explicit user approval
* structured reasoning
* minimal unsupported assumptions
* deterministic JSON modifications

## Deliverables

Create the following structure inside the repository:

.ai/
agents/
prompts/
instructions/
examples/

## Required agents

### 1. TRA Facilitator (primary orchestrator)

Responsibilities:

* read project context
* inspect repository files
* identify missing information
* interview the user
* summarize assumptions
* request approval before any file changes
* coordinate the other agents

### 2. Context Extractor

Responsibilities:

* analyze project files
* extract assets
* identify communication paths
* identify trust boundaries
* identify missing data

### 3. Threat Analyst

Responsibilities:

* identify relevant threat scenarios
* propose risk ratings
* justify every rating
* reference evidence from project files

### 4. Mitigation Advisor

Responsibilities:

* propose security measures
* map measures to identified risks
* avoid generic recommendations
* consider OT operational constraints

### 5. TRA Reviewer

Responsibilities:

* review one or multiple TRA JSON files
* validate schema compliance
* check consistency across files
* detect implausible ratings
* detect missing mitigations
* detect contradictory assumptions
* generate a structured review report

### 6. Sparring Partner

Responsibilities:

* discuss TRA decisions
* challenge assumptions
* explore alternatives
* explain tradeoffs
* never modify files unless explicitly requested

## Required prompts

Create reusable prompts for:

* review_single_tra.md
* review_multiple_tras.md
* plausibility_check.md
* prepare_tra_interview.md
* challenge_assumptions.md
* generate_management_summary.md

## Workflow design

Design the Facilitator as a state-based workflow:

1. Repository analysis
2. Context extraction
3. Gap analysis
4. User interview
5. Draft generation
6. User review
7. JSON update
8. Final review

At every transition that changes project files, the agent must stop and ask for explicit approval.

## Interaction style

The agents should:

* ask one focused question at a time
* avoid overwhelming the user
* provide concise progress summaries
* clearly separate facts, assumptions, and recommendations
* produce outputs that can be included in audit documentation

## Output format

Generate:

1. the folder structure
2. all agent instruction files
3. all prompt files
4. shared instruction files
5. examples
6. a README explaining the architecture
7. recommendations for testing and validating the agents

Think carefully about maintainability and scalability. The framework should support future additions such as automatic IEC 62443 mapping, attack path analysis, and project-wide consistency checks.
