export class ParseError extends Error {}

export class RuntimeError extends Error {
  public constructor(public token: Token, message: string) { super(message); }
}

export class Return extends Error { // Wow I'm not fond of this at all

  public constructor(public value: LiteralType) { super(); }
}