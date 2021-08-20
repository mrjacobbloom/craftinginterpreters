import { OpCode, typeGuardSwitch } from './common';
import type { Chunk } from './Chunk';
import { stringifyValue } from './value';

export function disassembleChunk(chunk: Chunk, name: string): void {
  console.log(`== ${name} ==`);

  for (let offset = 0 as Index; offset < chunk.code.length;) {
    offset = disassembleInstruction(chunk, offset);
  }
}

const pad4 = (num: number): string => num.toString().padStart(4);

export function disassembleInstruction(chunk: Chunk, offset: Index): Index {
  const instruction = chunk.code[offset] as OpCode; // Not /strictly/ true, but true for valid code, and this helps us make sure we've written a case for every opcode
  switch(instruction) {
    case OpCode.CONSTANT:
      return constantInstruction('OP_CONSTANT', chunk, offset);
    case OpCode.NIL:
      return simpleInstruction('OP_NIL', chunk, offset);
    case OpCode.TRUE:
      return simpleInstruction('OP_TRUE', chunk, offset);
    case OpCode.FALSE:
      return simpleInstruction('OP_FALSE', chunk, offset);
    case OpCode.POP:
      return simpleInstruction('OP_POP', chunk, offset);
    case OpCode.GET_LOCAL:
      return byteInstruction('OP_GET_LOCAL', chunk, offset);
    case OpCode.SET_LOCAL:
      return byteInstruction('OP_SET_LOCAL', chunk, offset);
    case OpCode.GET_GLOBAL:
      return constantInstruction('OP_GET_GLOBAL', chunk, offset);
    case OpCode.DEFINE_GLOBAL:
      return constantInstruction('OP_DEFINE_GLOBAL', chunk, offset);
    case OpCode.SET_GLOBAL:
      return constantInstruction('OP_SET_GLOBAL', chunk, offset);
    case OpCode.GET_UPVALUE:
      return byteInstruction('OP_GET_UPVALUE', chunk, offset);
    case OpCode.SET_UPVALUE:
      return byteInstruction('OP_SET_UPVALUE', chunk, offset);
    case OpCode.GET_PROPERTY:
      return constantInstruction('OP_GET_PROPERTY', chunk, offset);
    case OpCode.SET_PROPERTY:
      return constantInstruction('OP_SET_PROPERTY', chunk, offset);
    case OpCode.GET_SUPER:
      return constantInstruction('OP_GET_SUPER', chunk, offset);
    case OpCode.EQUAL:
      return simpleInstruction('OP_EQUAL', chunk, offset);
    case OpCode.GREATER:
      return simpleInstruction('OP_GREATER', chunk, offset);
    case OpCode.LESS:
      return simpleInstruction('OP_LESS', chunk, offset);
    case OpCode.ADD:
      return simpleInstruction('OP_ADD', chunk, offset);
    case OpCode.SUBTRACT:
      return simpleInstruction('OP_SUBTRACT', chunk, offset);
    case OpCode.MULTIPLY:
      return simpleInstruction('OP_MULTIPLY', chunk, offset);
    case OpCode.DIVIDE:
      return simpleInstruction('OP_DIVIDE', chunk, offset);
    case OpCode.NOT:
      return simpleInstruction('OP_NOT', chunk, offset);
    case OpCode.NEGATE:
      return simpleInstruction('OP_NEGATE', chunk, offset);
    case OpCode.PRINT:
      return simpleInstruction('OP_PRINT', chunk, offset);
    case OpCode.JUMP:
      return jumpInstruction('OP_JUMP', 1, chunk, offset);
    case OpCode.JUMP_IF_FALSE:
      return jumpInstruction('OP_JUMP_IF_FALSE', 1, chunk, offset);
    case OpCode.LOOP:
      return jumpInstruction('OP_LOOP', -1, chunk, offset);
    case OpCode.CALL:
      return byteInstruction('OP_CALL', chunk, offset);
    case OpCode.INVOKE:
      return invokeInstruction('OP_INVOKE', chunk, offset);
    case OpCode.SUPER_INVOKE:
      return invokeInstruction('OP_SUPER_INVOKE', chunk, offset);
    case OpCode.CLOSURE: {
      const initOffset = offset;
      offset++;
      const constantIndex = chunk.code[offset++];
      const fun = chunk.constants[constantIndex] as FunValue;
      logInstruction(initOffset, chunk, 'OP_CLOSURE', pad4(constantIndex), `'${stringifyValue(fun)}'`);
      for (let j = 0; j < fun.upvalueCount; j++) {
        const isLocal = chunk.code[offset++];
        const index = chunk.code[offset++];
        console.log(`${(offset - 2).toString().padStart(4, '0')}      |                     ${isLocal ? 'local' : 'upvalue'} ${index}`);
      }
      return offset;
    }
    case OpCode.CLOSE_UPVALUE:
      return simpleInstruction('OP_CLOSE_UPVALUE', chunk,  offset);
    case OpCode.RETURN:
      return simpleInstruction('OP_RETURN', chunk, offset);
    case OpCode.CLASS:
      return constantInstruction('OP_CLASS', chunk, offset);
    case OpCode.INHERIT:
      return simpleInstruction('OP_INHERIT', chunk, offset);
    case OpCode.METHOD:
      return constantInstruction('OP_METHOD', chunk, offset);
    default: {
      typeGuardSwitch(instruction);
      logInstruction(offset, chunk, 'Unknown opcode', instruction);
      return offset + 1;
    }
  }
}

function logInstruction(offset: Index, chunk: Chunk, name: string, ...otherBits: string[]): void {
  const offsetPadded = offset.toString().padStart(4, '0');
  let linePadded: string;
  if (offset > 0 && chunk.lines[offset - 1] === chunk.lines[offset]) {
    linePadded = '   |';
  } else {
    linePadded = chunk.lines[offset].toString().padStart(4, '0');
  }
  const namePadded = otherBits.length ? `${name.padEnd(16)  } ` : name;
  console.log(`${offsetPadded} ${linePadded} ${namePadded}${otherBits.join(' ')}`);
}

function constantInstruction(name: string, chunk: Chunk, offset: Index): Index {
  const constantIndex: Index = chunk.code[offset + 1];
  const constant: Value = chunk.constants[constantIndex];

  logInstruction(offset, chunk, name, pad4(constantIndex), `'${stringifyValue(constant)}'`);
  return offset + 2;
}

function invokeInstruction(name: string, chunk: Chunk, offset: Index): Index {
  const constantIndex: Index = chunk.code[offset + 1];
  const constant: Value = chunk.constants[constantIndex];
  const argCount: Index = chunk.code[offset + 1];
  logInstruction(offset, chunk, name, `(${argCount} args)`, pad4(constantIndex), `'${stringifyValue(constant)}'`);
  return offset + 3;
}

function simpleInstruction(name: string, chunk: Chunk, offset: Index): Index {
  logInstruction(offset, chunk, name);
  return offset + 1;
}

function byteInstruction(name: string, chunk: Chunk, offset: Index): Index {
  const slot = chunk.code[offset + 1];
  logInstruction(offset, chunk, name, slot.toString().padStart(4, '0'));
  return offset + 2; 
}

function jumpInstruction(name: string, sign: 1 | -1, chunk: Chunk, offset: Index): Index {
  const jump: Index = chunk.code[offset + 1];

  logInstruction(offset, chunk, name, pad4(offset), '->', pad4(offset + 2 + (sign * jump)));
  return offset + 2;
}
