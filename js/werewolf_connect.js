let port = null;
let midiOutput = null;
let midiInput = null;
let receiveBuffer = [];
let receiveComplete = false;
let connected = false;
let bootloader_mode = 0; // todo: from html
let serial_num = 0;
let ACK = 0;

var calibration_values = {}; // assigned at import level to user defined html fields. messages populated iff they're defined.

let pdo_log_byte_queue = []; // todo: this could be a generic packet queue for connect function

function setConnected(newValue){
  connected = newValue;
  const event = new CustomEvent('connectedChange', { detail: connected });
  window.dispatchEvent(event);
}


    function Delay(ms) {
      const start = Date.now();
      while (Date.now() - start < ms) {}
    }
    function connectMidi(retry=false) {
      if (port) { // Disconnect
        console.log("Disconnecting MIDI...");
        if (midiInput) {
          midiInput.onmidimessage = null; // Remove listener
          console.log("Input listener removed:", midiInput.name);
        }
        midiOutput = null;
        midiInput = null;
        port = null;
        console.log("Disconnected: port cleared");
        connected = false;
        setConnected(false);

      } else { // Connect
        navigator.requestMIDIAccess().then(midiAccess => {
          for (let out of midiAccess.outputs.values()) {
            console.log(`Output: ${out.name} (ID: ${out.id})`);
            if (out.name.includes("vFlex")) {
              midiOutput = out;
              break;
            }
          }
          for (let inPort of midiAccess.inputs.values()) {
            //console.log(`Input: ${inPort.name} (ID: ${inPort.id})`);
            if (inPort.name.includes("vFlex")) {
              midiInput = inPort;
              midiInput.onmidimessage = vflex_midi_packet_handler;
              break;
            }
          }
          if (!midiInput || ! midiOutput) {
            console.log('no midi, continue');
            if(retry) {
              document.getElementById('connectMessage').value = "no midi device found!";
              setTimeout(connectMidi(true), 1000);
            }
            return;
          }
          else console.log("Selected Input:", midiInput.name);
          console.log("Selected Output:", midiOutput.name);
          port = {
            send: function(data) {
              if (!midiOutput) {
                console.error("No MIDI output connected!");
                return;
              }
              midiOutput.send([0x80, 0, 0]);
              //console.log("Sent: Clear buffer [80 00 00]");
              Delay(20);

              for (let i = 0; i < data.length; i++) {
                const byte = data[i];
                const highNibble = (byte >> 4) & 0x0F;
                const lowNibble = byte & 0x0F;
                midiOutput.send([0x90, highNibble, lowNibble]);
                Delay(20);
              }

              midiOutput.send([0xA0, 0, 0]);
              //console.log("Sent: End [A0 00 00]");
            }
          };
          connected = true;
          setConnected(connected);

          console.log("Connected: port set:", port);

        }, err => {
            console.error("MIDI Access Failed:", err)
          }
        );
      }
    }

    function werewolf_auto_connect() {
      connectMidi(true);
    }
    function werewolf_manual_connect() {
      connectMidi();
    }

    function werewolf_attempt_connect() {
      let get_ports_promise = serial.getPorts();
      get_ports_promise.then(
        function(result) {
          serial.getPorts().then(ports => {
            if(connected) {
              return;
            }
            if (ports.length === 0) {
              console.log("No device found.");
            } else {
              console.log("connecting.");
              console.log(calibration_values.bootload_enable.value);
              port = ports[0];
              connect(port,);
              connected = true;
              setConnected(true);
            }
          });
        }, null);
    }

// midi specific connection, may deprecate some of the above
// Global variables
let midiAccess = null;
let isConnecting = false;
// Callbacks (to be set by the user)
let onConnectSuccess = () => {};
let onConnectFail = () => {};
let onDisconnect = () => {};

// Utility delay function
function Delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class MidiConnection {
    constructor() {
        this.checkInterval = null;
    }

    setCallbacks(successCb, failCb, disconnectCb) {
        onConnectSuccess = successCb || onConnectSuccess;
        onConnectFail = failCb || onConnectFail;
        onDisconnect = disconnectCb || onDisconnect;
    }

    async init() { // Initialize MIDI access (called once)
        if (!midiAccess) {
            try {
                midiAccess = await navigator.requestMIDIAccess();
                console.log("MIDI Access Granted");
                this.startMonitoring();
            } catch (err) {
                console.error("MIDI Access Failed:", err);
                onConnectFail(err);
            }
        }
    }

    async tryConnect() { // Check for vFlex device and connect
        if (isConnecting || connected || !midiAccess) return;

        isConnecting = true;
        try {
            // Find output
            midiOutput = null;
            for (let out of midiAccess.outputs.values()) {
                if (out.name.includes("vFlex")) {
                    midiOutput = out;
                    break;
                }
            }

            // Find input
            midiInput = null;
            for (let inPort of midiAccess.inputs.values()) {
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

                connected = true;
                setConnected(connected);
                console.log("Connected to:", midiInput.name, midiOutput.name);
                onConnectSuccess();
            } else {
                throw new Error("No vFlex device found");
            }
        } catch (err) {
            console.log("Connection attempt failed:", err);
            onConnectFail(err);
        } finally {
            isConnecting = false;
        }
    }

    disconnect() {
        if (!connected) return;

        if (midiInput) {
            midiInput.onmidimessage = null;
            console.log("Input listener removed:", midiInput.name);
        }
        midiOutput = null;
        midiInput = null;
        port = null;
        connected = false;
        setConnected(connected);
        console.log("Disconnected");
        onDisconnect();
    }

    // Monitor device state
    startMonitoring() {
        midiAccess.onstatechange = (e) => { // Listen for device state changes
            console.log("MIDI state change:", e.port.state, e.port.name);
            if (e.port.name.includes("vFlex")) {
                if (e.port.state === "disconnected" && connected) {
                    this.disconnect();
                }
            }
        };

        this.checkInterval = setInterval(() => { // Periodic check for available devices
            if (!connected) {
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
        midiAccess.onstatechange = null;
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
