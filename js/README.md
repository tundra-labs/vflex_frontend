# VFLEX Library README

## Overview
This library provides an interface for communicating with a VFLEX USB device using both MIDI and WebUSB Serial (CDC) protocols. It supports an application mode (via MIDI) and bootloader mode (via Serial). The library is designed to handle connection management and vFlex device protocols

Key classes:
- `VFLEX_PROTOCOL`: Core command and response handling.
- `VFLEX_MIDI`: MIDI-based connection for application mode.
- `VFLEX_CDC_SERIAL`: WebUSB Serial-based connection for bootloader mode.
- `VFLEX_API`: High-level API that orchestrates MIDI/Serial connections and exposes device operations.

## Connection Flows

### MIDI Connection (Application Mode)
MIDI is used for normal application interactions (e.g., setting voltage, getting device info).
1. **Initialization**: Call `vflex.app_autoconnect()` (where `vflex` is an instance of `VFLEX_API`). This internally calls `midi.init()` to request MIDI access.
2. **Monitoring and Auto-Connect**: The library starts monitoring for device state changes. It periodically calls `try_connect()` to detect and connect to a "vFlex" named MIDI device.
3. **Await Connection**: Use `await midi.await_connected()` if you need to block until connected.
4. **Event Handling**: Listen for events like `'connect'`, `'disconnect'`, `'connectionchange'`, and `'error'` on the `VFLEX_API` instance.
5. **Disconnect**: Call `midi.disconnect()` to manually disconnect. Monitoring stops on `deinit()`.

Sequence Example:
```javascript
const vflex = new VFLEX_API();
vflex.on('connect', () => console.log('Connected via MIDI'));
try {
  await vflex.app_autoconnect();
  // Now perform operations like vflex.get_voltage_mv()
} catch (err) {
  console.error('Connection failed:', err);
}
