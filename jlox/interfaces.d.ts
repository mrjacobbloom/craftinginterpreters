type SyntaxErrorHandler = (lineOrToken: number | Token, message: string) => void;
type RuntimeErrorHandler = (error: import('./Errors').RuntimeError) => void;

type TokenType =
  // Single-character tokens
  | 'LEFT_PAREN' | 'RIGHT_PAREN' | 'LEFT_BRACE' | 'RIGHT_BRACE'
  | 'COMMA' | 'DOT' | 'MINUS' | 'PLUS' | 'SEMICOLON' | 'SLASH' | 'STAR'
  // One or two character tokens
  | 'BANG' | 'BANG_EQUAL'
  | 'EQUAL' | 'EQUAL_EQUAL'
  | 'GREATER' | 'GREATER_EQUAL'
  | 'LESS' | 'LESS_EQUAL'
  // Literals
  | 'IDENTIFIER' | 'STRING' | 'NUMBER'
  // Keywords
  | 'AND' | 'CLASS' | 'ELSE' | 'FALSE' | 'FUN' | 'FOR' | 'IF' | 'NIL' | 'OR'
  | 'PRINT' | 'RETURN' | 'SUPER' | 'THIS' | 'TRUE' | 'VAR' | 'WHILE'
  // Misc
  | 'EOF';

type LiteralType = null | string | number | boolean | Callable | import('./LoxInstance').LoxInstance;

interface Callable {
  isCallable: true;
  arity: () => number;
  call(interpreter: import('./Interpreter').Interpreter, args: LiteralType[]): LiteralType;
  bind(object: import('./LoxInstance').LoxInstance): Callable;
  toString(): string;
}

type ClassType = 'CLASS' | 'SUBCLASS' | 'NONE';

type FunctionType = 'FUNCTION' | 'INITIALIZER' | 'METHOD' | 'NONE';

declare class Token {
  public type: TokenType;
  public lexeme: string;
  public literal: LiteralType;
  public line: number;

  public constructor(type: TokenType, lexeme: string, literal: LiteralType, line: number);
  public toString(): string;
}

type ParseExprRule = () => import('./AST').Expr;
type ParseStmtRule = () => import('./AST').Stmt;