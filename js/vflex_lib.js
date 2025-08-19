import {serial} from "./serial.js";
export const command_list = Object.freeze({
  CMD_BOOTLOADER_WRITE_CHUNK: 0,
  CMD_BOOTLOADER_COMMIT_PAGE: 1,
  CMD_BOOTLOADER_VERIFY: 2,
  CMD_BOOTLOAD_END: 3,
  CMD_RESERVED0: 4,
  CMD_RESERVED1: 5,
  CMD_RESERVED2: 6,
  CMD_RESERVED3: 7,
  CMD_SERIAL_NUMBER: 8,
  CMD_CHIP_UUID: 9,
  CMD_HARDWARE_ID: 10,
  CMD_FIRMWARE_VERSION: 11,
  CMD_MFG_DATE: 12,
  CMD_FLASH_LED_SEQUENCE_ADVANCED: 13,
  CMD_FLASH_LED: 14,
  CMD_DISABLE_LED_DURING_OPERATION: 15,
  CMD_ENCRYPT_MSG: 16,
  CMD_PDO_LOG: 17,
  CMD_VOLTAGE_MV: 18,
  CMD_CURRENT_LIMIT_MA: 19,
  CMD_JUMP_APP_TO_BOOTLOADER: 20
});

const command_list_string_sizes = Object.freeze({
  CMD_SERIAL_NUMBER: 8,
  CMD_CHIP_UUID: 8,
  CMD_HARDWARE_ID: 8,
  CMD_FIRMWARE_VERSION: 12,
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

function delay_ms(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}



export class VFLEX {
  constructor(device_data) {
    this.device_data = device_data;// stores reference
    this.device = null;
    this.bootloader_packet_queue = [];
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
    output_array[1] = command_list.CMD_BOOTLOADER_WRITE_CHUNK | 0x80;
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
    output_array[1] = command_list.CMD_BOOTLOADER_VERIFY | 0x80;
    port.send(output_array);
  }

  commit_bootloader_page(port) {
    this.ACK = 0;
    let preamble_len = 2;
    let output_array_len = preamble_len;
    var output_array = new Uint8Array(output_array_len);
    output_array[0] = output_array_len;
    output_array[1] = command_list.CMD_BOOTLOADER_COMMIT_PAGE | 0x80;
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

  get_voltage_mv(port) {
    this.ACK = 0;
    var array = new Uint8Array(2);
    array[0] = 2;
    array[1] = command_list.CMD_VOLTAGE_MV;
    port.send(array);
  }

  set_voltage_mv(port, setting_mv) {
    this.ACK = 0;
    var array = new Uint8Array(4);
    array[0] = 4;
    array[1] = command_list.CMD_VOLTAGE_MV | 0x80;
    let setting_mv_msb = (setting_mv >> 8) & 0xFF;
    let setting_mv_lsb = setting_mv & 0xFF;
    array[2] = setting_mv_msb;
    array[3] = setting_mv_lsb;
    port.send(array);
  }

  get_max_current_ma(port) {
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
    arr[1] = command_list.CMD_JUMP_APP_TO_BOOTLOADER;
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
    let command_code = data_u8a[1];
    let next_packet;
    let response;
    this.ACK = 1;
    switch (command_code) {
      case command_list.CMD_DISABLE_LED_DURING_OPERATION:
        let disabled = data_u8a[2];
        this.device_data.led_disable_during_operation = disabled;
        break;
      case command_list.CMD_BOOTLOADER_WRITE_CHUNK:
        break;
      case command_list.CMD_BOOTLOADER_COMMIT_PAGE:
        break;
      case command_list.CMD_BOOTLOADER_VERIFY:
        this.device_data.crc = data_u8a[2];
        break;
      case command_list.CMD_PDO_LOG:
        if (data_u8a.length == 3) {
          this.device_data.pdo_len = data_u8a[2];
          this.device_data.pdo_payload = [];
        } else if (data_u8a.length == 6) {
          let new_pdo = [];
          new_pdo.push(data_u8a[2]);
          new_pdo.push(data_u8a[3]);
          new_pdo.push(data_u8a[4]);
          new_pdo.push(data_u8a[5]);
          this.device_data.pdo_payload.push(new_pdo);
        }
        this.device_data.pdo_ack = true;
        break;
      case command_list.CMD_ENCRYPT_MSG:
        const numbers = data.slice(2);
        this.device_data.secretsecrets = numbers;
        break;
      case command_list.CMD_VOLTAGE_MV:
        let mv = data_u8a[2] << 8 | (data_u8a[3]);
        this.device_data.voltage_mv = mv;
        break;
      case command_list.CMD_CURRENT_LIMIT_MA:
        break;
      case command_list.CMD_SERIAL_NUMBER:
        var string = new TextDecoder().decode(data_u8a).slice(preamble_len);
        this.device_data.serial_num = string;
        break;
      case command_list.CMD_CHIP_UUID:
        var string = new TextDecoder().decode(data_u8a).slice(preamble_len);
        this.device_data.uuid = string;
        break;
      case command_list.CMD_HARDWARE_ID:
        var string = new TextDecoder().decode(data_u8a).slice(preamble_len);
        this.device_data.hw_id = string;
        break;
      case command_list.CMD_FIRMWARE_VERSION:
        var string = new TextDecoder().decode(data_u8a).slice(preamble_len);
        this.device_data.fw_id = string;
        break;
      case command_list.CMD_MFG_DATE:
        var string = new TextDecoder().decode(data_u8a).slice(preamble_len);
        this.device_data.mfg_date = string;
        break;
      case command_list.CMD_FLASH_LED_SEQUENCE_ADVANCED:
        break;
      case command_list.CMD_FLASH_LED:
        break;
      default:
        console.log("invalid usb incoming message. unexpected command code", command_code);
    }
  }
}

export class VFLEX_MIDI {
  constructor() {
    this.checkInterval = null;
    this.midi_access = null;
    this.is_connecting = false;
    this.on_connect_success = () => {};
    this.on_connection_fail = () => {};
    this.on_disconnect = () => {};
    this.on_connection_change = () => {};
    this.on_message= () => {};
    this.connected = false;
    this.port = null;
    this.midi_input = null;
    this.midi_output= null;
    this.midi_packet_delay_ms = 20;
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
  register_message_callback(on_message_callback) { this.on_message = on_message_callback || this.on_message; }

  async init() {
    if (!this.midi_access) {
      try {
        this.midi_access = await navigator.requestMIDIAccess();
        this.start_monitoring();
      } catch (err) {
        console.error("MIDI Access Failed:", err);
        this.on_connection_fail(err);
      }
    }
  }

  async deinit() {
    this.stop_monitoring();
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

  async try_connect() {
    if (this.is_connecting || this.connected || !this.midi_access) return;
    this.is_connecting = true;
    try {
      this.midi_output = null;
      for (let out of this.midi_access.outputs.values()) {
        if (out.name.includes("vFlex")) {
          this.midi_output = out;
          break;
        }
      }
      this.midi_input = null;
      for (let in_port of this.midi_access.inputs.values()) {
        if (in_port.name.includes("vFlex")) {
          this.midi_input = in_port;
          this.midi_input.onmidimessage = (event) => this.on_message(event); 
          break;
        }
      }
      let midi_connection_ok = this.midi_input != null && this.midi_output != null;
      if (midi_connection_ok) {
        this.port = {
          send: async function(data) {
            if (this.midi_output == null) {
              console.error("No MIDI output connected!");
              return;
            }
            this.midi_output.send([0x80, 0, 0]);
            await delay_ms(this.midi_packet_delay_ms);
            for (let i = 0; i < data.length; i++) {
              const byte = data[i];
              const high_nibble = (byte >> 4) & 0x0F;
              const low_nibble = byte & 0x0F;
              this.midi_output.send([0x90, high_nibble, low_nibble]);
              await delay_ms(this.midi_packet_delay_ms);
            }
            this.midi_output.send([0xA0, 0, 0]);
          }.bind(this),
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
    if (this.midi_input) {
      this.midi_input.onmidimessage = null;
    }
    this.midi_output = null;
    this.midi_input = null;
    this.port = null;
    this.connected = false;
    this.on_connection_change();
    this.on_disconnect();
  }

  start_monitoring() {
    this.midi_access.onstatechange = (e) => {
      if (e.port.name.includes("vFlex")) {
        if (e.port.state === "disconnected" && this.connected) {
          this.disconnect();
        }
      }
    };
    this.checkInterval = setInterval(() => {
      if (!this.connected) {
        this.try_connect();
      }
    }, 100);
  }

 

  stop_monitoring() {
    clearInterval(this.checkInterval);
    this.disconnect();
  }

  destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.disconnect();
    this.midi_access.onstatechange = null;
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
      serial.requestPort().then(selected_port => {
        this.port = selected_port;
        this.port.connect().then(() => {
          this.port.onReceive = data => { this.vflex.process_response(data.buffer); };
          this.port.onReceiveError = error => {
         };
        //  if (this.cancel_btl_timeout) {
        //    setTimeout(() => { this.vflex.bootload_cancel_app_timeout(this.port); }, 100);
        //  }
          this.connected = true;
        });
      }).catch(error => {
      });
    }
  }
}

//export const vflex = new VFLEX();
export const VFLEX_COMMANDS = command_list;

export class VFLEX_API {
  constructor() {
    this.device_data = {};
    this.vflex = new VFLEX(this.device_data);
    this.midi = new VFLEX_MIDI();
    this.midi_receive_buffer = [];
    this.midi_receive_complete = false;
    this.serial = new VFLEX_CDC_SERIAL(this.vflex);
    this.port = null;
    this.connected = false;
    this.midi.set_callbacks(
      () => { this.connected = true; 
              this.port = this.midi.port; 
              this.on_connection_change();
              this.on_connect_success();
            },
      (err) => {
              this.on_connection_change();
              },
      () => { 
              this.on_disconnect = () => {};
              this.on_connection_change();
            },
      () => {
              this.on_connection_change();
            }
    );
    this.midi.register_message_callback( (event) => 
    {
      const [status, data1, data2] = event.data;
      if (status === 0x80) {
        this.midi_receive_buffer = [];
        this.midi_receive_complete = false;
      } else if (status === 0x90) {
        if (this.midi_receive_buffer.length < 64) {
          const byte = (data1 << 4) | data2;
          this.midi_receive_buffer.push(byte);
        }
      } else if (status === 0xA0) {
        this.midi_receive_complete = true;
        this.vflex.process_response(this.midi_receive_buffer);
      }
    });
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

  async protocol_wrap(fn) {
    if (!this.port) throw new Error("No connection established");
    const result = await fn(this.port);
    await this.vflex.await_response();
    return result;
  }

  async send_ww_string(string_command, str, write, scratchpad) {
    return this.protocol_wrap(port => this.vflex.send_ww_string(port, string_command, str, write, scratchpad));
  }

  async send_encrypted_message(msg) {
    return this.protocol_wrap(port => this.vflex.send_encrypted_message(port, msg));
  }

  async send_bootloader_chunk_encrypted(msg, pg_id, chunk_id) {
    return this.protocol_wrap(port => this.vflex.send_bootloader_chunk_encrypted(port, msg, pg_id, chunk_id));
  }

  async verify_bootloader() {
    return this.protocol_wrap(port => this.vflex.verify_bootloader(port));
  }

  async commit_bootloader_page() {
    return this.protocol_wrap(port => this.vflex.commit_bootloader_page(port));
  }

  async set_ww_string(string_command, str) {
    return this.protocol_wrap(port => this.vflex.set_ww_string(port, string_command, str));
  }

  async set_ww_string_scratchpad(string_command, str) {
    return this.protocol_wrap(port => this.vflex.set_ww_string_scratchpad(port, string_command, str));
  }

  async get_ww_string(string_command) {
    return this.protocol_wrap(port => this.vflex.get_ww_string(port, string_command));
  }

  async get_ww_string_scratchpad(string_command) {
    return this.protocol_wrap(port => this.vflex.get_ww_string_scratchpad(port, string_command));
  }

  async get_voltage_mv() {
    return this.protocol_wrap(port => this.vflex.get_voltage_mv(port));
  }

  async set_voltage_mv(setting_mv) {
    return this.protocol_wrap(port => this.vflex.set_voltage_mv(port, setting_mv));
  }

  async get_max_current_ma() {
    return this.protocol_wrap(port => this.vflex.get_max_current_ma(port));
  }

  async set_max_current_ma(setting_ma) {
    return this.protocol_wrap(port => this.vflex.set_max_current_ma(port, setting_ma));
  }

  async bootload_prom_function(data_object) {
    return this.protocol_wrap(port => this.vflex.bootload_prom_function(port, data_object));
  }

  async disable_leds_operation(disable, write) {
    return this.protocol_wrap(port => this.vflex.disable_leds_operation(port, disable, write));
  }

  async clear_pdo_log() {
    return this.protocol_wrap(port => this.vflex.clear_pdo_log(port));
  }

  async get_pdo_log() {
    return this.protocol_wrap(port => this.vflex.get_pdo_log(port));
  }

  async pdo_cmd(pdo_cmd) {
    return this.protocol_wrap(port => this.vflex.pdo_cmd(port, pdo_cmd));
  }

  async jump_to_app() {
    return this.protocol_wrap(port => this.vflex.jump_to_app(port));
  }

  async jump_to_bootloader() {
    return this.protocol_wrap(port => this.vflex.jump_to_bootloader(port));
  }

  async bootload_verify_function(data_object) {
    return this.protocol_wrap(port => this.vflex.bootload_verify_function(port, data_object));
  }

  async bootload_cancel_app_timeout() {
    return this.protocol_wrap(port => this.vflex.bootload_cancel_app_timeout(port));
  }

  async await_response() {
    return await this.vflex.await_response();
  }

}
