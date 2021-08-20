import { Scanner } from './Scanner';
import { Chunk } from './Chunk';
import { CONSTS_MAX, CTokenType, LOCALS_MAX, OpCode, Precedence, typeGuardSwitch } from './common';
import { disassembleChunk } from './debug';
import { funValue, numberValue, stringValue } from './value';

class Compiler {
  public fun: FunValue = null!;
  public locals: Local[] = [];
  public upvalues: Upvalue[] = [];
  public scopeDepth = 0;

  public constructor(public type: CFunctionType, public enclosing: Compiler) {
    this.fun = null!; // has to do with garbage collection?
    this.fun = funValue();
  }
}

export class Parser {
  public hadError = false;
  public panicMode = false;
  public previous: CToken = null!; // Why do I even have strictNullChecks on
  public current: CToken = null!;
  private scanner: Scanner = null!;
  private currentCompiler: Compiler = null!;
  private currentClass: ClassCompiler | null = null;
  private rules: { [key in CTokenType]: ParseRule } = [] as any;

  public constructor() {
    this.rules[CTokenType.LEFT_PAREN]    = {prefix: this.grouping, infix: this.funCall, precedence: Precedence.CALL};
    this.rules[CTokenType.RIGHT_PAREN]   = {prefix: null,          infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.LEFT_BRACE]    = {prefix: null,          infix: null,          precedence: Precedence.NONE}; 
    this.rules[CTokenType.RIGHT_BRACE]   = {prefix: null,          infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.COMMA]         = {prefix: null,          infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.DOT]           = {prefix: null,          infix: this.dot,      precedence: Precedence.CALL};
    this.rules[CTokenType.MINUS]         = {prefix: this.unary,    infix: this.binary,   precedence: Precedence.TERM};
    this.rules[CTokenType.PLUS]          = {prefix: null,          infix: this.binary,   precedence: Precedence.TERM};
    this.rules[CTokenType.SEMICOLON]     = {prefix: null,          infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.SLASH]         = {prefix: null,          infix: this.binary,   precedence: Precedence.FACTOR};
    this.rules[CTokenType.STAR]          = {prefix: null,          infix: this.binary,   precedence: Precedence.FACTOR};
    this.rules[CTokenType.BANG]          = {prefix: this.unary,    infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.BANG_EQUAL]    = {prefix: null,          infix: this.binary,   precedence: Precedence.EQUALITY};
    this.rules[CTokenType.EQUAL]         = {prefix: null,          infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.EQUAL_EQUAL]   = {prefix: null,          infix: this.binary,   precedence: Precedence.EQUALITY};
    this.rules[CTokenType.GREATER]       = {prefix: null,          infix: this.binary,   precedence: Precedence.COMPARISON};
    this.rules[CTokenType.GREATER_EQUAL] = {prefix: null,          infix: this.binary,   precedence: Precedence.COMPARISON};
    this.rules[CTokenType.LESS]          = {prefix: null,          infix: this.binary,   precedence: Precedence.COMPARISON};
    this.rules[CTokenType.LESS_EQUAL]    = {prefix: null,          infix: this.binary,   precedence: Precedence.COMPARISON};
    this.rules[CTokenType.IDENTIFIER]    = {prefix: this.variable, infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.STRING]        = {prefix: this.string,   infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.NUMBER]        = {prefix: this.number,   infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.AND]           = {prefix: null,          infix: this.and,      precedence: Precedence.AND};
    this.rules[CTokenType.CLASS]         = {prefix: null,          infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.ELSE]          = {prefix: null,          infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.FALSE]         = {prefix: this.literal,  infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.FOR]           = {prefix: null,          infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.FUN]           = {prefix: null,          infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.IF]            = {prefix: null,          infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.NIL]           = {prefix: this.literal,  infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.OR]            = {prefix: null,          infix: this.or,       precedence: Precedence.OR};
    this.rules[CTokenType.PRINT]         = {prefix: null,          infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.RETURN]        = {prefix: null,          infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.SUPER]         = {prefix: this.super_,   infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.THIS]          = {prefix: this.this_,    infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.TRUE]          = {prefix: this.literal,  infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.VAR]           = {prefix: null,          infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.WHILE]         = {prefix: null,          infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.ERROR]         = {prefix: null,          infix: null,          precedence: Precedence.NONE};
    this.rules[CTokenType.EOF]           = {prefix: null,          infix: null,          precedence: Precedence.NONE};
  }

  public compile(source: string): FunValue | null {
    this.scanner = new Scanner(source);
    this.initCompiler('SCRIPT');
    this.advance();
  
    while (!this.match(CTokenType.EOF)) {
      this.declaration();
    }
  
    this.consume(CTokenType.EOF, 'Expect end of expression.');
    const func = this.endCompiler();
    return this.hadError ? null : func;
  }

  private emitByte(byte: number): void {
    this.currentChunk().write(byte, this.previous.line);
  }

  private emitBytes(...bytes: number[]): void {
    for (const byte of bytes) this.emitByte(byte);
  }

  private makeConstant(value: Value): number {
    const constant = this.currentChunk().addConstant(value);
    if (constant > CONSTS_MAX) {
      this.error('Too many constants in one chunk.');
      return 0;
    }
  
    return constant;
  }

  private initCompiler(type: CFunctionType): void {
    this.currentCompiler = new Compiler(type, this.currentCompiler);

    if (type !== 'SCRIPT') {
      this.currentCompiler.fun.name = this.previous.lexeme;
    }

    let firstSlotName: CToken;
    if (type === 'SCRIPT') {
      firstSlotName = this.syntheticToken('script');
    } else if (type === 'FUNCTION') {
      firstSlotName = this.previous;
    } else if (type === 'METHOD' || type === 'INITIALIZER') {
      firstSlotName = this.syntheticToken('this');
    } else {
      firstSlotName = typeGuardSwitch(type)!;
    }

    this.currentCompiler.locals.push({
      depth: 0,
      name: firstSlotName,
      isCaptured: false,
    });
  }

  private endCompiler(): FunValue {
    this.emitReturn();

    const func = this.currentCompiler.fun;

    // /* DEBUG */ if (!this.hadError) disassembleChunk(this.currentChunk(), func.name || '<script>');

    this.currentCompiler = this.currentCompiler.enclosing;

    return func;
  }

  private expression(): void {
    this.parsePrecedence(Precedence.ASSIGNMENT);
  }

  private block(): void {
    while (!this.check(CTokenType.RIGHT_BRACE) && !this.check(CTokenType.EOF)) {
      this.declaration();
    }
  
    this.consume(CTokenType.RIGHT_BRACE, 'Expect \'}\' after block.');
  }

  private fun(type: CFunctionType): void {
    this.initCompiler(type);
    const funCompiler = this.currentCompiler;
    this.beginScope(); 

    this.consume(CTokenType.LEFT_PAREN, 'Expect \'(\' after function name.');
    if (!this.check(CTokenType.RIGHT_PAREN)) {
      do {
        this.currentCompiler.fun.arity++;
        if (this.currentCompiler.fun.arity > 255) {
          this.errorAtCurrent('Can\'t have more than 255 parameters.');
        }
        const constant = this.parseVariable('Expect parameter name.');
        this.defineVariable(constant);
      } while (this.match(CTokenType.COMMA));
    }
    this.consume(CTokenType.RIGHT_PAREN, 'Expect \')\' after parameters.');
    this.consume(CTokenType.LEFT_BRACE, 'Expect \'{\' before function body.');
    this.block();

    const fun = this.endCompiler();
    this.emitBytes(OpCode.CLOSURE, this.makeConstant(fun));

    for (let i = 0; i < fun.upvalueCount; i++) {
      this.emitByte(funCompiler.upvalues[i].isLocal ? 1 : 0);
      this.emitByte(funCompiler.upvalues[i].index);
    }
  }

  private method(): void {
    this.consume(CTokenType.IDENTIFIER, 'Expect method name.');
    const constant = this.identifierConstant(this.previous);
    let type: CFunctionType = 'METHOD';
    if (this.previous.lexeme === 'init') {
      type = 'INITIALIZER';
    }
    this.fun(type);
    this.emitBytes(OpCode.METHOD, constant);
  }

  private classDeclaration(): void {
    this.consume(CTokenType.IDENTIFIER, 'Expect class name.');
    const nameConstant = this.identifierConstant(this.previous);
    const className = this.previous;
    this.declareVariable();
  
    this.emitBytes(OpCode.CLASS, nameConstant);
    this.defineVariable(nameConstant);

    const classCompiler: ClassCompiler = { enclosing: this.currentClass, hasSuperclass: false };
    this.currentClass = classCompiler;

    if (this.match(CTokenType.LESS)) {
      this.consume(CTokenType.IDENTIFIER, 'Expect superclass name.');
      this.variable(false);
      if (className.lexeme === this.previous.lexeme) {
        this.error('A class can\'t inherit from itself.');
      }
      this.beginScope();
      this.addLocal(this.syntheticToken('super'));
      this.defineVariable(0);
      this.namedVariable(className, false);
      this.emitByte(OpCode.INHERIT);
      classCompiler.hasSuperclass = true;
    }

    this.namedVariable(className, false);
    this.consume(CTokenType.LEFT_BRACE, 'Expect \'{\' before class body.');
    while (!this.check(CTokenType.RIGHT_BRACE) && !this.check(CTokenType.EOF)) {
      this.method();
    }
    this.consume(CTokenType.RIGHT_BRACE, 'Expect \'}\' after class body.');
    this.emitByte(OpCode.POP);

    if (classCompiler.hasSuperclass) {
      this.endScope();
    }

    this.currentClass = this.currentClass.enclosing;
  }

  private funDeclaration(): void {
    const global = this.parseVariable('Expect function name.');
    this.markInitialized();
    this.fun('FUNCTION');
    this.defineVariable(global);
  }

  private varDeclaration(): void {
    const global = this.parseVariable('Expect variable name.');
  
    if (this.match(CTokenType.EQUAL)) {
      this.expression();
    } else {
      this.emitByte(OpCode.NIL);
    }
    this.consume(CTokenType.SEMICOLON, 'Expect \';\' after variable declaration.');
  
    this.defineVariable(global);
  }

  private expressionStatement(): void {
    this.expression();
    this.consume(CTokenType.SEMICOLON, 'Expect \';\' after expression.');
    this.emitByte(OpCode.POP);
  }

  private forStatement(): void {
    this.beginScope();
    this.consume(CTokenType.LEFT_PAREN, 'Expect \'(\' after \'for\'.');
    if (this.match(CTokenType.SEMICOLON)) {
      // No initializer.
    } else if (this.match(CTokenType.VAR)) {
      this.varDeclaration();
    } else {
      this.expressionStatement();
    }
  
    let loopStart = this.currentChunk().code.length;
    let exitJump = -1;
    if (!this.match(CTokenType.SEMICOLON)) {
      this.expression();
      this.consume(CTokenType.SEMICOLON, 'Expect \';\' after loop condition.');

      // Jump out of the loop if the condition is false.
      exitJump = this.emitJump(OpCode.JUMP_IF_FALSE);
      this.emitByte(OpCode.POP); // Condition.
    }

    // Increment part, which is textually before the statement but runs after it, involves exactly aaaa GOTOs
    if (!this.match(CTokenType.RIGHT_PAREN)) {
      const bodyJump = this.emitJump(OpCode.JUMP);
      const incrementStart = this.currentChunk().code.length;
      this.expression();
      this.emitByte(OpCode.POP);
      this.consume(CTokenType.RIGHT_PAREN, 'Expect \')\' after for clauses.');
  
      this.emitLoop(loopStart);
      loopStart = incrementStart;
      this.patchJump(bodyJump);
    }
  
    this.statement();
    this.emitLoop(loopStart);

    if (exitJump !== -1) {
      this.patchJump(exitJump);
      this.emitByte(OpCode.POP); // Condition.
    }

    this.endScope();
  }

  private ifStatement(): void {
    this.consume(CTokenType.LEFT_PAREN, 'Expect \'(\' after \'if\'.');
    this.expression();
    this.consume(CTokenType.RIGHT_PAREN, 'Expect \')\' after condition.'); 
  
    const thenJump = this.emitJump(OpCode.JUMP_IF_FALSE);
    this.emitByte(OpCode.POP);
    this.statement();

    const elseJump = this.emitJump(OpCode.JUMP);
  
    this.patchJump(thenJump);
    this.emitByte(OpCode.POP);

    if (this.match(CTokenType.ELSE)) this.statement();
    this.patchJump(elseJump);
  }

  private printStatement(): void {
    this.expression();
    this.consume(CTokenType.SEMICOLON, 'Expect \';\' after value.');
    this.emitByte(OpCode.PRINT);
  }

  private returnStatement(): void {
    if (this.currentCompiler.type === 'SCRIPT') {
      this.error('Can\'t return from top-level code.');
    }
    if (this.match(CTokenType.SEMICOLON)) {
      this.emitReturn();
    } else {
      if (this.currentCompiler.type === 'INITIALIZER') {
        this.error('Can\'t return a value from an initializer.');
      }
      this.expression();
      this.consume(CTokenType.SEMICOLON, 'Expect \';\' after return value.');
      this.emitByte(OpCode.RETURN);
    }
  }

  private whileStatement(): void {
    const loopStart = this.currentChunk().code.length;
    this.consume(CTokenType.LEFT_PAREN, 'Expect \'(\' after \'while\'.');
    this.expression();
    this.consume(CTokenType.RIGHT_PAREN, 'Expect \')\' after condition.');
  
    const exitJump = this.emitJump(OpCode.JUMP_IF_FALSE);
    this.emitByte(OpCode.POP);
    this.statement();
    this.emitLoop(loopStart);
  
    this.patchJump(exitJump);
    this.emitByte(OpCode.POP);
  }

  private declaration(): void {
    if (this.match(CTokenType.CLASS)) {
      this.classDeclaration();
    } else if (this.match(CTokenType.FUN)) {
      this.funDeclaration();
    } else if (this.match(CTokenType.VAR)) {
      this.varDeclaration();
    } else {
      this.statement();
    }

    if (this.panicMode) this.synchronize();
  }

  private statement(): void {
    if (this.match(CTokenType.PRINT)) {
      this.printStatement();
    } else if (this.match(CTokenType.FOR)) {
      this.forStatement();
    } else if (this.match(CTokenType.IF)) {
      this.ifStatement();
    } else if (this.match(CTokenType.RETURN)) {
      this.returnStatement();
    } else if (this.match(CTokenType.WHILE)) {
      this.whileStatement();
    } else if (this.match(CTokenType.LEFT_BRACE)) {
      this.beginScope();
      this.block();
      this.endScope();
    } else {
      this.expressionStatement();
    }
  }

  private currentChunk(): Chunk {
    return this.currentCompiler.fun.chunk;
  }

  private parsePrecedence(precedence: Precedence): void {
    this.advance();
    const prefixRule = this.rules[this.previous.type].prefix;
    if (prefixRule === null) {
      this.error('Expect expression.');
      return;
    }

    const canAssign = precedence <= Precedence.ASSIGNMENT;
    prefixRule(canAssign);

    while (precedence <= this.rules[this.current.type].precedence) {
      this.advance();
      const infixRule = this.rules[this.previous.type].infix;
      infixRule!(canAssign); /* eslint-disable-line @typescript-eslint/no-non-null-assertion */
    }

    if (canAssign && this.match(CTokenType.EQUAL)) {
      this.error('Invalid assignment target.');
    }
  }

  private identifierConstant(name: CToken): Index {
    return this.makeConstant(stringValue(name.lexeme));
  }

  private addLocal(name: CToken): void {
    if (this.currentCompiler.locals.length === LOCALS_MAX) {
      this.error('Too many local variables in function.');
      return;
    }
  
    this.currentCompiler.locals.push({ name, depth: -1, isCaptured: false });
  }

  private declareVariable(): void {
    if (this.currentCompiler.scopeDepth === 0) return;
  
    const name = this.previous;

    for (let i = this.currentCompiler.locals.length - 1; i >= 0; i--) {
      const local = this.currentCompiler.locals[i];
      if (local.depth !== -1 && local.depth < this.currentCompiler.scopeDepth) {
        break; 
      }
  
      if (name.lexeme === local.name.lexeme) {
        this.error('Already a variable with this name in this scope.');
      }
    }

    this.addLocal(name);
  }

  private parseVariable(errorMessage: string): Index {
    this.consume(CTokenType.IDENTIFIER, errorMessage);

    this.declareVariable();
    if (this.currentCompiler.scopeDepth > 0) return 0;

    return this.identifierConstant(this.previous);
  }

  private markInitialized(): void {
    if (this.currentCompiler.scopeDepth === 0) return;
    this.currentCompiler.locals[this.currentCompiler.locals.length- 1].depth = this.currentCompiler.scopeDepth;
  }

  private defineVariable(global: number): void {
    if (this.currentCompiler.scopeDepth > 0) {
      this.markInitialized();
      return;
    }
    this.emitBytes(OpCode.DEFINE_GLOBAL, global);
  }

  private argumentList(): number {
    let argCount = 0;
    if (!this.check(CTokenType.RIGHT_PAREN)) {
      do {
        this.expression();
        if (argCount === 255) {
          this.error('Can\'t have more than 255 arguments.');
        }
        argCount++;
      } while (this.match(CTokenType.COMMA));
    }
    this.consume(CTokenType.RIGHT_PAREN, 'Expect \')\' after arguments.');
    return argCount;
  }

  private namedVariable(name: CToken, canAssign: boolean): void {
    let getOp: OpCode, setOp: OpCode;
    let arg = this.resolveLocal(this.currentCompiler, name);
    if (arg !== -1) {
      getOp = OpCode.GET_LOCAL;
      setOp = OpCode.SET_LOCAL;
    } else if ((arg = this.resolveUpvalue(this.currentCompiler, name)) !== -1) {
      getOp = OpCode.GET_UPVALUE;
      setOp = OpCode.SET_UPVALUE;
    } else {
      arg = this.identifierConstant(name);
      getOp = OpCode.GET_GLOBAL;
      setOp = OpCode.SET_GLOBAL;
    }
    if (canAssign && this.match(CTokenType.EQUAL)) {
      this.expression();
      this.emitBytes(setOp, arg);
    } else {
      this.emitBytes(getOp, arg);
    }
  }

  private resolveLocal(compiler: Compiler, name: CToken): number {
    for (let i = compiler.locals.length - 1; i >= 0; i--) {
      const local = compiler.locals[i];
      if (name.lexeme === local.name.lexeme) {
        if (local.depth === -1) {
          this.error('Can\'t read local variable in its own initializer.');
        }
        return i;
      }
    }
  
    return -1;
  }

  private addUpvalue(compiler: Compiler, index: number, isLocal: boolean): number {
    const upvalueCount = compiler.fun.upvalueCount;

    for (let i = 0; i < upvalueCount; i++) {
      const upvalue = compiler.upvalues[i];
      if (upvalue.index === index && upvalue.isLocal === isLocal) {
        return i;
      }
    }

    if (upvalueCount === LOCALS_MAX) {
      this.error('Too many closure variables in function.');
      return 0;
    }
  
    compiler.upvalues[upvalueCount] = { isLocal, index };
    return compiler.fun.upvalueCount++;
  }

  private resolveUpvalue(compiler: Compiler, name: CToken): number {
    if (compiler.enclosing === null) return -1;
  
    const local = this.resolveLocal(compiler.enclosing, name);
    if (local !== -1) {
      compiler.enclosing.locals[local].isCaptured = true;
      return this.addUpvalue(compiler, local, true);
    }

    const upvalue = this.resolveUpvalue(compiler.enclosing, name);
    if (upvalue !== -1) {
      return this.addUpvalue(compiler, upvalue, false);
    }
  
    return -1;
  }


  /* *** EMITTERS? *** */

  private emitReturn(): void {
    if (this.currentCompiler.type === 'INITIALIZER') {
      this.emitBytes(OpCode.GET_LOCAL, 0);
    } else {
      this.emitByte(OpCode.NIL);
    }
    this.emitByte(OpCode.RETURN);
  }

  private emitConstant(value: Value): void {
    this.emitBytes(OpCode.CONSTANT, this.makeConstant(value));
  }

  private patchJump(offset: number): void {
    // -1 to adjust for the bytecode for the jump offset itself.
    const jump = this.currentChunk().code.length - offset - 1;
  
    if (jump > Number.MAX_SAFE_INTEGER) {
      this.error('Too much code to jump over.');
    }
  
    this.currentChunk().code[offset] = jump;
  }

  private emitJump(instruction: number): Index {
    this.emitByte(instruction);
    this.emitByte(0xff);
    return this.currentChunk().code.length - 1;
  }

  private emitLoop(loopStart: number): void {
    this.emitByte(OpCode.LOOP);
  
    const offset = this.currentChunk().code.length - loopStart + 1;
    if (offset > Number.MAX_SAFE_INTEGER) this.error('Loop body too large.');
  
    this.emitByte(offset);
  }

  /* *** SCOPE *** */

  private beginScope(): void {
    this.currentCompiler.scopeDepth++;
  }

  private endScope(): void {
    this.currentCompiler.scopeDepth--;

    while (this.currentCompiler.locals.length > 0
      && this.currentCompiler.locals[this.currentCompiler.locals.length - 1].depth > this.currentCompiler.scopeDepth) {
      if (this.currentCompiler.locals[this.currentCompiler.locals.length - 1].isCaptured) {
        this.emitByte(OpCode.CLOSE_UPVALUE);
      } else {
        this.emitByte(OpCode.POP);
      }
      this.currentCompiler.locals.pop();
    }
  }


  /* *** EXPRESSION PARSERS *** */

  private binary: ParseFn = () => {
    const operatorType = this.previous.type;
    const rule = this.rules[operatorType];
    this.parsePrecedence(rule.precedence + 1);
  
    switch (operatorType) {
      case CTokenType.BANG_EQUAL:    this.emitBytes(OpCode.EQUAL, OpCode.NOT); break;
      case CTokenType.EQUAL_EQUAL:   this.emitByte(OpCode.EQUAL); break;
      case CTokenType.GREATER:       this.emitByte(OpCode.GREATER); break;
      case CTokenType.GREATER_EQUAL: this.emitBytes(OpCode.LESS, OpCode.NOT); break;
      case CTokenType.LESS:          this.emitByte(OpCode.LESS); break;
      case CTokenType.LESS_EQUAL:    this.emitBytes(OpCode.GREATER, OpCode.NOT); break;
      case CTokenType.PLUS:          this.emitByte(OpCode.ADD); break;
      case CTokenType.MINUS:         this.emitByte(OpCode.SUBTRACT); break;
      case CTokenType.STAR:          this.emitByte(OpCode.MULTIPLY); break;
      case CTokenType.SLASH:         this.emitByte(OpCode.DIVIDE); break;
      default: return; // Unreachable.
    }
  };

  private funCall: ParseFn = () => {
    const argCount = this.argumentList();
    this.emitBytes(OpCode.CALL, argCount);
  };

  private dot: ParseFn = (canAssign) => {
    this.consume(CTokenType.IDENTIFIER, 'Expect property name after \'.\'.');
    const name = this.identifierConstant(this.previous);

    if (canAssign && this.match(CTokenType.EQUAL)) {
      this.expression();
      this.emitBytes(OpCode.SET_PROPERTY, name);
    } else if (this.match(CTokenType.LEFT_PAREN)) {
      const argCount = this.argumentList();
      this.emitBytes(OpCode.INVOKE, name);
      this.emitByte(argCount);
    } else {
      this.emitBytes(OpCode.GET_PROPERTY, name);
    }
  };

  private literal: ParseFn = () =>  {
    switch (this.previous.type) {
      case CTokenType.FALSE: this.emitByte(OpCode.FALSE); break;
      case CTokenType.NIL: this.emitByte(OpCode.NIL); break;
      case CTokenType.TRUE: this.emitByte(OpCode.TRUE); break;
      default: return; // Unreachable.
    }
  };

  private grouping: ParseFn = () => {
    this.expression();
    this.consume(CTokenType.RIGHT_PAREN, 'Expect \')\' after expression.');
  };

  private number: ParseFn = () => {
    const value = Number(this.previous.lexeme);
    this.emitConstant(numberValue(value));
  };

  private string: ParseFn = () => {
    this.emitConstant(stringValue(this.previous.lexeme.substring(1, this.previous.lexeme.length - 1)));
  };

  private variable: ParseFn = (canAssign = false) => {
    this.namedVariable(this.previous, canAssign);
  };

  private syntheticToken(lexeme: string): CToken {
    return { type: CTokenType.IDENTIFIER, lexeme, line: this.current?.line ?? 0 };
  }

  private super_: ParseFn = () => {
    if (this.currentClass === null) {
      this.error('Can\'t use \'super\' outside of a class.');
    } else if (!this.currentClass.hasSuperclass) {
      this.error('Can\'t use \'super\' in a class with no superclass.');
    }
    this.consume(CTokenType.DOT, 'Expect \'.\' after \'super\'.');
    this.consume(CTokenType.IDENTIFIER, 'Expect superclass method name.');
    const name = this.identifierConstant(this.previous);

    this.namedVariable(this.syntheticToken('this'), false);
    if (this.match(CTokenType.LEFT_PAREN)) {
      const argCount = this.argumentList();
      this.namedVariable(this.syntheticToken('super'), false);
      this.emitBytes(OpCode.SUPER_INVOKE, name);
      this.emitByte(argCount);
    } else {
      this.namedVariable(this.syntheticToken('super'), false);
      this.emitBytes(OpCode.GET_SUPER, name);
    }
  };

  private this_: ParseFn = () => {
    if (this.currentClass === null) {
      this.error('Can\'t use \'this\' outside of a class.');
      return;
    }
    this.variable();
  };

  private unary: ParseFn = () => {
    const operatorType = this.previous.type;
  
    // Compile the operand.
    this.parsePrecedence(Precedence.UNARY);
  
    // Emit the operator instruction.
    switch (operatorType) {
      case CTokenType.BANG: this.emitByte(OpCode.NOT); break;
      case CTokenType.MINUS: this.emitByte(OpCode.NEGATE); break;
      default: return; // Unreachable.
    }
  };

  private and: ParseFn = () => {
    const endJump = this.emitJump(OpCode.JUMP_IF_FALSE);
  
    this.emitByte(OpCode.POP);
    this.parsePrecedence(Precedence.AND);
  
    this.patchJump(endJump);
  };

  private or: ParseFn = () => {
    const elseJump = this.emitJump(OpCode.JUMP_IF_FALSE);
    const endJump = this.emitJump(OpCode.JUMP);
  
    this.patchJump(elseJump);
    this.emitByte(OpCode.POP);
  
    this.parsePrecedence(Precedence.OR);
    this.patchJump(endJump);
  };


  /* *** PRIMITIVE OPERATIONS *** */

  private advance(): void {
    this.previous = this.current;

    while (true) {
      this.current = this.scanner.scanToken();
      if (this.current.type !== CTokenType.ERROR) break;

      this.errorAtCurrent(this.current.lexeme);
    }
  }

  private consume(type: CTokenType, message: string): void {
    if (this.current.type === type) {
      this.advance();
      return;
    }
  
    this.errorAtCurrent(message);
  }

  private check(type: CTokenType): boolean {
    return this.current.type === type;
  }

  private match(type: CTokenType): boolean {
    if (!this.check(type)) return false;
    this.advance();
    return true;
  }


  /* *** ERROR HANDLING *** */

  private errorAtCurrent(message: string): void {
    this.errorAt(this.current, message);
  }

  private errorAt(token: CToken, message: string): void {
    if (this.panicMode) return;
    this.panicMode = true;
    console.log(`[line ${token.line}] Error at ${token.type === CTokenType.EOF ? 'end' : `'${token.lexeme}'`}: ${message}`);
    this.hadError = true;
  }

  private error(message: string): void {
    this.errorAt(this.previous, message);
  }

  private synchronize(): void {
    this.panicMode = false;
  
    while (this.current.type !== CTokenType.EOF) {
      if (this.previous.type === CTokenType.SEMICOLON) return;
      switch (this.current.type) {
        case CTokenType.CLASS:
        case CTokenType.FUN:
        case CTokenType.VAR:
        case CTokenType.FOR:
        case CTokenType.IF:
        case CTokenType.WHILE:
        case CTokenType.PRINT:
        case CTokenType.RETURN:
          return;
  
        default:
           // Do nothing.
      }
  
      this.advance();
    }
  }
}