import { RuntimeError } from './Errors';
export class Resolver {
    interpreter;
    runtimeError;
    currentClass = 'NONE';
    currentFunction = 'NONE';
    scopes = [];
    constructor(interpreter, runtimeError) {
        this.interpreter = interpreter;
        this.runtimeError = runtimeError;
    }
    visitBlockStmt(stmt) {
        this.beginScope();
        this.resolveStmts(stmt.statements);
        this.endScope();
    }
    visitClassStmt(stmt) {
        const enclosingClass = this.currentClass;
        this.currentClass = 'CLASS';
        this.declare(stmt.name);
        this.define(stmt.name);
        if (stmt.superclass !== null) {
            if (stmt.name.lexeme === stmt.superclass.name.lexeme) {
                this.runtimeError(new RuntimeError(stmt.superclass.name, 'A class can\'t inherit from itself.'));
            }
            this.currentClass = 'SUBCLASS';
            this.resolveExpr(stmt.superclass);
            this.beginScope();
            this.peekScope()?.set('super', true);
        }
        this.beginScope();
        this.peekScope()?.set('this', true);
        for (const method of stmt.methods) {
            let declaration = 'METHOD';
            if (method.name.lexeme === 'init') {
                declaration = 'INITIALIZER';
            }
            this.resolveFunction(method, declaration);
        }
        this.endScope();
        if (stmt.superclass !== null)
            this.endScope();
        this.currentClass = enclosingClass;
    }
    visitExpressionStmt(stmt) {
        this.resolveExpr(stmt.expression);
    }
    visitFunctionStmt(stmt) {
        this.declare(stmt.name);
        this.define(stmt.name);
        this.resolveFunction(stmt, 'FUNCTION');
    }
    visitIfStmt(stmt) {
        this.resolveExpr(stmt.condition);
        this.resolveStmt(stmt.thenBranch);
        if (stmt.elseBranch !== null)
            this.resolveStmt(stmt.elseBranch);
    }
    visitPrintStmt(stmt) {
        this.resolveExpr(stmt.expression);
    }
    visitReturnStmt(stmt) {
        if (this.currentFunction === 'NONE') {
            this.runtimeError(new RuntimeError(stmt.keyword, 'Can\'t return from top-level code.'));
        }
        if (stmt.value !== null) {
            if (this.currentFunction === 'INITIALIZER') {
                this.runtimeError(new RuntimeError(stmt.keyword, 'Can\'t return a value from an initializer.'));
            }
            this.resolveExpr(stmt.value);
        }
    }
    visitVarStmt(stmt) {
        this.declare(stmt.name);
        if (stmt.initializer !== null) {
            this.resolveExpr(stmt.initializer);
        }
        this.define(stmt.name);
    }
    visitWhileStmt(stmt) {
        this.resolveExpr(stmt.condition);
        this.resolveStmt(stmt.body);
    }
    visitAssignExpr(expr) {
        this.resolveExpr(expr.value);
        this.resolveLocal(expr, expr.name);
    }
    visitBinaryExpr(expr) {
        this.resolveExpr(expr.left);
        this.resolveExpr(expr.right);
    }
    visitCallExpr(expr) {
        this.resolveExpr(expr.callee);
        for (const argument of expr.args) {
            this.resolveExpr(argument);
        }
    }
    visitGetExpr(expr) {
        this.resolveExpr(expr.object);
    }
    visitGroupingExpr(expr) {
        this.resolveExpr(expr.expression);
    }
    visitLiteralExpr() {
        return;
    }
    visitLogicalExpr(expr) {
        this.resolveExpr(expr.left);
        this.resolveExpr(expr.right);
    }
    visitSetExpr(expr) {
        this.resolveExpr(expr.value);
        this.resolveExpr(expr.object);
    }
    visitSuperExpr(expr) {
        if (this.currentClass === 'NONE') {
            this.runtimeError(new RuntimeError(expr.keyword, 'Can\'t use \'super\' outside of a class.'));
        }
        else if (this.currentClass !== 'SUBCLASS') {
            this.runtimeError(new RuntimeError(expr.keyword, 'Can\'t use \'super\' in a class with no superclass.'));
        }
        this.resolveLocal(expr, expr.keyword);
    }
    visitThisExpr(expr) {
        if (this.currentClass === 'NONE') {
            this.runtimeError(new RuntimeError(expr.keyword, 'Can\'t use \'this\' outside of a class.'));
            return;
        }
        this.resolveLocal(expr, expr.keyword);
    }
    visitVariableExpr(expr) {
        if (this.peekScope()?.get(expr.name.lexeme) === false) {
            this.runtimeError(new RuntimeError(expr.name, 'Can\'t read local variable in its own initializer.'));
        }
        this.resolveLocal(expr, expr.name);
    }
    visitUnaryExpr(expr) {
        this.resolveExpr(expr.right);
    }
    /* *** VISITOR HELPERS *** */
    resolveStmts(statements) {
        for (const statement of statements) {
            this.resolveStmt(statement);
        }
    }
    resolveStmt(stmt) {
        stmt.accept(this);
    }
    resolveExpr(expr) {
        expr.accept(this);
    }
    resolveFunction(func, type) {
        const enclosingFunction = this.currentFunction;
        this.currentFunction = type;
        this.beginScope();
        for (const param of func.params) {
            this.declare(param);
            this.define(param);
        }
        this.resolveStmts(func.body);
        this.endScope();
        this.currentFunction = enclosingFunction;
    }
    resolveLocal(expr, name) {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            if (this.scopes[i].has(name.lexeme)) {
                this.interpreter.resolve(expr, this.scopes.length - 1 - i);
                return;
            }
        }
    }
    /* *** PRIMITIVES *** */
    beginScope() {
        this.scopes.push(new Map());
    }
    endScope() {
        this.scopes.pop();
    }
    declare(name) {
        const scope = this.peekScope();
        if (!scope)
            return;
        if (scope.has(name.lexeme)) {
            this.runtimeError(new RuntimeError(name, 'Already a variable with this name in this scope.'));
        }
        scope.set(name.lexeme, false);
    }
    define(name) {
        this.peekScope()?.set(name.lexeme, true);
    }
    peekScope() {
        if (!this.scopes.length)
            return null;
        return this.scopes[this.scopes.length - 1];
    }
}
