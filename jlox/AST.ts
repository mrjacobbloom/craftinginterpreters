/* *** EXPRESSIONS *** */

export abstract class Expr {
  public accept<T>(visitor: ExprVisitor<T>): T {
    // Decide what the correct visitXExpr method name should be using the class's name
    // This is a hack, but it keeps us from having to write an `accept` method in each subclass
    return (visitor as any)[`visit${this.constructor.name}Expr`].call(visitor, this);
  }

  public static Assign = class Assign extends Expr {
    public constructor(public name: Token, public value: Expr) { super(); }
  };

  public static Binary = class Binary extends Expr {
    public constructor(public left: Expr, public operator: Token, public right: Expr) { super(); }
  };

  public static Call = class Call extends Expr {
    public constructor(public callee: Expr, public paren: Token, public args: Expr[]) { super(); }
  };

  public static Get = class Get extends Expr {
    public constructor(public object: Expr, public name: Token) { super(); }
  };
  
  public static Grouping = class Grouping extends Expr {
    public constructor(public expression: Expr) { super(); }
  };
  
  public static Literal = class Literal extends Expr {
    public constructor(public value: LiteralType) { super(); }
  };

  public static Logical = class Logical extends Expr {
    public constructor(public left: Expr, public operator: Token, public right: Expr) { super(); }
  };

  public static Set = class Set extends Expr {
    public constructor(public object: Expr, public name: Token, public value: Expr) { super(); }
  };

  public static Super = class Super extends Expr {
    public constructor(public keyword: Token, public method: Token) { super(); }
  };

  public static This = class This extends Expr {
    public constructor(public keyword: Token) { super(); }
  };
  
  public static Unary = class Unary extends Expr {
    public constructor(public operator: Token, public right: Expr) { super(); }
  };
  
  public static Variable = class Variable extends Expr {
    public constructor(public name: Token) { super(); }
  };
}

type ExprNames = Exclude<keyof typeof Expr, 'prototype'>;

/*
 * TypeScript struggles with edge cases in "type expressions" (is that a thing?)
 * regarding static properties of a class, especially when that static property
 * is another class. So these are both broken:
 *      function makeALiteral(): Expr.Literal { ... }
 *      function makeALiteral(): Expr["Literal"] { ... }
 * Instead, we use ExprT to grab the right property off of Expr:
 *      function makeALiteral(): ExprT<'Literal'> { ... }
 */
export type ExprT<T extends ExprNames> = InstanceType<(typeof Expr)[T]>;

/* *** STATEMENTS *** */

export abstract class Stmt {
  public accept<T>(visitor: StmtVisitor<T>): T {
    return (visitor as any)[`visit${this.constructor.name}Stmt`].call(visitor, this);
  }

  public static Block = class Block extends Stmt {
    public constructor(public statements: Stmt[]) { super(); }
  };

  public static Class = class Class extends Stmt {
    public constructor(public name: Token, public superclass: ExprT<'Variable'> | null, public methods: StmtT<'Function'>[]) { super(); }
  };
  
  public static Expression = class Expression extends Stmt {
    public constructor(public expression: Expr) { super(); }
  };

  public static Function = class Function extends Stmt {
    public constructor(public name: Token, public params: Token[], public body: Stmt[]) { super(); }
  };

  public static If = class If extends Stmt {
    public constructor (public condition: Expr, public thenBranch: Stmt, public elseBranch: Stmt | null) { super(); }
  }

  public static Print = class Print extends Stmt {
    public constructor(public expression: Expr) { super(); }
  };

  public static Return = class Return extends Stmt {
    public constructor(public keyword: Token, public value: Expr | null) { super(); }
  };
  
  public static Var = class Var extends Stmt {
    public constructor(public name: Token, public initializer: Expr | null) { super(); }
  };
  
  public static While = class While extends Stmt {
    public constructor(public condition: Expr, public body: Stmt) { super(); }
  };
}

type StmtNames = Exclude<keyof typeof Stmt, 'prototype'>;

export type StmtT<T extends StmtNames> = InstanceType<(typeof Stmt)[T]>;


/* *** VISITORS *** */

export type ExprVisitor<T> = {
  // This uses the new template literal types to generate strings in type space!!!
  [key in ExprNames as `visit${key}Expr`]: (expr: ExprT<key>) => T;
}

export type StmtVisitor<T> = {
  [key in StmtNames as `visit${key}Stmt`]: (stmt: StmtT<key>) => T;
}

export type Visitor<ExprType, StmtType = ExprType> = ExprVisitor<ExprType> & StmtVisitor<StmtType>;