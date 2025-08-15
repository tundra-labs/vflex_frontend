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

    function new_device_callback(result) { // todo: delete?
      serial.getPorts().then(ports => {
        if(connected) {
          return;
        }
        if (ports.length === 0) {
          console.log("No device found.");
        } else {
          console.log("connecting?");
          console.log(calibration_values.bootload_enable.value);
          port = ports[0];
          connect(port);
          connected = true;
          setConnected(true);
          //setTimeout(() => { bootload_cancel_app_timeout(port); }, 50);
          //todo: this is auto program feature, disable for now
          //if(app_bin_data) {
          //  setTimeout(() => { bootload_prom_function(prom, app_bin_data); }, 200);
          //}
        }
      });
    }

    function process_midi_return(data) {
        let data_u8a = new Uint8Array(data); 
        let preamble_len = 2;
        let textDecoder = new TextDecoder();
        let command_code = data[1];
        let next_packet;
        let response;
        ACK = 1;
        // todo: check if calibration_values.led exists here?
        switch(command_code) {
          case command_list.CMD_DISABLE_LED_DURING_OPERATION:
            let disabled = data[2];
            calibration_values.led_disable_during_operation = disabled;
            break;
          case command_list.CMD_SB_WRITE_HALF_PAGE:
            break;
          case command_list.CMD_SB_COMMIT_PAGE:
            break;
          case command_list.CMD_SB_VERIFY:
            console.log("verify");
            break;
         case command_list.CMD_PDO_LOG:
            if (data.length ==3 ) {
              calibration_values.pdo_len = data[2];
              calibration_values.pdo_payload = []; // resets
            } else if (data.length == 6){
              let new_pdo = [];
              new_pdo.push(data[2]);
              new_pdo.push(data[3]);
              new_pdo.push(data[4]);
              new_pdo.push(data[5]);
              calibration_values.pdo_payload.push(new_pdo);
            }
            calibration_values.pdo_ack = true;
            break;
          case command_list.CMD_ENCRYPT_MSG:
            const numbers = data.slice(2);
            calibration_values.secretsecrets = numbers;
            break;
          case command_list.CMD_VOLTAGE:
            let mv = data[2] <<8 | (data[3]);
            calibration_values.voltage = mv;
            break;
          case command_list.CMD_CURRENT_LIMIT:
            break;
          case command_list.CMD_WW_SERIAL:
            var string = new TextDecoder().decode(data_u8a).slice(preamble_len);
            console.log(string);
            calibration_values.serial_num = string;
            serial_num = string;
            break;
          case command_list.CMD_CHIP_UUID:
            var string = new TextDecoder().decode(data_u8a).slice(preamble_len);
            calibration_values.uuid = string;
            break;
          case command_list.CMD_HWID:
						console.log('got hwid');
            var string = new TextDecoder().decode(data_u8a).slice(preamble_len);
            calibration_values.hw_id = string;
            break;
          case command_list.CMD_FWID:
            var string = new TextDecoder().decode(data_u8a).slice(preamble_len);
            calibration_values.fw_id = string;
            break;
          case command_list.CMD_MFG_DATE:
            var string = new TextDecoder().decode(data_u8a).slice(preamble_len);
            calibration_values.mfg_date = string;
            break;
          case command_list.CMD_FLASH_LED_SEQUENCE_ADVANCED:
            break;
          case command_list.CMD_FLASH_LED:
            break;
          case command_list.CMD_LOAD_CAL_SCRATCHPAD:
            break;
          case command_list.CMD_COMMIT_CAL_SCRATCHPAD:
            break;
          case command_list.OK:
            break;
          case command_list.ERROR:
            break;
          case command_list.CMD_BOOTLOAD_PROM:
            response = data[2];
            if (response == 0) { //proceed
            } else {
              // leave error for verification stage
            }
            next_packet = bootloader_packet_queue.shift();
            if(next_packet) {
              port.send(next_packet);
            } else {
              boot_message.textContent = "bootload complete";
              setTimeout(function() {boot_message.textContent = "bootloader verifying";}, 200);
              calibration_values.bootload_enable.value = "disabled";
              setTimeout(() => { bootload_verify_function(port, app_bin_data['data']); }, 200);
            }


            break;
          case command_list.CMD_BOOTLOAD_VERIFY:
            response = data[2];
            if(response){
              if (bootloader_packet_queue.length == 0) {
                boot_message.textContent = "bootloader verify succesful!";
                setTimeout(() => {boot_message.textContent = "exiting bootloader!";}, 200);
                setTimeout(() => {ledBlink (port, 5, confBlink); }, 100);
                setTimeout(() => {jump_to_app(port);}, 4000);

              }
              // validated packet
            } else {
              boot_message.textContent = "bootloader verify detected error";
              bootloader_packet_queue = [];
            }
            next_packet = bootloader_packet_queue.shift();
            if(next_packet) {
              port.send(next_packet);
            }

            break;
          case command_list.CMD_BOOTLOAD_CANCEL_APP_TIMEOUT:
            console.log("confirm bootloader mode");
            boot_message.textContent = "bootloader connected";
            if(app_bin_data['data']) {
              setTimeout(function() {boot_message.textContent = "bootloader in progress";}, 500);
              setTimeout(() => { bootload_prom_function(port, app_bin_data['data']); }, 200);
            }

            break;

          case command_list.CMD_BOOTLOAD_CANCEL_APP_TIMEOUT:
            console.log("jumping to bootloader");

          default:
            console.log("invalid usb incoming message. unexpected command code",command_code );
        }

    }


    function handleMidiMessage(event) {
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
        process_midi_return(receiveBuffer);
      }
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
              midiInput.onmidimessage = handleMidiMessage;
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
//let midiInput = null;
//let midiOutput = null;
//let port = null;
//let connected = false;
let isConnecting = false;

// Callbacks (to be set by the user)
let onConnectSuccess = () => {};
let onConnectFail = () => {};
let onDisconnect = () => {};

// Utility delay function
function Delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Handle MIDI messages
//function handleMidiMessage(message) {
//    // Your MIDI message handling logic here
//    console.log("MIDI Message:", message.data);
//}

// Main MIDI connection manager
class MidiConnection {
    constructor() {
        this.checkInterval = null;
    }

    // Set callback functions
    setCallbacks(successCb, failCb, disconnectCb) {
        onConnectSuccess = successCb || onConnectSuccess;
        onConnectFail = failCb || onConnectFail;
        onDisconnect = disconnectCb || onDisconnect;
    }

    // Initialize MIDI access (called once)
    async init() {
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

    // Check for vFlex device and connect
    async tryConnect() {
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
                    midiInput.onmidimessage = handleMidiMessage;
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

    // Disconnect MIDI
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
        // Listen for device state changes
        midiAccess.onstatechange = (e) => {
            console.log("MIDI state change:", e.port.state, e.port.name);
            if (e.port.name.includes("vFlex")) {
                if (e.port.state === "disconnected" && connected) {
                    this.disconnect();
                }
                // Connection attempt will be handled by interval check
            }
        };

        // Periodic check for available devices
        this.checkInterval = setInterval(() => {
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
