let port = null;
let midiOutput = null;
let midiInput = null;
let receiveBuffer = [];
let receiveComplete = false;
//let connected = false;
let bootloader_mode = 0; // todo: from html
let serial_num = 0;
let ACK = 0;

let pdo_log_byte_queue = []; // todo: this could be a generic packet queue for connect function

//function setConnected(newValue){
//  // emits event and sets 'connected'
//  // todo: anywhere accessing connected uses vflex.connected
//  // tod: event change uses new event
//  connected = newValue;
//  const event = new CustomEvent('connectedChange', { detail: connected });
//  window.dispatchEvent(event);
//}

function Delay(ms) { // Utility delay function
    return new Promise(resolve => setTimeout(resolve, ms));
}

class MidiConnection {
    constructor() {
        this.checkInterval = null;
        this.midiAccess = null;

        this.isConnecting = false;
        this.onConnectSuccess = () => {};
        this.onConnectFail = () => {};
        this.onDisconnect = () => {};
        this.onConnectionChange= () => {};
        this.connected = false;
        this.eventListeners = new Map([['connection_change_event', []]]); // Initialize connection_change_event
    }


    setCallbacks(successCb, failCb, disconnectCb, changeCb) {
        this.onConnectSuccess = successCb || this.onConnectSuccess;
        this.onConnectFail = failCb || this.onConnectFail;
        this.onDisconnect = disconnectCb || this.onDisconnect;
        this.onConnectionChange = changeCb|| this.onConnectionChange;
    }
    override_connection_change_callback(changeCb) {
        this.onConnectionChange = changeCb|| this.onConnectionChange;
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
            midiInput = null;
            for (let inPort of this.midiAccess.inputs.values()) {
                if (inPort.name.includes("vFlex")) {
                    midiInput = inPort;
                    midiInput.onmidimessage = vflex_midi_packet_handler;
                    break;
                }
            }

            if (midiInput && midiOutput) {
                // Set up port wrapper
                port = {
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
                console.log("Connected to:", midiInput.name, midiOutput.name);
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

        if (midiInput) {
            midiInput.onmidimessage = null;
            console.log("Input listener removed:", midiInput.name);
        }
        midiOutput = null;
        midiInput = null;
        port = null;
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

    // Cleanup
    destroy() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
        this.disconnect();
        this.midiAccess.onstatechange = null;
    }
}
const midi = new MidiConnection();
midi.setCallbacks(
    () => {
        // Handle successful connection
        console.log("MIDI device ready!");

    },
    (err) => {
        // Handle connection failure
        console.error("MIDI connection failed:", err);
    },
    () => {
        // Handle disconnection
        console.log("MIDI device disconnected");
    },
    () => {
        // Handle connection change
        console.log("MIDI device connection status changed");
    }
);


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
