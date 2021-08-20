/* *** EXPRESSIONS *** */
export class Expr {
    accept(visitor) {
        // Decide what the correct visitXExpr method name should be using the class's name
        // This is a hack, but it keeps us from having to write an `accept` method in each subclass
        return visitor[`visit${this.constructor.name}Expr`].call(visitor, this);
    }
    static Assign = class Assign extends Expr {
        name;
        value;
        constructor(name, value) {
            super();
            this.name = name;
            this.value = value;
        }
    };
    static Binary = class Binary extends Expr {
        left;
        operator;
        right;
        constructor(left, operator, right) {
            super();
            this.left = left;
            this.operator = operator;
            this.right = right;
        }
    };
    static Call = class Call extends Expr {
        callee;
        paren;
        args;
        constructor(callee, paren, args) {
            super();
            this.callee = callee;
            this.paren = paren;
            this.args = args;
        }
    };
    static Get = class Get extends Expr {
        object;
        name;
        constructor(object, name) {
            super();
            this.object = object;
            this.name = name;
        }
    };
    static Grouping = class Grouping extends Expr {
        expression;
        constructor(expression) {
            super();
            this.expression = expression;
        }
    };
    static Literal = class Literal extends Expr {
        value;
        constructor(value) {
            super();
            this.value = value;
        }
    };
    static Logical = class Logical extends Expr {
        left;
        operator;
        right;
        constructor(left, operator, right) {
            super();
            this.left = left;
            this.operator = operator;
            this.right = right;
        }
    };
    static Set = class Set extends Expr {
        object;
        name;
        value;
        constructor(object, name, value) {
            super();
            this.object = object;
            this.name = name;
            this.value = value;
        }
    };
    static Super = class Super extends Expr {
        keyword;
        method;
        constructor(keyword, method) {
            super();
            this.keyword = keyword;
            this.method = method;
        }
    };
    static This = class This extends Expr {
        keyword;
        constructor(keyword) {
            super();
            this.keyword = keyword;
        }
    };
    static Unary = class Unary extends Expr {
        operator;
        right;
        constructor(operator, right) {
            super();
            this.operator = operator;
            this.right = right;
        }
    };
    static Variable = class Variable extends Expr {
        name;
        constructor(name) {
            super();
            this.name = name;
        }
    };
}
/* *** STATEMENTS *** */
export class Stmt {
    accept(visitor) {
        return visitor[`visit${this.constructor.name}Stmt`].call(visitor, this);
    }
    static Block = class Block extends Stmt {
        statements;
        constructor(statements) {
            super();
            this.statements = statements;
        }
    };
    static Class = class Class extends Stmt {
        name;
        superclass;
        methods;
        constructor(name, superclass, methods) {
            super();
            this.name = name;
            this.superclass = superclass;
            this.methods = methods;
        }
    };
    static Expression = class Expression extends Stmt {
        expression;
        constructor(expression) {
            super();
            this.expression = expression;
        }
    };
    static Function = class Function extends Stmt {
        name;
        params;
        body;
        constructor(name, params, body) {
            super();
            this.name = name;
            this.params = params;
            this.body = body;
        }
    };
    static If = class If extends Stmt {
        condition;
        thenBranch;
        elseBranch;
        constructor(condition, thenBranch, elseBranch) {
            super();
            this.condition = condition;
            this.thenBranch = thenBranch;
            this.elseBranch = elseBranch;
        }
    };
    static Print = class Print extends Stmt {
        expression;
        constructor(expression) {
            super();
            this.expression = expression;
        }
    };
    static Return = class Return extends Stmt {
        keyword;
        value;
        constructor(keyword, value) {
            super();
            this.keyword = keyword;
            this.value = value;
        }
    };
    static Var = class Var extends Stmt {
        name;
        initializer;
        constructor(name, initializer) {
            super();
            this.name = name;
            this.initializer = initializer;
        }
    };
    static While = class While extends Stmt {
        condition;
        body;
        constructor(condition, body) {
            super();
            this.condition = condition;
            this.body = body;
        }
    };
}
