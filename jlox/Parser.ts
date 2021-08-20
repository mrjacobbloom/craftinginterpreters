import { Stmt, Expr, StmtT, ExprT } from './AST';
import { ParseError } from './Errors';

export class Parser {
  private current = 0;

  public constructor(private tokens: Token[], private loxError: SyntaxErrorHandler) {}

  public parse(): Stmt[] | null {
    try {
      const statements: Stmt[] = [];
      while (!this.isAtEnd()) {
        const stmt = this.declaration();
        if (stmt) statements.push(stmt);
      }

      return statements;
    } catch { return null; }
  }

  public ParseError = class extends Error {}

  private error(token: Token, message: string): ParseError {
    this.loxError(token, message);
    return new ParseError(message);
  }

  private synchronize(): void {
    this.advance();

    while (!this.isAtEnd()) {
      if (this.previous().type === 'SEMICOLON') return;

      switch (this.peek().type) {
        case 'CLASS':
        case 'FUN':
        case 'VAR':
        case 'FOR':
        case 'IF':
        case 'WHILE':
        case 'PRINT':
        case 'RETURN':
          return;
      }

      this.advance();
    }
  }

  /* *** PARSE RULES *** */

  private declaration: () => Stmt | null = () => {
    try {
      if (this.match('CLASS')) return this.classDeclaration();
      if (this.match('FUN')) return this.func('function');
      if (this.match('VAR')) return this.varDeclaration();

      return this.statement();
    } catch (error) {
      if (error instanceof ParseError) {
        this.synchronize();
        return null;
      } else throw error;
    }
  };

  private func = (kind: 'function' | 'method'): StmtT<'Function'> => {
    const name = this.consume('IDENTIFIER', `Expect ${kind} name.`);
    this.consume('LEFT_PAREN', `Expect '(' after ${kind} name.`);
    const parameters: Token[] = [];
    if (!this.check('RIGHT_PAREN')) {
      do {
        if (parameters.length >= 255) {
          this.error(this.peek(), 'Can\'t have more than 255 parameters.');
        }

        parameters.push(this.consume('IDENTIFIER', 'Expect parameter name.'));
      } while (this.match('COMMA'));
    }
    this.consume('RIGHT_PAREN', 'Expect \')\' after parameters.');

    this.consume('LEFT_BRACE', `Expect '{' before ${kind} body.`);
    const body = this.block();
    return new Stmt.Function(name, parameters, body);
  };

  private varDeclaration: ParseStmtRule = () => {
    const name = this.consume('IDENTIFIER', 'Expect variable name.');

    let initializer: Expr | null = null;
    if (this.match('EQUAL')) {
      initializer = this.expression();
    }

    this.consume('SEMICOLON', 'Expect \';\' after variable declaration.');
    return new Stmt.Var(name, initializer);
  }

  private classDeclaration(): Stmt {
    const name = this.consume('IDENTIFIER', 'Expect class name.');

    let superclass: ExprT<'Variable'> | null = null;
    if (this.match('LESS')) {
      this.consume('IDENTIFIER', 'Expect superclass name.');
      superclass = new Expr.Variable(this.previous());
    }

    this.consume('LEFT_BRACE', 'Expect \'{\' before class body.');

    const methods: StmtT<'Function'>[] = [];
    while (!this.check('RIGHT_BRACE') && !this.isAtEnd()) {
      methods.push(this.func('method'));
    }

    this.consume('RIGHT_BRACE', 'Expect \'}\' after class body.');

    return new Stmt.Class(name, superclass, methods);
  }

  private statement: ParseStmtRule = () => {
    if (this.match('FOR')) return this.forStatement();
    if (this.match('IF')) return this.ifStatement();
    if (this.match('PRINT')) return this.printStatement();
    if (this.match('RETURN')) return this.returnStatement();
    if (this.match('WHILE')) return this.whileStatement();
    if (this.match('LEFT_BRACE')) return new Stmt.Block(this.block());

    return this.expressionStatement();
  };

  private forStatement: ParseStmtRule = () => {
    this.consume('LEFT_PAREN', 'Expect \'(\' after \'for\'.');
    let initializer: Stmt | null;
    if (this.match('SEMICOLON')) {
      initializer = null;
    } else if (this.match('VAR')) {
      initializer = this.varDeclaration();
    } else {
      initializer = this.expressionStatement();
    }

    let condition: Expr | null = null;
    if (!this.check('SEMICOLON')) {
      condition = this.expression();
    }
    this.consume('SEMICOLON', 'Expect \';\' after loop condition.');

    let increment: Expr | null = null;
    if (!this.check('RIGHT_PAREN')) {
      increment = this.expression();
    }
    this.consume('RIGHT_PAREN', 'Expect \')\' after for clauses.');

    let body = this.statement();

    if (increment !== null) {
      body = new Stmt.Block([body, new Stmt.Expression(increment)]);
    }

    if (condition === null) condition = new Expr.Literal(true);
    body = new Stmt.While(condition, body);

    if (initializer !== null) {
      body = new Stmt.Block([initializer, body]);
    }

    return body;
  };

  private ifStatement: ParseStmtRule = () => {
    this.consume('LEFT_PAREN', 'Expect \'(\' after \'if\'.');
    const condition = this.expression();
    this.consume('RIGHT_PAREN', 'Expect \')\' after if condition.'); 

    const thenBranch = this.statement();
    let elseBranch: Stmt | null = null;
    if (this.match('ELSE')) {
      elseBranch = this.statement();
    }

    return new Stmt.If(condition, thenBranch, elseBranch);
  };

  private printStatement: ParseStmtRule = () => {
    const value = this.expression();
    this.consume('SEMICOLON', 'Expect \';\' after value.');
    return new Stmt.Print(value);
  };

  private returnStatement: ParseStmtRule = () => {
    const keyword = this.previous();
    let value: Expr | null = null;
    if (!this.check('SEMICOLON')) {
      value = this.expression();
    }

    this.consume('SEMICOLON', 'Expect \';\' after return value.');
    return new Stmt.Return(keyword, value);
  };

  private whileStatement(): Stmt {
    this.consume('LEFT_PAREN', 'Expect \'(\' after \'while\'.');
    const condition = this.expression();
    this.consume('RIGHT_PAREN', 'Expect \')\' after condition.');
    const body = this.statement();

    return new Stmt.While(condition, body);
  }

  private expressionStatement: ParseStmtRule = () => {
    const expr = this.expression();
    this.consume('SEMICOLON', 'Expect \';\' after expression.');
    return new Stmt.Expression(expr);
  };

  private expression: ParseExprRule = () => this.assignment();

  private assignment: ParseExprRule = () => {
    const expr = this.or();

    if (this.match('EQUAL')) {
      const equals = this.previous();
      const value = this.assignment();

      if (expr instanceof Expr.Variable) {
        const name = expr.name; // Grab the token, we're converting our r-value into an l-value baybeeee
        return new Expr.Assign(name, value);
      } else if (expr instanceof Expr.Get) {
        return new Expr.Set(expr.object, expr.name, value);
      }

      // We report an error if the left-hand side isn’t a valid assignment target,
      // but we don’t throw it because the parser isn’t in a confused state where we
      // need to go into panic mode and synchronize.
      this.error(equals, 'Invalid assignment target.');
    }

    return expr;
  };

  private or: ParseExprRule = () => {
    let expr = this.and();

    while (this.match('OR')) {
      const operator = this.previous();
      const right = this.and();
      expr = new Expr.Logical(expr, operator, right);
    }

    return expr;
  };

  private and: ParseExprRule = () => {
    let expr = this.equality();

    while (this.match('AND')) {
      const operator = this.previous();
      const right = this.equality();
      expr = new Expr.Logical(expr, operator, right);
    }

    return expr;
  };

  private equality = this.generateBinaryRule(() => this.comparison, ['BANG_EQUAL', 'EQUAL_EQUAL']);

  private comparison = this.generateBinaryRule(() => this.term, ['GREATER', 'GREATER_EQUAL', 'LESS', 'LESS_EQUAL']);

  private term = this.generateBinaryRule(() => this.factor, ['MINUS', 'PLUS']);

  private factor = this.generateBinaryRule(() => this.unary, ['SLASH', 'STAR']);

  private unary: ParseExprRule = () => {
    if (this.match('BANG', 'MINUS')) {
      const operator = this.previous();
      const right = this.unary();
      return new Expr.Unary(operator, right);
    }

    return this.call();
  };

  private call: ParseExprRule = () => {
    let expr = this.primary();

    while (true) { 
      if (this.match('LEFT_PAREN')) {
        expr = this.finishCall(expr);
      } else if (this.match('DOT')) {
        const name = this.consume('IDENTIFIER', 'Expect property name after \'.\'.');
        expr = new Expr.Get(expr, name);
      } else {
        break;
      }
    }

    return expr;
  }

  private primary: ParseExprRule = () => {
    if (this.match('FALSE')) return new Expr.Literal(false);
    if (this.match('TRUE')) return new Expr.Literal(true);
    if (this.match('NIL')) return new Expr.Literal(null);

    if (this.match('NUMBER', 'STRING')) {
      return new Expr.Literal(this.previous().literal);
    }

    if (this.match('LEFT_PAREN')) {
      const expr = this.expression();
      this.consume('RIGHT_PAREN', 'Expect \')\' after expression.');
      return new Expr.Grouping(expr);
    }

    if (this.match('SUPER')) {
      const keyword = this.previous();
      this.consume('DOT', 'Expect \'.\' after \'super\'.');
      const method = this.consume('IDENTIFIER', 'Expect superclass method name.');
      return new Expr.Super(keyword, method);
    }

    if (this.match('THIS')) return new Expr.This(this.previous());

    if (this.match('IDENTIFIER')) {
      return new Expr.Variable(this.previous());
    }

    throw this.error(this.peek(), 'Expect expression.');
  }


  /* HELPER FUNCTION TO GENERATE PARSER RULES */

  private generateBinaryRule(getNonterminal: () => ParseExprRule, terminals: TokenType[]): ParseExprRule {
    return (): Expr => {
      let expr = getNonterminal()(); // This is to sidestep passing in a method that hasn't been defined yet, since generateBinaryRule runs at construct/link time
  
      while (this.match(...terminals)) {
        const operator = this.previous();
        const right = getNonterminal()();
        expr = new Expr.Binary(expr, operator, right);
      }
  
      return expr;
    }
  }

  /* *** BREAKOUT SUB-RULES... IDK *** */

  private block(): Stmt[] {
    const statements: Stmt[] = [];

    while (!this.check('RIGHT_BRACE') && !this.isAtEnd()) {
      const stmt = this.declaration();
      if (stmt) statements.push(stmt);
    }

    this.consume('RIGHT_BRACE', 'Expect \'}\' after block.');
    return statements;
  }

  private finishCall(callee: Expr): Expr {
    const args: Expr[] = [];
    if (!this.check('RIGHT_PAREN')) {
      do {
        if (args.length >= 255) {
          this.error(this.peek(), 'Can\'t have more than 255 arguments.');
        }
        args.push(this.expression());
      } while (this.match('COMMA'));
    }

    const paren = this.consume('RIGHT_PAREN', 'Expect \')\' after arguments.');

    return new Expr.Call(callee, paren, args);
  }

  /* *** PRIMITIVE OPERATIONS *** */

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }

    return false;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();

    throw this.error(this.peek(), message);
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }
}