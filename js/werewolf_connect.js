let port;    
let connected = false;
let bootloader_mode = 0; // todo: from html

var calibration_values = {}; // assigned at import level to user defined html fields. messages populated iff they're defined.

let pdo_log_byte_queue = []; // todo: this could be a generic packet queue for connect function
function connect() {
      let boot_message = document.getElementById("boot_message");
      port.connect().then(() => {
        //statusDisplay.textContent = '';
        //connectButton.textContent = 'Disconnect';
        //console.log("connect!");


        port.onReceive = data => {
          let preamble_len = 2;
          let textDecoder = new TextDecoder();
          let command_code = data.getUint8(1);
          let next_packet;
          let response;
          switch(command_code) {
            case command_list.CMD_PDO_LOG:
              if (data.byteLength == 6) {
                pdo_log_byte_queue.push(data.getUint8(2)); 
                pdo_log_byte_queue.push(data.getUint8(3)); 
                pdo_log_byte_queue.push(data.getUint8(4)); 
                pdo_log_byte_queue.push(data.getUint8(5)); 
                get_pdo_log(port);
              } else {
                let n_pdos = pdo_log_byte_queue.length / 4;
                for (let i = 0; i < n_pdos; i++) {
                    var temp32 = (pdo_log_byte_queue[4*i + 3]<<24)>>>0;
                    temp32 += (pdo_log_byte_queue[4*i + 2]<<16);
                    temp32 += (pdo_log_byte_queue[4*i + 1]<<8);
                    temp32 += (pdo_log_byte_queue[4*i + 0]<<0);
                    if (temp32 == 0xFFFFFFFF || temp32 == 0xAAAAAAAA) { // skip empty log and delimiter
                    } else if (temp32 & 0xC0000000) {
                      let max_current_50_ma = ((temp32 & 0x7F)) * 50;
                      let min_voltage_100mv = ((temp32 & 0x0000FF00)>>8) * 100;
                      let max_voltage_100mv = ((temp32 & 0x01FE0000 >> 17 )) * 100;
                      console.log("variable / augmented pps supply. max_current_50_ma:", max_current_50_ma , "min_voltage_100mv:", min_voltage_100mv, "max_voltage_100mv:", max_voltage_100mv);


                    } else {
                      let current = ( temp32 & 0x000003FF ) * 10;
                      temp32 = temp32 >> 10;
                      let voltage = ( temp32 & 0x000003FF ) * 50;
                      console.log("fixed supply. v= ", voltage, ", i=", current);
                    }

                }

                //for (int i = 0; i < pdo_log_byte_que
                pdo_log_byte_queue = [];
              }
              break;
            case command_list.CMD_VOLTAGE:
              let mv = data.getUint8(2) <<8 | (data.getUint8(3));
              if(calibration_values.voltage) {
                console.log("received:" ,mv);
                calibration_values.voltage.value = mv;
              }
              break;
            case command_list.CMD_CURRENT_LIMIT:
              break;
            case command_list.CMD_WW_SERIAL:
              var string = new TextDecoder().decode(data).slice(preamble_len);
              if(calibration_values.serial_num) {
                calibration_values.serial_num.value = string;
              }
              break;
            case command_list.CMD_CHIP_UUID:
              var string = new TextDecoder().decode(data).slice(preamble_len);
              if(calibration_values.uuid) {
                calibration_values.uuid.value = string;
              }
              break;
            case command_list.CMD_HWID:
              var string = new TextDecoder().decode(data).slice(preamble_len);
              if(calibration_values.hw_id) {
                calibration_values.hw_id.value = string;
              }
              break;
            case command_list.CMD_FWID:
              var string = new TextDecoder().decode(data).slice(preamble_len);
              if(calibration_values.fw_id) {
                calibration_values.fw_id.value = string;
                if (string.match("APP*")) {
                  setTimeout(() => {
                    get_pdo_log(port);
                    console.log("APP connected, load pdo log:");
                  }, 100);
                }
              }
              break;
            case command_list.CMD_MFG_DATE:
              var string = new TextDecoder().decode(data).slice(preamble_len);
              if(calibration_values.mfg_date) {
                calibration_values.mfg_date.value = string;
              }
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
              response = data.getUint8(2);
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
              response = data.getUint8(2);
              if(response){
                if (bootloader_packet_queue.length == 0) {
                  boot_message.textContent = "bootloader verify succesful!";
                  setTimeout(() => {boot_message.textContent = "exiting bootloader!";}, 200);
                  setTimeout(() => {ledBlink (port, 3, confBlink); }, 100);
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
              console.log("invalid usb incoming message. unexpected command code");
          }
          if (data.getInt8() === 13) {
            currentReceiverLine = null;
          } else {
            //appendLines('receiver_lines', textDecoder.decode(data));
          }
        };
        port.onReceiveError = error => {
          boot_message.textContent = "bootload idle";
          console.log("disconnect");
          port.disconnect();
          port = null;

          connected = false;
          //console.error(error);
        };


        if (calibration_values.bootload_enable) {
          if (calibration_values.bootload_enable.value == "enabled" && connected) {
            console.log(calibration_values.bootload_enable.value); 
            console.log("boot load enable");
            boot_message.textContent = "bootloader connecting...";
            setTimeout(() => { bootload_cancel_app_timeout(port); }, 100);
          }  else {
            setTimeout(() => {get_ww_string(port, command_list.CMD_FWID); }, 100);
            setTimeout(() => { get_ww_string(port, command_list.CMD_WW_SERIAL); }, 400);
            setTimeout(() => {get_ww_string(port, command_list.CMD_HWID);}, 700);
            //setTimeout(() => {get_ww_string(port, command_list.CMD_FWID); }, 600);
            //setTimeout(() => { get_ww_string(port, command_list.CMD_MFG_DATE); }, 800);
            setTimeout(() => { getVoltage(port); }, 1000);
            //setTimeout(() => { get_pdo_log(port); }, 1300);
            //setTimeout(() => { get_ww_string(port, command_list.CMD_CHIP_UUID); }, 0);
          }


        }

      }, error => {
        console.log(error);
      });
      connected = true;
    } // \connect function

    function new_device_callback(result) {
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
          //setTimeout(() => { bootload_cancel_app_timeout(port); }, 50);
          //todo: this is auto program feature, disable for now
          //if(app_bin_data) {
          //  setTimeout(() => { bootload_prom_function(prom, app_bin_data); }, 200);
          //}
        }
      });
    }

    function werewolf_manual_connect() {
      if (port) {
        port.disconnect();
        //connectButton.textContent = 'Connect';
        port = null;
      } else {
        serial.requestPort().then(selectedPort => {
          port = selectedPort;
          connect();
        }).catch(error => {
          console.log(error);
        });
      }

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
            }
          });
        }, null);
    }
