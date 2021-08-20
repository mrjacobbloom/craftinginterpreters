import { Environment } from './Environment';
import { Return, RuntimeError } from './Errors';
import { LoxFunction } from './LoxFunction';
import { LoxClass } from './LoxClass';
import { attachGlobals } from './Builtins';
export class Interpreter {
    runtimeError;
    globals = new Environment();
    environment = this.globals; // Is overwritten when things create new scopes
    locals = new WeakMap(); // The book uses a normal map, but doing similar things with the DOM over the years has me paranoid
    currentCallParen = null;
    constructor(runtimeError) {
        this.runtimeError = runtimeError;
        attachGlobals(this.globals);
    }
    interpret(statements) {
        try {
            for (const statement of statements) {
                this.execute(statement);
            }
        }
        catch (error) {
            if (error instanceof RuntimeError) {
                this.runtimeError(error);
            }
            else {
                console.error(error);
            }
        }
    }
    // Note: statements are executed, expressions are evaluated
    execute(stmt) {
        stmt.accept(this);
    }
    resolve(expr, depth) {
        this.locals.set(expr, depth);
    }
    evaluate(expr) {
        return expr.accept(this);
    }
    executeBlock(statements, environment) {
        const previous = this.environment;
        try {
            this.environment = environment;
            for (const statement of statements) {
                this.execute(statement);
            }
        }
        finally {
            this.environment = previous;
        }
    }
    lookUpVariable(name, expr) {
        const distance = this.locals.get(expr);
        if (distance !== null && distance !== undefined) { // "null" means it's a global, if our variable doesn't exist then it's undefined, and we can let the global environment throw the error
            return this.environment.getAt(distance, name.lexeme);
        }
        else {
            return this.globals.get(name);
        }
    }
    visitBlockStmt(stmt) {
        this.executeBlock(stmt.statements, new Environment(this.environment));
    }
    visitClassStmt(stmt) {
        let superclass = null;
        if (stmt.superclass !== null) {
            superclass = this.evaluate(stmt.superclass);
            if (!this.isClass(superclass)) {
                throw new RuntimeError(stmt.superclass.name, 'Superclass must be a class.');
            }
        }
        this.environment.define(stmt.name.lexeme, null);
        if (stmt.superclass !== null) {
            this.environment = new Environment(this.environment);
            this.environment.define('super', superclass);
        }
        const methods = new Map();
        for (const method of stmt.methods) {
            const func = new LoxFunction(method, this.environment, method.name.lexeme === 'init');
            methods.set(method.name.lexeme, func);
        }
        const klass = new LoxClass(stmt.name.lexeme, superclass, methods);
        if (superclass !== null) {
            this.environment = this.environment.enclosing;
        }
        this.environment.assign(stmt.name, klass);
    }
    visitAssignExpr(expr) {
        const value = this.evaluate(expr.value);
        const distance = this.locals.get(expr);
        if (distance !== null && distance !== undefined) { // See comment in lookupVariable
            this.environment.assignAt(distance, expr.name, value);
        }
        else {
            this.globals.assign(expr.name, value);
        }
        return value;
    }
    visitLiteralExpr(expr) {
        return expr.value;
    }
    visitLogicalExpr(expr) {
        const left = this.evaluate(expr.left);
        if (expr.operator.type === 'OR') {
            if (this.isTruthy(left))
                return left;
        }
        else {
            if (!this.isTruthy(left))
                return left;
        }
        return this.evaluate(expr.right);
    }
    visitSetExpr(expr) {
        const object = this.evaluate(expr.object);
        if (!this.isInstance(object)) {
            throw new RuntimeError(expr.name, 'Only instances have fields.');
        }
        const value = this.evaluate(expr.value);
        object.set(expr.name, value);
        return value;
    }
    visitSuperExpr(expr) {
        const distance = this.locals.get(expr);
        const superclass = this.environment.getAt(distance, 'super');
        const object = this.environment.getAt(distance - 1, 'this');
        const method = superclass.findMethod(expr.method.lexeme);
        if (method === null) {
            throw new RuntimeError(expr.method, `Undefined property '${expr.method.lexeme}'.`);
        }
        return method.bind(object);
    }
    visitThisExpr(expr) {
        return this.lookUpVariable(expr.keyword, expr);
    }
    visitGetExpr(expr) {
        const object = this.evaluate(expr.object);
        if (this.isInstance(object)) {
            return object.get(expr.name);
        }
        throw new RuntimeError(expr.name, 'Only instances have properties.');
    }
    visitGroupingExpr(expr) {
        return this.evaluate(expr.expression);
    }
    visitUnaryExpr(expr) {
        const right = this.evaluate(expr.right);
        switch (expr.operator.type) {
            case 'BANG':
                return !this.isTruthy(right);
            case 'MINUS':
                this.checkNumberOperand(expr.operator, right);
                return -Number(right);
        }
        // Unreachable.
        return null;
    }
    visitBinaryExpr(expr) {
        const left = this.evaluate(expr.left);
        const right = this.evaluate(expr.right);
        switch (expr.operator.type) {
            case 'GREATER':
                this.checkNumberOperands(expr.operator, left, right);
                return Number(left) > Number(right);
            case 'GREATER_EQUAL':
                this.checkNumberOperands(expr.operator, left, right);
                return Number(left) >= Number(right);
            case 'LESS':
                this.checkNumberOperands(expr.operator, left, right);
                return Number(left) < Number(right);
            case 'LESS_EQUAL':
                this.checkNumberOperands(expr.operator, left, right);
                return Number(left) <= Number(right);
            case 'BANG_EQUAL': return !this.isEqual(left, right);
            case 'EQUAL_EQUAL': return this.isEqual(left, right);
            case 'MINUS':
                this.checkNumberOperands(expr.operator, left, right);
                return Number(left) - Number(right);
            case 'PLUS':
                if (typeof left === 'number' && typeof right === 'number') {
                    return left + right;
                }
                if (typeof left === 'string' && typeof right === 'string') {
                    return left + right;
                }
                throw new RuntimeError(expr.operator, 'Operands must be two numbers or two strings.');
                break;
            case 'SLASH':
                this.checkNumberOperands(expr.operator, left, right);
                return Number(left) / Number(right);
            case 'STAR':
                this.checkNumberOperands(expr.operator, left, right);
                return Number(left) * Number(right);
        }
        // Unreachable.
        return null;
    }
    visitCallExpr(expr) {
        const enclosingCallParen = this.currentCallParen;
        this.currentCallParen = expr.paren;
        const callee = this.evaluate(expr.callee);
        const argValues = [];
        for (const argument of expr.args) {
            argValues.push(this.evaluate(argument));
        }
        if (!this.isCallable(callee)) {
            throw new RuntimeError(expr.paren, 'Can only call functions and classes.');
        }
        if (argValues.length !== callee.arity()) {
            throw new RuntimeError(expr.paren, `Expected ${callee.arity()} arguments but got ${argValues.length}.`);
        }
        const returnValue = callee.call(this, argValues);
        this.currentCallParen = enclosingCallParen;
        return returnValue;
    }
    visitVariableExpr(expr) {
        return this.lookUpVariable(expr.name, expr);
    }
    visitExpressionStmt(stmt) {
        this.evaluate(stmt.expression);
    }
    visitFunctionStmt(stmt) {
        const func = new LoxFunction(stmt, this.environment);
        this.environment.define(stmt.name.lexeme, func);
    }
    visitIfStmt(stmt) {
        if (this.isTruthy(this.evaluate(stmt.condition))) {
            this.execute(stmt.thenBranch);
        }
        else if (stmt.elseBranch !== null) {
            this.execute(stmt.elseBranch);
        }
    }
    visitPrintStmt(stmt) {
        const value = this.evaluate(stmt.expression);
        console.log(this.stringify(value));
    }
    visitReturnStmt(stmt) {
        let value = null;
        if (stmt.value !== null)
            value = this.evaluate(stmt.value);
        throw new Return(value); // oh god
    }
    visitVarStmt(stmt) {
        let value = null;
        if (stmt.initializer !== null) {
            value = this.evaluate(stmt.initializer);
        }
        this.environment.define(stmt.name.lexeme, value);
    }
    visitWhileStmt(stmt) {
        while (this.isTruthy(this.evaluate(stmt.condition))) {
            this.execute(stmt.body);
        }
    }
    stringify(literalValue) {
        if (literalValue === null)
            return 'nil';
        return literalValue.toString();
    }
    /* *** UTILITY TESTS *** */
    isEqual(a, b) {
        if (typeof a !== typeof b)
            return false;
        if (Number.isNaN(a) && Number.isNaN(b))
            return true;
        return a === b;
    }
    isTruthy(literalValue) {
        if (literalValue === null || literalValue === false)
            return false;
        return true;
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    isNonNullObject(literalValue) {
        return typeof literalValue === 'object' && literalValue !== null;
    }
    isCallable(literalValue) {
        return this.isNonNullObject(literalValue) && literalValue.isCallable === true;
    }
    isInstance(literalValue) {
        return this.isNonNullObject(literalValue) && literalValue.isLoxInstance === true;
    }
    isClass(literalValue) {
        return this.isNonNullObject(literalValue) && literalValue.isLoxClass === true;
    }
    assertArgumentType(value, type, message) {
        let valid = true;
        switch (type) {
            case 'string':
            case 'number':
            case 'boolean':
                valid = typeof value === type;
                break;
            case 'nil':
                valid = value === null;
                break;
            case 'function':
                valid = this.isCallable(value);
                break;
            case 'object':
                valid = this.isInstance(value);
                break;
        }
        if (!valid) {
            this.runtimeError(new RuntimeError(this.currentCallParen, message));
        }
    }
    checkNumberOperand(operator, operand) {
        if (typeof operand === 'number')
            return;
        throw new RuntimeError(operator, 'Operand must be a number.');
    }
    checkNumberOperands(operator, left, right) {
        if (typeof left === 'number' && typeof right === 'number')
            return;
        throw new RuntimeError(operator, 'Operands must be numbers.');
    }
}
