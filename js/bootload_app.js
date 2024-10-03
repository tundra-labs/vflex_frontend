(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', event => {
    //console.log(werewolf_app_image);
    //let app_bin_data; // todo: from json

    // HTML elements
    let flash_led_conf = document.getElementById("flash_led_conf");
    let flash_led_error = document.getElementById("flash_led_error");

    //let get_pdo_log_button = document.getElementById("get_pdo_log");
    let clear_pdo_log_button = document.getElementById("clear_pdo_log");
    let test_leds_button = document.getElementById("test_leds");
    let bootload_enable = document.getElementById("bootload_enable");
    let boot_message = document.getElementById("boot_message");
    let connectButton = document.getElementById("connectButton");
    let bootloader_image = document.getElementById('bootloader_image');
    let voltage_fixed = document.getElementById("voltage_fixed");
    let voltage_pps = document.getElementById("voltage_pps");
    let voltageSelect = document.querySelector("#voltage_select");
    let programmed_voltage = document.getElementById("programmed_voltage");
    let current = document.getElementById("current");
    let set_voltage = document.getElementById("set_voltage");
    let bootload_prom = document.getElementById("bootload_prom");
    let disable_leds_operation = document.getElementById("disable_leds_operation");
    let enable_leds_operation = document.getElementById("enable_leds_operation");

    let uuid = document.getElementById("uuid");
    let serial_num = document.getElementById("serial_num");
    let hw_id = document.getElementById("hw_id");
    let fw_id = document.getElementById("fw_id");
    let mfg_date = document.getElementById("mfg_date");

    //let load_all = document.getElementById("load_all");
    //let store_all = document.getElementById("store_all");
    let jump_to_bootloader_elem = document.getElementById("jump_to_bootloader");

    calibration_values.voltage = programmed_voltage; // points to voltage elem
    calibration_values.serial_num = serial_num;
    calibration_values.uuid = uuid;
    calibration_values.hw_id = hw_id;
    calibration_values.fw_id = fw_id;
    calibration_values.mfg_date = mfg_date;
    calibration_values.bootload_enable = bootload_enable;
    bootload_prom.addEventListener('click', function(e) {
      bootload_prom_function(port, app_bin_data["data"]);
    });


    disable_leds_operation.addEventListener('click', function(e) {
				disable_leds_operation_fn(port, 1);
        console.log("disabling leds during operation (after timeout)");
    });

    enable_leds_operation.addEventListener('click', function(e) {
				disable_leds_operation_fn(port, 0);
        console.log("re-enabling (to default setting) leds during operation");
    });


    
    clear_pdo_log_button.addEventListener('click', function(e) {
        clear_pdo_log(port);
        console.log("clear pdo log");
    });


    if (test_leds_button) {
      test_leds_button.addEventListener('click', function(e) {
        ledBlink(port, 5, testBlink );
      });
    }


    //get_pdo_log_button.addEventListener('click', function(e) {
    //  get_pdo_log(port);
    //    console.log("get pdo log");
    //});


    set_voltage.addEventListener('click', function(e) {
      let i = voltageSelect.selectedIndex;
      let option = voltageSelect.options[i];
      let v_select = option.value;
      let setting_mv = 5000;
      if(v_select == "pps") {
        setting_mv = voltage_pps.value;
      } else {
        setting_mv = v_select;
      }
      if(connected) {
        console.log("setting voltage to", setting_mv);
        setVoltage(port, setting_mv);
        setTimeout(() => { ledBlink(port, 5, confBlink); }, 200);
      } else {
        console.log("disconnected from device");
      }
    });

    jump_to_bootloader_elem.addEventListener('click', function(e) {
      calibration_values.bootload_enable.value = "enabled";
      jump_to_bootloader(port);
    }, false);


    voltageSelect.addEventListener("click", function(event) {
       let i = voltageSelect.selectedIndex;
       let option = voltageSelect.options[i];
       let v_select = option.value;
       if(v_select == "pps") {
         voltage_pps.disabled = false;
         voltage_pps.value = "5000";
       } else {
         voltage_pps.disabled = true;
         voltage_pps.value = "";
       }
    });
    //load_all.addEventListener("click", function(event) {
    //  setTimeout(() => { get_ww_string(port, command_list.CMD_CHIP_UUID); }, 0);
    //  setTimeout(() => { get_ww_string(port, command_list.CMD_WW_SERIAL); }, 200);
    //  setTimeout(() => {get_ww_string(port, command_list.CMD_HWID);}, 400);
    //  setTimeout(() => {get_ww_string(port, command_list.CMD_FWID); }, 600);
    //  setTimeout(() => { get_ww_string(port, command_list.CMD_MFG_DATE); }, 800);
    //  setTimeout(() => { getVoltage(port); }, 1000);
    //  setTimeout(() => { getCurrent(port);}, 1400);
    //});
    //store_all.addEventListener("click", function(event) {
    //  setTimeout(() => { set_ww_string(port, command_list.CMD_CHIP_UUID, uuid.value); }, 0);
    //  setTimeout(() => { set_ww_string(port, command_list.CMD_WW_SERIAL, serial_num.value); }, 200);
    //  setTimeout(() => { set_ww_string(port, command_list.CMD_HWID, hw_id.value);}, 400);
    //  setTimeout(() => { set_ww_string(port, command_list.CMD_FWID, fw_id.value); }, 600);
    //  setTimeout(() => { set_ww_string(port, command_list.CMD_MFG_DATE, mfg_date.value); }, 800);
    //  setTimeout(() => { setVoltage(port, voltage); }, 1200);
    //  setTimeout(() => { commit_flash(port); }, 1400);
 
    //});

    bootloader_image.addEventListener('click', () => {
      bootloader_image.value = null;
    });
    bootloader_image.addEventListener('change', function(e) {
      readSingleFile(e);
    }, false);
 
    //flash_led_conf.addEventListener('click', () => {
    //  console.log("blink");
    //  ledBlink(5, confBlink);
    //});

    //flash_led_error.addEventListener('click', () => {
    //  ledBlink(5, errorBlink);
    //});


    connectButton.addEventListener('click', function() {
      werewolf_manual_connect();
    });

    window.onload = function() {
      setInterval(werewolf_attempt_connect, 200);
    }
  });

})();

