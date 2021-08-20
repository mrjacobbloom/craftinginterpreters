import type { Visitor, Stmt, Expr, ExprT, StmtT } from './AST';
import { Environment } from './Environment';
import { Return, RuntimeError } from './Errors';
import { LoxFunction } from './LoxFunction';
import { LoxClass } from './LoxClass';
import { LoxInstance } from './LoxInstance';
import { attachGlobals } from './Builtins';

export class Interpreter implements Visitor<LiteralType, void> {
  public globals = new Environment();
  private environment = this.globals; // Is overwritten when things create new scopes
  private locals: WeakMap<Expr, number | null> = new WeakMap(); // The book uses a normal map, but doing similar things with the DOM over the years has me paranoid
  private currentCallParen: Token | null = null;

  public constructor(private runtimeError: RuntimeErrorHandler) {
    attachGlobals(this.globals);
  }

  public interpret(statements: Stmt[]): void { 
    try {
      for (const statement of statements) {
        this.execute(statement);
      }
    } catch (error) {
      if (error instanceof RuntimeError) {
        this.runtimeError(error);
      } else {
        console.error(error);
      }
    }
  }

  // Note: statements are executed, expressions are evaluated
  private execute(stmt: Stmt): void {
    stmt.accept(this);
  }

  public resolve(expr: Expr, depth: number): void {
    this.locals.set(expr, depth);
  }

  private evaluate(expr: Expr): LiteralType {
    return expr.accept(this);
  }

  public executeBlock(statements: Stmt[], environment: Environment): void {
    const previous = this.environment;
    try {
      this.environment = environment;

      for (const statement of statements) {
        this.execute(statement);
      }
    } finally {
      this.environment = previous;
    }
  }

  private lookUpVariable(name: Token, expr: Expr): LiteralType {
    const distance = this.locals.get(expr);
    if (distance !== null && distance !== undefined) { // "null" means it's a global, if our variable doesn't exist then it's undefined, and we can let the global environment throw the error
      return this.environment.getAt(distance, name.lexeme);
    } else {
      return this.globals.get(name);
    }
  }

  public visitBlockStmt(stmt: StmtT<'Block'>): void {
    this.executeBlock(stmt.statements, new Environment(this.environment));
  }

  public visitClassStmt(stmt: StmtT<'Class'>): void {
    let superclass: LiteralType = null;
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
    const methods = new Map<string, LoxFunction>();
    for (const method of stmt.methods) {
      const func = new LoxFunction(method, this.environment, method.name.lexeme === 'init');
      methods.set(method.name.lexeme, func);
    }

    const klass = new LoxClass(stmt.name.lexeme, superclass, methods);

    if (superclass !== null) {
      this.environment = this.environment.enclosing!;
    }

    this.environment.assign(stmt.name, klass);
  }

  public visitAssignExpr(expr: ExprT<'Assign'>): LiteralType {
    const value = this.evaluate(expr.value);
    const distance = this.locals.get(expr);
    if (distance !== null && distance !== undefined) { // See comment in lookupVariable
      this.environment.assignAt(distance, expr.name, value);
    } else {
      this.globals.assign(expr.name, value);
    }
    return value;
  }

  public visitLiteralExpr(expr: ExprT<'Literal'>): LiteralType {
    return expr.value;
  }

  public visitLogicalExpr(expr: ExprT<'Logical'>): LiteralType {
    const left = this.evaluate(expr.left);

    if (expr.operator.type === 'OR') {
      if (this.isTruthy(left)) return left;
    } else {
      if (!this.isTruthy(left)) return left;
    }

    return this.evaluate(expr.right);
  }

  public visitSetExpr(expr: ExprT<'Set'>): LiteralType {
    const object = this.evaluate(expr.object);

    if (!this.isInstance(object)) { 
      throw new RuntimeError(expr.name, 'Only instances have fields.');
    }

    const value = this.evaluate(expr.value);
    object.set(expr.name, value);
    return value;
  }

  public visitSuperExpr(expr: ExprT<'Super'>): LiteralType {
    const distance = this.locals.get(expr)!;
    const superclass = this.environment.getAt(distance, 'super') as LoxClass;

    const object = this.environment.getAt(distance - 1, 'this') as LoxInstance;

    const method = superclass.findMethod(expr.method.lexeme);
    if (method === null) {
      throw new RuntimeError(expr.method, `Undefined property '${expr.method.lexeme}'.`);
    }

    return method.bind(object);
  }

  public visitThisExpr(expr: ExprT<'This'>): LiteralType {
    return this.lookUpVariable(expr.keyword, expr);
  }

  public visitGetExpr(expr: ExprT<'Get'>): LiteralType {
    const object = this.evaluate(expr.object);
    if (this.isInstance(object)) {
      return object.get(expr.name);
    }

    throw new RuntimeError(expr.name, 'Only instances have properties.');
  }

  public visitGroupingExpr(expr: ExprT<'Grouping'>): LiteralType {
    return this.evaluate(expr.expression);
  }

  public visitUnaryExpr(expr: ExprT<'Unary'>): LiteralType {
    const right = this.evaluate(expr.right);

    switch (expr.operator.type) {
      case 'BANG':
        return !this.isTruthy(right)
      case 'MINUS':
        this.checkNumberOperand(expr.operator, right);
        return -Number(right);
    }

    // Unreachable.
    return null;
  }

  public visitBinaryExpr(expr: ExprT<'Binary'>): LiteralType {
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

  public visitCallExpr(expr: ExprT<'Call'>): LiteralType {
    const enclosingCallParen = this.currentCallParen;
    this.currentCallParen = expr.paren;
    const callee = this.evaluate(expr.callee);

    const argValues: LiteralType[] = [];
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

  public visitVariableExpr(expr: ExprT<'Variable'>): LiteralType {
    return this.lookUpVariable(expr.name, expr);
  }

  public visitExpressionStmt(stmt: StmtT<'Expression'>): void {
    this.evaluate(stmt.expression);
  }

  public visitFunctionStmt(stmt: StmtT<'Function'>): void {
    const func = new LoxFunction(stmt, this.environment);
    this.environment.define(stmt.name.lexeme, func);
  }

  public visitIfStmt(stmt: StmtT<'If'>): void {
    if (this.isTruthy(this.evaluate(stmt.condition))) {
      this.execute(stmt.thenBranch);
    } else if (stmt.elseBranch !== null) {
      this.execute(stmt.elseBranch);
    }
  }

  public visitPrintStmt(stmt: StmtT<'Print'>): void {
    const value = this.evaluate(stmt.expression);
    console.log(this.stringify(value));
  }

  public visitReturnStmt(stmt: StmtT<'Return'>): void {
    let value: LiteralType = null;
    if (stmt.value !== null) value = this.evaluate(stmt.value);

    throw new Return(value); // oh god
  }

  public visitVarStmt(stmt: StmtT<'Var'>): void {
    let value = null;
    if (stmt.initializer !== null) {
      value = this.evaluate(stmt.initializer);
    }

    this.environment.define(stmt.name.lexeme, value);
  }

  public visitWhileStmt(stmt: StmtT<'While'>): void {
    while (this.isTruthy(this.evaluate(stmt.condition))) {
      this.execute(stmt.body);
    }
  }

  private stringify(literalValue: LiteralType): string {
    if (literalValue === null) return 'nil';

    return literalValue.toString();
  }

  /* *** UTILITY TESTS *** */

  public isEqual(a: LiteralType, b: LiteralType): boolean {
    if (typeof a !== typeof b) return false;
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    return a === b;
  }

  public isTruthy(literalValue: LiteralType): boolean {
    if (literalValue === null || literalValue === false) return false;
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public isNonNullObject(literalValue: any): literalValue is { [key: string]: true } {
    return typeof literalValue === 'object' && literalValue !== null;
  }

  public isCallable(literalValue: LiteralType): literalValue is Callable {
    return this.isNonNullObject(literalValue) && literalValue.isCallable === true;
  }

  public isInstance(literalValue: LiteralType): literalValue is LoxInstance {
    return this.isNonNullObject(literalValue) && literalValue.isLoxInstance === true;
  }

  public isClass(literalValue: LiteralType): literalValue is LoxClass {
    return this.isNonNullObject(literalValue) && literalValue.isLoxClass === true;
  }

  public assertArgumentType(value: LiteralType, type: 'string' | 'number' | 'boolean' | 'nil' | 'function' | 'object', message: string): void {
    let valid = true;
    switch (type) {
      case 'string':
      case 'number':
      case 'boolean':
        valid = typeof value === type; break;
      case 'nil':
        valid = value === null; break;
      case 'function':
        valid = this.isCallable(value); break;
      case 'object':
        valid = this.isInstance(value); break;
    }
    if (!valid) {
      this.runtimeError(new RuntimeError(this.currentCallParen!, message))
    }
  }

  private checkNumberOperand(operator: Token, operand: LiteralType): void {
    if (typeof operand === 'number') return;
    throw new RuntimeError(operator, 'Operand must be a number.');
  }

  private checkNumberOperands(operator: Token, left: LiteralType, right: LiteralType): void {
    if (typeof left === 'number' && typeof right === 'number') return;
    throw new RuntimeError(operator, 'Operands must be numbers.');
  }
}