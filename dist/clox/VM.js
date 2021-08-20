import { FRAME_MAX, typeGuardSwitch } from './common';
import { Parser } from './Compiler';
import { boolValue, newBoundMethod, newClass, newClosure, newInstance, nilValue, numberValue, stringifyValue, stringValue } from './value';
import { attachGlobals } from './builtins';
export class VM {
    frames = [];
    stack = [];
    globals = new Map();
    openUpvalues = null;
    constructor() {
        this.resetStack();
        attachGlobals(this.globals);
    }
    interpret(source) {
        const parser = new Parser();
        const fun = parser.compile(source);
        if (fun === null)
            return 'INTERPRET_COMPILE_ERROR';
        this.stack.push(fun);
        const closure = newClosure(fun);
        this.stack.pop();
        this.stack.push(closure);
        this.callClosure(closure, 0);
        return this.run();
    }
    peek(distance) {
        return this.stack[this.stack.length - 1 - distance];
    }
    callClosure(closure, argCount) {
        if (argCount !== closure.fun.arity) {
            this.runtimeError(`Expected ${closure.fun.arity} arguments but got ${argCount}.`);
            return false;
        }
        if (this.frames.length === FRAME_MAX) {
            this.runtimeError('Stack overflow.');
            return false;
        }
        this.frames.push({
            closure,
            funCode: closure.fun.chunk.code,
            funConstants: closure.fun.chunk.constants,
            ip: 0,
            firstSlotIndex: this.stack.length - argCount - 1,
        });
        return true;
    }
    callValue(callee, argCount) {
        switch (callee.type) {
            case 5 /* CLASS */: {
                this.stack[this.stack.length - argCount - 1] = newInstance(callee);
                const initializer = callee.methods.get('init');
                if (initializer) {
                    return this.callClosure(initializer, argCount);
                }
                else if (argCount !== 0) {
                    this.runtimeError(`Expected 0 arguments but got ${argCount}`);
                    return false;
                }
                return true;
            }
            case 6 /* CLOSURE */: return this.callClosure(callee, argCount);
            case 7 /* BOUND_METHOD */: {
                this.stack[this.stack.length - argCount - 1] = callee.receiver;
                return this.callClosure(callee.method, argCount);
            }
            case 9 /* NATIVE_FUN */: {
                const args = this.stack.slice(this.stack.length - argCount);
                const [success, result] = callee.fun(args, this);
                if (success) {
                    this.stack.length -= argCount + 1;
                    this.stack.push(result);
                    return true;
                }
                return false;
            }
            default: {
                this.runtimeError('Can only call functions and classes.');
                return false;
            }
        }
    }
    invokeFromClass(klass, name, argCount) {
        const method = klass.methods.get(name);
        if (!method) {
            this.runtimeError(`Undefined property '${name}'.`);
            return false;
        }
        return this.callValue(method, argCount);
    }
    invoke(name, argCount) {
        const instance = this.peek(argCount);
        if (instance.type !== 4 /* INSTANCE */) {
            this.runtimeError('Only instances have methods.');
            return false;
        }
        const value = instance.fields.get(name);
        if (value) {
            this.stack[this.stack.length - argCount - 1] = value;
            return this.callValue(value, argCount);
        }
        return this.invokeFromClass(instance.klass, name, argCount);
    }
    bindMethod(klass, name) {
        const method = klass.methods.get(name);
        if (!method) {
            this.runtimeError(`Undefined property '${name}'.`);
            return false;
        }
        const bound = newBoundMethod(this.peek(0), method);
        this.stack.pop();
        this.stack.push(bound);
        return true;
    }
    captureUpvalue(stackIndex) {
        let prevUpvalue = null;
        let upvalue = this.openUpvalues;
        while (upvalue !== null && upvalue.stackIndex > stackIndex) {
            prevUpvalue = upvalue;
            upvalue = upvalue.next;
        }
        if (upvalue !== null && upvalue.stackIndex === stackIndex) {
            return upvalue;
        }
        const createdUpvalue = { stackIndex, closed: nilValue, next: upvalue };
        if (prevUpvalue === null) {
            this.openUpvalues = createdUpvalue;
        }
        else {
            prevUpvalue.next = createdUpvalue;
        }
        return createdUpvalue;
    }
    closeUpvalues(last) {
        while (this.openUpvalues !== null && this.openUpvalues.stackIndex >= last) {
            const upvalue = this.openUpvalues;
            upvalue.closed = this.stack[upvalue.stackIndex];
            upvalue.stackIndex = -1;
            this.openUpvalues = upvalue.next;
        }
    }
    defineMethod(name) {
        const method = this.peek(0);
        const klass = this.peek(1);
        klass.methods.set(name, method);
        this.stack.pop();
    }
    readByte(frame) {
        // There are no inlined functions in TS, if it's enough of a bottleneck we can hand-inline this later
        // Update: after running some tests, inlining  these seems to provide no/negligible speed boost (27.761 -> 27.188 secs)
        return frame.funCode[frame.ip++];
    }
    readConstant(frame) {
        return frame.funConstants[this.readByte(frame)];
    }
    readString(frame) {
        return this.readConstant(frame).value;
    }
    binaryOp(operator) {
        if (this.peek(0).type !== 2 /* NUMBER */ || this.peek(1).type !== 2 /* NUMBER */) {
            this.runtimeError('Operands must be numbers.');
            return true;
        }
        const b = this.stack.pop().value;
        const a = this.stack.pop().value;
        switch (operator) {
            case '+':
                this.stack.push(numberValue(a + b));
                return false;
            case '-':
                this.stack.push(numberValue(a - b));
                return false;
            case '*':
                this.stack.push(numberValue(a * b));
                return false;
            case '/':
                this.stack.push(numberValue(a / b));
                return false;
            case '<':
                this.stack.push(boolValue(a < b));
                return false;
            case '>':
                this.stack.push(boolValue(a > b));
                return false;
            default:
                typeGuardSwitch(operator);
                return false;
        }
    }
    run() {
        let frame = this.frames[this.frames.length - 1];
        while (true) {
            // /* DEBUG */ this.printStack();
            // /* DEBUG */ disassembleInstruction(frame.funCode, frame.ip);
            let instruction;
            switch (instruction = this.readByte(frame)) {
                case 0 /* CONSTANT */: {
                    const constant = this.readConstant(frame);
                    this.stack.push(constant);
                    break;
                }
                case 1 /* NIL */:
                    this.stack.push(nilValue);
                    break;
                case 2 /* TRUE */:
                    this.stack.push(boolValue(true));
                    break;
                case 3 /* FALSE */:
                    this.stack.push(boolValue(false));
                    break;
                case 4 /* POP */:
                    this.stack.pop();
                    break;
                case 5 /* GET_LOCAL */: {
                    const slot = this.readByte(frame);
                    this.stack.push(this.stack[frame.firstSlotIndex + slot]);
                    break;
                }
                case 6 /* SET_LOCAL */: {
                    const slot = this.readByte(frame);
                    this.stack[frame.firstSlotIndex + slot] = this.peek(0);
                    break;
                }
                case 7 /* GET_GLOBAL */: {
                    const name = this.readString(frame);
                    const value = this.globals.get(name);
                    if (!value) {
                        return 'INTERPRET_RUNTIME_ERROR';
                    }
                    this.stack.push(value);
                    break;
                }
                case 8 /* DEFINE_GLOBAL */: {
                    const name = this.readString(frame);
                    this.globals.set(name, this.peek(0));
                    this.stack.pop();
                    break;
                }
                case 9 /* SET_GLOBAL */: {
                    const name = this.readString(frame);
                    if (!this.globals.has(name)) {
                        this.runtimeError(`Undefined variable '${name}'.`);
                        return 'INTERPRET_RUNTIME_ERROR';
                    }
                    this.globals.set(name, this.peek(0));
                    break;
                }
                case 10 /* GET_UPVALUE */: {
                    const slot = this.readByte(frame);
                    const upvalue = frame.closure.upvalues[slot];
                    // Can't do the pointer magic in the book, so we have to do this instead :/
                    this.stack.push(upvalue.stackIndex === -1 ? upvalue.closed : this.stack[upvalue.stackIndex]);
                    break;
                }
                case 11 /* SET_UPVALUE */: {
                    const slot = this.readByte(frame);
                    const upvalue = frame.closure.upvalues[slot];
                    // Can't do the pointer magic in the book, so we have to do this instead :/
                    if (upvalue.stackIndex === -1) {
                        upvalue.closed = this.peek(0);
                    }
                    else {
                        this.stack[upvalue.stackIndex] = this.peek(0);
                    }
                    break;
                }
                case 12 /* GET_PROPERTY */: {
                    if (this.peek(0).type !== 4 /* INSTANCE */) {
                        this.runtimeError('Only instances have properties.');
                        return 'INTERPRET_RUNTIME_ERROR';
                    }
                    const instance = this.peek(0);
                    const name = this.readString(frame);
                    const value = instance.fields.get(name);
                    if (value) {
                        this.stack.pop(); // Instance.
                        this.stack.push(value);
                        break;
                    }
                    if (!this.bindMethod(instance.klass, name)) {
                        return 'INTERPRET_RUNTIME_ERROR';
                    }
                    break;
                }
                case 13 /* SET_PROPERTY */: {
                    if (this.peek(1).type !== 4 /* INSTANCE */) {
                        this.runtimeError('Only instances have fields.');
                        return 'INTERPRET_RUNTIME_ERROR';
                    }
                    const instance = this.peek(1);
                    const name = this.readString(frame);
                    instance.fields.set(name, this.peek(0));
                    const value = this.stack.pop();
                    this.stack.pop();
                    this.stack.push(value);
                    break;
                }
                case 14 /* GET_SUPER */: {
                    const name = this.readString(frame);
                    const superclass = this.stack.pop();
                    if (!this.bindMethod(superclass, name)) {
                        return 'INTERPRET_RUNTIME_ERROR';
                    }
                    break;
                }
                case 15 /* EQUAL */: {
                    const b = this.stack.pop();
                    const a = this.stack.pop();
                    this.stack.push(boolValue(this.valuesEqual(a, b)));
                    break;
                }
                case 16 /* GREATER */:
                    if (this.binaryOp('>'))
                        return 'INTERPRET_RUNTIME_ERROR';
                    break;
                case 17 /* LESS */:
                    if (this.binaryOp('<'))
                        return 'INTERPRET_RUNTIME_ERROR';
                    break;
                case 18 /* ADD */: {
                    if (this.peek(0).type === 3 /* STRING */ && this.peek(1).type === 3 /* STRING */) {
                        const b = this.stack.pop().value;
                        const a = this.stack.pop().value;
                        this.stack.push(stringValue(a + b));
                    }
                    else if (this.peek(0).type === 2 /* NUMBER */ && this.peek(1).type === 2 /* NUMBER */) {
                        const b = this.stack.pop().value;
                        const a = this.stack.pop().value;
                        this.stack.push(numberValue(a + b));
                    }
                    else {
                        this.runtimeError('Operands must be two numbers or two strings.');
                        return 'INTERPRET_RUNTIME_ERROR';
                    }
                    break;
                }
                case 19 /* SUBTRACT */:
                    if (this.binaryOp('-'))
                        return 'INTERPRET_RUNTIME_ERROR';
                    break;
                case 20 /* MULTIPLY */:
                    if (this.binaryOp('*'))
                        return 'INTERPRET_RUNTIME_ERROR';
                    break;
                case 21 /* DIVIDE */:
                    if (this.binaryOp('/'))
                        return 'INTERPRET_RUNTIME_ERROR';
                    break;
                case 22 /* NOT */:
                    this.stack.push(boolValue(this.isFalsey(this.stack.pop())));
                    break;
                case 23 /* NEGATE */: {
                    if (this.peek(0).type !== 2 /* NUMBER */) {
                        this.runtimeError('Operand must be a number.');
                        return 'INTERPRET_RUNTIME_ERROR';
                    }
                    this.stack.push(numberValue(-(this.stack.pop().value)));
                    break;
                }
                case 24 /* PRINT */: {
                    console.log(stringifyValue(this.stack.pop()));
                    break;
                }
                case 25 /* JUMP */: {
                    const offset = this.readByte(frame);
                    frame.ip += offset;
                    break;
                }
                case 26 /* JUMP_IF_FALSE */: {
                    const offset = this.readByte(frame);
                    if (this.isFalsey(this.peek(0)))
                        frame.ip += offset;
                    break;
                }
                case 27 /* LOOP */: {
                    const offset = this.readByte(frame);
                    frame.ip -= offset;
                    break;
                }
                case 28 /* CALL */: {
                    const argCount = this.readByte(frame);
                    if (!this.callValue(this.peek(argCount), argCount)) {
                        return 'INTERPRET_RUNTIME_ERROR';
                    }
                    frame = this.frames[this.frames.length - 1];
                    break;
                }
                case 29 /* INVOKE */: {
                    const method = this.readString(frame);
                    const argCount = this.readByte(frame);
                    if (!this.invoke(method, argCount)) {
                        return 'INTERPRET_RUNTIME_ERROR';
                    }
                    frame = this.frames[this.frames.length - 1];
                    break;
                }
                case 30 /* SUPER_INVOKE */: {
                    const method = this.readString(frame);
                    const argCount = this.readByte(frame);
                    const superclass = this.stack.pop();
                    if (!this.invokeFromClass(superclass, method, argCount)) {
                        return 'INTERPRET_RUNTIME_ERROR';
                    }
                    frame = this.frames[this.frames.length - 1];
                    break;
                }
                case 31 /* CLOSURE */: {
                    const fun = this.readConstant(frame);
                    const closure = newClosure(fun);
                    this.stack.push(closure);
                    for (let i = 0; i < closure.upvalueCount; i++) {
                        const isLocal = this.readByte(frame);
                        const index = this.readByte(frame);
                        if (isLocal) {
                            closure.upvalues[i] = this.captureUpvalue(frame.firstSlotIndex + index);
                        }
                        else {
                            closure.upvalues[i] = frame.closure.upvalues[index];
                        }
                    }
                    break;
                }
                case 32 /* CLOSE_UPVALUE */: {
                    this.closeUpvalues(this.stack.length - 1);
                    this.stack.pop();
                    break;
                }
                case 33 /* RETURN */: {
                    const result = this.stack.pop();
                    this.closeUpvalues(frame.firstSlotIndex);
                    this.frames.pop();
                    if (this.frames.length === 0) {
                        this.stack.pop();
                        return 'INTERPRET_OK';
                    }
                    this.stack.length = frame.firstSlotIndex;
                    this.stack.push(result);
                    frame = this.frames[this.frames.length - 1];
                    break;
                }
                case 34 /* CLASS */:
                    this.stack.push(newClass(this.readString(frame)));
                    break;
                case 35 /* INHERIT */: {
                    const superclass = this.peek(1);
                    if (superclass.type !== 5 /* CLASS */) {
                        this.runtimeError('Superclass must be a class.');
                        return 'INTERPRET_RUNTIME_ERROR';
                    }
                    const subclass = this.peek(0);
                    subclass.methods = new Map(superclass.methods); // Note: this runs before subclass' own methods have been attached yet
                    this.stack.pop(); // Subclass.
                    break;
                }
                case 36 /* METHOD */:
                    this.defineMethod(this.readString(frame));
                    break;
                default: {
                    typeGuardSwitch(instruction);
                }
            }
        }
    }
    resetStack() {
        this.stack.length = 0;
    }
    printStack() {
        let out = '          ';
        for (let slot = 0; slot < this.stack.length; slot++) {
            out += `[ ${stringifyValue(this.stack[slot])} ]`;
        }
        console.log(out);
    }
    runtimeError(message) {
        console.log(message);
        for (let i = this.frames.length - 1; i >= 0; i--) {
            const frame = this.frames[i];
            const fun = frame.closure.fun;
            const instruction = frame.ip - 1;
            const name = fun.name ? `${fun.name}()` : 'script';
            console.log(`[line ${fun.chunk.lines[instruction]}] in ${name}`);
        }
        this.resetStack();
    }
    /* *** TESTS *** */
    isFalsey(value) {
        return value === nilValue || (value.type === 0 /* BOOL */ && !value.value);
    }
    valuesEqual(a, b) {
        if (a.type !== b.type)
            return false;
        if ('value' in a && 'value' in b) {
            if (Number.isNaN(a.value) && Number.isNaN(b.value))
                return true;
            return a.value === b.value;
        }
        return a === b; // Function/object-y values must be equal by reference? IDR what the exact semantics are here, I should probably go back and check
    }
    isCallable(value) {
        switch (value.type) {
            case 5 /* CLASS */:
            case 6 /* CLOSURE */:
            case 7 /* BOUND_METHOD */:
            case 9 /* NATIVE_FUN */: return true;
            default: return false;
        }
    }
}
