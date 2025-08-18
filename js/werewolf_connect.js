let midiOutput = null; // todo: moving this inside class messes everything up, but it should move
//
import {VFLEX, command_list} from "./werewolf_comms.js"
export const vflex = new VFLEX();
export const COMMAND_LIST= command_list;

let receiveBuffer = [];
let receiveComplete = false;
export function vflex_midi_packet_handler(event) {
  const [status, data1, data2] = event.data;
  if (status === 0x80) {
    receiveBuffer = [];
    receiveComplete = false;
  } else if (status === 0x90) {
    if (receiveBuffer.length < 64) {
      const byte = (data1 << 4) | data2;
      receiveBuffer.push(byte);
    }
  } else if (status === 0xA0) {
    receiveComplete = true;
    console.log("Payload received:", receiveBuffer.map(b => b.toString(16).padStart(2, '0')));
    vflex.process_response(receiveBuffer);
  }
}


function Delay(ms) { // Utility delay function
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class VFLEX_MIDI{
    constructor() {
        this.checkInterval = null;
        this.midiAccess = null;

        this.isConnecting = false;
        this.onConnectSuccess = () => {};
        this.onConnectFail = () => {};
        this.onDisconnect = () => {};
        this.onConnectionChange= () => {};
        this.connected = false;
        this.port = null;

        this.midiInput = null;
    }


    register_connection_callback(successCb) { this.onConnectSuccess = successCb || this.onConnectSuccess; }
    register_fail_connection_callback(failCb){ this.onConnectFail = failCb || this.onConnectFail; }
    register_disconnect_callback(disconnectCb) { this.onDisconnect = disconnectCb || this.onDisconnect;}
    register_connection_change_callback(changeCb) { this.onConnectionChange = changeCb|| this.onConnectionChange; }
    setCallbacks(successCb, failCb, disconnectCb, changeCb) {
        this.register_connection_callback(successCb);
        this.register_fail_connection_callback(failCb);
        this.register_disconnect_callback(disconnectCb);
        this.register_connection_change_callback(changeCb);
    }

    async init() { // Initialize MIDI access (called once)
        if (!this.midiAccess) {
            try {
                this.midiAccess = await navigator.requestMIDIAccess();
                console.log("MIDI Access Granted");
                this.startMonitoring();
            } catch (err) {
                console.error("MIDI Access Failed:", err);
                onConnectFail(err);
            }
        }
    }
    async deinit() { // Initialize MIDI access (called once)
      this.stopMonitoring();
    }


    async tryConnect() { // Check for vFlex device and connect
        if (this.isConnecting || this.connected || !this.midiAccess) return;

        this.isConnecting = true;
        try {
            // Find output
            midiOutput = null;
            for (let out of this.midiAccess.outputs.values()) {
                if (out.name.includes("vFlex")) {
                    midiOutput = out;
                    break;
                }
            }

            // Find input
            this.midiInput = null;
            for (let inPort of this.midiAccess.inputs.values()) {
                if (inPort.name.includes("vFlex")) {
                    this.midiInput = inPort;
                    this.midiInput.onmidimessage = vflex_midi_packet_handler;
                    break;
                }
            }

            if (this.midiInput && midiOutput) {
                // Set up port wrapper
                this.port = {
                    send: async function(data) {
                        if (!midiOutput) {
                            console.error("No MIDI output connected!");
                            return;
                        }
                        midiOutput.send([0x80, 0, 0]);
                        await Delay(20);

                        for (let i = 0; i < data.length; i++) {
                            const byte = data[i];
                            const highNibble = (byte >> 4) & 0x0F;
                            const lowNibble = byte & 0x0F;
                            midiOutput.send([0x90, highNibble, lowNibble]);
                            await Delay(20);
                        }

                        midiOutput.send([0xA0, 0, 0]);
                    }
                };

                this.connected = true;
                this.onConnectionChange();
                console.log("Connected to:", this.midiInput.name, midiOutput.name);
                this.onConnectSuccess();
            } else {
                throw new Error("No vFlex device found");
            }
        } catch (err) {
            console.log("Connection attempt failed:", err);
            this.onConnectFail(err);
        } finally {
            this.isConnecting = false;
        }
    }

    disconnect() {
        if (!this.connected) return;

        if (this.midiInput) {
            this.midiInput.onmidimessage = null;
            console.log("Input listener removed:", this.midiInput.name);
        }
        midiOutput = null;
        this.midiInput = null;
        this.port = null;
        this.connected = false;
        this.onConnectionChange();
        console.log("Disconnected");
        this.onDisconnect();
    }

    // Monitor device state
    startMonitoring() {
        this.midiAccess.onstatechange = (e) => { // Listen for device state changes
            console.log("MIDI state change:", e.port.state, e.port.name);
            if (e.port.name.includes("vFlex")) {
                if (e.port.state === "disconnected" && this.connected) {
                    this.disconnect();
                }
            }
        };

        this.checkInterval = setInterval(() => { // Periodic check for available devices
            if (!this.connected) {
                this.tryConnect();
            }
        }, 100);
    }
    stopMonitoring() {
      clearInterval(this.checkInterval);
      this.disconnect();
    }

    // Cleanup
    destroy() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
        this.disconnect();
        this.midiAccess.onstatechange = null;
    }
}






















// Usage example:
//const midi = new MidiConnection();

// Set your callbacks
//midi.setCallbacks(
//    () => console.log("Successfully connected!"),
//    (err) => console.log("Connection failed:", err),
//    () => console.log("Disconnected!")
//);

// Start the MIDI system
//midi.init();

// To send MIDI data when connected:
//async function sendMidiData(data) {
//    if (port) {
//        await port.send(data);
//    }
//
