import { typeGuardSwitch, ValueType } from './common';
import { nilValue, numberValue, stringifyValue, stringValue } from './value';

const clock: NativeFunValue = {
  type: ValueType.NATIVE_FUN,
  arity: 0,
  name: 'clock',
  fun: () => [true, numberValue(Date.now() / 1000)],
};

const runtime: NativeFunValue = {
  type: ValueType.NATIVE_FUN,
  arity: 0,
  name: 'runtime',
  fun: () => [true, stringValue('clox')],
};

const schedule: NativeFunValue = {
  type: ValueType.NATIVE_FUN,
  arity: 2,
  name: 'schedule',
  fun: ([secs, cb], vm) => {
    if (secs.type !== ValueType.NUMBER) { vm.runtimeError('First argument to \'schedule\' must be a number.'); return [false]; }
    if (!vm.isCallable(cb)) { vm.runtimeError('Second argument to \'schedule\' must be a function.'); return [false]; }
    setTimeout(() => {
      vm.callValue(cb, 0);
      // This was an extremely bad decision. It breaks assumptions in the VM, and the return value of interpret can no longer be trusted
      // Also, thank goodness I skipped implementing the GC, that would've probably caused problems here
      vm.run();
    }, (secs as NumberValue).value * 1000);
    return [true, nilValue];
  },
};

const typeOf: NativeFunValue = {
  type: ValueType.NATIVE_FUN,
  arity: 1,
  name: 'typeOf',
  fun: ([value]) => {
    switch(value.type) {
      case ValueType.STRING: return [true, stringValue('string')];
      case ValueType.NUMBER: return [true, stringValue('number')];
      case ValueType.BOOL: return [true, stringValue('boolean')];
      case ValueType.NIL: return [true, stringValue('nil')];
      case ValueType.INSTANCE: return [true, stringValue('object')];
      case ValueType.CLASS:
      case ValueType.CLOSURE:
      case ValueType.BOUND_METHOD:
      case ValueType.FUN: // Should never happen, but
      case ValueType.NATIVE_FUN:
        return [true, stringValue('function')];
      default: {
        typeGuardSwitch(value);
        return [false];
      }
    }
  },
};

const toString: NativeFunValue = {
  type: ValueType.NATIVE_FUN,
  arity: 1,
  name: 'toString',
  fun: ([value]) => [true, stringValue(stringifyValue(value))],
};

export const attachGlobals = (globals: Map<string, Value>): void => {
  globals.set('clock', clock);
  globals.set('runtime', runtime);
  globals.set('schedule', schedule);
  globals.set('typeOf', typeOf);
  globals.set('toString', toString);
  // globals.set('Array', LoxArray);
  // globals.set('Promise', LoxPromiseObject);
};