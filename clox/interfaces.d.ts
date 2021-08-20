type Index = number; // Doesn't do much, just here to help me to keep things straight

type BoolValue        = { type: import('./common').ValueType.BOOL;   value: boolean };
type NumberValue      = { type: import('./common').ValueType.NUMBER; value: number };
type StringValue      = { type: import('./common').ValueType.STRING; value: string };
type NilValue         = { type: import('./common').ValueType.NIL };
type InstanceValue    = {
  type: import('./common').ValueType.INSTANCE;
  klass: ClassValue;
  fields: Map<string, Value>;
};
type ClassValue       = {
  type: import('./common').ValueType.CLASS;
  name: string;
  methods: Map<string, Value>;
};
type ClosureValue     = {
  type: import('./common').ValueType.CLOSURE;
  fun: FunValue;
  upvalues: ObjUpvalue[];
  upvalueCount: number;
};
type BoundMethodValue = {
  type: import('./common').ValueType.BOUND_METHOD;
  receiver: InstanceValue;
  method: ClosureValue;
};
type FunValue         = {
  type: import('./common').ValueType.FUN;
  arity: number;
  chunk: import('./Chunk').Chunk;
  upvalueCount: number;
  name: string | null;
};
type NativeFunValue   = {
  type: import('./common').ValueType.NATIVE_FUN;
  arity: number;
  fun: (args: Value[], vm: import('./VM').VM) => ([true, Value] | [false]);
  name: string;
};
type Value =
  | BoolValue
  | NumberValue
  | StringValue
  | NilValue
  | InstanceValue
  | ClassValue
  | ClosureValue
  | BoundMethodValue
  | FunValue
  | NativeFunValue;

type InterpretResult = 'INTERPRET_OK' | 'INTERPRET_COMPILE_ERROR' | 'INTERPRET_RUNTIME_ERROR';

// Prefix with C for clox, because VSCode keeps pulling in typings from both clox and jlox :/
type CFunctionType = 'FUNCTION' | 'SCRIPT' | 'METHOD' | 'INITIALIZER';

interface CToken {
  type: import('./common').CTokenType;
  lexeme: string;
  line: Index;
}

interface Local {
  name: CToken;
  depth: number;
  isCaptured: boolean;
}

interface Upvalue {
  index: number;
  isLocal: boolean;
}

interface ClassCompiler {
  enclosing: ClassCompiler | null;
  hasSuperclass: boolean;
}

interface CallFrame {
  closure: ClosureValue;
  funCode: number[];
  funConstants: Value[];
  ip: number;
  firstSlotIndex: number; // called "slots" in the book, but we can't do that here
}

interface ObjUpvalue {
  stackIndex: Index; // -1 means point to self
  closed: Value; // We can't use the pointer trick used in the book :(
  next: ObjUpvalue | null;
}

type ParseFn = (canAssign?: boolean) => void;

interface ParseRule {
  prefix: ParseFn | null;
  infix: ParseFn | null;
  precedence: import('./common').Precedence;
}

interface Entry {
  key: string | null;
  value: Value;
}
