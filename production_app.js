var encrypted_msg = 0;
function waitForACK(){
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            if(ACK) {
                ACK = 0;
                clearInterval(interval);
                resolve();
            }
        }, 25);
    });
}
async function waitForEncryptedMsg(){
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            if(encrypted_msg) {
                clearInterval(interval);
                resolve();
            }
        }, 25);
    });
}
async function waitForSerial(){
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            if (calibration_values.serial_num !== null && calibration_values.serial_num !== '') {
                clearInterval(interval);
                resolve();
            }
        }, 25);
    });
}

(function() {
    'use strict';
  
    document.addEventListener('DOMContentLoaded', event => {
        connectButton.addEventListener('click', function() {
							console.log('fudge');
                werewolf_manual_connect();
        });

        const secure_boot_ws_path = window.WS_SECURE_BOOT_APP || 'http://localhost:8001'; // check for server path provided from index.html, localhost default
        console.log('connect on', secure_boot_ws_path);
        const ws = new WebSocket(secure_boot_ws_path);

        ws.onmessage = function(event){
          //encrypted_msg = JSON.stringify(event.data, null,4);
          encrypted_msg = JSON.parse(event.data);
          console.log("data:", encrypted_msg);
        };
        send_encrypted_msg.addEventListener('click', async function(e) {
          encrypted_msg = 0; // reset
          get_ww_string(port, command_list.CMD_WW_SERIAL);
          await waitForSerial();
          try {ws.send(serial_num);} // send serial number to server, server responds with encrypted bootload packets
          catch (error) {console.log('err');}
          await waitForEncryptedMsg();
          console.log('len en msg,',encrypted_msg.length);
          for (let i = 0; i < encrypted_msg.length; i++) {
            for (let j = 0; j < 8; j++) {
              //console.log(encrypted_msg[i].chunks[j]);
              fn_send_bootloader_chunk_encrypted(port, encrypted_msg[i].chunks[j], encrypted_msg[i].pg_id, j)
              await waitForACK();
            }
            fn_commit_bootloader_page(port);
            await waitForACK();
 
              //fn_send_bootloader_chunk_encrypted(port, encrypted_msg[i].second_half_encrypted, encrypted_msg[i].pg_id, 1);
              //await waitForACK();
          }
          console.log('done', encrypted_msg.length);
          //fn_verify_bootloader(port,encrypted_msg.length);
          //fn_verify_bootloader(port,5);
        });

        verify_encrypted_msg.addEventListener('click', async function(e) {
          fn_verify_bootloader(port,5);
        });
        jump_app.addEventListener('click', async function(e) {
          jump_to_app(port);
        });

        //const commission_ws = new WebSocket("ws://127.0.0.1:8002/");

        const commission_ws_path = window.WS_COMMISSIONING_APP || 'http://localhost:8002'; // check for server path provided from index.html, localhost default
        console.log('connect on', commission_ws_path);
        const commission_ws  = new WebSocket(commission_ws_path);
        get_new_img.addEventListener('click', async function(e) {
          try {commission_ws.send(JSON.stringify({N: 2, V_MV : 9000}));}
          catch (error) {console.log(error);}
        });

        commission_ws.onmessage = function(event){ // creates new 
          let data = JSON.parse(event.data);
          console.log('created new device in database:',data)
					let N = data.N;
					let base_img = data.base_img;
					let unique_imgs = data.unique_imgs
          for (let i = 0; i <= N; i++) {
					  console.log(unique_imgs[i]);
						var downloadLink = document.createElement("a");
						var blob = new Blob(["\ufeff", unique_imgs[i].hex_file]);
						var url = URL.createObjectURL(blob);
						downloadLink.href = url;
						downloadLink.download = "data.hex.txt";

						document.body.appendChild(downloadLink);
						downloadLink.click();
						document.body.removeChild(downloadLink);
					}
        };

        //}
        ////  bootload_prom_function(port, app_bin_data["data"]);
        ////});

        //const connectButton = document.querySelector("#connectButton");
        //const statusDisplay = document.querySelector('#voltageStatus');
        //const controls = document.querySelector("#controls"); // Assuming this contains the voltage select and program button
        //const voltageSelect = document.querySelector("#voltage_select");

        //const ppsMessage = document.querySelector("#pps_message");
        //let bootload_enable = document.getElementById("bootload_enable");
        //let recovery_msg = document.getElementById('recovery_msg');
        //let connectInterval;
        //
        //let ppsMessageContent = "Programmable in 0.05V increments. <br><br>Not all voltage ranges are supported, please check your power supply.<br>"

        //let jump_to_bootloader_elem = document.getElementById("fw_version");

        //const closePopupBtn = document.getElementById('closePopupBtn');
        //const progressBar = document.getElementById('progressBar');

        //let uuid = document.getElementById("uuid");
        //let serial_num = document.getElementById("serial_num");
        //let hw_id = document.getElementById("hw_id");
        //let fw_id = document.getElementById("fw_id");
        //let mfg_date = document.getElementById("mfg_date");
        //let fw_version = document.getElementById("fw_version");
        //let currentFW = 'APP.01.06.01';

        //let fw_or_recover

        //const troubleConnectingBtn = document.getElementById('troubleConnectingLink');
        //const popupBox = document.getElementById('popupBox');
        //const nextBtn = document.getElementById('nextBtn');

        //const toggleButton = document.getElementById('toggle-button');
        //const toggleStatus = document.getElementById('toggle-status');
        //

        ////calibration_values.voltage = programmed_voltage; // points to voltage elem
        //calibration_values.serial_num = serial_num;
        //calibration_values.uuid = uuid;
        //calibration_values.hw_id = hw_id;
        //calibration_values.fw_id = fw_id;
        //calibration_values.mfg_date = mfg_date;
        //calibration_values.bootload_enable = bootload_enable;
        ////bootload_prom.addEventListener('click', function(e) {
        ////  bootload_prom_function(port, app_bin_data["data"]);
        ////});

        //// disable_leds_operation_fn(port, 1, 0);
        //// console.log(calibration_values.led_disable_during_operation);

        //toggleButton.addEventListener('click', function(e) {
        //    setTimeout(() => {
        //      console.log(calibration_values.led_disable_during_operation);
        //      let toggled = calibration_values.led_disable_during_operation == 0 ? 1 : 0;
        //      disable_leds_operation_fn(port, toggled, 1); // write
        //    }, 200);
        //  });

        //

        ////Checking to see if variable connected from werewolf_connect.js changes
        //window.addEventListener('connectedChange', async function(event) {
        //    const isConnected = event.detail;
        //    if (isConnected && window.getComputedStyle(popupBox).display === 'none') {
        //        console.log(calibration_values.fw_id.value);
        //        console.log(calibration_values.voltage.value);
        //        connectButton.textContent = 'Disconnect';
        //        connectButton.classList.add('deactive');
        //        controls.style.display = 'block';
        //        troubleConnectingBtn.style.display = 'none';

        //        document.getElementById('voltage_pps').disabled = true;

        //        await waitForFirmware();

        //        if(fw_id.value === currentFW){
        //            fw_version.textContent = 'Firmware Version:  ' + fw_id.value;
        //        } else {
        //            newFirmware();
        //        }
        //        
        //        await waitForVoltageChange();
        //        
        //        let fInput = programmed_voltage.value/1000;
        //        voltage_pps.value = fInput.toFixed(2);

        //        disable_leds_operation_fn(port, 1, 0);
        //        setTimeout(() => {
        //            if(calibration_values.led_disable_during_operation === 0){
        //                toggleButton.checked = true;
        //            }
        //          }, 200);
        //        

        //    } else {
        //        connectButton.textContent = 'Connect';
        //        connectButton.classList.remove('deactive');
        //        fw_version.textContent = '';
        //        troubleConnectingBtn.style.display = 'block';
        //        controls.style.display = 'none';
        //        edit_voltage.style.display = 'block';
        //        set_voltage.style.display = 'none';
        //        cancel_voltage.style.display = 'none';
        //        document.getElementById('voltage_pps').disabled = true;
        //    }
        //});
        //
        //
        //// Clicking Connect Button
        //connectButton.addEventListener('click', function() {
        //    if(connected){
        //        port.disconnect();
        //    } else {
        //        werewolf_manual_connect();
        //    }
        //});

        //edit_voltage.addEventListener('click', function(){
        //    document.getElementById('voltage_pps').disabled = false;
        //    edit_voltage.style.display = 'none';
        //    set_voltage.style.display = 'block';
        //    cancel_voltage.style.display = 'block';
        //});

        //cancel_voltage.addEventListener('click', function(){
        //    document.getElementById('voltage_pps').disabled = true;
        //    edit_voltage.style.display = 'block';
        //    set_voltage.style.display = 'none';
        //    cancel_voltage.style.display = 'none';
        //    let fInput = programmed_voltage.value/1000;
        //    voltage_pps.value = fInput.toFixed(2);
        //});

        //// setting the voltage after clicking
        //set_voltage.addEventListener('click', async function(e) {
        //    console.log("clicking");
        //  
        //    let floatValue = (parseFloat(voltage_pps.value) * 1000);
        //    let setting_mv = floatValue.toFixed(0);
        //
        //    console.log(setting_mv);
        //    
        //    if (connected) {
        //        // Call setVoltage and wait for it to complete
        //        await setVoltage(port, setting_mv);
        //        pps_message.textContent = "";
        //    }
        //    
        //    voltageStatus.textContent = "";
        //
        //    // Wait for calibration_values.voltage.value to be updated before proceeding
        //    await waitForVoltageChange();
        //
        //    let fInput = programmed_voltage.value/1000;
        //    voltage_pps.value = fInput.toFixed(2);

        //    edit_voltage.style.display = 'block';
        //    set_voltage.style.display = 'none';
        //    cancel_voltage.style.display = 'none';
        //    document.getElementById('voltage_pps').disabled = true;
        //});

        //jump_to_bootloader_elem.addEventListener('click', function(e) {
        //    if(fw_version.textContent === 'New Firmware Available!'){
        //        fw_or_recover = 'fw';
        //        popupBox.style.display = 'block';
        //        recovery_msg.innerHTML = 'Click Next To Continue Updating Firmware...';
        //        }
        //    }, false);

        // // Show the popup when the "Trouble Connecting?" button is clicked
        //troubleConnectingBtn.addEventListener('click', function() {
        //    fw_or_recover = 'recover';
        //    popupBox.style.display = 'block'; 
        //    //updateProgress(0);      
        //});


        //// Button that initializes either the recovery mode or fw update
        //nextBtn.addEventListener('click', async function() {
        //    calibration_values.bootload_enable.value = "enabled";
        //    
        //    let i = 0;
        //    nextBtn.style.display = 'none';
        //    
        //    if(fw_or_recover === 'recover'){
        //        setInterval(werewolf_attempt_connect, 200);
        //        recovery_msg.innerHTML = 'Plug Device Back In<br><br>Scanning for Devices...';
        //        navigator.usb.addEventListener('connect', async (event) => {
        //        
        //            if (event.device.vendorId === 14271 && i === 0) {
        //                recovery_msg.textContent = "Device Found";
        //                i++;
        //                
        //                await updateProgressBar(0, 25); // Update progress from 0 to 25%
        //                await delay(1500);  // 1 second delay
        //                recovery_msg.textContent = "Restoring Device";
        //                
        //                await updateProgressBar(25, 50); // Update progress from 25 to 50%
        //                await delay(1500);  // Another 1 second delay
        //                recovery_msg.textContent = "Verifying";
        //                
        //                await updateProgressBar(50, 75); // Update progress from 50 to 75%
        //                await delay(1500);  // 5 seconds delay for the verification step
        //                
        //                await updateProgressBar(75, 100); // Update progress from 75 to 100
        //                if (connected) {
        //                    recovery_msg.textContent = "Device has been Restored!";
        //                }
        //                else {
        //                    recovery_msg.textContent = "Error";
        //                }
        //                await delay(1250);
        //                recovery_msg.textContent = "Refreshing Your Browser...";
        //                await delay(1500);
        //                window.location.reload(true);
        //            }
        //            
        //        });
        //    } else if(fw_or_recover === 'fw'){
        //        recovery_msg.innerHTML = '';
        //        jump_to_bootloader(port);
        //        setInterval(werewolf_attempt_connect, 200);
        //        navigator.usb.addEventListener('connect', async (event) => {
        //        
        //            if (event.device.vendorId === 14271 && i === 0) {
        //                recovery_msg.textContent = "Device Found...";
        //                i++;
        //                
        //                await updateProgressBar(0, 25); // Update progress from 0 to 25%
        //                await delay(1500);  // 1 second delay
        //                recovery_msg.textContent = "Connecting To Device...";
        //                
        //                await updateProgressBar(25, 50); // Update progress from 25 to 50%
        //                await delay(1500);  // Another 1 second delay
        //                recovery_msg.textContent = "Updating Firmware...";
        //                
        //                await updateProgressBar(50, 75); // Update progress from 50 to 75%
        //                await delay(1500);  // 5 seconds delay for the verification step
        //                
        //                await updateProgressBar(75, 100); // Update progress from 75 to 100
        //                if (connected) {
        //                    recovery_msg.textContent = "Firmware Is Up To Date!";
        //                }
        //                else {
        //                    recovery_msg.textContent = "Error";
        //                }
        //                await delay(1250);
        //                recovery_msg.textContent = "Refreshing Your Browser...";
        //                await delay(1500);
        //                window.location.reload(true);
        //            }
        //            
        //        });
        //        
        //    }
        //    
        //});


        //// Close the pop-up when the 'X' button is clicked
        //closePopupBtn.addEventListener('click', function() {
        //    popupBox.style.display = 'none';  // Hide the pop-up
        //});
        //
        //// Utility function for creating a delay
        //function delay(ms) {
        //    return new Promise(resolve => setTimeout(resolve, ms));
        //}

        //// Function to update progress
        //function updateProgress(value) {
        //    progressBar.style.width = value + '%'; // Set the width of the progress bar
        //}

        //async function updateProgressBar(start, end) {
        //    const progressIncrement = (end - start) / ((end - start) * 10); // 1% every 10 ms
        //    for (let i = start; i <= end; i++) {
        //        updateProgress(i);
        //        await delay(10); // Wait for 10 ms
        //    }
        //}

        //function newFirmware(){
        //    fw_version.textContent = 'New Firmware Available!';
        //    fw_version.style.color = '#2B303B';
        //    fw_version.style.cursor = 'pointer';
        //    fw_version.style.textDecoration = 'underline';
        //    fw_version.addEventListener('click', function(){
        //        console.log("Clicked on New Firmware Available!");
        //    });
        //    fw_version.classList.add('hover');
        //}

        //// This function waits for the voltage value to change
        //function waitForVoltageChange() {
        //    return new Promise((resolve) => {
        //        const interval = setInterval(() => {
        //            if (calibration_values.voltage.value !== null && calibration_values.voltage.value !== '') { // Change condition based on your use case
        //                clearInterval(interval);  // Stop the interval when the value is updated
        //                resolve();  // Resolve the promise
        //            }
        //        }, 25);  // Check every 100ms (adjust the interval if needed)
        //    });
        //}

        //function waitForFirmware(){
        //    return new Promise((resolve) => {
        //        const interval = setInterval(() => {
        //            if(calibration_values.fw_id.value !== '') {
        //                clearInterval(interval);
        //                resolve();
        //            }
        //        }, 25);
        //    });
        //}
        //
        //function stopConnectionAttempts() {
        //    if (connectInterval) {
        //        clearInterval(connectInterval);  // Stop the connection attempts
        //        console.log("Stopped attempting to connect.");
        //    }
        //}

        //// toggleButton.addEventListener('change', () => {
        ////     if (toggleButton.checked) {
        ////         toggleStatus.textContent = 'LED Always On';
        ////     } else {
        ////         toggleStatus.textContent = 'LED Always Off';
        ////     }
        //// });
        //
        //bootload_enable.addEventListener('click', function() {
        //    setInterval(werewolf_attempt_connect, 200);
        //});
    });

   
  })();
