export const CONSTS_MAX = 256;
export const LOCALS_MAX = 256;
export const FRAME_MAX = 64;
export const STACK_MAX = FRAME_MAX * 256;
/**
 * Put this in the "default" case of a switch to cause a TS error when you forget to add a new case
 */
export function typeGuardSwitch(value) { }
; /* eslint-disable-line */
