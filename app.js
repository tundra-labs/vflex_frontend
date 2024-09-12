(function() {
    'use strict';
  
    document.addEventListener('DOMContentLoaded', event => {
        const connectButton = document.querySelector("#connectButton");
        const statusDisplay = document.querySelector('#status');
        const controls = document.querySelector("#controls"); // Assuming this contains the voltage select and program button
        const ppsInput = document.querySelector("#voltage_pps");
        const voltageSelect = document.querySelector("#voltage_select");
        const commandLine = document.querySelector("#command_line");
        const getVoltageButton = document.querySelector("#getVoltage");
        const advancedSettings = document.querySelector("#advanced_settings");
        const advancedSettingsLink = document.querySelector("#advanced_settings_link");
        const recoveryBtn = document.querySelector("#jump_to_bootloader");
        const ppsMessage = document.querySelector("#pps_message");
        let ppsMessageContent = "pps (programmable power supply) voltage setting (programmable in 50mV increments)"

        let jump_to_bootloader_elem = document.getElementById("jump_to_bootloader");

        let uuid = document.getElementById("uuid");
        let serial_num = document.getElementById("serial_num");
        let hw_id = document.getElementById("hw_id");
        let fw_id = document.getElementById("fw_id");
        let mfg_date = document.getElementById("mfg_date");

        calibration_values.voltage = programmed_voltage; // points to voltage elem
        calibration_values.serial_num = serial_num;
        calibration_values.uuid = uuid;
        calibration_values.hw_id = hw_id;
        calibration_values.fw_id = fw_id;
        calibration_values.mfg_date = mfg_date;
        calibration_values.bootload_enable = bootload_enable;
        bootload_prom.addEventListener('click', function(e) {
          bootload_prom_function(port, app_bin_data["data"]);
          console.log("Bootloader Prom Clicked");
        });


        //Checking to see if variable connected from werewolf_connect.js changes
        window.addEventListener('connectedChange', function(event) {
            const isConnected = event.detail;
            if (isConnected) {
                console.log('connected is true');
                connectButton.textContent = 'Disconnect';
                controls.style.display = 'block';
                ppsInput.style.display = 'none';
                advancedSettingsLink.style.display = 'block';
                ppsCheck();
            } else {
                console.log('Connected is false');
                connectButton.textContent = 'Connect';
                advancedSettingsLink.textContent = 'Trouble Connecting?';
                controls.style.display = 'none';
                advancedSettingsLink.style.display = 'none';
                advancedSettings.style.display = 'none';
                statusDisplay.textContent = '';
                ppsMessage.style.display = 'none';
            }
        });
        
      
        connectButton.addEventListener('click', function() {
            console.log(connectButton.textContent);
            if(connectButton.textContent == 'Disconnect'){
                port.disconnect();
            } else {
                werewolf_manual_connect();
            }
        });

        advancedSettingsLink.addEventListener('click', function() {
            advancedSettings.style.display = 'block';
            if (advancedSettingsLink.textContent == 'Hide...') {
                advancedSettingsLink.textContent = 'Trouble Connecting?';
                advancedSettings.style.display = 'None';
                controls.style.display = 'block';
                ppsMessage.style.display = 'none';
            } else {
                advancedSettingsLink.textContent = 'Hide...';
                controls.style.display = 'none';
            }
        });

        voltageSelect.addEventListener('change', function() {
            ppsCheck();
        });

        function ppsCheck() {
            const selectedValue = voltageSelect.value;
            console.log("Selected Value is: "+selectedValue);
            
            if (selectedValue === 'pps') {
                ppsInput.style.display = 'block';
                ppsMessage.style.display = 'block';
                ppsMessage.textContent = ppsMessageContent;
            } else {
                ppsInput.style.display = 'none';
                ppsMessage.style.display = 'none';
                setTimeout(() => {
                    statusDisplay.textContent = "Programmed to " + (calibration_values.voltage.value / 1000) + "V";
                    console.log(calibration_values.bootload_enable.value);
                }, 1200);
            }
        }

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
            if(connected && validVoltage(setting_mv)) {
              console.log("setting voltage to", setting_mv);
              setVoltage(port, setting_mv);
              ppsMessage.textContent = "";
            } else {
              ppsMessage.textContent = "Not a Valid Voltage! Try Again!";
              console.log("disconnected from device");
            }
            statusDisplay.textContent = "";
            setTimeout(() => {
                statusDisplay.textContent = "Programmed to " + (calibration_values.voltage.value / 1000) + "V";
            }, 300);  // 200ms delay
          });

        jump_to_bootloader_elem.addEventListener('click', function(e) {
            calibration_values.bootload_enable.value = "enabled";
            jump_to_bootloader(port);
            }, false);

        function validVoltage(v_value) {
            // Check if the value is within the range 0-100000
            const inRange = v_value >= 0 && v_value <= 100000;
            // Check if the value is divisible by 50
            const isDivisible = v_value % 50 === 0;
            // Return true if both conditions are met
            return inRange && isDivisible;
        }
        
        

    });
  })();