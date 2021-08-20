import { Scanner } from './Scanner';
import { CONSTS_MAX, LOCALS_MAX, typeGuardSwitch } from './common';
import { funValue, numberValue, stringValue } from './value';
class Compiler {
    type;
    enclosing;
    fun = null;
    locals = [];
    upvalues = [];
    scopeDepth = 0;
    constructor(type, enclosing) {
        this.type = type;
        this.enclosing = enclosing;
        this.fun = null; // has to do with garbage collection?
        this.fun = funValue();
    }
}
export class Parser {
    hadError = false;
    panicMode = false;
    previous = null; // Why do I even have strictNullChecks on
    current = null;
    scanner = null;
    currentCompiler = null;
    currentClass = null;
    rules = [];
    constructor() {
        this.rules[0 /* LEFT_PAREN */] = { prefix: this.grouping, infix: this.funCall, precedence: 9 /* CALL */ };
        this.rules[1 /* RIGHT_PAREN */] = { prefix: null, infix: null, precedence: 0 /* NONE */ };
        this.rules[2 /* LEFT_BRACE */] = { prefix: null, infix: null, precedence: 0 /* NONE */ };
        this.rules[3 /* RIGHT_BRACE */] = { prefix: null, infix: null, precedence: 0 /* NONE */ };
        this.rules[4 /* COMMA */] = { prefix: null, infix: null, precedence: 0 /* NONE */ };
        this.rules[5 /* DOT */] = { prefix: null, infix: this.dot, precedence: 9 /* CALL */ };
        this.rules[6 /* MINUS */] = { prefix: this.unary, infix: this.binary, precedence: 6 /* TERM */ };
        this.rules[7 /* PLUS */] = { prefix: null, infix: this.binary, precedence: 6 /* TERM */ };
        this.rules[8 /* SEMICOLON */] = { prefix: null, infix: null, precedence: 0 /* NONE */ };
        this.rules[9 /* SLASH */] = { prefix: null, infix: this.binary, precedence: 7 /* FACTOR */ };
        this.rules[10 /* STAR */] = { prefix: null, infix: this.binary, precedence: 7 /* FACTOR */ };
        this.rules[11 /* BANG */] = { prefix: this.unary, infix: null, precedence: 0 /* NONE */ };
        this.rules[12 /* BANG_EQUAL */] = { prefix: null, infix: this.binary, precedence: 4 /* EQUALITY */ };
        this.rules[13 /* EQUAL */] = { prefix: null, infix: null, precedence: 0 /* NONE */ };
        this.rules[14 /* EQUAL_EQUAL */] = { prefix: null, infix: this.binary, precedence: 4 /* EQUALITY */ };
        this.rules[15 /* GREATER */] = { prefix: null, infix: this.binary, precedence: 5 /* COMPARISON */ };
        this.rules[16 /* GREATER_EQUAL */] = { prefix: null, infix: this.binary, precedence: 5 /* COMPARISON */ };
        this.rules[17 /* LESS */] = { prefix: null, infix: this.binary, precedence: 5 /* COMPARISON */ };
        this.rules[18 /* LESS_EQUAL */] = { prefix: null, infix: this.binary, precedence: 5 /* COMPARISON */ };
        this.rules[19 /* IDENTIFIER */] = { prefix: this.variable, infix: null, precedence: 0 /* NONE */ };
        this.rules[20 /* STRING */] = { prefix: this.string, infix: null, precedence: 0 /* NONE */ };
        this.rules[21 /* NUMBER */] = { prefix: this.number, infix: null, precedence: 0 /* NONE */ };
        this.rules[22 /* AND */] = { prefix: null, infix: this.and, precedence: 3 /* AND */ };
        this.rules[23 /* CLASS */] = { prefix: null, infix: null, precedence: 0 /* NONE */ };
        this.rules[24 /* ELSE */] = { prefix: null, infix: null, precedence: 0 /* NONE */ };
        this.rules[25 /* FALSE */] = { prefix: this.literal, infix: null, precedence: 0 /* NONE */ };
        this.rules[26 /* FOR */] = { prefix: null, infix: null, precedence: 0 /* NONE */ };
        this.rules[27 /* FUN */] = { prefix: null, infix: null, precedence: 0 /* NONE */ };
        this.rules[28 /* IF */] = { prefix: null, infix: null, precedence: 0 /* NONE */ };
        this.rules[29 /* NIL */] = { prefix: this.literal, infix: null, precedence: 0 /* NONE */ };
        this.rules[30 /* OR */] = { prefix: null, infix: this.or, precedence: 2 /* OR */ };
        this.rules[31 /* PRINT */] = { prefix: null, infix: null, precedence: 0 /* NONE */ };
        this.rules[32 /* RETURN */] = { prefix: null, infix: null, precedence: 0 /* NONE */ };
        this.rules[33 /* SUPER */] = { prefix: this.super_, infix: null, precedence: 0 /* NONE */ };
        this.rules[34 /* THIS */] = { prefix: this.this_, infix: null, precedence: 0 /* NONE */ };
        this.rules[35 /* TRUE */] = { prefix: this.literal, infix: null, precedence: 0 /* NONE */ };
        this.rules[36 /* VAR */] = { prefix: null, infix: null, precedence: 0 /* NONE */ };
        this.rules[37 /* WHILE */] = { prefix: null, infix: null, precedence: 0 /* NONE */ };
        this.rules[38 /* ERROR */] = { prefix: null, infix: null, precedence: 0 /* NONE */ };
        this.rules[39 /* EOF */] = { prefix: null, infix: null, precedence: 0 /* NONE */ };
    }
    compile(source) {
        this.scanner = new Scanner(source);
        this.initCompiler('SCRIPT');
        this.advance();
        while (!this.match(39 /* EOF */)) {
            this.declaration();
        }
        this.consume(39 /* EOF */, 'Expect end of expression.');
        const func = this.endCompiler();
        return this.hadError ? null : func;
    }
    emitByte(byte) {
        this.currentChunk().write(byte, this.previous.line);
    }
    emitBytes(...bytes) {
        for (const byte of bytes)
            this.emitByte(byte);
    }
    makeConstant(value) {
        const constant = this.currentChunk().addConstant(value);
        if (constant > CONSTS_MAX) {
            this.error('Too many constants in one chunk.');
            return 0;
        }
        return constant;
    }
    initCompiler(type) {
        this.currentCompiler = new Compiler(type, this.currentCompiler);
        if (type !== 'SCRIPT') {
            this.currentCompiler.fun.name = this.previous.lexeme;
        }
        let firstSlotName;
        if (type === 'SCRIPT') {
            firstSlotName = this.syntheticToken('script');
        }
        else if (type === 'FUNCTION') {
            firstSlotName = this.previous;
        }
        else if (type === 'METHOD' || type === 'INITIALIZER') {
            firstSlotName = this.syntheticToken('this');
        }
        else {
            firstSlotName = typeGuardSwitch(type);
        }
        this.currentCompiler.locals.push({
            depth: 0,
            name: firstSlotName,
            isCaptured: false,
        });
    }
    endCompiler() {
        this.emitReturn();
        const func = this.currentCompiler.fun;
        // /* DEBUG */ if (!this.hadError) disassembleChunk(this.currentChunk(), func.name || '<script>');
        this.currentCompiler = this.currentCompiler.enclosing;
        return func;
    }
    expression() {
        this.parsePrecedence(1 /* ASSIGNMENT */);
    }
    block() {
        while (!this.check(3 /* RIGHT_BRACE */) && !this.check(39 /* EOF */)) {
            this.declaration();
        }
        this.consume(3 /* RIGHT_BRACE */, 'Expect \'}\' after block.');
    }
    fun(type) {
        this.initCompiler(type);
        const funCompiler = this.currentCompiler;
        this.beginScope();
        this.consume(0 /* LEFT_PAREN */, 'Expect \'(\' after function name.');
        if (!this.check(1 /* RIGHT_PAREN */)) {
            do {
                this.currentCompiler.fun.arity++;
                if (this.currentCompiler.fun.arity > 255) {
                    this.errorAtCurrent('Can\'t have more than 255 parameters.');
                }
                const constant = this.parseVariable('Expect parameter name.');
                this.defineVariable(constant);
            } while (this.match(4 /* COMMA */));
        }
        this.consume(1 /* RIGHT_PAREN */, 'Expect \')\' after parameters.');
        this.consume(2 /* LEFT_BRACE */, 'Expect \'{\' before function body.');
        this.block();
        const fun = this.endCompiler();
        this.emitBytes(31 /* CLOSURE */, this.makeConstant(fun));
        for (let i = 0; i < fun.upvalueCount; i++) {
            this.emitByte(funCompiler.upvalues[i].isLocal ? 1 : 0);
            this.emitByte(funCompiler.upvalues[i].index);
        }
    }
    method() {
        this.consume(19 /* IDENTIFIER */, 'Expect method name.');
        const constant = this.identifierConstant(this.previous);
        let type = 'METHOD';
        if (this.previous.lexeme === 'init') {
            type = 'INITIALIZER';
        }
        this.fun(type);
        this.emitBytes(36 /* METHOD */, constant);
    }
    classDeclaration() {
        this.consume(19 /* IDENTIFIER */, 'Expect class name.');
        const nameConstant = this.identifierConstant(this.previous);
        const className = this.previous;
        this.declareVariable();
        this.emitBytes(34 /* CLASS */, nameConstant);
        this.defineVariable(nameConstant);
        const classCompiler = { enclosing: this.currentClass, hasSuperclass: false };
        this.currentClass = classCompiler;
        if (this.match(17 /* LESS */)) {
            this.consume(19 /* IDENTIFIER */, 'Expect superclass name.');
            this.variable(false);
            if (className.lexeme === this.previous.lexeme) {
                this.error('A class can\'t inherit from itself.');
            }
            this.beginScope();
            this.addLocal(this.syntheticToken('super'));
            this.defineVariable(0);
            this.namedVariable(className, false);
            this.emitByte(35 /* INHERIT */);
            classCompiler.hasSuperclass = true;
        }
        this.namedVariable(className, false);
        this.consume(2 /* LEFT_BRACE */, 'Expect \'{\' before class body.');
        while (!this.check(3 /* RIGHT_BRACE */) && !this.check(39 /* EOF */)) {
            this.method();
        }
        this.consume(3 /* RIGHT_BRACE */, 'Expect \'}\' after class body.');
        this.emitByte(4 /* POP */);
        if (classCompiler.hasSuperclass) {
            this.endScope();
        }
        this.currentClass = this.currentClass.enclosing;
    }
    funDeclaration() {
        const global = this.parseVariable('Expect function name.');
        this.markInitialized();
        this.fun('FUNCTION');
        this.defineVariable(global);
    }
    varDeclaration() {
        const global = this.parseVariable('Expect variable name.');
        if (this.match(13 /* EQUAL */)) {
            this.expression();
        }
        else {
            this.emitByte(1 /* NIL */);
        }
        this.consume(8 /* SEMICOLON */, 'Expect \';\' after variable declaration.');
        this.defineVariable(global);
    }
    expressionStatement() {
        this.expression();
        this.consume(8 /* SEMICOLON */, 'Expect \';\' after expression.');
        this.emitByte(4 /* POP */);
    }
    forStatement() {
        this.beginScope();
        this.consume(0 /* LEFT_PAREN */, 'Expect \'(\' after \'for\'.');
        if (this.match(8 /* SEMICOLON */)) {
            // No initializer.
        }
        else if (this.match(36 /* VAR */)) {
            this.varDeclaration();
        }
        else {
            this.expressionStatement();
        }
        let loopStart = this.currentChunk().code.length;
        let exitJump = -1;
        if (!this.match(8 /* SEMICOLON */)) {
            this.expression();
            this.consume(8 /* SEMICOLON */, 'Expect \';\' after loop condition.');
            // Jump out of the loop if the condition is false.
            exitJump = this.emitJump(26 /* JUMP_IF_FALSE */);
            this.emitByte(4 /* POP */); // Condition.
        }
        // Increment part, which is textually before the statement but runs after it, involves exactly aaaa GOTOs
        if (!this.match(1 /* RIGHT_PAREN */)) {
            const bodyJump = this.emitJump(25 /* JUMP */);
            const incrementStart = this.currentChunk().code.length;
            this.expression();
            this.emitByte(4 /* POP */);
            this.consume(1 /* RIGHT_PAREN */, 'Expect \')\' after for clauses.');
            this.emitLoop(loopStart);
            loopStart = incrementStart;
            this.patchJump(bodyJump);
        }
        this.statement();
        this.emitLoop(loopStart);
        if (exitJump !== -1) {
            this.patchJump(exitJump);
            this.emitByte(4 /* POP */); // Condition.
        }
        this.endScope();
    }
    ifStatement() {
        this.consume(0 /* LEFT_PAREN */, 'Expect \'(\' after \'if\'.');
        this.expression();
        this.consume(1 /* RIGHT_PAREN */, 'Expect \')\' after condition.');
        const thenJump = this.emitJump(26 /* JUMP_IF_FALSE */);
        this.emitByte(4 /* POP */);
        this.statement();
        const elseJump = this.emitJump(25 /* JUMP */);
        this.patchJump(thenJump);
        this.emitByte(4 /* POP */);
        if (this.match(24 /* ELSE */))
            this.statement();
        this.patchJump(elseJump);
    }
    printStatement() {
        this.expression();
        this.consume(8 /* SEMICOLON */, 'Expect \';\' after value.');
        this.emitByte(24 /* PRINT */);
    }
    returnStatement() {
        if (this.currentCompiler.type === 'SCRIPT') {
            this.error('Can\'t return from top-level code.');
        }
        if (this.match(8 /* SEMICOLON */)) {
            this.emitReturn();
        }
        else {
            if (this.currentCompiler.type === 'INITIALIZER') {
                this.error('Can\'t return a value from an initializer.');
            }
            this.expression();
            this.consume(8 /* SEMICOLON */, 'Expect \';\' after return value.');
            this.emitByte(33 /* RETURN */);
        }
    }
    whileStatement() {
        const loopStart = this.currentChunk().code.length;
        this.consume(0 /* LEFT_PAREN */, 'Expect \'(\' after \'while\'.');
        this.expression();
        this.consume(1 /* RIGHT_PAREN */, 'Expect \')\' after condition.');
        const exitJump = this.emitJump(26 /* JUMP_IF_FALSE */);
        this.emitByte(4 /* POP */);
        this.statement();
        this.emitLoop(loopStart);
        this.patchJump(exitJump);
        this.emitByte(4 /* POP */);
    }
    declaration() {
        if (this.match(23 /* CLASS */)) {
            this.classDeclaration();
        }
        else if (this.match(27 /* FUN */)) {
            this.funDeclaration();
        }
        else if (this.match(36 /* VAR */)) {
            this.varDeclaration();
        }
        else {
            this.statement();
        }
        if (this.panicMode)
            this.synchronize();
    }
    statement() {
        if (this.match(31 /* PRINT */)) {
            this.printStatement();
        }
        else if (this.match(26 /* FOR */)) {
            this.forStatement();
        }
        else if (this.match(28 /* IF */)) {
            this.ifStatement();
        }
        else if (this.match(32 /* RETURN */)) {
            this.returnStatement();
        }
        else if (this.match(37 /* WHILE */)) {
            this.whileStatement();
        }
        else if (this.match(2 /* LEFT_BRACE */)) {
            this.beginScope();
            this.block();
            this.endScope();
        }
        else {
            this.expressionStatement();
        }
    }
    currentChunk() {
        return this.currentCompiler.fun.chunk;
    }
    parsePrecedence(precedence) {
        this.advance();
        const prefixRule = this.rules[this.previous.type].prefix;
        if (prefixRule === null) {
            this.error('Expect expression.');
            return;
        }
        const canAssign = precedence <= 1 /* ASSIGNMENT */;
        prefixRule(canAssign);
        while (precedence <= this.rules[this.current.type].precedence) {
            this.advance();
            const infixRule = this.rules[this.previous.type].infix;
            infixRule(canAssign); /* eslint-disable-line @typescript-eslint/no-non-null-assertion */
        }
        if (canAssign && this.match(13 /* EQUAL */)) {
            this.error('Invalid assignment target.');
        }
    }
    identifierConstant(name) {
        return this.makeConstant(stringValue(name.lexeme));
    }
    addLocal(name) {
        if (this.currentCompiler.locals.length === LOCALS_MAX) {
            this.error('Too many local variables in function.');
            return;
        }
        this.currentCompiler.locals.push({ name, depth: -1, isCaptured: false });
    }
    declareVariable() {
        if (this.currentCompiler.scopeDepth === 0)
            return;
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
    parseVariable(errorMessage) {
        this.consume(19 /* IDENTIFIER */, errorMessage);
        this.declareVariable();
        if (this.currentCompiler.scopeDepth > 0)
            return 0;
        return this.identifierConstant(this.previous);
    }
    markInitialized() {
        if (this.currentCompiler.scopeDepth === 0)
            return;
        this.currentCompiler.locals[this.currentCompiler.locals.length - 1].depth = this.currentCompiler.scopeDepth;
    }
    defineVariable(global) {
        if (this.currentCompiler.scopeDepth > 0) {
            this.markInitialized();
            return;
        }
        this.emitBytes(8 /* DEFINE_GLOBAL */, global);
    }
    argumentList() {
        let argCount = 0;
        if (!this.check(1 /* RIGHT_PAREN */)) {
            do {
                this.expression();
                if (argCount === 255) {
                    this.error('Can\'t have more than 255 arguments.');
                }
                argCount++;
            } while (this.match(4 /* COMMA */));
        }
        this.consume(1 /* RIGHT_PAREN */, 'Expect \')\' after arguments.');
        return argCount;
    }
    namedVariable(name, canAssign) {
        let getOp, setOp;
        let arg = this.resolveLocal(this.currentCompiler, name);
        if (arg !== -1) {
            getOp = 5 /* GET_LOCAL */;
            setOp = 6 /* SET_LOCAL */;
        }
        else if ((arg = this.resolveUpvalue(this.currentCompiler, name)) !== -1) {
            getOp = 10 /* GET_UPVALUE */;
            setOp = 11 /* SET_UPVALUE */;
        }
        else {
            arg = this.identifierConstant(name);
            getOp = 7 /* GET_GLOBAL */;
            setOp = 9 /* SET_GLOBAL */;
        }
        if (canAssign && this.match(13 /* EQUAL */)) {
            this.expression();
            this.emitBytes(setOp, arg);
        }
        else {
            this.emitBytes(getOp, arg);
        }
    }
    resolveLocal(compiler, name) {
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
    addUpvalue(compiler, index, isLocal) {
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
    resolveUpvalue(compiler, name) {
        if (compiler.enclosing === null)
            return -1;
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
    emitReturn() {
        if (this.currentCompiler.type === 'INITIALIZER') {
            this.emitBytes(5 /* GET_LOCAL */, 0);
        }
        else {
            this.emitByte(1 /* NIL */);
        }
        this.emitByte(33 /* RETURN */);
    }
    emitConstant(value) {
        this.emitBytes(0 /* CONSTANT */, this.makeConstant(value));
    }
    patchJump(offset) {
        // -1 to adjust for the bytecode for the jump offset itself.
        const jump = this.currentChunk().code.length - offset - 1;
        if (jump > Number.MAX_SAFE_INTEGER) {
            this.error('Too much code to jump over.');
        }
        this.currentChunk().code[offset] = jump;
    }
    emitJump(instruction) {
        this.emitByte(instruction);
        this.emitByte(0xff);
        return this.currentChunk().code.length - 1;
    }
    emitLoop(loopStart) {
        this.emitByte(27 /* LOOP */);
        const offset = this.currentChunk().code.length - loopStart + 1;
        if (offset > Number.MAX_SAFE_INTEGER)
            this.error('Loop body too large.');
        this.emitByte(offset);
    }
    /* *** SCOPE *** */
    beginScope() {
        this.currentCompiler.scopeDepth++;
    }
    endScope() {
        this.currentCompiler.scopeDepth--;
        while (this.currentCompiler.locals.length > 0
            && this.currentCompiler.locals[this.currentCompiler.locals.length - 1].depth > this.currentCompiler.scopeDepth) {
            if (this.currentCompiler.locals[this.currentCompiler.locals.length - 1].isCaptured) {
                this.emitByte(32 /* CLOSE_UPVALUE */);
            }
            else {
                this.emitByte(4 /* POP */);
            }
            this.currentCompiler.locals.pop();
        }
    }
    /* *** EXPRESSION PARSERS *** */
    binary = () => {
        const operatorType = this.previous.type;
        const rule = this.rules[operatorType];
        this.parsePrecedence(rule.precedence + 1);
        switch (operatorType) {
            case 12 /* BANG_EQUAL */:
                this.emitBytes(15 /* EQUAL */, 22 /* NOT */);
                break;
            case 14 /* EQUAL_EQUAL */:
                this.emitByte(15 /* EQUAL */);
                break;
            case 15 /* GREATER */:
                this.emitByte(16 /* GREATER */);
                break;
            case 16 /* GREATER_EQUAL */:
                this.emitBytes(17 /* LESS */, 22 /* NOT */);
                break;
            case 17 /* LESS */:
                this.emitByte(17 /* LESS */);
                break;
            case 18 /* LESS_EQUAL */:
                this.emitBytes(16 /* GREATER */, 22 /* NOT */);
                break;
            case 7 /* PLUS */:
                this.emitByte(18 /* ADD */);
                break;
            case 6 /* MINUS */:
                this.emitByte(19 /* SUBTRACT */);
                break;
            case 10 /* STAR */:
                this.emitByte(20 /* MULTIPLY */);
                break;
            case 9 /* SLASH */:
                this.emitByte(21 /* DIVIDE */);
                break;
            default: return; // Unreachable.
        }
    };
    funCall = () => {
        const argCount = this.argumentList();
        this.emitBytes(28 /* CALL */, argCount);
    };
    dot = (canAssign) => {
        this.consume(19 /* IDENTIFIER */, 'Expect property name after \'.\'.');
        const name = this.identifierConstant(this.previous);
        if (canAssign && this.match(13 /* EQUAL */)) {
            this.expression();
            this.emitBytes(13 /* SET_PROPERTY */, name);
        }
        else if (this.match(0 /* LEFT_PAREN */)) {
            const argCount = this.argumentList();
            this.emitBytes(29 /* INVOKE */, name);
            this.emitByte(argCount);
        }
        else {
            this.emitBytes(12 /* GET_PROPERTY */, name);
        }
    };
    literal = () => {
        switch (this.previous.type) {
            case 25 /* FALSE */:
                this.emitByte(3 /* FALSE */);
                break;
            case 29 /* NIL */:
                this.emitByte(1 /* NIL */);
                break;
            case 35 /* TRUE */:
                this.emitByte(2 /* TRUE */);
                break;
            default: return; // Unreachable.
        }
    };
    grouping = () => {
        this.expression();
        this.consume(1 /* RIGHT_PAREN */, 'Expect \')\' after expression.');
    };
    number = () => {
        const value = Number(this.previous.lexeme);
        this.emitConstant(numberValue(value));
    };
    string = () => {
        this.emitConstant(stringValue(this.previous.lexeme.substring(1, this.previous.lexeme.length - 1)));
    };
    variable = (canAssign = false) => {
        this.namedVariable(this.previous, canAssign);
    };
    syntheticToken(lexeme) {
        return { type: 19 /* IDENTIFIER */, lexeme, line: this.current?.line ?? 0 };
    }
    super_ = () => {
        if (this.currentClass === null) {
            this.error('Can\'t use \'super\' outside of a class.');
        }
        else if (!this.currentClass.hasSuperclass) {
            this.error('Can\'t use \'super\' in a class with no superclass.');
        }
        this.consume(5 /* DOT */, 'Expect \'.\' after \'super\'.');
        this.consume(19 /* IDENTIFIER */, 'Expect superclass method name.');
        const name = this.identifierConstant(this.previous);
        this.namedVariable(this.syntheticToken('this'), false);
        if (this.match(0 /* LEFT_PAREN */)) {
            const argCount = this.argumentList();
            this.namedVariable(this.syntheticToken('super'), false);
            this.emitBytes(30 /* SUPER_INVOKE */, name);
            this.emitByte(argCount);
        }
        else {
            this.namedVariable(this.syntheticToken('super'), false);
            this.emitBytes(14 /* GET_SUPER */, name);
        }
    };
    this_ = () => {
        if (this.currentClass === null) {
            this.error('Can\'t use \'this\' outside of a class.');
            return;
        }
        this.variable();
    };
    unary = () => {
        const operatorType = this.previous.type;
        // Compile the operand.
        this.parsePrecedence(8 /* UNARY */);
        // Emit the operator instruction.
        switch (operatorType) {
            case 11 /* BANG */:
                this.emitByte(22 /* NOT */);
                break;
            case 6 /* MINUS */:
                this.emitByte(23 /* NEGATE */);
                break;
            default: return; // Unreachable.
        }
    };
    and = () => {
        const endJump = this.emitJump(26 /* JUMP_IF_FALSE */);
        this.emitByte(4 /* POP */);
        this.parsePrecedence(3 /* AND */);
        this.patchJump(endJump);
    };
    or = () => {
        const elseJump = this.emitJump(26 /* JUMP_IF_FALSE */);
        const endJump = this.emitJump(25 /* JUMP */);
        this.patchJump(elseJump);
        this.emitByte(4 /* POP */);
        this.parsePrecedence(2 /* OR */);
        this.patchJump(endJump);
    };
    /* *** PRIMITIVE OPERATIONS *** */
    advance() {
        this.previous = this.current;
        while (true) {
            this.current = this.scanner.scanToken();
            if (this.current.type !== 38 /* ERROR */)
                break;
            this.errorAtCurrent(this.current.lexeme);
        }
    }
    consume(type, message) {
        if (this.current.type === type) {
            this.advance();
            return;
        }
        this.errorAtCurrent(message);
    }
    check(type) {
        return this.current.type === type;
    }
    match(type) {
        if (!this.check(type))
            return false;
        this.advance();
        return true;
    }
    /* *** ERROR HANDLING *** */
    errorAtCurrent(message) {
        this.errorAt(this.current, message);
    }
    errorAt(token, message) {
        if (this.panicMode)
            return;
        this.panicMode = true;
        console.log(`[line ${token.line}] Error at ${token.type === 39 /* EOF */ ? 'end' : `'${token.lexeme}'`}: ${message}`);
        this.hadError = true;
    }
    error(message) {
        this.errorAt(this.previous, message);
    }
    synchronize() {
        this.panicMode = false;
        while (this.current.type !== 39 /* EOF */) {
            if (this.previous.type === 8 /* SEMICOLON */)
                return;
            switch (this.current.type) {
                case 23 /* CLASS */:
                case 27 /* FUN */:
                case 36 /* VAR */:
                case 26 /* FOR */:
                case 28 /* IF */:
                case 37 /* WHILE */:
                case 31 /* PRINT */:
                case 32 /* RETURN */:
                    return;
                default:
                // Do nothing.
            }
            this.advance();
        }
    }
}
