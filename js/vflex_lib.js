import {serial} from "./serial.js";
export const command_list = Object.freeze({
  CMD_SB_WRITE_CHUNK: 0,
  CMD_SB_COMMIT_PAGE: 1,
  CMD_SB_VERIFY: 2,
  CMD_BOOTLOAD_END: 3,
  OK: 4,
  ERROR: 5,
  CMD_LOAD_CAL_SCRATCHPAD: 6,
  CMD_COMMIT_CAL_SCRATCHPAD: 7,
  CMD_WW_SERIAL: 8,
  CMD_CHIP_UUID: 9,
  CMD_HWID: 10,
  CMD_FWID: 11,
  CMD_MFG_DATE: 12,
  CMD_FLASH_LED_SEQUENCE_ADVANCED: 13,
  CMD_FLASH_LED: 14,
  CMD_LED_DISABLE: 15,
  CMD_ENCRYPT_MSG: 16,
  CMD_PDO_LOG: 17,
  CMD_VOLTAGE: 18,
  CMD_CURRENT_LIMIT: 19,
  CMD_JUMP_TO_BOOTLOAD: 20
});

const command_list_string_sizes = Object.freeze({
  CMD_WW_SERIAL: 8,
  CMD_CHIP_UUID: 8,
  CMD_HWID: 8,
  CMD_FWID: 12,
  CMD_MFG_DATE: 8,
});

function command_to_string_length(command) {
  var keys = [];
  for (const [key, value] of Object.entries(command_list_string_sizes)) {
    if (key == command) {
      return command_list_string_sizes[key];
    }
  }
  return 0;
}

function extract_key_from_list(command) {
  return Object.keys(command_list)[command];
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let midiOutput = null;
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
    vflex.process_response(receiveBuffer);
  }
}

export class VFLEX {
  constructor() {
    this.device = null;
    this.bootloader_packet_queue = [];
    this.calibration_values = {};
    this.ACK = 0;
  }

  send_ww_string(port, string_command, str, write, scratchpad) {
    this.ACK = 0;
    let command = extract_key_from_list(string_command);
    let expected_str_len = command_to_string_length(command);
    let command_code = command_list[command];
    if (scratchpad) {
      command_code |= 0x40;
    }
    if (!write) {
      let preamble_len = 2;
      let output_array_len = preamble_len;
      var output_array = new Uint8Array(output_array_len);
      output_array[0] = preamble_len;
      output_array[1] = command_code;
      port.send(output_array);
    } else if (str.length == expected_str_len) {
      command_code |= 0x80;
      let preamble_len = 2;
      let output_array_len = str.length + preamble_len;
      var output_array = new Uint8Array(output_array_len);
      output_array[0] = output_array_len;
      output_array[1] = command_code;
      for (let i = preamble_len; i < output_array_len; i++) {
        output_array[i] = str[i - preamble_len].charCodeAt(0);
      }
      port.send(output_array);
      return true;
    } else {
      return false;
    }
  }

  send_encrypted_message(port, msg) {
    this.ACK = 0;
    let preamble_len = 2;
    let output_array_len = msg.length + preamble_len;
    var output_array = new Uint8Array(output_array_len);
    output_array[0] = output_array_len;
    output_array[1] = command_list.CMD_ENCRYPT_MSG | 0x80;
    for (let i = 0; i < msg.length; i++) {
      output_array[i + preamble_len] = msg.charCodeAt(i);
    }
    port.send(output_array);
  }

  send_bootloader_chunk_encrypted(port, msg, pg_id, chunk_id) {
    this.ACK = 0;
    let preamble_len = 2;
    let data_start_pos = 5;
    let pg_id_sz = 2;
    let chunk_sz = 1;
    let output_array_len = preamble_len + pg_id_sz + chunk_sz + msg.length;
    var output_array = new Uint8Array(output_array_len);
    output_array[0] = output_array_len;
    output_array[1] = command_list.CMD_SB_WRITE_HALF_PAGE | 0x80;
    output_array[2] = pg_id >> 8;
    output_array[3] = pg_id & 0xff;
    output_array[4] = chunk_id;
    for (let i = 0; i < msg.length; i++) {
      output_array[i + data_start_pos] = msg[i];
    }
    port.send(output_array);
  }

  verify_bootloader(port) {
    this.ACK = 0;
    let preamble_len = 2;
    let output_array_len = preamble_len;
    var output_array = new Uint8Array(output_array_len);
    output_array[0] = output_array_len;
    output_array[1] = command_list.CMD_SB_VERIFY | 0x80;
    port.send(output_array);
  }

  commit_bootloader_page(port) {
    this.ACK = 0;
    let preamble_len = 2;
    let output_array_len = preamble_len;
    var output_array = new Uint8Array(output_array_len);
    output_array[0] = output_array_len;
    output_array[1] = command_list.CMD_SB_COMMIT_PAGE | 0x80;
    port.send(output_array);
  }

  set_ww_string(port, string_command, str) {
    this.ACK = 0;
    let write = 1;
    let scratchpad = 0;
    this.send_ww_string(port, string_command, str, write, scratchpad);
  }

  set_ww_string_scratchpad(port, string_command, str) {
    this.ACK = 0;
    let write = 1;
    let scratchpad = 1;
    this.send_ww_string(port, string_command, str, write, scratchpad);
  }

  get_ww_string(port, string_command) {
    this.ACK = 0;
    let write = 0;
    let scratchpad = 0;
    this.send_ww_string(port, string_command, "", write, scratchpad);
  }

  get_ww_string_scratchpad(port, string_command) {
    this.ACK = 0;
    let write = 0;
    let scratchpad = 1;
    this.send_ww_string(port, string_command, "", write, scratchpad);
  }

  get_voltage(port) {
    this.ACK = 0;
    var array = new Uint8Array(2);
    array[0] = 2;
    array[1] = command_list.CMD_VOLTAGE;
    port.send(array);
  }

  set_voltage(port, setting_mv) {
    this.ACK = 0;
    var array = new Uint8Array(4);
    array[0] = 4;
    array[1] = command_list.CMD_VOLTAGE | 0x80;
    let setting_mv_msb = (setting_mv >> 8) & 0xFF;
    let setting_mv_lsb = setting_mv & 0xFF;
    array[2] = setting_mv_msb;
    array[3] = setting_mv_lsb;
    port.send(array);
  }

  get_max_current(port) {
    this.ACK = 0;
    var array = new Uint8Array(2);
    array[0] = 2;
    array[1] = command_list.CMD_CURRENT;
    port.send(array);
  }

  set_max_current_ma(port, setting_ma) {
    this.ACK = 0;
    var array = new Uint8Array(4);
    array[0] = 4;
    array[1] = command_list.CMD_CURRENT | 0x80;
    let setting_ma_msb = (setting_ma >> 8) & 0xFF;
    let setting_ma_lsb = setting_ma & 0xFF;
    array[2] = setting_ma_msb;
    array[3] = setting_ma_lsb;
    port.send(array);
  }

  load_flash(port) {
    this.ACK = 0;
    var arr = new Uint8Array(2);
    arr[0] = 2;
    arr[1] = command_list.CMD_LOAD_CAL_SCRATCHPAD | 0x40;
    port.send(arr);
  }

  commit_flash(port) {
    this.ACK = 0;
    var arr = new Uint8Array(2);
    arr[0] = 2;
    arr[1] = command_list.CMD_COMMIT_CAL_SCRATCHPAD | 0x40;
    port.send(arr);
  }

  bootload_prom_function(port, data_object) {
    this.ACK = 0;
    var data = new Uint8Array(data_object);
    let code_len = data.byteLength;
    let bootloader_preamble_len = 4;
    let max_packet_len = 64;
    let max_packet_code_len = max_packet_len - bootloader_preamble_len;
    let index = 0;
    let packet_count = 0;
    while (index < code_len) {
      let remaining = code_len - index;
      let packet_code_len = Math.min(remaining, max_packet_code_len);
      let packet_len = packet_code_len + bootloader_preamble_len;
      var boot_arr = new Uint8Array(packet_len);
      boot_arr[0] = packet_len;
      boot_arr[1] = command_list.CMD_BOOTLOAD_PROM;
      for (let i = 0; i < packet_code_len; i++) {
        boot_arr[i + bootloader_preamble_len] = data[index++];
      }
      this.bootloader_packet_queue.push(boot_arr);
      packet_count++;
    }
    let first_packet = this.bootloader_packet_queue.shift();
    port.send(first_packet);
  }

  disable_leds_operation(port, disable, write) {
    this.ACK = 0;
    let bootloader_preamble_len = 2;
    if (write) {
      var output_arr = new Uint8Array(3);
      output_arr[0] = 3;
      output_arr[1] = command_list.CMD_DISABLE_LED_DURING_OPERATION | 0x80;
      output_arr[2] = disable;
    } else {
      var output_arr = new Uint8Array(2);
      output_arr[0] = 2;
      output_arr[1] = command_list.CMD_DISABLE_LED_DURING_OPERATION;
    }
    port.send(output_arr);
  }

  clear_pdo_log(port) {
    this.ACK = 0;
    let arr_len = 2;
    var output_arr = new Uint8Array(arr_len);
    output_arr[0] = arr_len;
    output_arr[1] = command_list.CMD_PDO_LOG | 0x80;
    port.send(output_arr);
  }

  get_pdo_log(port) {
    this.ACK = 0;
    let bootloader_preamble_len = 2;
    let max_packet_len = 64;
    var output_arr = new Uint8Array(2);
    output_arr[0] = 2;
    output_arr[1] = command_list.CMD_PDO_LOG;
    port.send(output_arr);
  }

  pdo_cmd(port, pdo_cmd) {
    this.ACK = 0;
    let packet_len = 3;
    var output_arr = new Uint8Array(packet_len);
    output_arr[0] = packet_len;
    output_arr[1] = command_list.CMD_PDO_LOG;
    output_arr[2] = pdo_cmd;
    port.send(output_arr);
  }

  jump_to_app(port) {
    this.ACK = 0;
    var arr = new Uint8Array(2);
    arr[0] = 2;
    arr[1] = command_list.CMD_BOOTLOAD_END;
    port.send(arr);
  }

  jump_to_bootloader(port) {
    this.ACK = 0;
    var arr = new Uint8Array(2);
    arr[0] = 2;
    arr[1] = command_list.CMD_JUMP_TO_BOOTLOAD;
    port.send(arr);
  }

  bootload_verify_function(port, data_object) {
    this.ACK = 0;
    var data = new Uint8Array(data_object);
    let code_len = data.byteLength;
    let bootloader_preamble_len = 4;
    let max_packet_len = 64;
    let max_packet_code_len = max_packet_len - bootloader_preamble_len;
    let index = 0;
    let packet_count = 0;
    while (index < code_len) {
      let remaining = code_len - index;
      let packet_code_len = Math.min(remaining, max_packet_code_len);
      let packet_len = packet_code_len + bootloader_preamble_len;
      var boot_arr = new Uint8Array(packet_len);
      boot_arr[0] = packet_len;
      boot_arr[1] = command_list.CMD_BOOTLOAD_VERIFY;
      for (let i = 0; i < packet_code_len; i++) {
        boot_arr[i + bootloader_preamble_len] = data[index++];
      }
      this.bootloader_packet_queue.push(boot_arr);
      packet_count++;
    }
    let first_packet = this.bootloader_packet_queue.shift();
    port.send(first_packet);
  }

  bootload_cancel_app_timeout(port) {
    this.ACK = 0;
    var arr = new Uint8Array(2);
    arr[0] = 2;
    arr[1] = command_list.CMD_BOOTLOAD_CANCEL_APP_TIMEOUT;
    port.send(arr);
  }

  async await_response() {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (this.ACK == 1) {
          this.ACK = 0;
          clearInterval(interval);
          resolve();
        }
      }, 25);
    });
  }

  process_response(data) {
    let data_u8a = new Uint8Array(data);
    let preamble_len = 2;
    let command_code = data[1];
    let next_packet;
    let response;
    this.ACK = 1;
    switch (command_code) {
      case command_list.CMD_DISABLE_LED_DURING_OPERATION:
        let disabled = data[2];
        this.calibration_values.led_disable_during_operation = disabled;
        break;
      case command_list.CMD_SB_WRITE_HALF_PAGE:
        break;
      case command_list.CMD_SB_COMMIT_PAGE:
        break;
      case command_list.CMD_SB_VERIFY:
        break;
      case command_list.CMD_PDO_LOG:
        if (data.length == 3) {
          this.calibration_values.pdo_len = data[2];
          this.calibration_values.pdo_payload = [];
        } else if (data.length == 6) {
          let new_pdo = [];
          new_pdo.push(data[2]);
          new_pdo.push(data[3]);
          new_pdo.push(data[4]);
          new_pdo.push(data[5]);
          this.calibration_values.pdo_payload.push(new_pdo);
        }
        this.calibration_values.pdo_ack = true;
        break;
      case command_list.CMD_ENCRYPT_MSG:
        const numbers = data.slice(2);
        this.calibration_values.secretsecrets = numbers;
        break;
      case command_list.CMD_VOLTAGE:
        let mv = data[2] << 8 | (data[3]);
        this.calibration_values.voltage = mv;
        break;
      case command_list.CMD_CURRENT_LIMIT:
        break;
      case command_list.CMD_WW_SERIAL:
        var string = new TextDecoder().decode(data_u8a).slice(preamble_len);
        this.calibration_values.serial_num = string;
        break;
      case command_list.CMD_CHIP_UUID:
        var string = new TextDecoder().decode(data_u8a).slice(preamble_len);
        this.calibration_values.uuid = string;
        break;
      case command_list.CMD_HWID:
        var string = new TextDecoder().decode(data_u8a).slice(preamble_len);
        this.calibration_values.hw_id = string;
        break;
      case command_list.CMD_FWID:
        var string = new TextDecoder().decode(data_u8a).slice(preamble_len);
        this.calibration_values.fw_id = string;
        break;
      case command_list.CMD_MFG_DATE:
        var string = new TextDecoder().decode(data_u8a).slice(preamble_len);
        this.calibration_values.mfg_date = string;
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
        if (response == 0) {
        } else {
        }
        next_packet = this.bootloader_packet_queue.shift();
        if (next_packet) {
          port.send(next_packet);
        } else {
          setTimeout(() => { this.bootload_verify_function(port, app_bin_data['data']); }, 200);
        }
        break;
      case command_list.CMD_BOOTLOAD_VERIFY:
        response = data[2];
        if (response) {
          if (this.bootloader_packet_queue.length == 0) {
            setTimeout(() => { this.jump_to_app(port); }, 4000);
          }
        } else {
          this.bootloader_packet_queue = [];
        }
        next_packet = this.bootloader_packet_queue.shift();
        if (next_packet) {
          port.send(next_packet);
        }
        break;
      case command_list.CMD_BOOTLOAD_CANCEL_APP_TIMEOUT:
        if (app_bin_data['data']) {
          setTimeout(() => { this.bootload_prom_function(port, app_bin_data['data']); }, 200);
        }
        break;
      default:
        console.log("invalid usb incoming message. unexpected command code", command_code);
    }
  }
}

export class VFLEX_MIDI {
  constructor() {
    this.checkInterval = null;
    this.midiAccess = null;
    this.is_connecting = false;
    this.on_connect_success = () => {};
    this.on_connection_fail = () => {};
    this.on_disconnect = () => {};
    this.on_connection_change = () => {};
    this.connected = false;
    this.port = null;
    this.midiInput = null;
  }

  register_connection_callback(succes_callback) { this.on_connect_success = succes_callback || this.on_connect_success; }
  register_fail_connection_callback(fail_callback) { this.on_connection_fail = fail_callback || this.on_connection_fail; }
  register_disconnect_callback(disconnect_callback) { this.on_disconnect = disconnect_callback || this.on_disconnect; }
  register_connection_change_callback(change_callback) { this.on_connection_change = change_callback || this.on_connection_change; }
  set_callbacks(succes_callback, fail_callback, disconnect_callback, change_callback) {
    this.register_connection_callback(succes_callback);
    this.register_fail_connection_callback(fail_callback);
    this.register_disconnect_callback(disconnect_callback);
    this.register_connection_change_callback(change_callback);
  }

  async init() {
    if (!this.midiAccess) {
      try {
        this.midiAccess = await navigator.requestMIDIAccess();
        this.startMonitoring();
      } catch (err) {
        console.error("MIDI Access Failed:", err);
        this.on_connection_fail(err);
      }
    }
  }

  async deinit() {
    this.stopMonitoring();
  }

  async await_connected() {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (this.connected) {
          clearInterval(interval);
          resolve();
        }
      }, 25);
    });
  }

  async tryConnect() {
    if (this.is_connecting || this.connected || !this.midiAccess) return;
    this.is_connecting = true;
    try {
      midiOutput = null;
      for (let out of this.midiAccess.outputs.values()) {
        if (out.name.includes("vFlex")) {
          midiOutput = out;
          break;
        }
      }
      this.midiInput = null;
      for (let inPort of this.midiAccess.inputs.values()) {
        if (inPort.name.includes("vFlex")) {
          this.midiInput = inPort;
          this.midiInput.onmidimessage = vflex_midi_packet_handler;
          break;
        }
      }
      if (this.midiInput && midiOutput) {
        this.port = {
          send: async function(data) {
            if (!midiOutput) {
              console.error("No MIDI output connected!");
              return;
            }
            midiOutput.send([0x80, 0, 0]);
            await delay(20);
            for (let i = 0; i < data.length; i++) {
              const byte = data[i];
              const highNibble = (byte >> 4) & 0x0F;
              const lowNibble = byte & 0x0F;
              midiOutput.send([0x90, highNibble, lowNibble]);
              await delay(20);
            }
            midiOutput.send([0xA0, 0, 0]);
          }
        };
        this.connected = true;
        this.on_connection_change();
        this.on_connect_success();
      } else {
        throw new Error("No vFlex device found");
      }
    } catch (err) {
      this.on_connection_fail(err);
    } finally {
      this.is_connecting = false;
    }
  }

  disconnect() {
    if (!this.connected) return;
    if (this.midiInput) {
      this.midiInput.onmidimessage = null;
    }
    midiOutput = null;
    this.midiInput = null;
    this.port = null;
    this.connected = false;
    this.on_connection_change();
    this.on_disconnect();
  }

  startMonitoring() {
    this.midiAccess.onstatechange = (e) => {
      if (e.port.name.includes("vFlex")) {
        if (e.port.state === "disconnected" && this.connected) {
          this.disconnect();
        }
      }
    };
    this.checkInterval = setInterval(() => {
      if (!this.connected) {
        this.tryConnect();
      }
    }, 100);
  }

 

  stopMonitoring() {
    clearInterval(this.checkInterval);
    this.disconnect();
  }

  destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.disconnect();
    this.midiAccess.onstatechange = null;
  }
}

export class VFLEX_CDC_SERIAL {
  constructor(vflex_interface) {
    this.vflex = vflex_interface;
    this.port = null;
    this.cancel_btl_timeout = true;
    this.is_connecting = false;
    this.on_connect_success = () => {};
    this.on_connection_fail = () => {};
    this.on_disconnect = () => {};
    this.on_connection_change = () => {};
    this.connected = false;
  }

  async await_connected() {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (this.connected) {
          clearInterval(interval);
          resolve();
        }
      }, 25);
    });
  }

  async serial_manual_connect() {
    if (this.port) {
      try {
        this.port.disconnect();
      } catch {}
      try {
        delete this.port;
      } catch {}
      this.port = null;
    } else {
      serial.requestPort().then(selectedPort => {
        this.port = selectedPort;
        this.port.connect().then(() => {
          this.port.onReceive = data => { this.vflex.process_response(data); };
          this.port.onReceiveError = error => {
          };
          if (this.cancel_btl_timeout) {
            setTimeout(() => { this.vflex.bootload_cancel_app_timeout(this.port); }, 100);
          }
          this.connected = true;
        });
      }).catch(error => {
      });
    }
  }
}

export const vflex = new VFLEX();
export const VFLEX_COMMANDS = command_list;

export class VFLEX_API {
  constructor() {
    this.vflex = vflex;
    this.midi = new VFLEX_MIDI();
    this.serial = new VFLEX_CDC_SERIAL(this.vflex);
    this.port = null;
    this.connected = false;
    this.midi.set_callbacks(
      () => { this.connected = true; 
              this.port = this.midi.port; 
              this.on_connection_change();
              this.on_connect_success();
            },
      (err) => { console.error("MIDI connection failed:", err); 
              this.on_connection_change();
              },
      () => { console.log("MIDI device disconnected"); 
              this.on_disconnect = () => {};
              this.on_connection_change();
            },
      () => { console.log("MIDI device connection status changed"); 
              this.on_connection_change();
            }
    );
    // callbacks:
    this.on_connect_success = () => {};
    this.on_connection_fail = () => {};
    this.on_disconnect = () => {};
    this.on_connection_change = () => {};
  }
  register_connection_callback(succes_callback) { this.on_connect_success = succes_callback || this.on_connect_success; }
  register_fail_connection_callback(fail_callback) { this.on_connection_fail = fail_callback || this.on_connection_fail; }
  register_disconnect_callback(disconnect_callback) { this.on_disconnect = disconnect_callback || this.on_disconnect; }
  register_connection_change_callback(change_callback) { this.on_connection_change = change_callback || this.on_connection_change; }
  set_callbacks(succes_callback, fail_callback, disconnect_callback, change_callback) {
    this.register_connection_callback(succes_callback);
    this.register_fail_connection_callback(fail_callback);
    this.register_disconnect_callback(disconnect_callback);
    this.register_connection_change_callback(change_callback);
  }

  async app_autoconnect() {
    this.midi.init();
    await this.midi.await_connected();
    this.port = this.midi.port;
  }

  app_disconnect() {
    this.midi.deinit();
    this.port = null;
    this.connected = false;
  }

  async bootloader_manual_connect() {
    await this.serial.serial_manual_connect();
    await this.serial.await_connected();
    this.port = this.serial.port;
  }

  async bootloader_disconnect() {
    if (this.serial.port) {
      try {
        await this.serial.port.disconnect();
      } catch {}
      try {
        delete this.serial.port;
      } catch {}
      this.serial.port = null;
      this.port = null;
    }
    this.connected = false;
  }

  async send_ww_string(string_command, str, write, scratchpad) {
    if (this.port) this.vflex.send_ww_string(this.port, string_command, str, write, scratchpad);
    await this.await_response();
  }

  async send_encrypted_message(msg) {
    if (this.port) this.vflex.send_encrypted_message(this.port, msg);
    await this.await_response();
  }

  async send_bootloader_chunk_encrypted(msg, pg_id, chunk_id) {
    if (this.port) this.vflex.send_bootloader_chunk_encrypted(this.port, msg, pg_id, chunk_id);
    await this.await_response();
  }

  async verify_bootloader() {
    if (this.port) this.vflex.verify_bootloader(this.port);
    await this.await_response();
  }

  async commit_bootloader_page() {
    if (this.port) this.vflex.commit_bootloader_page(this.port);
    await this.await_response();
  }

  async set_ww_string(string_command, str) {
    if (this.port) this.vflex.set_ww_string(this.port, string_command, str);
    await this.await_response();
  }

  async set_ww_string_scratchpad(string_command, str) {
    if (this.port) this.vflex.set_ww_string_scratchpad(this.port, string_command, str);
    await this.await_response();
  }

  async get_ww_string(string_command) {
    if (this.port) this.vflex.get_ww_string(this.port, string_command);
    await this.await_response();
  }

  async get_ww_string_scratchpad(string_command) {
    if (this.port) this.vflex.get_ww_string_scratchpad(this.port, string_command);
    await this.await_response();
  }

  async get_voltage() {
    if (this.port) this.vflex.get_voltage(this.port);
    await this.await_response();
  }

  async set_voltage(setting_mv) {
    if (this.port) this.vflex.set_voltage(this.port, setting_mv);
    await this.await_response();
  }

  async get_max_current() {
    if (this.port) this.vflex.get_max_current(this.port);
    await this.await_response();
  }

  async set_max_current_ma(setting_ma) {
    if (this.port) this.vflex.set_max_current_ma(this.port, setting_ma);
    await this.await_response();
  }

  async load_flash() {
    if (this.port) this.vflex.load_flash(this.port);
    await this.await_response();
  }

  async commit_flash() {
    if (this.port) this.vflex.commit_flash(this.port);
    await this.await_response();
  }

  async bootload_prom_function(data_object) {
    if (this.port) this.vflex.bootload_prom_function(this.port, data_object);
    await this.await_response();
  }

  async disable_leds_operation(disable, write) {
    if (this.port) this.vflex.disable_leds_operation(this.port, disable, write);
    await this.await_response();
  }

  async clear_pdo_log() {
    if (this.port) this.vflex.clear_pdo_log(this.port);
    await this.await_response();
  }

  async get_pdo_log() {
    if (this.port) this.vflex.get_pdo_log(this.port);
    await this.await_response();
  }

  async pdo_cmd(pdo_cmd) {
    if (this.port) this.vflex.pdo_cmd(this.port, pdo_cmd);
    await this.await_response();
  }

  async jump_to_app() {
    if (this.port) this.vflex.jump_to_app(this.port);
    await this.await_response();
  }

  async jump_to_bootloader() {
    if (this.port) this.vflex.jump_to_bootloader(this.port);
    await this.await_response();
  }

  async bootload_verify_function(data_object) {
    if (this.port) this.vflex.bootload_verify_function(this.port, data_object);
    await this.await_response();
  }

  async bootload_cancel_app_timeout() {
    if (this.port) this.vflex.bootload_cancel_app_timeout(this.port);
    await this.await_response();
  }

  async await_response() {
    return await this.vflex.await_response();
  }
}

(function() {
  'use strict';
  document.addEventListener('DOMContentLoaded', event => {});
})();
