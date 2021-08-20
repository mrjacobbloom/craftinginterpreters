import { LoxClass } from './LoxClass';
class NativeFunction {
    arity_;
    call_;
    thisArg;
    isCallable = true;
    constructor(arity_, call_, thisArg = null) {
        this.arity_ = arity_;
        this.call_ = call_;
        this.thisArg = thisArg;
    }
    call(interpreter, args) {
        return this.call_(interpreter, args, this.thisArg);
    }
    arity() { return this.arity_; }
    bind(thisArg) { return new NativeFunction(this.arity_, this.call_, thisArg); }
    toString() {
        return '<native fn>';
    }
}
const stringAsToken = (str) => ({
    type: 'IDENTIFIER',
    lexeme: str,
    literal: str,
    line: 0,
});
const clock = new NativeFunction(0, () => Date.now() / 1000);
const runtime = new NativeFunction(0, () => 'jlox');
const schedule = new NativeFunction(2, (interpreter, args) => {
    interpreter.assertArgumentType(args[0], 'number', 'First argument to \'schedule\' must be a number.');
    interpreter.assertArgumentType(args[1], 'function', 'Second argument to \'schedule\' must be a function.');
    setTimeout(() => args[1].call(interpreter, []), args[0] * 1000);
    return null;
});
const typeOf = new NativeFunction(1, (interpreter, args) => {
    if (args[0] === null)
        return 'nil';
    if (interpreter.isInstance(args[0]))
        return 'object';
    if (interpreter.isCallable(args[0]))
        return 'function';
    return typeof args[0];
});
const toString = new NativeFunction(1, (interpreter, args) => {
    if (args[0] === null)
        return 'nil';
    return args[0].toString();
});
const arrayMethods = new Map();
arrayMethods.set('init', new NativeFunction(0, (interpreter, args, thisArg) => {
    thisArg?.set(stringAsToken('length'), 0);
    thisArg?.hiddenSlots.set('values', []);
    return null;
}));
arrayMethods.set('set', new NativeFunction(2, (interpreter, args, thisArg) => {
    if (!thisArg)
        return null;
    interpreter.assertArgumentType(args[0], 'number', 'First argument to Array.set must be a number.');
    thisArg.hiddenSlots.get('values')[args[0]] = args[1];
    thisArg?.set(stringAsToken('length'), thisArg.hiddenSlots.get('values').length);
    return null;
}));
arrayMethods.set('get', new NativeFunction(1, (interpreter, args, thisArg) => {
    if (!thisArg)
        return null;
    interpreter.assertArgumentType(args[0], 'number', 'First argument to Array.get must be a number.');
    return thisArg.hiddenSlots.get('values')[args[0]] ?? null;
}));
arrayMethods.set('push', new NativeFunction(1, (interpreter, args, thisArg) => {
    thisArg?.hiddenSlots.get('values').push(args[0]);
    thisArg?.set(stringAsToken('length'), thisArg.hiddenSlots.get('values').length);
    return null;
}));
arrayMethods.set('forEach', new NativeFunction(1, (interpreter, args, thisArg) => {
    interpreter.assertArgumentType(args[0], 'function', 'First argument to Array.forEach must be a function.');
    for (const value of thisArg?.hiddenSlots.get('values')) {
        args[0].call(interpreter, [value ?? null]);
    }
    return null;
}));
const LoxArray = new LoxClass('Array', null, arrayMethods);
export const attachGlobals = (globalEnv) => {
    globalEnv.define('clock', clock);
    globalEnv.define('runtime', runtime);
    globalEnv.define('schedule', schedule);
    globalEnv.define('typeOf', typeOf);
    globalEnv.define('toString', toString);
    globalEnv.define('Array', LoxArray);
    // globalEnv.define('Promise', LoxPromiseObject);
};
