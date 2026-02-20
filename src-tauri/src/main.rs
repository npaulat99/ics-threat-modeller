// ICS Threat Modeller — Desktop Application Entry Point.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    env_logger::init();
    ics_threat_modeller_lib::run();
}
