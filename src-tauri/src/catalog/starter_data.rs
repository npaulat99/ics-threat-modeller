// Starter catalog data for seeding the database.
// Each entry is a self-contained attack-tree template.

use crate::db::models::CatalogEntry;
use uuid::Uuid;

/// Return all starter catalog entries.
pub fn get_starter_entries() -> Vec<CatalogEntry> {
    vec![
        firmware_compromise(),
        process_manipulation(),
        persistent_access(),
        information_leakage(),
        supply_chain_attack(),
        credential_theft(),
        denial_of_service(),
        sensor_spoofing(),
    ]
}

fn firmware_compromise() -> CatalogEntry {
    let tree_data = serde_json::json!({
        "goal": {
            "name": "Compromise Device Firmware",
            "description": "Attacker modifies or replaces device firmware to gain persistent control.",
            "aggregation_type": "or"
        },
        "steps": [
            {
                "name": "Physical Access Firmware Extraction",
                "description": "Physically extract firmware from device using debug interfaces (JTAG, UART).",
                "is_leaf": true,
                "assessments": [
                    {"factor_name": "Elapsed Time", "factor_value": 4, "rationale": "Requires physical proximity and specialized tools."},
                    {"factor_name": "Expertise", "factor_value": 6, "rationale": "Requires knowledge of embedded hardware debugging."},
                    {"factor_name": "Knowledge of Target", "factor_value": 7, "rationale": "Needs device-specific debug port information."},
                    {"factor_name": "Window of Opportunity", "factor_value": 3, "rationale": "Requires physical access window."},
                    {"factor_name": "Equipment", "factor_value": 5, "rationale": "Specialized debug probes and adapters."}
                ],
                "countermeasures": [
                    {"name": "Disable Debug Ports", "description": "Fuse-blow or disable JTAG/SWD in production.", "effectiveness": 8},
                    {"name": "Firmware Encryption", "description": "Encrypt firmware at rest so extraction yields ciphertext.", "effectiveness": 7},
                    {"name": "Physical Tamper Detection", "description": "Tamper-evident enclosures with alert mechanisms.", "effectiveness": 5}
                ],
                "technique_mappings": [
                    {"technique_id": "T0839", "technique_name": "Module Firmware", "source": "MITRE ATT&CK for ICS"}
                ]
            },
            {
                "name": "Remote Firmware Update Hijack",
                "description": "Intercept or forge firmware update to inject malicious code.",
                "is_leaf": true,
                "assessments": [
                    {"factor_name": "Elapsed Time", "factor_value": 7, "rationale": "Requires time to reverse update protocol."},
                    {"factor_name": "Expertise", "factor_value": 8, "rationale": "Advanced reverse engineering and crypto skills."},
                    {"factor_name": "Knowledge of Target", "factor_value": 8, "rationale": "Update mechanism must be understood."},
                    {"factor_name": "Window of Opportunity", "factor_value": 6, "rationale": "Must coincide with firmware update cycle."},
                    {"factor_name": "Equipment", "factor_value": 4, "rationale": "Network intercept tools and signing bypass."}
                ],
                "countermeasures": [
                    {"name": "Signed Firmware Updates", "description": "Cryptographically sign all firmware images.", "effectiveness": 9},
                    {"name": "Secure Boot Chain", "description": "Verify firmware signature before execution.", "effectiveness": 9},
                    {"name": "Encrypted Update Channel", "description": "TLS/DTLS for firmware delivery.", "effectiveness": 6}
                ],
                "technique_mappings": [
                    {"technique_id": "T0857", "technique_name": "System Firmware", "source": "MITRE ATT&CK for ICS"}
                ]
            }
        ]
    });

    CatalogEntry {
        id: Uuid::new_v4().to_string(),
        entry_type: "attack_tree".to_string(),
        name: "Firmware Compromise".to_string(),
        description: "Attack tree template for firmware compromise scenarios on embedded ICS devices.".to_string(),
        tree_data: serde_json::to_string(&tree_data).unwrap(),
        source_framework: "ICS-CERT / MITRE ATT&CK for ICS".to_string(),
        version: "1.0".to_string(),
        tags: "[]".to_string(),
        created_at: String::new(),
        updated_at: String::new(),
    }
}

fn process_manipulation() -> CatalogEntry {
    let tree_data = serde_json::json!({
        "goal": {
            "name": "Manipulate Industrial Process",
            "description": "Attacker alters process parameters to cause physical damage or unsafe conditions.",
            "aggregation_type": "or"
        },
        "steps": [
            {
                "name": "Modify Setpoints via HMI",
                "description": "Gain access to HMI and change process setpoints.",
                "is_leaf": true,
                "assessments": [
                    {"factor_name": "Elapsed Time", "factor_value": 3, "rationale": "Quick once HMI access is obtained."},
                    {"factor_name": "Expertise", "factor_value": 4, "rationale": "Process knowledge needed."},
                    {"factor_name": "Knowledge of Target", "factor_value": 5, "rationale": "Specific setpoint ranges must be known."},
                    {"factor_name": "Window of Opportunity", "factor_value": 5, "rationale": "Requires network or physical access."},
                    {"factor_name": "Equipment", "factor_value": 2, "rationale": "Standard network tools."}
                ],
                "countermeasures": [
                    {"name": "HMI Authentication", "description": "Require strong authentication for setpoint changes.", "effectiveness": 8},
                    {"name": "Rate-of-Change Limits", "description": "PLC enforces maximum rate of change for critical parameters.", "effectiveness": 7}
                ],
                "technique_mappings": [
                    {"technique_id": "T0836", "technique_name": "Modify Parameter", "source": "MITRE ATT&CK for ICS"}
                ]
            },
            {
                "name": "PLC Logic Modification",
                "description": "Upload modified control logic to PLC.",
                "is_leaf": true,
                "assessments": [
                    {"factor_name": "Elapsed Time", "factor_value": 6, "rationale": "Must analyze and modify ladder logic."},
                    {"factor_name": "Expertise", "factor_value": 7, "rationale": "PLC programming expertise required."},
                    {"factor_name": "Knowledge of Target", "factor_value": 8, "rationale": "Specific PLC model and program structure."},
                    {"factor_name": "Window of Opportunity", "factor_value": 4, "rationale": "Engineering workstation access needed."},
                    {"factor_name": "Equipment", "factor_value": 5, "rationale": "PLC programming software."}
                ],
                "countermeasures": [
                    {"name": "PLC Key Switch", "description": "Physical key switch to prevent remote logic upload.", "effectiveness": 9},
                    {"name": "Logic Change Detection", "description": "Monitor for unauthorized logic changes.", "effectiveness": 7}
                ],
                "technique_mappings": [
                    {"technique_id": "T0833", "technique_name": "Modify Control Logic", "source": "MITRE ATT&CK for ICS"}
                ]
            }
        ]
    });

    CatalogEntry {
        id: Uuid::new_v4().to_string(),
        entry_type: "attack_tree".to_string(),
        name: "Process Manipulation".to_string(),
        description: "Attack tree template for industrial process manipulation scenarios.".to_string(),
        tree_data: serde_json::to_string(&tree_data).unwrap(),
        source_framework: "ICS-CERT / MITRE ATT&CK for ICS".to_string(),
        version: "1.0".to_string(),
        tags: "[]".to_string(),
        created_at: String::new(),
        updated_at: String::new(),
    }
}

fn persistent_access() -> CatalogEntry {
    let tree_data = serde_json::json!({
        "goal": {
            "name": "Establish Persistent Access",
            "description": "Attacker establishes long-term covert access to the ICS network.",
            "aggregation_type": "or"
        },
        "steps": [
            {
                "name": "Implant Backdoor in Engineering Workstation",
                "description": "Install persistent backdoor on engineering workstation.",
                "is_leaf": true,
                "assessments": [
                    {"factor_name": "Elapsed Time", "factor_value": 5, "rationale": "Social engineering plus malware deployment."},
                    {"factor_name": "Expertise", "factor_value": 6, "rationale": "Malware development and evasion."},
                    {"factor_name": "Knowledge of Target", "factor_value": 4, "rationale": "OS and AV information."},
                    {"factor_name": "Window of Opportunity", "factor_value": 5, "rationale": "Phishing or USB drop opportunity."},
                    {"factor_name": "Equipment", "factor_value": 4, "rationale": "Custom malware and C2 infrastructure."}
                ],
                "countermeasures": [
                    {"name": "Application Whitelisting", "description": "Only allow approved applications to execute.", "effectiveness": 8},
                    {"name": "USB Port Lockdown", "description": "Disable or monitor USB ports.", "effectiveness": 6}
                ],
                "technique_mappings": [
                    {"technique_id": "T0889", "technique_name": "Modify Program", "source": "MITRE ATT&CK for ICS"}
                ]
            },
            {
                "name": "Compromise Network Infrastructure",
                "description": "Take control of switches/routers to maintain access.",
                "is_leaf": true,
                "assessments": [
                    {"factor_name": "Elapsed Time", "factor_value": 4, "rationale": "Default credentials or known vulnerabilities."},
                    {"factor_name": "Expertise", "factor_value": 5, "rationale": "Network administration skills."},
                    {"factor_name": "Knowledge of Target", "factor_value": 5, "rationale": "Network topology knowledge."},
                    {"factor_name": "Window of Opportunity", "factor_value": 6, "rationale": "Remote access to management interfaces."},
                    {"factor_name": "Equipment", "factor_value": 3, "rationale": "Standard pentest tools."}
                ],
                "countermeasures": [
                    {"name": "Network Segmentation", "description": "Isolate OT network from IT network.", "effectiveness": 8},
                    {"name": "Change Default Credentials", "description": "Replace all default passwords.", "effectiveness": 7}
                ],
                "technique_mappings": [
                    {"technique_id": "T0883", "technique_name": "Internet Accessible Device", "source": "MITRE ATT&CK for ICS"}
                ]
            }
        ]
    });

    CatalogEntry {
        id: Uuid::new_v4().to_string(),
        entry_type: "attack_tree".to_string(),
        name: "Persistent Access".to_string(),
        description: "Attack tree template for establishing persistent access to ICS environments.".to_string(),
        tree_data: serde_json::to_string(&tree_data).unwrap(),
        source_framework: "ICS-CERT / MITRE ATT&CK for ICS".to_string(),
        version: "1.0".to_string(),
        tags: "[]".to_string(),
        created_at: String::new(),
        updated_at: String::new(),
    }
}

fn information_leakage() -> CatalogEntry {
    let tree_data = serde_json::json!({
        "goal": {
            "name": "Exfiltrate Sensitive Process Data",
            "description": "Attacker extracts proprietary process information, recipes, or configurations.",
            "aggregation_type": "or"
        },
        "steps": [
            {
                "name": "Network Traffic Capture",
                "description": "Capture unencrypted OT protocol traffic (Modbus, DNP3, EtherNet/IP).",
                "is_leaf": true,
                "assessments": [
                    {"factor_name": "Elapsed Time", "factor_value": 2, "rationale": "Passive sniffing is fast."},
                    {"factor_name": "Expertise", "factor_value": 3, "rationale": "Basic network analysis."},
                    {"factor_name": "Knowledge of Target", "factor_value": 3, "rationale": "Protocol identification."},
                    {"factor_name": "Window of Opportunity", "factor_value": 4, "rationale": "Network segment access."},
                    {"factor_name": "Equipment", "factor_value": 2, "rationale": "Standard packet capture tools."}
                ],
                "countermeasures": [
                    {"name": "OT Protocol Encryption", "description": "Use encrypted variants of industrial protocols.", "effectiveness": 8},
                    {"name": "Network Monitoring", "description": "IDS for anomalous traffic patterns.", "effectiveness": 6}
                ],
                "technique_mappings": [
                    {"technique_id": "T0801", "technique_name": "Monitor Process State", "source": "MITRE ATT&CK for ICS"}
                ]
            },
            {
                "name": "Historian Database Exfiltration",
                "description": "Access process historian to extract historical data.",
                "is_leaf": true,
                "assessments": [
                    {"factor_name": "Elapsed Time", "factor_value": 3, "rationale": "SQL queries once access is gained."},
                    {"factor_name": "Expertise", "factor_value": 4, "rationale": "Database and OT knowledge."},
                    {"factor_name": "Knowledge of Target", "factor_value": 5, "rationale": "Database schema and location."},
                    {"factor_name": "Window of Opportunity", "factor_value": 5, "rationale": "Historian network access."},
                    {"factor_name": "Equipment", "factor_value": 2, "rationale": "Database client tools."}
                ],
                "countermeasures": [
                    {"name": "Historian Access Controls", "description": "Role-based access to historian data.", "effectiveness": 7},
                    {"name": "Data Loss Prevention", "description": "Monitor for large data transfers.", "effectiveness": 6}
                ],
                "technique_mappings": [
                    {"technique_id": "T0802", "technique_name": "Automated Collection", "source": "MITRE ATT&CK for ICS"}
                ]
            }
        ]
    });

    CatalogEntry {
        id: Uuid::new_v4().to_string(),
        entry_type: "attack_tree".to_string(),
        name: "Information Leakage".to_string(),
        description: "Attack tree template for exfiltration of sensitive process data from ICS.".to_string(),
        tree_data: serde_json::to_string(&tree_data).unwrap(),
        source_framework: "ICS-CERT / MITRE ATT&CK for ICS".to_string(),
        version: "1.0".to_string(),
        tags: "[]".to_string(),
        created_at: String::new(),
        updated_at: String::new(),
    }
}

fn supply_chain_attack() -> CatalogEntry {
    let tree_data = serde_json::json!({
        "goal": {
            "name": "Compromise via Supply Chain",
            "description": "Introduce malicious components through the supply chain before deployment.",
            "aggregation_type": "or"
        },
        "steps": [
            {
                "name": "Trojanized Component Delivery",
                "description": "Replace legitimate hardware or software with trojanized version.",
                "is_leaf": true,
                "assessments": [
                    {"factor_name": "Elapsed Time", "factor_value": 8, "rationale": "Long-term supply chain infiltration."},
                    {"factor_name": "Expertise", "factor_value": 9, "rationale": "Hardware/software design expertise."},
                    {"factor_name": "Knowledge of Target", "factor_value": 6, "rationale": "Target procurement processes."},
                    {"factor_name": "Window of Opportunity", "factor_value": 7, "rationale": "Supply chain access point."},
                    {"factor_name": "Equipment", "factor_value": 7, "rationale": "Manufacturing or development capability."}
                ],
                "countermeasures": [
                    {"name": "Vendor Verification", "description": "Verify component authenticity and provenance.", "effectiveness": 7},
                    {"name": "Incoming Inspection", "description": "Test components before deployment.", "effectiveness": 6}
                ],
                "technique_mappings": [
                    {"technique_id": "T0862", "technique_name": "Supply Chain Compromise", "source": "MITRE ATT&CK for ICS"}
                ]
            }
        ]
    });

    CatalogEntry {
        id: Uuid::new_v4().to_string(),
        entry_type: "attack_tree".to_string(),
        name: "Supply Chain Attack".to_string(),
        description: "Attack tree template for supply chain compromise of ICS components.".to_string(),
        tree_data: serde_json::to_string(&tree_data).unwrap(),
        source_framework: "MITRE ATT&CK for ICS".to_string(),
        version: "1.0".to_string(),
        tags: "[]".to_string(),
        created_at: String::new(),
        updated_at: String::new(),
    }
}

fn credential_theft() -> CatalogEntry {
    let tree_data = serde_json::json!({
        "goal": {
            "name": "Steal ICS Credentials",
            "description": "Obtain valid credentials for ICS systems to enable further attacks.",
            "aggregation_type": "or"
        },
        "steps": [
            {
                "name": "Default Credential Exploitation",
                "description": "Use known default credentials on ICS devices.",
                "is_leaf": true,
                "assessments": [
                    {"factor_name": "Elapsed Time", "factor_value": 1, "rationale": "Trivial to attempt."},
                    {"factor_name": "Expertise", "factor_value": 2, "rationale": "Publicly available lists."},
                    {"factor_name": "Knowledge of Target", "factor_value": 3, "rationale": "Device model identification."},
                    {"factor_name": "Window of Opportunity", "factor_value": 4, "rationale": "Network access to device."},
                    {"factor_name": "Equipment", "factor_value": 1, "rationale": "Standard tools."}
                ],
                "countermeasures": [
                    {"name": "Change Default Passwords", "description": "Replace all factory-default credentials.", "effectiveness": 9},
                    {"name": "Password Policy", "description": "Enforce strong password policy for OT systems.", "effectiveness": 7}
                ],
                "technique_mappings": [
                    {"technique_id": "T0812", "technique_name": "Default Credentials", "source": "MITRE ATT&CK for ICS"}
                ]
            },
            {
                "name": "Credential Harvesting from IT/OT Convergence",
                "description": "Extract credentials from shared IT/OT authentication systems.",
                "is_leaf": true,
                "assessments": [
                    {"factor_name": "Elapsed Time", "factor_value": 4, "rationale": "Active directory enumeration."},
                    {"factor_name": "Expertise", "factor_value": 5, "rationale": "AD exploitation skills."},
                    {"factor_name": "Knowledge of Target", "factor_value": 4, "rationale": "AD structure knowledge."},
                    {"factor_name": "Window of Opportunity", "factor_value": 5, "rationale": "IT network access."},
                    {"factor_name": "Equipment", "factor_value": 3, "rationale": "Credential dumping tools."}
                ],
                "countermeasures": [
                    {"name": "Separate OT Authentication", "description": "Dedicated authentication for OT systems.", "effectiveness": 8},
                    {"name": "Multi-Factor Authentication", "description": "MFA for critical ICS access.", "effectiveness": 8}
                ],
                "technique_mappings": [
                    {"technique_id": "T0859", "technique_name": "Valid Accounts", "source": "MITRE ATT&CK for ICS"}
                ]
            }
        ]
    });

    CatalogEntry {
        id: Uuid::new_v4().to_string(),
        entry_type: "attack_tree".to_string(),
        name: "Credential Theft".to_string(),
        description: "Attack tree template for credential theft targeting ICS systems.".to_string(),
        tree_data: serde_json::to_string(&tree_data).unwrap(),
        source_framework: "MITRE ATT&CK for ICS".to_string(),
        version: "1.0".to_string(),
        tags: "[]".to_string(),
        created_at: String::new(),
        updated_at: String::new(),
    }
}

fn denial_of_service() -> CatalogEntry {
    let tree_data = serde_json::json!({
        "goal": {
            "name": "Deny Control System Availability",
            "description": "Prevent operators from monitoring or controlling the industrial process.",
            "aggregation_type": "or"
        },
        "steps": [
            {
                "name": "Network Flooding",
                "description": "Flood OT network to disrupt communications between controllers and HMIs.",
                "is_leaf": true,
                "assessments": [
                    {"factor_name": "Elapsed Time", "factor_value": 1, "rationale": "Immediate effect."},
                    {"factor_name": "Expertise", "factor_value": 3, "rationale": "Basic DoS tools."},
                    {"factor_name": "Knowledge of Target", "factor_value": 2, "rationale": "Network topology."},
                    {"factor_name": "Window of Opportunity", "factor_value": 4, "rationale": "Network access."},
                    {"factor_name": "Equipment", "factor_value": 2, "rationale": "Traffic generation tools."}
                ],
                "countermeasures": [
                    {"name": "Network Segmentation", "description": "Segment OT network from IT.", "effectiveness": 7},
                    {"name": "Traffic Rate Limiting", "description": "Limit traffic rates on OT network segments.", "effectiveness": 6}
                ],
                "technique_mappings": [
                    {"technique_id": "T0814", "technique_name": "Denial of Service", "source": "MITRE ATT&CK for ICS"}
                ]
            },
            {
                "name": "Device Crash via Malformed Packets",
                "description": "Send malformed protocol packets to crash PLCs or RTUs.",
                "is_leaf": true,
                "assessments": [
                    {"factor_name": "Elapsed Time", "factor_value": 3, "rationale": "Fuzzing and exploit development."},
                    {"factor_name": "Expertise", "factor_value": 5, "rationale": "Protocol and vulnerability knowledge."},
                    {"factor_name": "Knowledge of Target", "factor_value": 6, "rationale": "Device firmware version."},
                    {"factor_name": "Window of Opportunity", "factor_value": 4, "rationale": "Network access to device."},
                    {"factor_name": "Equipment", "factor_value": 3, "rationale": "Protocol fuzzer."}
                ],
                "countermeasures": [
                    {"name": "Deep Packet Inspection", "description": "Industrial firewalls with protocol validation.", "effectiveness": 7},
                    {"name": "Firmware Patching", "description": "Apply vendor patches for known vulnerabilities.", "effectiveness": 8}
                ],
                "technique_mappings": [
                    {"technique_id": "T0880", "technique_name": "Loss of Safety", "source": "MITRE ATT&CK for ICS"}
                ]
            }
        ]
    });

    CatalogEntry {
        id: Uuid::new_v4().to_string(),
        entry_type: "attack_tree".to_string(),
        name: "Denial of Service".to_string(),
        description: "Attack tree template for denial of service attacks against ICS.".to_string(),
        tree_data: serde_json::to_string(&tree_data).unwrap(),
        source_framework: "MITRE ATT&CK for ICS".to_string(),
        version: "1.0".to_string(),
        tags: "[]".to_string(),
        created_at: String::new(),
        updated_at: String::new(),
    }
}

fn sensor_spoofing() -> CatalogEntry {
    let tree_data = serde_json::json!({
        "goal": {
            "name": "Spoof Sensor Readings",
            "description": "Manipulate sensor data to hide malicious process changes or cause incorrect operator response.",
            "aggregation_type": "or"
        },
        "steps": [
            {
                "name": "Man-in-the-Middle on Sensor Network",
                "description": "Intercept and modify sensor readings between field devices and controllers.",
                "is_leaf": true,
                "assessments": [
                    {"factor_name": "Elapsed Time", "factor_value": 5, "rationale": "Setup and calibration of MITM."},
                    {"factor_name": "Expertise", "factor_value": 6, "rationale": "OT protocol analysis."},
                    {"factor_name": "Knowledge of Target", "factor_value": 7, "rationale": "Sensor addresses and expected ranges."},
                    {"factor_name": "Window of Opportunity", "factor_value": 4, "rationale": "Physical or network access."},
                    {"factor_name": "Equipment", "factor_value": 5, "rationale": "Protocol-aware proxy tools."}
                ],
                "countermeasures": [
                    {"name": "Sensor Data Authentication", "description": "Authenticate sensor communications.", "effectiveness": 8},
                    {"name": "Redundant Sensors", "description": "Cross-check with independent sensor measurements.", "effectiveness": 7}
                ],
                "technique_mappings": [
                    {"technique_id": "T0832", "technique_name": "Manipulation of View", "source": "MITRE ATT&CK for ICS"}
                ]
            }
        ]
    });

    CatalogEntry {
        id: Uuid::new_v4().to_string(),
        entry_type: "attack_tree".to_string(),
        name: "Sensor Spoofing".to_string(),
        description: "Attack tree template for sensor data manipulation in ICS.".to_string(),
        tree_data: serde_json::to_string(&tree_data).unwrap(),
        source_framework: "MITRE ATT&CK for ICS".to_string(),
        version: "1.0".to_string(),
        tags: "[]".to_string(),
        created_at: String::new(),
        updated_at: String::new(),
    }
}
