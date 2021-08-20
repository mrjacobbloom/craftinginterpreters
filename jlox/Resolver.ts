import { Visitor, StmtT, ExprT, Stmt, Expr } from './AST';
import type { Interpreter } from './Interpreter';
import { RuntimeError } from './Errors';

export class Resolver implements Visitor<void> {
  private currentClass: ClassType = 'NONE';
  private currentFunction: FunctionType = 'NONE';
  private scopes: Map<string, boolean>[] = [];

  public constructor(private interpreter: Interpreter, private runtimeError: RuntimeErrorHandler) {}

  public visitBlockStmt(stmt: StmtT<'Block'>): void {
    this.beginScope();
    this.resolveStmts(stmt.statements);
    this.endScope();
  }

  public visitClassStmt(stmt: StmtT<'Class'>): void {
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
      let declaration: FunctionType = 'METHOD';
      if (method.name.lexeme === 'init') {
        declaration = 'INITIALIZER';
      }
      this.resolveFunction(method, declaration); 
    }

    this.endScope();
    if (stmt.superclass !== null) this.endScope();
    this.currentClass = enclosingClass;
  }

  public visitExpressionStmt(stmt: StmtT<'Expression'>): void {
    this.resolveExpr(stmt.expression);
  }

  public visitFunctionStmt(stmt: StmtT<'Function'>): void {
    this.declare(stmt.name);
    this.define(stmt.name);

    this.resolveFunction(stmt, 'FUNCTION');
  }

  public visitIfStmt(stmt: StmtT<'If'>): void {
    this.resolveExpr(stmt.condition);
    this.resolveStmt(stmt.thenBranch);
    if (stmt.elseBranch !== null) this.resolveStmt(stmt.elseBranch);
  }

  public visitPrintStmt(stmt: StmtT<'Print'>): void {
    this.resolveExpr(stmt.expression);
  }

  public visitReturnStmt(stmt: StmtT<'Return'>): void {
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

  public visitVarStmt(stmt: StmtT<'Var'>): void {
    this.declare(stmt.name);
    if (stmt.initializer !== null) {
      this.resolveExpr(stmt.initializer);
    }
    this.define(stmt.name);
  }

  public visitWhileStmt(stmt: StmtT<'While'>): void {
    this.resolveExpr(stmt.condition);
    this.resolveStmt(stmt.body);
  }

  public visitAssignExpr(expr: ExprT<'Assign'>): void {
    this.resolveExpr(expr.value);
    this.resolveLocal(expr, expr.name);
  }

  public visitBinaryExpr(expr: ExprT<'Binary'>): void {
    this.resolveExpr(expr.left);
    this.resolveExpr(expr.right);
  }

  public visitCallExpr(expr: ExprT<'Call'>): void {
    this.resolveExpr(expr.callee);

    for (const argument of expr.args) {
      this.resolveExpr(argument);
    }
  }

  public visitGetExpr(expr: ExprT<'Get'>): void {
    this.resolveExpr(expr.object);
  }

  public visitGroupingExpr(expr: ExprT<'Grouping'>): void {
    this.resolveExpr(expr.expression);
  }

  public visitLiteralExpr(): void {
    return;
  }

  public visitLogicalExpr(expr: ExprT<'Logical'>): void {
    this.resolveExpr(expr.left);
    this.resolveExpr(expr.right);
  }

  public visitSetExpr(expr: ExprT<'Set'>): void {
    this.resolveExpr(expr.value);
    this.resolveExpr(expr.object);
  }

  public visitSuperExpr(expr: ExprT<'Super'>): void {
    if (this.currentClass === 'NONE') {
      this.runtimeError(new RuntimeError(expr.keyword, 'Can\'t use \'super\' outside of a class.'));
    } else if (this.currentClass !== 'SUBCLASS') {
      this.runtimeError(new RuntimeError(expr.keyword, 'Can\'t use \'super\' in a class with no superclass.'));
    }

    this.resolveLocal(expr, expr.keyword);
  }

  public visitThisExpr(expr: ExprT<'This'>): void {
    if (this.currentClass === 'NONE') {
      this.runtimeError(new RuntimeError(expr.keyword, 'Can\'t use \'this\' outside of a class.'));
      return;
    }

    this.resolveLocal(expr, expr.keyword);
  }

  public visitVariableExpr(expr: ExprT<'Variable'>): void {
    if (this.peekScope()?.get(expr.name.lexeme) === false) {
      this.runtimeError(new RuntimeError(expr.name, 'Can\'t read local variable in its own initializer.'));
    }

    this.resolveLocal(expr, expr.name);
  }

  public visitUnaryExpr(expr: ExprT<'Unary'>): void {
    this.resolveExpr(expr.right);
  }

  /* *** VISITOR HELPERS *** */
  public resolveStmts(statements: Stmt[]): void {
    for (const statement of statements) {
      this.resolveStmt(statement);
    }
  }

  private resolveStmt(stmt: Stmt): void {
    stmt.accept(this);
  }

  private resolveExpr(expr: Expr): void {
    expr.accept(this);
  }

  private resolveFunction(func: StmtT<'Function'>, type: FunctionType): void {
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

  private resolveLocal(expr: Expr, name: Token): void {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (this.scopes[i].has(name.lexeme)) {
        this.interpreter.resolve(expr, this.scopes.length - 1 - i);
        return;
      }
    }
  }

  /* *** PRIMITIVES *** */
  private beginScope(): void {
    this.scopes.push(new Map());
  }

  private endScope(): void {
    this.scopes.pop();
  }

  private declare(name: Token): void {
    const scope = this.peekScope();
    if (!scope) return;

    if (scope.has(name.lexeme)) {
      this.runtimeError(new RuntimeError(name, 'Already a variable with this name in this scope.'));
    }
    scope.set(name.lexeme, false);
  }

  private define(name: Token): void {
    this.peekScope()?.set(name.lexeme, true);
  }

  private peekScope(): Map<string, boolean> | null {
    if (!this.scopes.length) return null;
    return this.scopes[this.scopes.length - 1];
  }
}