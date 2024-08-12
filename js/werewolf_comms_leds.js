// Color ENUM
const color = Object.freeze ({
  OFF:0,
  RED: 1,
  GREEN: 2,
  BLUE: 3,
});


// ConfirmationBlink Array
let confBlink = [
  { color: color.OFF, timeMS: 100 },
  { color: color.GREEN, timeMS: 100 },
  { color: color.OFF, timeMS: 100 },
  { color: color.GREEN, timeMS: 100 }
];

// errorBlink Array
let errorBlink = [
  { color: color.OFF, timeMS: 1000 },
  { color: color.RED, timeMS: 2000 },
  { color: color.OFF, timeMS: 1000 },
  { color: color.RED, timeMS: 2000 }
];


// LED Blink Helper Function
function ledBlink (n_cycles, ledArr) {
    // * [10, 2, 5(cycles), 2(sequence len), 1(green), 0x03, 0x08, 3(off), 0x03, 0x08]
  let flashArrayLength = (4 + (ledArr.length * 3));

  var led_flash_message_array = new Uint8Array(flashArrayLength); //setting array length
  led_flash_message_array.set([flashArrayLength, command_list.CMD_FLASH_LED_SEQUENCE_ADVANCED, n_cycles, ledArr.length], 0);


  let i = 4;

  for(let k = 0; k < ledArr.length; k++, i++){
    led_flash_message_array[i] = ledArr[k].color; // send color code
    i++;
    let byteTime = msToBytes(ledArr[k].timeMS); //Convert MSB and LSB to byteTime array
    led_flash_message_array[i] = byteTime[0]; //MSB
    i++;
    led_flash_message_array[i] = byteTime[1]; //LSB
  }

  //console.log(led_flash_message_array);
  port.send(led_flash_message_array);

}


