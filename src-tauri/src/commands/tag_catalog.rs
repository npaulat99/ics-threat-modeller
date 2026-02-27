// Tag Catalog CRUD commands — manages the predefined tag database
// for assets, interfaces, and third-party software suggestions.

use crate::db::models::{CreateTagCatalogEntry, TagCatalogEntry};
use crate::db::Database;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

fn row_to_tag_catalog(row: &rusqlite::Row) -> rusqlite::Result<TagCatalogEntry> {
    Ok(TagCatalogEntry {
        id: row.get(0)?,
        category: row.get(1)?,
        name: row.get(2)?,
        description: row.get(3)?,
        created_at: row.get(4)?,
    })
}

#[tauri::command]
pub fn create_tag_catalog_entry(
    db: State<'_, Database>,
    data: CreateTagCatalogEntry,
) -> Result<TagCatalogEntry, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT INTO tag_catalog (id, category, name, description, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, data.category, data.name, data.description.unwrap_or_default(), now],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, category, name, description, created_at FROM tag_catalog WHERE id = ?1",
        params![id],
        |row| row_to_tag_catalog(row),
    )
    .map_err(|e| e.to_string())
}

/// List all tag catalog entries, optionally filtered by category.
#[tauri::command]
pub fn list_tag_catalog(
    db: State<'_, Database>,
    category: Option<String>,
) -> Result<Vec<TagCatalogEntry>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    list_tag_catalog_internal(&conn, category.as_deref())
}

pub fn list_tag_catalog_internal(
    conn: &rusqlite::Connection,
    category: Option<&str>,
) -> Result<Vec<TagCatalogEntry>, String> {
    if let Some(cat) = category {
        let mut stmt = conn
            .prepare("SELECT id, category, name, description, created_at FROM tag_catalog WHERE category = ?1 ORDER BY name")
            .map_err(|e| e.to_string())?;
        let items = stmt
            .query_map(params![cat], |row| row_to_tag_catalog(row))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(items)
    } else {
        let mut stmt = conn
            .prepare("SELECT id, category, name, description, created_at FROM tag_catalog ORDER BY category, name")
            .map_err(|e| e.to_string())?;
        let items = stmt
            .query_map([], |row| row_to_tag_catalog(row))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(items)
    }
}

#[tauri::command]
pub fn delete_tag_catalog_entry(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tag_catalog WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Search tag catalog entries by name (partial match).
#[tauri::command]
pub fn search_tag_catalog(
    db: State<'_, Database>,
    query: String,
    category: Option<String>,
) -> Result<Vec<TagCatalogEntry>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let search = format!("%{}%", query);

    if let Some(cat) = category {
        let mut stmt = conn
            .prepare("SELECT id, category, name, description, created_at FROM tag_catalog WHERE category = ?1 AND (name LIKE ?2 OR description LIKE ?2) ORDER BY name")
            .map_err(|e| e.to_string())?;
        let items = stmt
            .query_map(params![cat, search], |row| row_to_tag_catalog(row))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(items)
    } else {
        let mut stmt = conn
            .prepare("SELECT id, category, name, description, created_at FROM tag_catalog WHERE name LIKE ?1 OR description LIKE ?1 ORDER BY category, name")
            .map_err(|e| e.to_string())?;
        let items = stmt
            .query_map(params![search], |row| row_to_tag_catalog(row))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(items)
    }
}

/// Seed the tag catalog with ICS-relevant default entries.
pub fn seed_tag_catalog(conn: &rusqlite::Connection) -> Result<(), String> {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM tag_catalog", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    if count > 0 {
        return Ok(());
    }

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // ─── Assets ────────────────────────────────────────────────────
    let assets = vec![
        ("PLC", "Programmable Logic Controller"),
        ("RTU", "Remote Terminal Unit"),
        ("HMI", "Human-Machine Interface"),
        (
            "SCADA Server",
            "Supervisory Control and Data Acquisition server",
        ),
        ("DCS Controller", "Distributed Control System controller"),
        (
            "Engineering Workstation",
            "Used for programming and configuring controllers",
        ),
        ("Historian", "Data historian / process data archive"),
        ("Safety System (SIS)", "Safety Instrumented System"),
        ("IED", "Intelligent Electronic Device"),
        ("Sensor", "Field sensor / transmitter"),
        ("Actuator", "Field actuator (valve, motor, relay)"),
        ("Network Switch", "Industrial Ethernet switch"),
        ("Firewall", "Network firewall / security appliance"),
        ("Data Diode", "Unidirectional security gateway"),
        ("Wireless Access Point", "Industrial wireless AP"),
        ("Gateway", "Protocol conversion gateway"),
        ("OPC UA Server", "OPC Unified Architecture server"),
        ("Badge Reader", "Physical access control reader"),
        ("Camera System", "CCTV / surveillance system"),
        ("IO Module", "Remote I/O module"),
    ];

    // ─── Interfaces ────────────────────────────────────────────────
    let interfaces = vec![
        ("Ethernet/IP", "Industrial Ethernet protocol (CIP-based)"),
        ("Modbus TCP", "Modbus over TCP/IP"),
        ("Modbus RTU", "Modbus over serial RS-485/RS-232"),
        ("PROFINET", "Siemens PROFINET industrial Ethernet"),
        ("PROFIBUS", "Siemens PROFIBUS fieldbus"),
        ("OPC UA", "OPC Unified Architecture"),
        (
            "OPC DA/HDA",
            "OPC Classic (Data Access / Historical Data Access)",
        ),
        ("DNP3", "Distributed Network Protocol 3"),
        ("IEC 61850", "Substation communication standard"),
        ("IEC 60870-5-104", "Telecontrol protocol (IEC 104)"),
        ("BACnet", "Building Automation and Control network"),
        ("HART", "Highway Addressable Remote Transducer"),
        ("Foundation Fieldbus", "Process automation fieldbus"),
        ("CAN Bus", "Controller Area Network"),
        ("MQTT", "Message Queuing Telemetry Transport"),
        ("HTTP/REST", "HTTP REST API"),
        ("SSH", "Secure Shell"),
        ("RDP", "Remote Desktop Protocol"),
        ("VPN", "Virtual Private Network"),
        ("Serial RS-232", "Serial RS-232 interface"),
        ("Serial RS-485", "Serial RS-485 interface"),
        ("USB", "Universal Serial Bus"),
        ("JTAG", "Joint Test Action Group debug interface"),
        ("Bluetooth/BLE", "Bluetooth / Bluetooth Low Energy"),
        ("Wi-Fi", "IEEE 802.11 wireless"),
        ("Zigbee", "IEEE 802.15.4 based mesh protocol"),
        ("LoRaWAN", "Long Range Wide Area Network"),
        ("Cellular (4G/5G)", "Cellular network connectivity"),
    ];

    // ─── Third-Party Software ──────────────────────────────────────
    let third_party = vec![
        ("Windows OS", "Microsoft Windows operating system"),
        ("Linux OS", "Linux-based operating system"),
        ("VxWorks", "Wind River VxWorks RTOS"),
        ("QNX", "BlackBerry QNX real-time operating system"),
        (
            "Siemens TIA Portal",
            "Siemens Totally Integrated Automation",
        ),
        ("Siemens WinCC", "Siemens SCADA/HMI software"),
        ("Rockwell FactoryTalk", "Rockwell Automation software suite"),
        ("Rockwell Studio 5000", "Rockwell Logix Designer"),
        ("Schneider Unity Pro", "Schneider Electric PLC programming"),
        ("Schneider Citect", "Schneider Electric SCADA"),
        ("ABB Ability Symphony Plus", "ABB DCS platform"),
        ("GE iFIX", "GE Digital HMI/SCADA"),
        ("GE Proficy Historian", "GE process data historian"),
        ("Honeywell Experion", "Honeywell DCS platform"),
        ("Emerson DeltaV", "Emerson DCS platform"),
        ("OSIsoft PI", "AVEVA/OSIsoft process data historian"),
        ("Kepware KEPServerEX", "OPC connectivity platform"),
        ("Matrikon OPC", "OPC server/tunneling software"),
        ("Nozomi Networks Guardian", "OT security monitoring"),
        ("Claroty xDome", "OT security platform"),
        ("Dragos Platform", "OT threat detection"),
        ("CyberArk", "Privileged Access Management"),
        ("Active Directory", "Microsoft AD directory service"),
        ("Antivirus / EDR", "Endpoint protection software"),
        ("VMware / Hypervisor", "Virtualization platform"),
        ("Docker / Containers", "Container runtime"),
        ("SQL Database", "SQL database (MS-SQL, PostgreSQL, MySQL)"),
        ("Apache / Nginx", "Web server"),
        ("Node-RED", "Flow-based programming for ICS/IoT"),
        ("CODESYS", "IEC 61131-3 PLC programming platform"),
    ];

    for (name, desc) in &assets {
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT OR IGNORE INTO tag_catalog (id, category, name, description, created_at) VALUES (?1, 'asset', ?2, ?3, ?4)",
            params![id, name, desc, now],
        ).map_err(|e| e.to_string())?;
    }

    for (name, desc) in &interfaces {
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT OR IGNORE INTO tag_catalog (id, category, name, description, created_at) VALUES (?1, 'interface', ?2, ?3, ?4)",
            params![id, name, desc, now],
        ).map_err(|e| e.to_string())?;
    }

    for (name, desc) in &third_party {
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT OR IGNORE INTO tag_catalog (id, category, name, description, created_at) VALUES (?1, 'third_party_software', ?2, ?3, ?4)",
            params![id, name, desc, now],
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Tauri command wrapper for seed_tag_catalog.
#[tauri::command]
pub fn seed_tag_catalog_command(db: State<'_, Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    seed_tag_catalog(&conn)
}
