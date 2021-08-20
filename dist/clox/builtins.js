import { typeGuardSwitch } from './common';
import { nilValue, numberValue, stringifyValue, stringValue } from './value';
const clock = {
    type: 9 /* NATIVE_FUN */,
    arity: 0,
    name: 'clock',
    fun: () => [true, numberValue(Date.now() / 1000)],
};
const runtime = {
    type: 9 /* NATIVE_FUN */,
    arity: 0,
    name: 'runtime',
    fun: () => [true, stringValue('clox')],
};
const schedule = {
    type: 9 /* NATIVE_FUN */,
    arity: 2,
    name: 'schedule',
    fun: ([secs, cb], vm) => {
        if (secs.type !== 2 /* NUMBER */) {
            vm.runtimeError('First argument to \'schedule\' must be a number.');
            return [false];
        }
        if (!vm.isCallable(cb)) {
            vm.runtimeError('Second argument to \'schedule\' must be a function.');
            return [false];
        }
        setTimeout(() => {
            vm.callValue(cb, 0);
            // This was an extremely bad decision. It breaks assumptions in the VM, and the return value of interpret can no longer be trusted
            // Also, thank goodness I skipped implementing the GC, that would've probably caused problems here
            vm.run();
        }, secs.value * 1000);
        return [true, nilValue];
    },
};
const typeOf = {
    type: 9 /* NATIVE_FUN */,
    arity: 1,
    name: 'typeOf',
    fun: ([value]) => {
        switch (value.type) {
            case 3 /* STRING */: return [true, stringValue('string')];
            case 2 /* NUMBER */: return [true, stringValue('number')];
            case 0 /* BOOL */: return [true, stringValue('boolean')];
            case 1 /* NIL */: return [true, stringValue('nil')];
            case 4 /* INSTANCE */: return [true, stringValue('object')];
            case 5 /* CLASS */:
            case 6 /* CLOSURE */:
            case 7 /* BOUND_METHOD */:
            case 8 /* FUN */: // Should never happen, but
            case 9 /* NATIVE_FUN */:
                return [true, stringValue('function')];
            default: {
                typeGuardSwitch(value);
                return [false];
            }
        }
    },
};
const toString = {
    type: 9 /* NATIVE_FUN */,
    arity: 1,
    name: 'toString',
    fun: ([value]) => [true, stringValue(stringifyValue(value))],
};
export const attachGlobals = (globals) => {
    globals.set('clock', clock);
    globals.set('runtime', runtime);
    globals.set('schedule', schedule);
    globals.set('typeOf', typeOf);
    globals.set('toString', toString);
    // globals.set('Array', LoxArray);
    // globals.set('Promise', LoxPromiseObject);
};
