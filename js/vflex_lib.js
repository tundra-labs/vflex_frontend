//import {VFLEX, command_list} from "./werewolf_comms.js"
import {VFLEX_MIDI, vflex as vflex_tmp, COMMAND_LIST} from "./werewolf_connect.js"

export const vflex = vflex_tmp;
export const midi = new VFLEX_MIDI();
export const VFLEX_COMMANDS = COMMAND_LIST;

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

