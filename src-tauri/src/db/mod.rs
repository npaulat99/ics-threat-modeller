// Database module — connection management, schema initialization, and data models.
pub mod models;
pub mod schema;

use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

/// Thread-safe wrapper around a SQLite connection.
pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    /// Open (or create) a SQLite database at the given path and initialize the schema.
    pub fn open(path: &Path) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(path)?;

        // Enable WAL mode for better concurrent read performance.
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;

        // Initialize schema (idempotent — uses IF NOT EXISTS).
        schema::initialize(&conn)?;

        Ok(Database {
            conn: Mutex::new(conn),
        })
    }

    /// Open an in-memory database (useful for tests).
    #[allow(dead_code)]
    pub fn open_in_memory() -> Result<Self, rusqlite::Error> {
        let conn = Connection::open_in_memory()?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        schema::initialize(&conn)?;
        Ok(Database {
            conn: Mutex::new(conn),
        })
    }
}
