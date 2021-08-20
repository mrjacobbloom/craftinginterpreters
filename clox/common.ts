export const enum OpCode {
  CONSTANT,      // operands 1   pops 0   pushes 1    Operand is index in consts table
  NIL,           // operands 0   pops 0   pushes 1
  TRUE,          // operands 0   pops 0   pushes 1
  FALSE,         // operands 0   pops 0   pushes 1
  POP,           // operands 0   pops 1   pushes 0
  GET_LOCAL,     // operands 1   pops 0   pushes 1    Operand is number representing variable offset in stack
  SET_LOCAL,     // operands 1   pops 1   pushes 1    Operand is number representing variable offset in stack
  GET_GLOBAL,    // operands 1   pops 1   pushes 1
  DEFINE_GLOBAL, // operands 1   pops 1   pushes 0
  SET_GLOBAL,    // operands 1   pops 0   pushes 0    Note: peeks value but leaves it on the stack
  GET_UPVALUE,   // operands 1   pops 0   pushes 1    Operand is upvalueId
  SET_UPVALUE,   // operands 1   pops 1   pushes 1    Operand is upvalueId
  GET_PROPERTY,  // operands 1   pops 1   pushes 1    Operand is prop name, pops instance and pushes field value
  SET_PROPERTY,  // operands 1   pops 2   pushes 1    Operand is prop name, pops instance and new value, pushes value back on
  GET_SUPER,     // operands 1   pops 1   pushes 1    Operand is identifier (consts table)
  EQUAL,         // operands 0   pops 2   pushes 1
  GREATER,       // operands 0   pops 2   pushes 1
  LESS,          // operands 0   pops 2   pushes 1
  ADD,           // operands 0   pops 2   pushes 1
  SUBTRACT,      // operands 0   pops 2   pushes 1
  MULTIPLY,      // operands 0   pops 2   pushes 1
  DIVIDE,        // operands 0   pops 2   pushes 1
  NOT,           // operands 0   pops 1   pushes 1
  NEGATE,        // operands 0   pops 1   pushes 1
  PRINT,         // operands 0   pops 1   pushes 0
  JUMP,          // operands 1   pops 0   pushes 0    Operand is jump offset
  JUMP_IF_FALSE, // operands 1   pops 0   pushes 0    Operand is jump offset // Note: peeks value but leaves it on the stack
  LOOP,          // operands 1   pops 0   pushes 0    Operand is jump offset (absolute value?)
  CALL,          // operands 1   pops 0   pushes 0    Operand is number of arguments
  INVOKE,        // operands 2   pops     pushes      Operands are method name (consts table) and argCount
  SUPER_INVOKE,  // operands 2   pops     pushes      Operands are method name (consts table) and argCount
  CLOSURE,       // operands 1 + 2*n where the first op is the fun constant, then for each upValue there's an [+isLocal index] tuple (yeesh)
  CLOSE_UPVALUE, // operands 0   pops     pushes
  RETURN,        // operands 0   pops 1   pushes 0
  CLASS,         // operands 1   pops 0   pushes 1    Operand is class name (consts table), pushes the new ClassValue
  INHERIT,       // operands 0   pops 1   pushes 0    Peeks 2 from stack: [...restOfStack, superclass, subclass]
  METHOD,        // operands 1   pops 1   pushes 0    Operand is method name (consts table), pops the method closure
}

export const enum CTokenType {
  // Single-character tokens.
  LEFT_PAREN, RIGHT_PAREN,
  LEFT_BRACE, RIGHT_BRACE,
  COMMA, DOT, MINUS, PLUS,
  SEMICOLON, SLASH, STAR,
  // One or two character tokens.
  BANG, BANG_EQUAL,
  EQUAL, EQUAL_EQUAL,
  GREATER, GREATER_EQUAL,
  LESS, LESS_EQUAL,
  // Literals.
  IDENTIFIER, STRING, NUMBER,
  // Keywords.
  AND, CLASS, ELSE, FALSE,
  FOR, FUN, IF, NIL, OR,
  PRINT, RETURN, SUPER, THIS,
  TRUE, VAR, WHILE,

  ERROR, EOF
}

export const enum Precedence {
  NONE,
  ASSIGNMENT,  // =
  OR,          // or
  AND,         // and
  EQUALITY,    // == !=
  COMPARISON,  // < > <= >=
  TERM,        // + -
  FACTOR,      // * /
  UNARY,       // ! -
  CALL,        // . ()
  PRIMARY
}

export const enum ValueType {
  BOOL,
  NIL,
  NUMBER,
  STRING,
  INSTANCE,
  CLASS,
  CLOSURE,
  BOUND_METHOD,
  FUN,
  NATIVE_FUN,
}

export const CONSTS_MAX = 256;
export const LOCALS_MAX = 256;
export const FRAME_MAX = 64;
export const STACK_MAX = FRAME_MAX * 256;

/**
 * Put this in the "default" case of a switch to cause a TS error when you forget to add a new case
 */
export function typeGuardSwitch(value: never): void {}; /* eslint-disable-line */