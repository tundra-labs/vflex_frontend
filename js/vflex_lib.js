const command_list = Object.freeze({
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

export class VFLEX_PROTOCOL {
  constructor(device_data) {
    this.device_data = device_data;
    this.bootloader_packet_queue = [];
    this.ACK = 0;
    this.preamble_len = 2;
  }

  async wrap_command(port, command_code, payload = new Uint8Array(0), write = false, scratchpad = false) {
    this.ACK = 0;
    let command = command_code;
    if (scratchpad) {
      command |= 0x40;
    }
    if (write) {
      command |= 0x80;
    }
    const output_array_len = this.preamble_len + payload.length;
    const output_arr = new Uint8Array(output_array_len);
    output_arr[0] = output_array_len;
    output_arr[1] = command;
    for (let i = 0; i < payload.length; i++) {
      output_arr[i + this.preamble_len] = payload[i];
    }
    await port.send(output_arr);
    return true;
  }

  async string_wrapper(port, string_command, str, write, scratchpad) {
    let command = extract_key_from_list(string_command);
    let expected_str_len = command_to_string_length(command);
    if (!write) {
      return await this.wrap_command(port, command_list[command], new Uint8Array(0), false, scratchpad);
    } else if (str.length === expected_str_len) {
      const payload = new Uint8Array(str.length);
      for (let i = 0; i < str.length; i++) {
        payload[i] = str.charCodeAt(i);
      }
      return await this.wrap_command(port, command_list[command], payload, true, scratchpad);
    }
    return false;
  }

  async send_encrypted_message(port, msg) {
    const payload = new Uint8Array(msg.length);
    for (let i = 0; i < msg.length; i++) {
      payload[i] = msg.charCodeAt(i);
    }
    return await this.wrap_command(port, command_list.CMD_ENCRYPT_MSG, payload, true);
  }

  async send_bootloader_chunk_encrypted(port, msg, pg_id, chunk_id) {
    const payload = new Uint8Array(3 + msg.length);
    payload[0] = pg_id >> 8;
    payload[1] = pg_id & 0xff;
    payload[2] = chunk_id;
    for (let i = 0; i < msg.length; i++) {
      payload[i + 3] = msg[i];
    }
    return await this.wrap_command(port, command_list.CMD_BOOTLOADER_WRITE_CHUNK, payload, true);
  }

  async verify_bootloader(port) {
    return await this.wrap_command(port, command_list.CMD_BOOTLOADER_VERIFY, new Uint8Array(0), true);
  }

  async commit_bootloader_page(port) {
    return await this.wrap_command(port, command_list.CMD_BOOTLOADER_COMMIT_PAGE, new Uint8Array(0), true);
  }

  async set_string(port, string_command, str) {
    return await this.string_wrapper(port, string_command, str, true, false);
  }

  async set_string_scratchpad(port, string_command, str) {
    return await this.string_wrapper(port, string_command, str, true, true);
  }

  async get_string(port, string_command) {
    return await this.string_wrapper(port, string_command, "", false, false);
  }

  async get_string_scratchpad(port, string_command) {
    return await this.string_wrapper(port, string_command, "", false, true);
  }

  async get_voltage_mv(port) {
    return await this.wrap_command(port, command_list.CMD_VOLTAGE_MV, new Uint8Array(0), false);
  }

  async set_voltage_mv(port, setting_mv) {
    const payload = new Uint8Array(2);
    payload[0] = (setting_mv >> 8) & 0xFF;
    payload[1] = setting_mv & 0xFF;
    return await this.wrap_command(port, command_list.CMD_VOLTAGE_MV, payload, true);
  }

  async get_max_current_ma(port) {
    return await this.wrap_command(port, command_list.CMD_CURRENT_LIMIT_MA, new Uint8Array(0), false);
  }

  async set_max_current_ma(port, setting_ma) {
    const payload = new Uint8Array(2);
    payload[0] = (setting_ma >> 8) & 0xFF;
    payload[1] = setting_ma & 0xFF;
    return await this.wrap_command(port, command_list.CMD_CURRENT_LIMIT_MA, payload, true);
  }

  async disable_leds_operation(port, disable, write) {
    const payload = write ? new Uint8Array([disable]) : new Uint8Array(0);
    return await this.wrap_command(port, command_list.CMD_DISABLE_LED_DURING_OPERATION, payload, write);
  }

  async clear_pdo_log(port) {
    return await this.wrap_command(port, command_list.CMD_PDO_LOG, new Uint8Array(0), true);
  }

  async get_pdo_log(port) {
    return await this.wrap_command(port, command_list.CMD_PDO_LOG, new Uint8Array(0), false);
  }

  async pdo_cmd(port, pdo_cmd) {
    const payload = new Uint8Array([pdo_cmd]);
    return await this.wrap_command(port, command_list.CMD_PDO_LOG, payload, false);
  }

  async jump_to_app(port) {
    return await this.wrap_command(port, command_list.CMD_BOOTLOAD_END, new Uint8Array(0), false);
  }

  async jump_to_bootloader(port) {
    return await this.wrap_command(port, command_list.CMD_JUMP_APP_TO_BOOTLOADER, new Uint8Array(0), false);
  }

  async bootload_verify_function(port, data_object) {
    this.ACK = 0;
    const data = new Uint8Array(data_object);
    const bootloader_preamble_len = 4;
    const max_packet_len = 64;
    const max_packet_code_len = max_packet_len - bootloader_preamble_len;
    let index = 0;
    while (index < data.byteLength) {
      const remaining = data.byteLength - index;
      const packet_code_len = Math.min(remaining, max_packet_code_len);
      const payload = new Uint8Array(packet_code_len + 2);
      payload[0] = index >> 8;
      payload[1] = index & 0xFF;
      for (let i = 0; i < packet_code_len; i++) {
        payload[i + 2] = data[index++];
      }
      this.bootloader_packet_queue.push(payload);
    }
    const first_payload = this.bootloader_packet_queue.shift();
    return await this.wrap_command(port, command_list.CMD_BOOTLOADER_VERIFY, first_payload, false);
  }

  async await_response(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (this.ACK == 1) {
          this.ACK = 0;
          clearInterval(interval);
          clearTimeout(timeout);
          resolve();
        }
      }, 25);
      const timeout = setTimeout(() => {
        clearInterval(interval);
        reject(new Error('Response timeout exceeded'));
      }, timeoutMs);
    });
  }


  process_response(data) {
    let data_u8a = new Uint8Array(data);
    let command_code = data_u8a[1];
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
        var string = new TextDecoder().decode(data_u8a).slice(this.preamble_len);
        this.device_data.serial_num = string;
        break;
      case command_list.CMD_CHIP_UUID:
        var string = new TextDecoder().decode(data_u8a).slice(this.preamble_len);
        this.device_data.uuid = string;
        break;
      case command_list.CMD_HARDWARE_ID:
        var string = new TextDecoder().decode(data_u8a).slice(this.preamble_len);
        this.device_data.hw_id = string;
        break;
      case command_list.CMD_FIRMWARE_VERSION:
        var string = new TextDecoder().decode(data_u8a).slice(this.preamble_len);
        this.device_data.fw_id = string;
        break;
      case command_list.CMD_MFG_DATE:
        var string = new TextDecoder().decode(data_u8a).slice(this.preamble_len);
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
    this.events = {};
    this.connected = false;
    this.port = null;
    this.midi_input = null;
    this.midi_output = null;
    this.midi_packet_delay_ms = 20;
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(...args));
    }
  }

  async init() {
    if (!this.midi_access) {
      try {
        this.midi_access = await navigator.requestMIDIAccess();
        this.start_monitoring();
      } catch (err) {
        console.error("MIDI Access Failed:", err);
        this.emit('error', err);
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
          this.midi_input.onmidimessage = (event) => this.emit('message', event);
          break;
        }
      }
      let midi_connection_ok = this.midi_input != null && this.midi_output != null;
      if (midi_connection_ok) {
        this.port = {
          send: async function(data) {
            return new Promise((resolve, reject) => {
              if (this.midi_output == null) {
                reject(new Error("No MIDI output connected!"));
                return;
              }
              try {
                this.midi_output.send([0x80, 0, 0]);
                delay_ms(this.midi_packet_delay_ms).then(() => {
                  const promises = [];
                  for (let i = 0; i < data.length; i++) {
                    const byte = data[i];
                    const high_nibble = (byte >> 4) & 0x0F;
                    const low_nibble = byte & 0x0F;
                    this.midi_output.send([0x90, high_nibble, low_nibble]);
                    promises.push(delay_ms(this.midi_packet_delay_ms));
                  }
                  Promise.all(promises).then(() => {
                    this.midi_output.send([0xA0, 0, 0]);
                    resolve();
                  }).catch(reject);
                }).catch(reject);
              } catch (err) {
                reject(err);
              }
            });
          }.bind(this),
        };
        this.connected = true;
        this.emit('connectionchange');
        this.emit('connect');
      } else {
        throw new Error("No vFlex device found");
      }
    } catch (err) {
      this.emit('error', err);
      throw new Error(`Connection failed: ${err.message}`);
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
    this.emit('connectionchange');
    this.emit('disconnect');
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
    this.events = {};
    this.connected = false;
    this.serial = {};
    this.serial.get_ports = function() {
      return navigator.usb.getDevices().then(devices => {
        return devices.map(device => new this.serial.Port(device));
      });
    }.bind(this);
    this.serial.request_port = function() {
      const filters = [{ 'vendorId': 0x37bf }]; // tundra
      return navigator.usb.requestDevice({ 'filters': filters }).then(
        device => new this.serial.Port(device)
      );
    }.bind(this);
    this.serial.Port = function(device) {
      this.device_ = device;
      this.interface_number = 0;
      this.endpoint_in = 0;
      this.endpoint_out = 0;
    };
    this.serial.Port.prototype.connect = function() {
      let read_loop = () => {
        this.device_.transferIn(this.endpoint_in, 64).then(result => {
          this.onReceive(result.data);
          read_loop();
        }, error => {
          this.onReceiveError(error);
        });
      };

      return this.device_.open()
        .then(() => {
          if (this.device_.configuration === null) {
            return this.device_.selectConfiguration(1);
          }
        })
        .then(() => {
          var interfaces = this.device_.configuration.interfaces;
          interfaces.forEach(element => {
            element.alternates.forEach(elementalt => {
              if (elementalt.interfaceClass == 0xFF) {
                this.interface_number = element.interfaceNumber;
                elementalt.endpoints.forEach(elementendpoint => {
                  if (elementendpoint.direction == "out") {
                    this.endpoint_out = elementendpoint.endpointNumber;
                  }
                  if (elementendpoint.direction == "in") {
                    this.endpoint_in = elementendpoint.endpointNumber;
                  }
                });
              }
            });
          });
        })
        .then(() => this.device_.claimInterface(this.interface_number))
        .then(() => this.device_.selectAlternateInterface(this.interface_number, 0))
        .then(() => this.device_.controlTransferOut({
          'requestType': 'class',
          'recipient': 'interface',
          'request': 0x22,
          'value': 0x01,
          'index': this.interface_number
        }))
        .then(() => {
          read_loop();
        });
    };
    this.serial.Port.prototype.disconnect = function() {
      try {
        this.device_.close();
      } catch {
        console.log("error closing device");
      }
    };
    this.serial.Port.prototype.send = function(data) {
      return this.device_.transferOut(this.endpoint_out, data);
    };
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(...args));
    }
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
        await this.port.disconnect();
      } catch {}
      this.port = null;
    }
    try {
      const selected_port = await this.serial.request_port();
      this.port = selected_port;
      await this.port.connect();
      this.port.onReceive = data => { this.vflex.process_response(data.buffer); };
      this.port.onReceiveError = error => {
        console.error("Serial receive error:", error);
        this.disconnect();
      };
      this.connected = true;
      this.emit('connect');
      this.emit('connectionchange');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  disconnect() {
    if (this.port) {
      try {
        this.port.disconnect();
      } catch (err) {
        console.error("Error closing serial port:", err);
      }
      this.port = null;
    }
    this.connected = false;
    this.emit('connectionchange');
    this.emit('disconnect');
  }
}

export const VFLEX_COMMANDS = command_list;

export class VFLEX_API {
  constructor() {
    this.device_data = {};
    this.vflex = new VFLEX_PROTOCOL(this.device_data);
    this.midi = new VFLEX_MIDI();
    this.midi_receive_buffer = [];
    this.midi_receive_complete = false;
    this.serial = new VFLEX_CDC_SERIAL(this.vflex);
    this.port = null;
    this.connected = false;
    this.events = {};

    // Register event listeners for MIDI
    this.midi.on('connect', () => {
      this.connected = true;
      this.port = this.midi.port;
      console.log('midi connect');
      this.emit('connect');
      this.emit('connectionchange');
    });
    this.midi.on('error', (err) => {
      this.connected = false;
      this.port = null;
      this.emit('error', err);
      this.emit('connectionchange');
    });
    this.midi.on('disconnect', () => {
      this.connected = false;
      this.port = null;
      this.emit('disconnect');
      this.emit('connectionchange');
    });
    this.midi.on('connectionchange', () => {
      this.emit('connectionchange');
    });
    this.midi.on('message', (event) => {
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

    // Register event listeners for Serial
    this.serial.on('connect', () => {
      console.log('midi connect');
      this.connected = true;
      this.port = this.serial.port;
      this.emit('connect');
      this.emit('connectionchange');
    });
    this.serial.on('error', (err) => {
      this.connected = false;
      this.port = null;
      this.emit('error', err);
      this.emit('connectionchange');
    });
    this.serial.on('disconnect', () => {
      this.connected = false;
      this.port = null;
      this.emit('disconnect');
      this.emit('connectionchange');
    });
    this.serial.on('connectionchange', () => {
      this.emit('connectionchange');
    });
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(...args));
    }
  }

  async app_autoconnect() {
    try {
      await this.midi.init();
      await this.midi.await_connected();
      this.port = this.midi.port;
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  async bootloader_manual_connect() {
    try {
      await this.serial.serial_manual_connect();
      await this.serial.await_connected();
      this.port = this.serial.port;
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  async bootloader_disconnect() {
    if (this.serial.port) {
      try {
        await this.serial.port.disconnect();
      } catch {}
      this.serial.port = null;
      this.port = null;
    }
    this.connected = false;
    this.emit('disconnect');
    this.emit('connectionchange');
  }

  async protocol_wrap(fn) {
    if (!this.port) throw new Error("No connection established");
    try {
      const result = await fn(this.port);
      await this.vflex.await_response();
      return result;
    } catch (err) {
      this.emit('error', err);
      throw new Error(`Command execution failed: ${err.message}`);
    }
  }

  async string_wrapper(string_command, str, write, scratchpad) {
    return await this.protocol_wrap(port => this.vflex.string_wrapper(port, string_command, str, write, scratchpad));
  }

  async send_encrypted_message(msg) {
    return await this.protocol_wrap(port => this.vflex.send_encrypted_message(port, msg));
  }

  async send_bootloader_chunk_encrypted(msg, pg_id, chunk_id) {
    return await this.protocol_wrap(port => this.vflex.send_bootloader_chunk_encrypted(port, msg, pg_id, chunk_id));
  }

  async verify_bootloader() {
    return await this.protocol_wrap(port => this.vflex.verify_bootloader(port));
  }

  async commit_bootloader_page() {
    return await this.protocol_wrap(port => this.vflex.commit_bootloader_page(port));
  }

  async set_string(string_command, str) {
    return await this.protocol_wrap(port => this.vflex.set_string(port, string_command, str));
  }

  async set_string_scratchpad(string_command, str) {
    return await this.protocol_wrap(port => this.vflex.set_string_scratchpad(port, string_command, str));
  }

  async get_string(string_command) {
    return await this.protocol_wrap(port => this.vflex.get_string(port, string_command));
  }

  async get_string_scratchpad(string_command) {
    return await this.protocol_wrap(port => this.vflex.get_string_scratchpad(port, string_command));
  }

  async get_voltage_mv() {
    return await this.protocol_wrap(port => this.vflex.get_voltage_mv(port));
  }

  async set_voltage_mv(setting_mv) {
    return await this.protocol_wrap(port => this.vflex.set_voltage_mv(port, setting_mv));
  }

  async get_max_current_ma() {
    return await this.protocol_wrap(port => this.vflex.get_max_current_ma(port));
  }

  async set_max_current_ma(setting_ma) {
    return await this.protocol_wrap(port => this.vflex.set_max_current_ma(port, setting_ma));
  }

  async bootload_verify_function(data_object) {
    return await this.protocol_wrap(port => this.vflex.bootload_verify_function(port, data_object));
  }

  async disable_leds_operation(disable, write) {
    return await this.protocol_wrap(port => this.vflex.disable_leds_operation(port, disable, write));
  }

  async clear_pdo_log() {
    return await this.protocol_wrap(port => this.vflex.clear_pdo_log(port));
  }

  async get_pdo_log() {
    return await this.protocol_wrap(port => this.vflex.get_pdo_log(port));
  }

  async pdo_cmd(pdo_cmd) {
    return await this.protocol_wrap(port => this.vflex.pdo_cmd(port, pdo_cmd));
  }

  async jump_to_app() {
    return await this.protocol_wrap(port => this.vflex.jump_to_app(port));
  }

  async jump_to_bootloader() {
    return await this.protocol_wrap(port => this.vflex.jump_to_bootloader(port));
  }

  async await_response() {
    return await this.vflex.await_response();
  }
}
