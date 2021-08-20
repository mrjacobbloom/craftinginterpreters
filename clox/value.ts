import { Chunk } from './Chunk';
import { typeGuardSwitch, ValueType } from './common';

const printFunction = (value: FunValue): string => value.name ? `<fn ${value.name}>` : '<script>';

export function stringifyValue(value: Value): string {
  switch(value.type) {
    case ValueType.STRING:
    case ValueType.NUMBER:
    case ValueType.BOOL:
      return String(value.value);
    case ValueType.NIL:
      return 'nil';
    case ValueType.INSTANCE:
      return `${value.klass.name} instance`;
    case ValueType.CLASS:
      return value.name;
    case ValueType.CLOSURE:
      return printFunction(value.fun);
    case ValueType.BOUND_METHOD:
      return printFunction(value.method.fun);
    case ValueType.FUN:
      return printFunction(value);
    case ValueType.NATIVE_FUN:
      return '<native fn>';
    default: {
      typeGuardSwitch(value);
      return 'unreachable';
    }
  }
}

export function boolValue(value: boolean): BoolValue {
  return {
    type: ValueType.BOOL,
    value,
  };
}

export function numberValue(value: number): NumberValue {
  return {
    type: ValueType.NUMBER,
    value,
  };
}

export function stringValue(value: string): StringValue {
  return {
    type: ValueType.STRING,
    value,
  };
}

export function newInstance(klass: ClassValue): InstanceValue {
  return {
    type: ValueType.INSTANCE,
    klass,
    fields: new Map(),
  }
}

export function newClass(name: string): ClassValue {
  return {
    type: ValueType.CLASS,
    name,
    methods: new Map(),
  };
}

export function newClosure(fun: FunValue): ClosureValue {
  return {
    type: ValueType.CLOSURE,
    fun,
    upvalues: [],
    upvalueCount: fun.upvalueCount,
  };
}

export function newBoundMethod(receiver: InstanceValue, method: ClosureValue): BoundMethodValue {
  return {
    type: ValueType.BOUND_METHOD,
    receiver,
    method,
  }
}

export function funValue(name: string | null = null, arity = 0): FunValue {
  return {
    type: ValueType.FUN,
    name,
    arity,
    upvalueCount: 0,
    chunk: new Chunk(),
  };
}

export const nilValue: NilValue = { type: ValueType.NIL };
