(function() {
    'use strict';
  
    document.addEventListener('DOMContentLoaded', event => {
        const connectButton = document.querySelector("#connectButton");
        const statusDisplay = document.querySelector('#voltageStatus');
        const controls = document.querySelector("#controls"); // Assuming this contains the voltage select and program button
        const voltageSelect = document.querySelector("#voltage_select");
        const commandLine = document.querySelector("#command_line");
        const getVoltageButton = document.querySelector("#getVoltage");
        // const advancedSettings = document.querySelector("#advanced_settings");
        // const advancedSettingsLink = document.querySelector("#advanced_settings_link");
        const recoveryBtn = document.querySelector("#jump_to_bootloader");
        const ppsMessage = document.querySelector("#pps_message");
        const customInput = document.getElementById('#voltage_pps');
        let bootload_enable = document.getElementById("bootload_enable");
        let recovery_msg = document.getElementById('recovery_msg');
        let connectInterval;
        
        let ppsMessageContent = "Programmable in 0.05V increments. <br><br>Not all voltage ranges are supported, please check your power supply.<br>"

        let jump_to_bootloader_elem = document.getElementById("fw_version");

        const closePopupBtn = document.getElementById('closePopupBtn');
        const progressBar = document.getElementById('progressBar');

        let uuid = document.getElementById("uuid");
        let serial_num = document.getElementById("serial_num");
        let hw_id = document.getElementById("hw_id");
        let fw_id = document.getElementById("fw_id");
        let mfg_date = document.getElementById("mfg_date");
        let fw_version = document.getElementById("fw_version");
        let currentFW = 'APP.01.04.03';

        let fw_or_recover
        // let hide = 'Hide Advanced Features';
        // let trouble = 'Trouble Connecting?';

        const troubleConnectingBtn = document.getElementById('troubleConnectingLink');
        const popupBox = document.getElementById('popupBox');
        const nextBtn = document.getElementById('nextBtn');
        

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

        

        //Checking to see if variable connected from werewolf_connect.js changes
        window.addEventListener('connectedChange', function(event) {
            const isConnected = event.detail;
            if (isConnected) {
                connectButton.textContent = 'Disconnect';
                controls.style.display = 'block';
                ppsInput.style.display = 'none';
                ppsCheck();
                setTimeout(() => {
                    if(fw_id.value === currentFW){
                        fw_version.textContent = 'Firmware Version:  ' + fw_id.value;
                    } else {
                        newFirmware();
                    }
                    
                }, 2000);
                troubleConnectingBtn.style.display = 'none';
                statusDisplay.style.display = 'block';
            } else {
                connectButton.textContent = 'Connect';
                controls.style.display = 'none';
                ppsMessage.style.display = 'none';
                fw_version.textContent = '';
                troubleConnectingBtn.style.display = 'block';
                statusDisplay.textContent = '';
            }
        });
        
        
        // Clicking Connect Button
        connectButton.addEventListener('click', function() {
            if(connected){
                port.disconnect();
            } else {
                werewolf_manual_connect();
            }
        });


        // Checking for PPS when drop down is interacted with
        voltageSelect.addEventListener('change', function() {
            ppsCheck();
        });

        // Checking to see if "Custom" is selected
        function ppsCheck() {
            const selectedValue = voltageSelect.value;
            
            if (selectedValue === 'pps') {
                ppsInput.style.display = 'block';
                ppsMessage.style.display = 'block';
                ppsMessage.innerHTML = ppsMessageContent;
            } else {
                ppsInput.style.display = 'none';
                ppsMessage.style.display = 'none';
                setTimeout(() => {
                    statusDisplay.textContent = "Programmed to " + (calibration_values.voltage.value / 1000) + "V";
                    fw_version.style.textDecoration = 'none';
                    fw_version.style.color = 'black';
                }, 1500);
            }
        }

        set_voltage.addEventListener('click', function(e) {
            let i = voltageSelect.selectedIndex;
            let option = voltageSelect.options[i];
            let v_select = option.value;
            let setting_mv = 5000;
            if(v_select == "pps") {
              
              let floatValue = (parseFloat(voltage_pps.value)*1000);
              setting_mv = floatValue.toFixed(0);
            } else {
              setting_mv = v_select;
            }
            if(connected) {
              setVoltage(port, setting_mv);
              ppsMessage.textContent = "";
            } 
            statusDisplay.textContent = "";
            setTimeout(() => {
                statusDisplay.textContent = "Programmed to " + (calibration_values.voltage.value / 1000) + "V";
            }, 300);  // 200ms delay
          });

        jump_to_bootloader_elem.addEventListener('click', function(e) {
            if(fw_version.textContent === 'New Firmware Available!'){
                fw_or_recover = 'fw';
                popupBox.style.display = 'block';
                recovery_msg.innerHTML = 'Click Next To Continue Updating Firmware...';
                }
            }, false);

         // Show the popup when the "Trouble Connecting?" button is clicked
        troubleConnectingBtn.addEventListener('click', function() {
            fw_or_recover = 'recover';
            popupBox.style.display = 'block'; 
            //updateProgress(0);      
        });


        // Button that initializes either the recovery mode or fw update
        nextBtn.addEventListener('click', async function() {
            calibration_values.bootload_enable.value = "enabled";
            
            let i = 0;
            nextBtn.style.display = 'none';
            
            if(fw_or_recover === 'recover'){
                setInterval(werewolf_attempt_connect, 200);
                recovery_msg.innerHTML = 'Plug Device Back In<br><br>Scanning for Devices...';
                navigator.usb.addEventListener('connect', async (event) => {
                
                    if (event.device.vendorId === 14271 && i === 0) {
                        recovery_msg.textContent = "Device Found";
                        i++;
                        
                        await updateProgressBar(0, 25); // Update progress from 0 to 25%
                        await delay(1500);  // 1 second delay
                        recovery_msg.textContent = "Restoring Device";
                        
                        await updateProgressBar(25, 50); // Update progress from 25 to 50%
                        await delay(1500);  // Another 1 second delay
                        recovery_msg.textContent = "Verifying";
                        
                        await updateProgressBar(50, 75); // Update progress from 50 to 75%
                        await delay(1500);  // 5 seconds delay for the verification step
                        
                        await updateProgressBar(75, 100); // Update progress from 75 to 100
                        if (connected) {
                            recovery_msg.textContent = "Device has been Restored!";
                        }
                        else {
                            recovery_msg.textContent = "Error";
                        }
                        await delay(1250);
                        recovery_msg.textContent = "Refreshing Your Browser...";
                        await delay(1500);
                        window.location.reload(true);
                    }
                    
                });
            } else if(fw_or_recover === 'fw'){
                recovery_msg.innerHTML = '';
                jump_to_bootloader(port);
                setInterval(werewolf_attempt_connect, 200);
                navigator.usb.addEventListener('connect', async (event) => {
                
                    if (event.device.vendorId === 14271 && i === 0) {
                        recovery_msg.textContent = "Device Found...";
                        i++;
                        
                        await updateProgressBar(0, 25); // Update progress from 0 to 25%
                        await delay(1500);  // 1 second delay
                        recovery_msg.textContent = "Connecting To Device...";
                        
                        await updateProgressBar(25, 50); // Update progress from 25 to 50%
                        await delay(1500);  // Another 1 second delay
                        recovery_msg.textContent = "Updating Firmware...";
                        
                        await updateProgressBar(50, 75); // Update progress from 50 to 75%
                        await delay(1500);  // 5 seconds delay for the verification step
                        
                        await updateProgressBar(75, 100); // Update progress from 75 to 100
                        if (connected) {
                            recovery_msg.textContent = "Firmware Is Up To Date!";
                        }
                        else {
                            recovery_msg.textContent = "Error";
                        }
                        await delay(1250);
                        recovery_msg.textContent = "Refreshing Your Browser...";
                        await delay(1500);
                        window.location.reload(true);
                    }
                    
                });
                
            }
            
        });


        // Close the pop-up when the 'X' button is clicked
        closePopupBtn.addEventListener('click', function() {
            popupBox.style.display = 'none';  // Hide the pop-up
        });
        
        // Utility function for creating a delay
        function delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        // Function to update progress
        function updateProgress(value) {
            progressBar.style.width = value + '%'; // Set the width of the progress bar
        }

        async function updateProgressBar(start, end) {
            const progressIncrement = (end - start) / ((end - start) * 10); // 1% every 10 ms
            for (let i = start; i <= end; i++) {
                updateProgress(i);
                await delay(10); // Wait for 10 ms
            }
        }

        function newFirmware(){
            fw_version.textContent = 'New Firmware Available!';
            fw_version.style.color = '#039E8D';
            fw_version.style.cursor = 'pointer';
            fw_version.style.textDecoration = 'underline';
            fw_version.addEventListener('click', function(){
                console.log("Clicked on New Firmware Available!");
            });
        }
        
        function stopConnectionAttempts() {
            if (connectInterval) {
                clearInterval(connectInterval);  // Stop the connection attempts
                console.log("Stopped attempting to connect.");
            }
        }
        
        bootload_enable.addEventListener('click', function() {
            setInterval(werewolf_attempt_connect, 200);
        });
    });

   
  })();
