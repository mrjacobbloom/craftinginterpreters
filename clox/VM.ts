import { FRAME_MAX, OpCode, typeGuardSwitch, ValueType } from './common';
import { disassembleInstruction } from './debug';
import { Parser } from './Compiler';
import { boolValue, newBoundMethod, newClass, newClosure, newInstance, nilValue, numberValue, stringifyValue, stringValue } from './value';
import { attachGlobals } from './builtins';

export class VM {
  private frames: CallFrame[] = [];
  private stack: Value[] = [];
  private globals = new Map<string, Value>();
  private openUpvalues: ObjUpvalue | null = null;

  public constructor() {
    this.resetStack();
    attachGlobals(this.globals);
  }

  public interpret(source: string): InterpretResult {
    const parser = new Parser();
    const fun = parser.compile(source);
    if (fun === null) return 'INTERPRET_COMPILE_ERROR';

    this.stack.push(fun);
    const closure = newClosure(fun);
    this.stack.pop();
    this.stack.push(closure);
    this.callClosure(closure, 0);

    return this.run();
  }

  private peek(distance: number): Value {
    return this.stack[this.stack.length - 1 - distance];
  }

  private callClosure(closure: ClosureValue, argCount: number): boolean {
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

  public callValue(callee: Value, argCount: number): boolean {
    switch(callee.type) {
      case ValueType.CLASS: {
        this.stack[this.stack.length - argCount - 1] = newInstance(callee);
        const initializer = callee.methods.get('init');
        if (initializer) {
          return this.callClosure(initializer as ClosureValue, argCount);
        } else if (argCount !== 0) {
          this.runtimeError(`Expected 0 arguments but got ${argCount}`);
          return false;
        }
        return true
      }
      case ValueType.CLOSURE: return this.callClosure(callee, argCount);
      case ValueType.BOUND_METHOD: {
        this.stack[this.stack.length - argCount - 1] = callee.receiver;
        return this.callClosure(callee.method, argCount);
      }
      case ValueType.NATIVE_FUN: {
        const args = this.stack.slice(this.stack.length - argCount);
        const [success, result] = callee.fun(args, this);
        if (success) {
          this.stack.length -= argCount + 1;
          this.stack.push(result!);
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

  private invokeFromClass(klass: ClassValue, name: string, argCount: number): boolean {
    const method = klass.methods.get(name) as ClosureValue | undefined;
    if (!method) {
      this.runtimeError(`Undefined property '${name}'.`);
      return false;
    }
    return this.callValue(method, argCount);
  }

  private invoke(name: string, argCount: number): boolean {
    const instance = this.peek(argCount);

    if (instance.type !== ValueType.INSTANCE) {
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

  private bindMethod(klass: ClassValue, name: string): boolean {
    const method = klass.methods.get(name) as ClosureValue | null;
    if (!method) {
      this.runtimeError(`Undefined property '${name}'.`);
      return false;
    }
  
    const bound = newBoundMethod(this.peek(0) as InstanceValue, method);
    this.stack.pop();
    this.stack.push(bound);
    return true;
  }

  private captureUpvalue(stackIndex: number): ObjUpvalue {
    let prevUpvalue: ObjUpvalue | null = null;
    let upvalue = this.openUpvalues;
    while (upvalue !== null && upvalue.stackIndex > stackIndex) {
      prevUpvalue = upvalue;
      upvalue = upvalue.next;
    }

    if (upvalue !== null && upvalue.stackIndex === stackIndex) {
      return upvalue;
    }
    const createdUpvalue: ObjUpvalue = { stackIndex, closed: nilValue, next: upvalue };
    if (prevUpvalue === null) {
      this.openUpvalues = createdUpvalue;
    } else {
      prevUpvalue.next = createdUpvalue;
    }

    return createdUpvalue;
  }

  private closeUpvalues(last: Index): void {
    while (this.openUpvalues !== null && this.openUpvalues.stackIndex >= last) {
      const upvalue = this.openUpvalues;
      upvalue.closed = this.stack[upvalue.stackIndex]
      upvalue.stackIndex = -1;
      this.openUpvalues = upvalue.next;
    }
  }

  private defineMethod(name: string): void {
    const method = this.peek(0);
    const klass = this.peek(1) as ClassValue;
    klass.methods.set(name, method)
    this.stack.pop();
  }

  private readByte(frame: CallFrame): number {
    // There are no inlined functions in TS, if it's enough of a bottleneck we can hand-inline this later
    // Update: after running some tests, inlining  these seems to provide no/negligible speed boost (27.761 -> 27.188 secs)
    return frame.funCode[frame.ip++];
  }

  private readConstant(frame: CallFrame): Value {
    return frame.funConstants[this.readByte(frame)];
  }

  private readString(frame: CallFrame): string {
    return (this.readConstant(frame) as StringValue).value;
  }

  private binaryOp(operator: '+' | '-' | '*' | '/' | '>' | '<'): boolean {
    if (this.peek(0).type !== ValueType.NUMBER || this.peek(1).type !== ValueType.NUMBER) {
      this.runtimeError('Operands must be numbers.');
      return true;
    }
    const b = (this.stack.pop() as NumberValue).value;
    const a = (this.stack.pop() as NumberValue).value;
    switch(operator) {
      case '+': this.stack.push(numberValue(a + b)); return false;
      case '-': this.stack.push(numberValue(a - b)); return false;
      case '*': this.stack.push(numberValue(a * b)); return false;
      case '/': this.stack.push(numberValue(a / b)); return false;
      case '<': this.stack.push(boolValue(a < b)); return false;
      case '>': this.stack.push(boolValue(a > b)); return false;
      default: typeGuardSwitch(operator); return false;
    }
  }

  public run(): InterpretResult {
    let frame = this.frames[this.frames.length - 1];
    while (true) {
      // /* DEBUG */ this.printStack();
      // /* DEBUG */ disassembleInstruction(frame.funCode, frame.ip);
      let instruction: OpCode;
      switch (instruction = this.readByte(frame) as OpCode) {
        case OpCode.CONSTANT: {
          const constant = this.readConstant(frame);
          this.stack.push(constant);
          break;
        }
        case OpCode.NIL: this.stack.push(nilValue); break;
        case OpCode.TRUE: this.stack.push(boolValue(true)); break;
        case OpCode.FALSE: this.stack.push(boolValue(false)); break;
        case OpCode.POP: this.stack.pop(); break;
        case OpCode.GET_LOCAL: {
          const slot = this.readByte(frame);
          this.stack.push(this.stack[frame.firstSlotIndex + slot]); 
          break;
        }
        case OpCode.SET_LOCAL: {
          const slot = this.readByte(frame);
          this.stack[frame.firstSlotIndex + slot] = this.peek(0);
          break;
        }
        case OpCode.GET_GLOBAL: {
          const name = this.readString(frame);
          const value = this.globals.get(name);
          if (!value) {
            return 'INTERPRET_RUNTIME_ERROR';
          }
          this.stack.push(value);
          break;
        }
        case OpCode.DEFINE_GLOBAL: {
          const name = this.readString(frame);
          this.globals.set(name, this.peek(0));
          this.stack.pop();
          break;
        }
        case OpCode.SET_GLOBAL: {
          const name = this.readString(frame);
          if (!this.globals.has(name)) {
            this.runtimeError(`Undefined variable '${name}'.`);
            return 'INTERPRET_RUNTIME_ERROR';
          }
          this.globals.set(name, this.peek(0));
          break;
        }
        case OpCode.GET_UPVALUE: {
          const slot = this.readByte(frame);
          const upvalue = frame.closure.upvalues[slot];
          // Can't do the pointer magic in the book, so we have to do this instead :/
          this.stack.push(upvalue.stackIndex === -1 ? upvalue.closed :this.stack[upvalue.stackIndex]);
          break;
        }
        case OpCode.SET_UPVALUE: {
          const slot = this.readByte(frame);
          const upvalue = frame.closure.upvalues[slot];
          // Can't do the pointer magic in the book, so we have to do this instead :/
          if (upvalue.stackIndex === -1) {
            upvalue.closed = this.peek(0);
          } else {
            this.stack[upvalue.stackIndex] = this.peek(0);
          }
          break;
        }
        case OpCode.GET_PROPERTY: {
          if (this.peek(0).type !== ValueType.INSTANCE) {
            this.runtimeError('Only instances have properties.');
            return 'INTERPRET_RUNTIME_ERROR';
          }

          const instance = this.peek(0) as InstanceValue;
          const name =  this.readString(frame);
  
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
        case OpCode.SET_PROPERTY: {
          if (this.peek(1).type !== ValueType.INSTANCE) {
            this.runtimeError('Only instances have fields.');
            return 'INTERPRET_RUNTIME_ERROR';
          }
          const instance = this.peek(1) as InstanceValue;
          const name =  this.readString(frame);
          instance.fields.set(name, this.peek(0));
          const value = this.stack.pop()!;
          this.stack.pop();
          this.stack.push(value);
          break;
        }
        case OpCode.GET_SUPER: {
          const name = this.readString(frame);
          const superclass = this.stack.pop() as ClassValue;
  
          if (!this.bindMethod(superclass, name)) {
            return 'INTERPRET_RUNTIME_ERROR';
          }
          break;
        }
        case OpCode.EQUAL: {
          const b = this.stack.pop()!;
          const a = this.stack.pop()!;
          this.stack.push(boolValue(this.valuesEqual(a, b)));
          break;
        }
        case OpCode.GREATER:  if (this.binaryOp('>')) return 'INTERPRET_RUNTIME_ERROR'; break;
        case OpCode.LESS:     if (this.binaryOp('<')) return 'INTERPRET_RUNTIME_ERROR'; break;
        case OpCode.ADD: {
          if (this.peek(0).type === ValueType.STRING && this.peek(1).type === ValueType.STRING) {
            const b = (this.stack.pop() as StringValue).value;
            const a = (this.stack.pop() as StringValue).value;
            this.stack.push(stringValue(a + b));
          } else if (this.peek(0).type === ValueType.NUMBER && this.peek(1).type === ValueType.NUMBER) {
            const b = (this.stack.pop() as NumberValue).value;
            const a = (this.stack.pop() as NumberValue).value;
            this.stack.push(numberValue(a + b));
          } else {
            this.runtimeError('Operands must be two numbers or two strings.');
            return 'INTERPRET_RUNTIME_ERROR';
          }
          break;
        }
        case OpCode.SUBTRACT: if (this.binaryOp('-')) return 'INTERPRET_RUNTIME_ERROR'; break;
        case OpCode.MULTIPLY: if (this.binaryOp('*')) return 'INTERPRET_RUNTIME_ERROR'; break;
        case OpCode.DIVIDE:   if (this.binaryOp('/')) return 'INTERPRET_RUNTIME_ERROR'; break;
        case OpCode.NOT: this.stack.push(boolValue(this.isFalsey(this.stack.pop()!))); break;
        case OpCode.NEGATE: {
          if (this.peek(0).type !== ValueType.NUMBER) {
            this.runtimeError('Operand must be a number.');
            return 'INTERPRET_RUNTIME_ERROR';
          }
          this.stack.push(numberValue(-((this.stack.pop() as NumberValue).value)));
          break;
        }
        case OpCode.PRINT: {
          console.log(stringifyValue(this.stack.pop()!));
          break;
        }
        case OpCode.JUMP: {
          const offset = this.readByte(frame);
          frame.ip += offset;
          break;
        }
        case OpCode.JUMP_IF_FALSE: {
          const offset = this.readByte(frame);
          if (this.isFalsey(this.peek(0))) frame.ip += offset;
          break;
        }
        case OpCode.LOOP: {
          const offset = this.readByte(frame);
          frame.ip -= offset;
          break;
        }
        case OpCode.CALL: {
          const argCount = this.readByte(frame);
          if (!this.callValue(this.peek(argCount), argCount)) {
            return 'INTERPRET_RUNTIME_ERROR';
          }
          frame = this.frames[this.frames.length - 1];
          break;
        }
        case OpCode.INVOKE: {
          const method = this.readString(frame);
          const argCount = this.readByte(frame);
          if (!this.invoke(method, argCount)) {
            return 'INTERPRET_RUNTIME_ERROR';
          }
          frame = this.frames[this.frames.length - 1];
          break;
        }
        case OpCode.SUPER_INVOKE: {
          const method = this.readString(frame);
          const argCount = this.readByte(frame);
          const superclass = this.stack.pop() as ClassValue;
          if (!this.invokeFromClass(superclass, method, argCount)) {
            return 'INTERPRET_RUNTIME_ERROR';
          }
          frame = this.frames[this.frames.length - 1];
          break;
        }
        case OpCode.CLOSURE: {
          const fun = this.readConstant(frame) as FunValue;
          const closure = newClosure(fun);
          this.stack.push(closure);
          for (let i = 0; i < closure.upvalueCount; i++) {
            const isLocal = this.readByte(frame);
            const index = this.readByte(frame);
            if (isLocal) {
              closure.upvalues[i] = this.captureUpvalue(frame.firstSlotIndex + index);
            } else {
              closure.upvalues[i] = frame.closure.upvalues[index];
            }
          }
          break;
        }
        case OpCode.CLOSE_UPVALUE: {
          this.closeUpvalues(this.stack.length - 1);
          this.stack.pop();
          break;
        }
        case OpCode.RETURN: {
          const result = this.stack.pop()!;
          this.closeUpvalues(frame.firstSlotIndex);
          this.frames.pop();
          if (this.frames.length === 0) {
            this.stack.pop();
            return 'INTERPRET_OK';
          }

          this.stack.length = frame.firstSlotIndex;
          this.stack.push(result);
          frame = this.frames[this.frames.length- 1];
          break;
        }
        case OpCode.CLASS: this.stack.push(newClass(this.readString(frame))); break;
        case OpCode.INHERIT: {
          const superclass = this.peek(1);
          if (superclass.type !== ValueType.CLASS) {
            this.runtimeError('Superclass must be a class.');
            return 'INTERPRET_RUNTIME_ERROR';
          }

          const subclass = this.peek(0) as ClassValue;
          subclass.methods = new Map(superclass.methods); // Note: this runs before subclass' own methods have been attached yet
          this.stack.pop(); // Subclass.
          break;
        }
        case OpCode.METHOD: this.defineMethod(this.readString(frame)); break;
        default: {
          typeGuardSwitch(instruction);
        }
      }
    }
  }

  private resetStack(): void {
    this.stack.length = 0;
  }

  private printStack(): void {
    let out = '          ';
    for (let slot = 0; slot < this.stack.length; slot++) {
      out += `[ ${stringifyValue(this.stack[slot])} ]`;
    }
    console.log(out);
  }

  public runtimeError(message: string): void {
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
  public isFalsey(value: Value): boolean {
    return value === nilValue || (value.type === ValueType.BOOL && !value.value);
  }

  public valuesEqual(a: Value, b: Value): boolean {
    if (a.type !== b.type) return false;
    if ('value' in a && 'value' in b) {
      if (Number.isNaN(a.value) && Number.isNaN(b.value)) return true;
      return a.value === b.value;
    }
    return a === b; // Function/object-y values must be equal by reference? IDR what the exact semantics are here, I should probably go back and check
  }

  public isCallable(value: Value): boolean {
    switch(value.type) {
      case ValueType.CLASS:
      case ValueType.CLOSURE:
      case ValueType.BOUND_METHOD:
      case ValueType.NATIVE_FUN: return true;
      default: return false;
    }
  }
}