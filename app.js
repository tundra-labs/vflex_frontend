//import {VFLEX_COMMANDS,vflex, midi} from "./js/vflex_lib.js"
import {VFLEX_COMMANDS,VFLEX_API} from "./js/vflex_lib.js"
let vflex = new VFLEX_API();
(function() {
    'use strict';
  
    document.addEventListener('DOMContentLoaded', event => {
        //midi.init(); // moved from index.html
        vflex.app_autoconnect();
        const statusDisplay = document.querySelector('#voltageStatus');
        const controls = document.querySelector("#controls"); // Assuming this contains the voltage select and program button
        const voltageSelect = document.querySelector("#voltage_select");

        const ppsMessage = document.querySelector("#pps_message");
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
        let currentFW = 'APP.01.06.01';

        let fw_or_recover

        const troubleConnectingBtn = document.getElementById('troubleConnectingLink');
        const popupBox = document.getElementById('popupBox');
        const nextBtn = document.getElementById('nextBtn');

        const toggleButton = document.getElementById('toggle-button');
        const toggleStatus = document.getElementById('toggle-status');
        

        vflex.device_data.voltage_mv = programmed_voltage; // points to voltage elem
        vflex.device_data.serial_num = serial_num;
        vflex.device_data.uuid = uuid;
        vflex.device_data.hw_id = "vflex   ";
        vflex.device_data.fw_id = fw_id;
        vflex.device_data.mfg_date = mfg_date;
        vflex.device_data.bootload_enable = bootload_enable;
        //bootload_prom.addEventListener('click', function(e) {
        //  bootload_prom_function(midi.port, app_bin_data["data"]);
        //});

        // disable_leds_operation_fn(midi.port, 1, 0);
        // console.log(calibration_values.led_disable_during_operation);

        toggleButton.addEventListener('click', function(e) {
            setTimeout(() => {
              console.log(vflex.device_data.led_disable_during_operation);
              let toggled = vflex.device_data.led_disable_during_operation == 0 ? 1 : 0;
              vflex.disable_leds_operation(toggled, 1); // write
            }, 200);
          });

        async function waitForValue(propertyName) { // wait for 'calibration values'
            return new Promise((resolve) => {
                const interval = setInterval(() => {
                    if (vflex.device_data[propertyName] !== null && vflex.device_data[propertyName] !== undefined && vflex.device_data[propertyName] !== '') {
                        clearInterval(interval);
                        resolve();
                    }
                }, 25);
            });
        }
        //async function waitForMidiACK() { // wait for 'calibration values'
        //    return new Promise((resolve) => {
        //        const interval = setInterval(() => {
        //            if (ACK == 1) {
        //                ACK = 0;
        //              console.log(ACK);
        //                clearInterval(interval);
        //                resolve();
        //            }
        //        }, 25);
        //    });
        //}


        window.WS_LEGIT = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/legit`;
        const legit_ws_path = window.WS_LEGIT || 'http://localhost:8006'; // check for server path provided from index.html, localhost default
        console.log('connect on', legit_ws_path);
        const legit_ws = new WebSocket(legit_ws_path);
        legit_ws.onmessage = function(event){
          //encrypted_msg = JSON.parse(event.data);
          console.log("data:", event.data);
        };


        let transitioningtoApp = false;

        async function howlegitcanitgit() {
          await vflex.get_ww_string(VFLEX_COMMANDS.CMD_WW_SERIAL); // query device serial number
          console.log(vflex.device_data.serial_num);
          //let timestamp = "018APR25"; // todo
          let timestamp = String(Date.now());
          await vflex.send_encrypted_message(timestamp); // 
          
          // send certificate of authenticity
          let certificate_of_authenticity =JSON.stringify({ serial_num: vflex.device_data.serial_num, timestamp: timestamp, secret: Array.from(vflex.device_data.secretsecrets) });
          console.log(certificate_of_authenticity);
          try {legit_ws.send(certificate_of_authenticity);}
          catch (error) {console.log('err on legit server send', error);}
        }

        vflex.register_connection_change_callback(
                  async () => {
                    if (vflex.connected && window.getComputedStyle(popupBox).display === 'none') {

                        document.getElementById('voltage_pps').disabled = true;
                        await vflex.get_ww_string(VFLEX_COMMANDS.CMD_FIRMWARE_VERSION);
                        console.log('fwid:', vflex.device_data.fw_id);

                        console.log("yes something really happend");
                        if (vflex.device_data.fw_id.match("BTL*")) {
                          // todo: this should set a loading message
                          console.log('btl connected!');
                          document.getElementById('connectMessage').textContent = "Connecting...";
                          transitioningtoApp= true;
                          //jump_to_app(midi.port);

                        } else if (vflex.device_data.fw_id.match("APP*")) {
                          document.getElementById('connectMessage').textContent = "Please connect device...";
                          console.log('app connected!');
                          controls.style.display = 'block';
                          document.getElementById('connectMessage').style.display = 'none'; // todo: remove midi error field?
                          troubleConnectingBtn.style.display = 'none';
                          transitioningtoApp = false;
                          // todoo: allow app visual here
                        } else {
                          console.log('something bad happend');
                        }

                        vflex.device_data.voltage_mv = ''; // clear
                        await vflex.get_voltage_mv();
                        let fInput = vflex.device_data.voltage_mv/1000;
                        voltage_pps.value = fInput.toFixed(2);
                        howlegitcanitgit();

                        //if(fw_id.value === currentFW){
                        //    fw_version.textContent = 'Firmware Version:  ' + fw_id.value;
                        //} else {
                        //    newFirmware();
                        //}
                        //
                        //await waitForVoltageChange();
                        //
                        //let fInput = programmed_voltage.value/1000;
                        //voltage_pps.value = fInput.toFixed(2);

                        //disable_leds_operation_fn(midi.port, 1, 0);
                        //vflex.disable_leds_operation(1,0);
                        //setTimeout(() => {
                        //    if(calibration_values.led_disable_during_operation === 0){
                        //        toggleButton.checked = true;
                        //    }
                        //  }, 200);
                        

                    } else {
                        if (!transitioningtoApp){
                            fw_version.textContent = '';
                            //troubleConnectingBtn.textContent = "Trouble Connecting?";
                            //troubleConnectingBtn.style.display = 'block';
                            controls.style.display = 'none';
                            edit_voltage.style.display = 'block';
                            set_voltage.style.display = 'none';
                            cancel_voltage.style.display = 'none';
                            document.getElementById('voltage_pps').disabled = true;   
                            document.getElementById('connectMessage').textContent = "Please connect device...";
                            document.getElementById('connectMessage').style.display = 'block';
                        }  
                    }
        });

        
        edit_voltage.addEventListener('click', function(){
            document.getElementById('voltage_pps').disabled = false;
            voltage_pps.focus();
            voltage_pps.select();
            edit_voltage.style.display = 'none';
            set_voltage.style.display = 'block';
            cancel_voltage.style.display = 'block';
        });

        cancel_voltage.addEventListener('click', function(){
            document.getElementById('voltage_pps').disabled = true;
            edit_voltage.style.display = 'block';
            set_voltage.style.display = 'none';
            cancel_voltage.style.display = 'none';
            let fInput = programmed_voltage.value/1000;
            voltage_pps.value = fInput.toFixed(2);
        });

        // setting the voltage after clicking
        set_voltage.addEventListener('click', async function(e) {
            console.log("clicking");
          
            let floatValue = (parseFloat(voltage_pps.value) * 1000);
            let setting_mv = floatValue.toFixed(0);
        
            console.log(setting_mv);
            
            //await vflex.set_voltage(midi.port, setting_mv);
            await vflex.set_voltage_mv(setting_mv);
            pps_message.textContent = "";
            
            
            voltageStatus.textContent = "";
            await vflex.get_voltage_mv();
        
            let fInput = vflex.device_data.voltage_mv/1000;
            voltage_pps.value = fInput.toFixed(2);

            edit_voltage.style.display = 'block';
            set_voltage.style.display = 'none';
            cancel_voltage.style.display = 'none';
            document.getElementById('voltage_pps').disabled = true;
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
            vflex.device_data.bootload_enable.value = "enabled";
            
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
                        if (vflex.midi.connected) {
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
                jump_to_bootloader();
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
            fw_version.style.color = '#2B303B';
            fw_version.style.cursor = 'pointer';
            fw_version.style.textDecoration = 'underline';
            fw_version.addEventListener('click', function(){
                console.log("Clicked on New Firmware Available!");
            });
            fw_version.classList.add('hover');
        }

        // This function waits for the voltage value to change
        function waitForVoltageChange() {
            return new Promise((resolve) => {
                const interval = setInterval(() => {
                    //if (vflex.device_data.voltage.value !== null && calibration_values.voltage.value !== '') { // Change condition based on your use case
                    if (vflex.device_data.voltage_mv !== null && vflex.device_data.voltage_mv !== '') { // Change condition based on your use case
                        clearInterval(interval);  // Stop the interval when the value is updated
                        resolve();  // Resolve the promise
                    }
                }, 25);  // Check every 100ms (adjust the interval if needed)
            });
        }

        function waitForFirmware(){
            return new Promise((resolve) => {
                const interval = setInterval(() => {
                    if(vflex.device_data.fw_id.value !== '') {
                        clearInterval(interval);
                        resolve();
                    }
                }, 25);
            });
        }
        
        function stopConnectionAttempts() {
            if (connectInterval) {
                clearInterval(connectInterval);  // Stop the connection attempts
                console.log("Stopped attempting to connect.");
            }
        }

        // toggleButton.addEventListener('change', () => {
        //     if (toggleButton.checked) {
        //         toggleStatus.textContent = 'LED Always On';
        //     } else {
        //         toggleStatus.textContent = 'LED Always Off';
        //     }
        // });
        
        bootload_enable.addEventListener('click', function() {
            setInterval(werewolf_attempt_connect, 200);
        });
    });

   
  })();
