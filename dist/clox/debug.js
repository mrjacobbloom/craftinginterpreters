import { typeGuardSwitch } from './common';
import { stringifyValue } from './value';
export function disassembleChunk(chunk, name) {
    console.log(`== ${name} ==`);
    for (let offset = 0; offset < chunk.code.length;) {
        offset = disassembleInstruction(chunk, offset);
    }
}
const pad4 = (num) => num.toString().padStart(4);
export function disassembleInstruction(chunk, offset) {
    const instruction = chunk.code[offset]; // Not /strictly/ true, but true for valid code, and this helps us make sure we've written a case for every opcode
    switch (instruction) {
        case 0 /* CONSTANT */:
            return constantInstruction('OP_CONSTANT', chunk, offset);
        case 1 /* NIL */:
            return simpleInstruction('OP_NIL', chunk, offset);
        case 2 /* TRUE */:
            return simpleInstruction('OP_TRUE', chunk, offset);
        case 3 /* FALSE */:
            return simpleInstruction('OP_FALSE', chunk, offset);
        case 4 /* POP */:
            return simpleInstruction('OP_POP', chunk, offset);
        case 5 /* GET_LOCAL */:
            return byteInstruction('OP_GET_LOCAL', chunk, offset);
        case 6 /* SET_LOCAL */:
            return byteInstruction('OP_SET_LOCAL', chunk, offset);
        case 7 /* GET_GLOBAL */:
            return constantInstruction('OP_GET_GLOBAL', chunk, offset);
        case 8 /* DEFINE_GLOBAL */:
            return constantInstruction('OP_DEFINE_GLOBAL', chunk, offset);
        case 9 /* SET_GLOBAL */:
            return constantInstruction('OP_SET_GLOBAL', chunk, offset);
        case 10 /* GET_UPVALUE */:
            return byteInstruction('OP_GET_UPVALUE', chunk, offset);
        case 11 /* SET_UPVALUE */:
            return byteInstruction('OP_SET_UPVALUE', chunk, offset);
        case 12 /* GET_PROPERTY */:
            return constantInstruction('OP_GET_PROPERTY', chunk, offset);
        case 13 /* SET_PROPERTY */:
            return constantInstruction('OP_SET_PROPERTY', chunk, offset);
        case 14 /* GET_SUPER */:
            return constantInstruction('OP_GET_SUPER', chunk, offset);
        case 15 /* EQUAL */:
            return simpleInstruction('OP_EQUAL', chunk, offset);
        case 16 /* GREATER */:
            return simpleInstruction('OP_GREATER', chunk, offset);
        case 17 /* LESS */:
            return simpleInstruction('OP_LESS', chunk, offset);
        case 18 /* ADD */:
            return simpleInstruction('OP_ADD', chunk, offset);
        case 19 /* SUBTRACT */:
            return simpleInstruction('OP_SUBTRACT', chunk, offset);
        case 20 /* MULTIPLY */:
            return simpleInstruction('OP_MULTIPLY', chunk, offset);
        case 21 /* DIVIDE */:
            return simpleInstruction('OP_DIVIDE', chunk, offset);
        case 22 /* NOT */:
            return simpleInstruction('OP_NOT', chunk, offset);
        case 23 /* NEGATE */:
            return simpleInstruction('OP_NEGATE', chunk, offset);
        case 24 /* PRINT */:
            return simpleInstruction('OP_PRINT', chunk, offset);
        case 25 /* JUMP */:
            return jumpInstruction('OP_JUMP', 1, chunk, offset);
        case 26 /* JUMP_IF_FALSE */:
            return jumpInstruction('OP_JUMP_IF_FALSE', 1, chunk, offset);
        case 27 /* LOOP */:
            return jumpInstruction('OP_LOOP', -1, chunk, offset);
        case 28 /* CALL */:
            return byteInstruction('OP_CALL', chunk, offset);
        case 29 /* INVOKE */:
            return invokeInstruction('OP_INVOKE', chunk, offset);
        case 30 /* SUPER_INVOKE */:
            return invokeInstruction('OP_SUPER_INVOKE', chunk, offset);
        case 31 /* CLOSURE */: {
            const initOffset = offset;
            offset++;
            const constantIndex = chunk.code[offset++];
            const fun = chunk.constants[constantIndex];
            logInstruction(initOffset, chunk, 'OP_CLOSURE', pad4(constantIndex), `'${stringifyValue(fun)}'`);
            for (let j = 0; j < fun.upvalueCount; j++) {
                const isLocal = chunk.code[offset++];
                const index = chunk.code[offset++];
                console.log(`${(offset - 2).toString().padStart(4, '0')}      |                     ${isLocal ? 'local' : 'upvalue'} ${index}`);
            }
            return offset;
        }
        case 32 /* CLOSE_UPVALUE */:
            return simpleInstruction('OP_CLOSE_UPVALUE', chunk, offset);
        case 33 /* RETURN */:
            return simpleInstruction('OP_RETURN', chunk, offset);
        case 34 /* CLASS */:
            return constantInstruction('OP_CLASS', chunk, offset);
        case 35 /* INHERIT */:
            return simpleInstruction('OP_INHERIT', chunk, offset);
        case 36 /* METHOD */:
            return constantInstruction('OP_METHOD', chunk, offset);
        default: {
            typeGuardSwitch(instruction);
            logInstruction(offset, chunk, 'Unknown opcode', instruction);
            return offset + 1;
        }
    }
}
function logInstruction(offset, chunk, name, ...otherBits) {
    const offsetPadded = offset.toString().padStart(4, '0');
    let linePadded;
    if (offset > 0 && chunk.lines[offset - 1] === chunk.lines[offset]) {
        linePadded = '   |';
    }
    else {
        linePadded = chunk.lines[offset].toString().padStart(4, '0');
    }
    const namePadded = otherBits.length ? `${name.padEnd(16)} ` : name;
    console.log(`${offsetPadded} ${linePadded} ${namePadded}${otherBits.join(' ')}`);
}
function constantInstruction(name, chunk, offset) {
    const constantIndex = chunk.code[offset + 1];
    const constant = chunk.constants[constantIndex];
    logInstruction(offset, chunk, name, pad4(constantIndex), `'${stringifyValue(constant)}'`);
    return offset + 2;
}
function invokeInstruction(name, chunk, offset) {
    const constantIndex = chunk.code[offset + 1];
    const constant = chunk.constants[constantIndex];
    const argCount = chunk.code[offset + 1];
    logInstruction(offset, chunk, name, `(${argCount} args)`, pad4(constantIndex), `'${stringifyValue(constant)}'`);
    return offset + 3;
}
function simpleInstruction(name, chunk, offset) {
    logInstruction(offset, chunk, name);
    return offset + 1;
}
function byteInstruction(name, chunk, offset) {
    const slot = chunk.code[offset + 1];
    logInstruction(offset, chunk, name, slot.toString().padStart(4, '0'));
    return offset + 2;
}
function jumpInstruction(name, sign, chunk, offset) {
    const jump = chunk.code[offset + 1];
    logInstruction(offset, chunk, name, pad4(offset), '->', pad4(offset + 2 + (sign * jump)));
    return offset + 2;
}
