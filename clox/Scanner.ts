import { CTokenType } from "./common";

export class Scanner {
  private start: Index = 0;
  private current: Index = 0;
  private line: Index = 1;
  
  constructor(private source: string) {}

  public scanToken(): CToken {
    this.skipWhitespace();
    this.start = this.current;

    if (this.isAtEnd()) return this.makeToken(CTokenType.EOF);

    const c = this.advance();

    if (this.isAlpha(c)) return this.identifier();
    if (this.isDigit(c)) return this.number();

    switch (c) {
      case '(': return this.makeToken(CTokenType.LEFT_PAREN);
      case ')': return this.makeToken(CTokenType.RIGHT_PAREN);
      case '{': return this.makeToken(CTokenType.LEFT_BRACE);
      case '}': return this.makeToken(CTokenType.RIGHT_BRACE);
      case ';': return this.makeToken(CTokenType.SEMICOLON);
      case ',': return this.makeToken(CTokenType.COMMA);
      case '.': return this.makeToken(CTokenType.DOT);
      case '-': return this.makeToken(CTokenType.MINUS);
      case '+': return this.makeToken(CTokenType.PLUS);
      case '/': return this.makeToken(CTokenType.SLASH);
      case '*': return this.makeToken(CTokenType.STAR);
      case '!': return this.makeToken(this.match('=') ? CTokenType.BANG_EQUAL : CTokenType.BANG);
      case '=': return this.makeToken(this.match('=') ? CTokenType.EQUAL_EQUAL : CTokenType.EQUAL);
      case '<': return this.makeToken(this.match('=') ? CTokenType.LESS_EQUAL : CTokenType.LESS);
      case '>': return this.makeToken(this.match('=') ? CTokenType.GREATER_EQUAL : CTokenType.GREATER);
      case '"': return this.string();
    }

    return this.errorToken('Unexpected character.');
  }

  private makeToken(type: CTokenType): CToken {
    return {
      type,
      lexeme: this.source.substring(this.start, this.current),
      line: this.line,
    };
  }

  private errorToken(message: string): CToken {
    return {
      type: CTokenType.ERROR,
      lexeme: message,
      line: this.line,
    };
  }

  private skipWhitespace(): void {
    while(true) {
      const c = this.peek();
      switch (c) {
        case ' ':
        case '\r':
        case '\t':
          this.advance();
          break;
        case '\n':
          this.line++;
          this.advance();
          break;
        case '/':
          if (this.peekNext() == '/') {
            // A comment goes until the end of the line.
            while (this.peek() != '\n' && !this.isAtEnd()) this.advance();
          } else {
            return;
          }
          break;
        default:
          return;
      }
    }
  }

  private identifierType(): CTokenType {
    switch (this.source.charAt(this.start)) {
      case 'a': return this.checkKeyword(1, "nd", CTokenType.AND);
      case 'c': return this.checkKeyword(1, "lass", CTokenType.CLASS);
      case 'e': return this.checkKeyword(1, "lse", CTokenType.ELSE);
      case 'f':
        if (this.current - this.start > 1) {
          switch (this.source.charAt(this.start + 1)) {
            case 'a': return this.checkKeyword(2, "lse", CTokenType.FALSE);
            case 'o': return this.checkKeyword(2, "r", CTokenType.FOR);
            case 'u': return this.checkKeyword(2, "n", CTokenType.FUN);
          }
        }
        break;
      case 'i': return this.checkKeyword(1, "f", CTokenType.IF);
      case 'n': return this.checkKeyword(1, "il", CTokenType.NIL);
      case 'o': return this.checkKeyword(1, "r", CTokenType.OR);
      case 'p': return this.checkKeyword(1, "rint", CTokenType.PRINT);
      case 'r': return this.checkKeyword(1, "eturn", CTokenType.RETURN);
      case 's': return this.checkKeyword(1, "uper", CTokenType.SUPER);
      case 't':
        if (this.current - this.start > 1) {
          switch (this.source.charAt(this.start + 1)) {
            case 'h': return this.checkKeyword(2, "is", CTokenType.THIS);
            case 'r': return this.checkKeyword(2, "ue", CTokenType.TRUE);
          }
        }
        break;
      case 'v': return this.checkKeyword(1, "ar", CTokenType.VAR);
      case 'w': return this.checkKeyword(1, "hile", CTokenType.WHILE);
    }

    return CTokenType.IDENTIFIER;
  }

  private checkKeyword(start: number, rest: string, type: CTokenType): CTokenType {
    if (this.current - this.start == start + rest.length && rest === this.source.substring(this.start + start, this.start + start + rest.length)) {
      return type;
    }

    return CTokenType.IDENTIFIER;
  }
  

  /* *** PRIMITIVE OPERATIONS *** */

  private advance(): string {
    return this.source.charAt(this.current++);
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source.charAt(this.current) != expected) return false;

    this.current++;
    return true;
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source.charAt(this.current);
  }

  private peekNext(): string {
    if (this.current + 1 >= this.source.length) return '\0';
    return this.source.charAt(this.current + 1);
  }


  /* *** HANDLING FOR SPECIAL/LONGER TOKENS *** */

  private string(): CToken {
    while (this.peek() != '"' && !this.isAtEnd()) {
      if (this.peek() == '\n') this.line++;
      this.advance();
    }

    if (this.isAtEnd()) {
      return this.errorToken("Unterminated string.");
    }

    // The closing ".
    this.advance();

    return this.makeToken(CTokenType.STRING);
  }

  private number(): CToken {
    while (this.isDigit(this.peek())) this.advance();

    // Look for a fractional part.
    if (this.peek() == '.' && this.isDigit(this.peekNext())) {
      // Consume the "."
      this.advance();

      while (this.isDigit(this.peek())) this.advance();
    }

    return this.makeToken(CTokenType.NUMBER);
  }

  private identifier(): CToken {
    while (this.isAlphaNumeric(this.peek())) this.advance();

    return this.makeToken(this.identifierType());
  }


  /* *** UTILITY TESTS *** */

  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  private isAlpha(c: string): boolean {
    return (c >= 'a' && c <= 'z') ||
           (c >= 'A' && c <= 'Z') ||
            c == '_';
  }

  private isAlphaNumeric(c: string): boolean {
    return this.isAlpha(c) || this.isDigit(c);
  }

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }
}