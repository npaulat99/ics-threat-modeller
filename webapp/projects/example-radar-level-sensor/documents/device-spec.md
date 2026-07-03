# RL-100 device specification (excerpt)

The RadarLevel RL-100 is an 80 GHz radar level sensor for liquids and bulk solids.

## Interfaces
- 4-20 mA current loop with HART 7 digital communication (primary process interface).
- Bluetooth Low Energy for local commissioning via a mobile app.
- Optional Ethernet-APL module for IP connectivity.
- Internal JTAG/SWD debug header (production units ship with it disabled).

## Firmware and update
- The main MCU runs signed firmware; a signed bootloader verifies updates.
- Anti-rollback protection prevents downgrade to vulnerable firmware.

## Commissioning
- First-time setup over Bluetooth requires changing the default passcode.

This document is used by the assistant to suggest applicable threats and controls from the
shared knowledge base. It is illustrative only.
