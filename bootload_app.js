(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', event => {
    //console.log(werewolf_app_image);
    //let app_bin_data; // todo: from json

    // HTML elements
    let flash_led_conf = document.getElementById("flash_led_conf");
    let flash_led_error = document.getElementById("flash_led_error");

    let bootload_enable = document.getElementById("bootload_enable");
    let boot_message = document.getElementById("boot_message");
    let connectButton = document.getElementById("connectButton");
    let bootloader_image = document.getElementById('bootloader_image');
    let voltage = document.getElementById("voltage");
    let current = document.getElementById("current");

    let uuid = document.getElementById("uuid");
    let serial_num = document.getElementById("serial_num");
    let hw_id = document.getElementById("hw_id");
    let fw_id = document.getElementById("fw_id");
    let mfg_date = document.getElementById("mfg_date");

    let load_all = document.getElementById("load_all");
    let store_all = document.getElementById("store_all");
    let jump_to_bootloader_elem = document.getElementById("jump_to_bootloader");

    calibration_values.voltage = voltage; // points to voltage elem
    calibration_values.voltage = voltage;
    calibration_values.serial_num = serial_num;
    calibration_values.uuid = uuid;
    calibration_values.hw_id = hw_id;
    calibration_values.fw_id = fw_id;
    calibration_values.mfg_date = mfg_date;
    calibration_values.bootload_enable = bootload_enable;
      

    jump_to_bootloader_elem.addEventListener('click', function(e) {
      calibration_values.bootload_enable.value = "enabled";
      jump_to_bootloader(port);
    }, false);


    load_all.addEventListener("click", function(event) {
      setTimeout(() => { get_ww_string(port, command_list.CMD_CHIP_UUID); }, 0);
      setTimeout(() => { get_ww_string(port, command_list.CMD_WW_SERIAL); }, 200);
      setTimeout(() => {get_ww_string(port, command_list.CMD_HWID);}, 400);
      setTimeout(() => {get_ww_string(port, command_list.CMD_FWID); }, 600);
      setTimeout(() => { get_ww_string(port, command_list.CMD_MFG_DATE); }, 800);
      setTimeout(() => { getVoltage(port); }, 1000);
      setTimeout(() => { getCurrent(port);}, 1400);
    });
    store_all.addEventListener("click", function(event) {
      setTimeout(() => { set_ww_string(port, command_list.CMD_CHIP_UUID, uuid.value); }, 0);
      setTimeout(() => { set_ww_string(port, command_list.CMD_WW_SERIAL, serial_num.value); }, 200);
      setTimeout(() => { set_ww_string(port, command_list.CMD_HWID, hw_id.value);}, 400);
      setTimeout(() => { set_ww_string(port, command_list.CMD_FWID, fw_id.value); }, 600);
      setTimeout(() => { set_ww_string(port, command_list.CMD_MFG_DATE, mfg_date.value); }, 800);
      setTimeout(() => { setVoltage(port, voltage); }, 1200);
      setTimeout(() => { commit_flash(port); }, 1400);
 
    });

    bootloader_image.addEventListener('click', () => {
      bootloader_image.value = null;
    });
    bootloader_image.addEventListener('change', function(e) {
      readSingleFile(e);
    }, false);
 
    flash_led_conf.addEventListener('click', () => {
      console.log("blink");
      ledBlink(5, confBlink);
    });

    flash_led_error.addEventListener('click', () => {
      ledBlink(5, errorBlink);
    });




    connectButton.addEventListener('click', function() {
      werewolf_manual_connect();
    });

    //window.onload = function() {
    //  setInterval(werewolf_attempt_connect, 200);
    //}
  });

})();

