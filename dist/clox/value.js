import { Chunk } from './Chunk';
import { typeGuardSwitch } from './common';
const printFunction = (value) => value.name ? `<fn ${value.name}>` : '<script>';
export function stringifyValue(value) {
    switch (value.type) {
        case 3 /* STRING */:
        case 2 /* NUMBER */:
        case 0 /* BOOL */:
            return String(value.value);
        case 1 /* NIL */:
            return 'nil';
        case 4 /* INSTANCE */:
            return `${value.klass.name} instance`;
        case 5 /* CLASS */:
            return value.name;
        case 6 /* CLOSURE */:
            return printFunction(value.fun);
        case 7 /* BOUND_METHOD */:
            return printFunction(value.method.fun);
        case 8 /* FUN */:
            return printFunction(value);
        case 9 /* NATIVE_FUN */:
            return '<native fn>';
        default: {
            typeGuardSwitch(value);
            return 'unreachable';
        }
    }
}
export function boolValue(value) {
    return {
        type: 0 /* BOOL */,
        value,
    };
}
export function numberValue(value) {
    return {
        type: 2 /* NUMBER */,
        value,
    };
}
export function stringValue(value) {
    return {
        type: 3 /* STRING */,
        value,
    };
}
export function newInstance(klass) {
    return {
        type: 4 /* INSTANCE */,
        klass,
        fields: new Map(),
    };
}
export function newClass(name) {
    return {
        type: 5 /* CLASS */,
        name,
        methods: new Map(),
    };
}
export function newClosure(fun) {
    return {
        type: 6 /* CLOSURE */,
        fun,
        upvalues: [],
        upvalueCount: fun.upvalueCount,
    };
}
export function newBoundMethod(receiver, method) {
    return {
        type: 7 /* BOUND_METHOD */,
        receiver,
        method,
    };
}
export function funValue(name = null, arity = 0) {
    return {
        type: 8 /* FUN */,
        name,
        arity,
        upvalueCount: 0,
        chunk: new Chunk(),
    };
}
export const nilValue = { type: 1 /* NIL */ };
