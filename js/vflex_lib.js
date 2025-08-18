//import {VFLEX, command_list} from "./werewolf_comms.js"
// issue: connect (midi and serial) both require vflex instance
import {VFLEX_MIDI, vflex as vflex_tmp, COMMAND_LIST} from "./werewolf_connect.js"
import {VFLEX_CDC_SERIAL} from "./werewolf_serial_connect.js"
export const vflex = vflex_tmp;
export const midi = new VFLEX_MIDI();
export const VFLEX_COMMANDS = COMMAND_LIST;
export const vflex_cdc = new VFLEX_CDC_SERIAL(vflex);

midi.setCallbacks(
    () => {
        // Handle successful connection
        console.log("MIDI device ready!");

    },
    (err) => {
        // Handle connection failure
        console.error("MIDI connection failed:", err);
    },
    () => {
        // Handle disconnection
        console.log("MIDI device disconnected");
    },
    () => {
        // Handle connection change
        console.log("MIDI device connection status changed");
    }
);

