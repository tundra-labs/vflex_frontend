// ### Werewolf sink control API ###
// * commands supported between werewolf sink and web app via usb serial cdc:
// * command code's two most significant bits are reserved for a read/write bit (0x80) and scratchpad bit (0x40)
// * scratchpad is a datastructure in ram containing all calibration values
//   * it can be reset / loaded from flash
//   * it can be written (comitted) to flash
//   * individual values can be modified at any time by setting the scratchpad bit in an outgoing write command
//   * allows for bulk modification, preventing excessive flash erases
//   * default behavior (scratchpad = 0) means commands will reload flash to structure, overwrite a value, and write it back to flash
//
// * All commands to/from werewolf will have a preamble of length 2, where
//     command_array[0] = length of total message
//     command_array[1] = command code (including read/write bit and scrachpad bit)
//   After which the remaining packet structure depends on the type of command
//   For Voltage and current limit:
//     an additional two bytes are stored representing the voltage in mV or current in mA, MSB first
//     this makes the total packet len = 4: LEN COMMAND MSB LSB
//     example: set device for 9V (9000mV) writing directly to flash memory; 
//     9000 = 0x2328
//     packet len = 4 
//     command code = command_list.CMD_VOLTAGE | 0x00 (no scratchpad)| 0x80 (write)
//     packet = 0x04 0x80 0x23 0x28
//   For string values:
//     an additional N bytes are stored where each byte is an ascii character in the string
//     this script contains a list with the expected string size which is checked before sending the packet
//       i.e if serial number is expected to be 8 bytes, the input string must be 8 bytes
//     example: set serial number to "asdf1234"
//     packet len = premable + string_len = 2 + 8 = 10 
//     command code = command_list.CMD_WW_SERIAL | 0x00 (no scratchpad)| 0x80 (write)
//     packet = 0x0A 0x82 0x97 0x115 0x100 0x102 0x49 0x50 0x51 0x52
//
//     this is valid for all string values, however note that the chip uuid is not stored in flash memory
//   For led control:
//     A sequence of timed led flashes is programmed where each cycle of the sequence (one byte indicating off, red, green, blue)
//       turns on the desired led for a duration (time in ms stored as two bytes MSB and LSB)
//       each flash is then encoded as 3 bytes: code time_MSB time_LSB
//     
//    the packet structure is: len command_code n_cycles len_of_sequence led_payload(3 bytes * len_of_sequence)
//    where:
//    * n cycles is the number times to repeat
//    * length of sequence is number of led changes (i.e. RED/off would be len 2. red/blue/off would be len 3. red/off/blue/off len 4.)
//    * led_payload is 3 bytes * length of sequence, each 3 byte chunk defined as
//      * LED code (r/g/b/off = 0/1/2/3)
//      * LED duration milliseconds Most Significant Byte
//      * LED duration milliseconds Least Significant Byte
//    * example:
//      * flash green led on/off 5 times duration 1s
//        * [10, 2, 5(cycles), 2(sequence len), 1(green), 0x03, 0x08, 3(off), 0x03, 0x08]
//      * flash green / off / red /off 3 times duration 1s
//        * [16, 2, 3, 2, 1, 0x03, 0x08, 3, 0x03, 0x08, 0, 0x03, 0x08, 3, 0x03, 0x08]
//
//   For scratchpad commands:
//     only a command is sent, no payload
//     packet len = 2
//     command code = command_list.CMD_COMMIT_CAL_SCRATCHPAD | 0x40; (must set scratchpad bit)
//     or command code = command_list.CMD_LOAD_CAL_SCRATCHPAD | 0x40;
//     packet = 0x20 0x4A
//   
// * Response packets will resemble the outgoing request packet:
// i.e. a voltage setting will return the same length packet with the same payload, setting a string will return the same packet with that string
// todo: on event of incorrect flash write, return an error code or the packet with invalid setting?
const command_list = Object.freeze ({
  CMD_BOOTLOAD_PROM: 0,
  CMD_JUMP_TO_BOOTLOAD: 1,
  CMD_BOOTLOAD_VERIFY: 2,
  CMD_BOOTLOAD_END: 3,
  CMD_BOOTLOAD_CANCEL_APP_TIMEOUT: 4,
  CMD_BOOTLOAD_RESERVED_0: 5,
  CMD_BOOTLOAD_RESERVED_1: 6,
  CMD_BOOTLOAD_RESERVED_2: 7,
  OK: 8,
  ERROR: 9,
  CMD_VOLTAGE: 10,
  CMD_CURRENT_LIMIT: 11, // optional current limit for pd negotiation
  CMD_WW_SERIAL: 12, // unique device serial number
  CMD_CHIP_UUID: 13, // ch32x035 chip uuid
  CMD_HWID: 14, // werewolf product code
  CMD_FWID: 15, // major.minor.patch
  CMD_MFG_DATE: 16, // DDMMMYYYY
  CMD_FLASH_LED_SEQUENCE_ADVANCED: 17, // write only, read returns confirm sequence received (todo: alternate return when sequence done)
  CMD_FLASH_LED: 18, // simplified flash led sequence. write only, returns confirm sequence received
  CMD_LOAD_CAL_SCRATCHPAD: 19, // load flash memory into ram calibration scratch pad
  CMD_COMMIT_CAL_SCRATCHPAD: 20, // commit scratchpad to flash
  CMD_PDO_LOG: 21,
	CMD_DISABLE_LED_DURING_OPERATION: 22,
	CMD_ENCRYPT_MSG: 23,
  CMD_SB_WRITE_HALF_PAGE: 24, // secure bootloader
  CMD_SB_COMMIT_PAGE: 25,
  CMD_SB_VERIFY: 26 // use crc or hash to verify, verify N bytes starting from programm address
});

// Expected string sizes (in bytes) for string set commands
const command_list_string_sizes = Object.freeze ({ // subset of commands that support storing strings to flash
  CMD_WW_SERIAL: 8, // unique device serial number
  CMD_CHIP_UUID: 8, // ch32x035 chip uuid
  CMD_HWID: 8, // werewolf product code
  CMD_FWID: 12, // XXX.major.minor.patch, XXX is APP (application) or BTL(bootloader)
  CMD_MFG_DATE: 8, // (X)DDMMMYY
});

function command_to_string_length(command) { // return string size of desired command, return 0 if command isn't a string setting command
  var keys = [];
  //console.log(command);
  for (const [key, value] of Object.entries(command_list_string_sizes)) { 
    if(key == command) {
      //console.log(command_list_string_sizes[key]);
      return command_list_string_sizes[key];
    }
  }
  return 0;
}

function extract_key_from_list(command){
  return Object.keys(command_list)[command];
}
function send_ww_string(port, string_command, str, write,scratchpad){
  let command = extract_key_from_list(string_command);
  let expected_str_len = command_to_string_length(command);
  //let serial_string_array = Uint8Array.from(str.value.split("").map(x => x.charCodeAt()));
  let command_code = command_list[command];
  if(scratchpad) {
    command_code |= 0x40; // write to scratchpad
  }
  if(!write){ // read operation
    let preamble_len = 2;
    let output_array_len = preamble_len;
    var output_array = new Uint8Array(output_array_len);
    output_array[0] = preamble_len;
    //command_code |= 0x70;
    output_array[1] = command_code;
    port.send(output_array);

  } else  if (str.length == expected_str_len) { // write operation
    command_code |= 0x80; // set write bite
    let preamble_len = 2;
    let output_array_len = str.length + preamble_len;
    var output_array = new Uint8Array(output_array_len);
    output_array[0] = output_array_len;
    output_array[1] = command_code;

    for (let i = preamble_len; i < output_array_len; i++) {
      output_array[i] = str[i-preamble_len].charCodeAt(0);
      //console.log(output_array);
    }
    port.send(output_array);
    
    return true;
  } else {
    return false;
  }
}

function fn_send_encrypted_message (port, msg) { // msg is a string
  console.log(msg, msg.length);
 let preamble_len = 2;
 let output_array_len = msg.length + preamble_len;
 console.log("enc msg info", output_array_len, msg.length, preamble_len);
 var output_array = new Uint8Array(output_array_len);
 output_array[0] = output_array_len; // msg len
 output_array[1] = command_list.CMD_ENCRYPT_MSG | 0x80;
 for (let i = 0; i < msg.length; i++) {
   output_array[i+preamble_len] = msg[i];
 }
 console.log("output_array", output_array);
 port.send(output_array);
}

// packet format(size): len(1) cmd(1) pg_msb(1) pg_lsb(1) which_half(1) data(32)
function fn_send_bootloader_chunk_encrypted(port, msg, pg_id, chunk_id) {
  let preamble_len = 2;
  let data_start_pos = 5;
  let pg_id_sz = 2;
  let chunk_sz = 1;

  let output_array_len =  preamble_len +pg_id_sz + chunk_sz + msg.length;
  var output_array = new Uint8Array(output_array_len);
  output_array[0] = output_array_len; // msg len
  output_array[1] = command_list.CMD_SB_WRITE_HALF_PAGE | 0x80;
  output_array[2] = pg_id >> 8;
  output_array[3] = pg_id&0xff;
  output_array[4] = chunk_id;
  
  for (let i = 0; i < msg.length; i++) {
   output_array[i+data_start_pos] = msg[i];
  }
  console.log("output_array", output_array);
  port.send(output_array);
}
function fn_verify_bootloader(port, mem_len) {
  let preamble_len = 2;
  let data_len = 2;
  let output_array_len =  preamble_len + data_len;
  var output_array = new Uint8Array(output_array_len);
  output_array[0] = output_array_len; // msg len
  output_array[1] = command_list.CMD_SB_VERIFY | 0x80;
  output_array[2] = mem_len >> 8;
  output_array[3] = mem_len & 0xff;
  console.log(output_array);
  port.send(output_array);
}

function fn_commit_bootloader_page(port) {
  let preamble_len = 2;
  let output_array_len =  preamble_len;
  var output_array = new Uint8Array(output_array_len);
  output_array[0] = output_array_len; // msg len
  output_array[1] = command_list.CMD_SB_COMMIT_PAGE | 0x80;
  port.send(output_array);
}
//function fn_send_encrypted_message (port, msg) { // msg is a string
// let preamble_len = 2;
// let output_array_len = msg.length + preamble_len;
// var output_array = new Uint8Array(output_array_len);
// output_array[0] = output_array_len; // msg len
// output_array[1] = command_list.CMD_ENCRYPT_MSG | 0x80;
// for (let i = preamble_len; i < output_array_len; i++) {
//   output_array[i] = msg[i-preamble_len].charCodeAt(0);
// }
// port.send(output_array);
//}//

function set_ww_string(port, string_command, str){
  let write = 1;
  let scratchpad = 0;
  send_ww_string(port, string_command, str, write, scratchpad);
}
function set_ww_string_scratchpad(port, string_command, str){
  //console.log(string_command);
  let write = 1;
  let scratchpad = 1;
  send_ww_string(port, string_command, str, write, scratchpad);
}
function get_ww_string(port, string_command){
  let write = 0;
  let scratchpad = 0;
  send_ww_string(port, string_command, "", write, scratchpad);
}
function get_ww_string_scratchpad(port, string_command){
  let write = 0;
  let scratchpad = 1;
  send_ww_string(port, string_command, "", write, scratchpad);
}

function getVoltage (port, x) {
  var array = new Uint8Array(2);
  array[0] = 2; // msg len
  array[1] = command_list.CMD_VOLTAGE;
  port.send(array);
  return true;
}

function setVoltage (port, setting_mv) {
  var array = new Uint8Array(4);
  array[0] = 4; // msg len
  array[1] = command_list.CMD_VOLTAGE | 0x80;

  //let setting_mv = radioArray.value;
  let setting_mv_msb = (setting_mv >> 8)&0xFF;
  let setting_mv_lsb = setting_mv & 0xFF;
  array[2] = setting_mv_msb;
  array[3] = setting_mv_lsb;

  port.send(array);
}
function getCurrent(port) {
  var array = new Uint8Array(2);
  array[0] = 2; // msg len
  array[1] = command_list.CMD_CURRENT;
  port.send(array);

}
function setCurrent (port, radioArray) {
  var array = new Uint8Array(4);
  array[0] = 4; // msg len
  array[1] = command_list.CMD_CURRENT | 0x80;

  let setting_mv = radioArray.value*1000;
  let setting_mv_msb = (setting_mv >> 8)&0xFF;
  let setting_mv_lsb = setting_mv & 0xFF;
  array[2] = setting_mv_msb;
  array[3] = setting_mv_lsb;

  port.send(array);
}
function load_flash(port) {
  var arr = new Uint8Array(2);
  arr[0] = 2;
  arr[1] = command_list.CMD_LOAD_CAL_SCRATCHPAD | 0x40;
  port.send(arr);
}
function commit_flash(port) {
  var arr = new Uint8Array(2);
  arr[0] = 2;
  arr[1] = command_list.CMD_COMMIT_CAL_SCRATCHPAD | 0x40;
  port.send(arr);
}



let bootloader_packet_queue = []; // todo: this could be a generic packet queue for connect function
function bootload_prom_function(port, data_object){ // data is of type "object" which is definitely a real type
  //boot_message.textContent = "bootload in progress";
  var data = new Uint8Array(data_object); // completely necessary step javascript is great
  let code_len = data.byteLength; // todo: from file. todo: note this expects multiples of 256
  let bootloader_preamble_len = 4; // Cmd, Len, Rev[2]; // todo: modify away rev, i believe it's redundant as we store a fw revision elsewhere
  let max_packet_len = 64; // usb packet limit
  let max_packet_code_len = max_packet_len - bootloader_preamble_len; // max code size sent in one packet
  let index = 0;
  let packet_count = 0;
  while(index < code_len) {
    let remaining = code_len - index;
    let packet_code_len = Math.min(remaining, max_packet_code_len);
    let packet_len = packet_code_len + bootloader_preamble_len;
    var boot_arr = new Uint8Array(packet_len);
    boot_arr[0] = packet_len;
    boot_arr[1] = command_list.CMD_BOOTLOAD_PROM;
  
    for (let i  = 0; i < packet_code_len; i++){

      boot_arr[i + bootloader_preamble_len] = data[index++]
    }
    bootloader_packet_queue.push(boot_arr);
    packet_count++

  }
  let first_packet = bootloader_packet_queue.shift();

  ledBlink(port, 100, bootloaderBlink);
  setTimeout(() => { port.send(first_packet); }, 200);
}


function disable_leds_operation_fn(port, disable, write){
  let bootloader_preamble_len = 2; // Cmd, Len, Rev[2]; // todo: modify away rev, i believe it's redundant as we store a fw revision elsewhere
  if (write) {
    var output_arr = new Uint8Array(3);
    output_arr[0] = 3;
    output_arr[1] = command_list.CMD_DISABLE_LED_DURING_OPERATION | 0x80; // set write bit for clear
    output_arr[2] = disable;
  } else {
    var output_arr = new Uint8Array(2);
    output_arr[0] = 2;
    output_arr[1] = command_list.CMD_DISABLE_LED_DURING_OPERATION; // set write bit for clear
  }
  port.send(output_arr);
}


function clear_pdo_log(port){ // data is of type "object" which is definitely a real type
  //boot_message.textContent = "bootload in progress";
  //var data = new Uint8Array(data_object); // completely necessary step javascript is great
  //let code_len = data.byteLength; // todo: from file. todo: note this expects multiples of 256
  let bootloader_preamble_len = 2; // Cmd, Len, Rev[2]; // todo: modify away rev, i believe it's redundant as we store a fw revision elsewhere
  let max_packet_len = 64; // usb packet limit
  //let max_packet_code_len = max_packet_len - bootloader_preamble_len; // max code size sent in one packet
  var output_arr = new Uint8Array(2);
  output_arr[0] = 2;
  output_arr[1] = command_list.CMD_PDO_LOG | 0x80; // set write bit for clear
  //let index = 0;
  //let packet_count = 0;
  //while(index < code_len) {
  //  let remaining = code_len - index;
  //  let packet_code_len = Math.min(remaining, max_packet_code_len);
  //  let packet_len = packet_code_len + bootloader_preamble_len;
  //  var boot_arr = new Uint8Array(packet_len);
  //  boot_arr[0] = packet_len;
  //  boot_arr[1] = command_list.CMD_BOOTLOAD_PROM;
  //
  //  for (let i  = 0; i < packet_code_len; i++){

  //    boot_arr[i + bootloader_preamble_len] = data[index++]
  //  }
  //  bootloader_packet_queue.push(boot_arr);
  //  packet_count++

  //}
  //let first_packet = bootloader_packet_queue.shift();

  port.send(output_arr);
}
function get_pdo_log(port) {
  let bootloader_preamble_len = 2; // Cmd, Len, Rev[2]; // todo: modify away rev, i believe it's redundant as we store a fw revision elsewhere
  let max_packet_len = 64; // usb packet limit
  var output_arr = new Uint8Array(2);
  output_arr[0] = 2;
  output_arr[1] = command_list.CMD_PDO_LOG; 

  port.send(output_arr);
}


function jump_to_app(port) {
    var arr = new Uint8Array(2);
    arr[0] = 2;
    arr[1] = command_list.CMD_BOOTLOAD_END;
    port.send(arr);
}

function jump_to_bootloader(port) {
    var arr = new Uint8Array(2);
    arr[0] = 2;
    arr[1] = command_list.CMD_JUMP_TO_BOOTLOAD;
    port.send(arr);
}
function bootload_verify_function(port, data_object){
  boot_message.textContent = "bootload verification in progress";
  var data = new Uint8Array(data_object); // completely necessary step javascript is great
  let code_len = data.byteLength; // todo: from file. todo: note this expects multiples of 256
  let bootloader_preamble_len = 4; // Cmd, Len, Rev[2]; // todo: modify away rev, i believe it's redundant as we store a fw revision elsewhere
  let max_packet_len = 64; // usb packet limit
  let max_packet_code_len = max_packet_len - bootloader_preamble_len; // max code size sent in one packet
  let index = 0;
  let packet_count = 0;
  while(index < code_len) {
    let remaining = code_len - index;
    let packet_code_len = Math.min(remaining, max_packet_code_len);
    let packet_len = packet_code_len + bootloader_preamble_len;
    var boot_arr = new Uint8Array(packet_len);
    boot_arr[0] = packet_len;
    boot_arr[1] = command_list.CMD_BOOTLOAD_VERIFY;

    for (let i  = 0; i < packet_code_len; i++){

      boot_arr[i + bootloader_preamble_len] = data[index++]
    }
    bootloader_packet_queue.push(boot_arr);
    packet_count++

  }
  let first_packet = bootloader_packet_queue.shift();
  port.send(first_packet);

}
function bootload_cancel_app_timeout(port) {
    var arr = new Uint8Array(2);
    arr[0] = 2;
    arr[1] = command_list.CMD_BOOTLOAD_CANCEL_APP_TIMEOUT;
    port.send(arr);
}



(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', event => {
  });
})();
