import { Token } from './Token';

const KEYWORDS: { [keyword: string]: TokenType } = {
  'and':    'AND',
  'class':  'CLASS',
  'else':   'ELSE',
  'false':  'FALSE',
  'for':    'FOR',
  'fun':    'FUN',
  'if':     'IF',
  'nil':    'NIL',
  'or':     'OR',
  'print':  'PRINT',
  'return': 'RETURN',
  'super':  'SUPER',
  'this':   'THIS',
  'true':   'TRUE',
  'var':    'VAR',
  'while':  'WHILE',
};

export class Scanner {
  private tokens: Token[] = [];
  private start = 0;
  private current = 0;
  private line = 1;

  public constructor(private source: string, private error: SyntaxErrorHandler) {}

  public scanTokens(): Token[] {
    while (!this.isAtEnd()) {
      this.start = this.current;
      this.scanToken();
    }
    this.tokens.push(new Token('EOF', '', null, this.line));
    return this.tokens;
  }

  private addToken(type: TokenType, literal: LiteralType = null): void {
    const text = this.source.substring(this.start, this.current); // Please don't be off by one from java that'd suk
    this.tokens.push(new Token(type, text, literal, this.line));
  }

  private scanToken(): void {
    const c = this.advance();
    switch (c) {
      case '(': this.addToken('LEFT_PAREN'); break;
      case ')': this.addToken('RIGHT_PAREN'); break;
      case '{': this.addToken('LEFT_BRACE'); break;
      case '}': this.addToken('RIGHT_BRACE'); break;
      case ',': this.addToken('COMMA'); break;
      case '.': this.addToken('DOT'); break;
      case '-': this.addToken('MINUS'); break;
      case '+': this.addToken('PLUS'); break;
      case ';': this.addToken('SEMICOLON'); break;
      case '*': this.addToken('STAR'); break;
      case '!':
        this.addToken(this.match('=') ? 'BANG_EQUAL' : 'BANG');
        break;
      case '=':
        this.addToken(this.match('=') ? 'EQUAL_EQUAL' : 'EQUAL');
        break;
      case '<':
        this.addToken(this.match('=') ? 'LESS_EQUAL' : 'LESS');
        break;
      case '>':
        this.addToken(this.match('=') ? 'GREATER_EQUAL' : 'GREATER');
        break;
      case '/':
        if (this.match('/')) {
          // A comment goes until the end of the line.
          while (this.peek() !== '\n' && !this.isAtEnd()) this.advance();
        } else {
          this.addToken('SLASH');
        }
        break;
      case ' ':
      case '\r':
      case '\t':
        // Ignore whitespace.
        break;
      case '\n':
        this.line++;
        break;
      case '"': this.string(); break;
      default:
        if (this.isDigit(c)) {
          this.number();
        } else if (this.isAlpha(c)) {
          this.identifier();
        } else {
          this.error(this.line, 'Unexpected character.');
        }
        break;
    }
  }

  /* *** PRIMITIVE OPERATIONS *** */

  private advance(): string {
    return this.source.charAt(this.current++);
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source.charAt(this.current) !== expected) return false;

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

  private string(): void {
    while (this.peek() !== '"' && !this.isAtEnd()) {
      if (this.peek() === '\n') this.line++;
      this.advance();
    }

    if (this.isAtEnd()) {
      this.error(this.line, 'Unterminated string.');
      return;
    }

    // The closing ".
    this.advance();

    // Trim the surrounding quotes.
    const value = this.source.substring(this.start + 1, this.current - 1);
    this.addToken('STRING', value);
  }

  private number(): void {
    while (this.isDigit(this.peek())) this.advance();

    // Look for a fractional part.
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      // Consume the "."
      this.advance();

      while (this.isDigit(this.peek())) this.advance();
    }

    this.addToken('NUMBER', Number(this.source.substring(this.start, this.current)));
  }

  private identifier(): void {
    while (this.isAlphaNumeric(this.peek())) this.advance();

    const word = this.source.substring(this.start, this.current);
    // eslint-disable-next-line no-prototype-builtins
    const keyword = KEYWORDS.hasOwnProperty(word) ? KEYWORDS[word] : undefined;

    this.addToken(keyword ?? 'IDENTIFIER');
  }

  /* *** UTILITY TESTS *** */

  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  private isAlpha(c: string): boolean {
    return (c >= 'a' && c <= 'z') ||
           (c >= 'A' && c <= 'Z') ||
            c === '_';
  }

  private isAlphaNumeric(c: string): boolean {
    return this.isAlpha(c) || this.isDigit(c);
  }

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }
}