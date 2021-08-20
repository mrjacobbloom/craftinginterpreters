import { Token } from './Token';
const KEYWORDS = {
    'and': 'AND',
    'class': 'CLASS',
    'else': 'ELSE',
    'false': 'FALSE',
    'for': 'FOR',
    'fun': 'FUN',
    'if': 'IF',
    'nil': 'NIL',
    'or': 'OR',
    'print': 'PRINT',
    'return': 'RETURN',
    'super': 'SUPER',
    'this': 'THIS',
    'true': 'TRUE',
    'var': 'VAR',
    'while': 'WHILE',
};
export class Scanner {
    source;
    error;
    tokens = [];
    start = 0;
    current = 0;
    line = 1;
    constructor(source, error) {
        this.source = source;
        this.error = error;
    }
    scanTokens() {
        while (!this.isAtEnd()) {
            this.start = this.current;
            this.scanToken();
        }
        this.tokens.push(new Token('EOF', '', null, this.line));
        return this.tokens;
    }
    addToken(type, literal = null) {
        const text = this.source.substring(this.start, this.current); // Please don't be off by one from java that'd suk
        this.tokens.push(new Token(type, text, literal, this.line));
    }
    scanToken() {
        const c = this.advance();
        switch (c) {
            case '(':
                this.addToken('LEFT_PAREN');
                break;
            case ')':
                this.addToken('RIGHT_PAREN');
                break;
            case '{':
                this.addToken('LEFT_BRACE');
                break;
            case '}':
                this.addToken('RIGHT_BRACE');
                break;
            case ',':
                this.addToken('COMMA');
                break;
            case '.':
                this.addToken('DOT');
                break;
            case '-':
                this.addToken('MINUS');
                break;
            case '+':
                this.addToken('PLUS');
                break;
            case ';':
                this.addToken('SEMICOLON');
                break;
            case '*':
                this.addToken('STAR');
                break;
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
                    while (this.peek() !== '\n' && !this.isAtEnd())
                        this.advance();
                }
                else {
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
            case '"':
                this.string();
                break;
            default:
                if (this.isDigit(c)) {
                    this.number();
                }
                else if (this.isAlpha(c)) {
                    this.identifier();
                }
                else {
                    this.error(this.line, 'Unexpected character.');
                }
                break;
        }
    }
    /* *** PRIMITIVE OPERATIONS *** */
    advance() {
        return this.source.charAt(this.current++);
    }
    match(expected) {
        if (this.isAtEnd())
            return false;
        if (this.source.charAt(this.current) !== expected)
            return false;
        this.current++;
        return true;
    }
    peek() {
        if (this.isAtEnd())
            return '\0';
        return this.source.charAt(this.current);
    }
    peekNext() {
        if (this.current + 1 >= this.source.length)
            return '\0';
        return this.source.charAt(this.current + 1);
    }
    /* *** HANDLING FOR SPECIAL/LONGER TOKENS *** */
    string() {
        while (this.peek() !== '"' && !this.isAtEnd()) {
            if (this.peek() === '\n')
                this.line++;
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
    number() {
        while (this.isDigit(this.peek()))
            this.advance();
        // Look for a fractional part.
        if (this.peek() === '.' && this.isDigit(this.peekNext())) {
            // Consume the "."
            this.advance();
            while (this.isDigit(this.peek()))
                this.advance();
        }
        this.addToken('NUMBER', Number(this.source.substring(this.start, this.current)));
    }
    identifier() {
        while (this.isAlphaNumeric(this.peek()))
            this.advance();
        const word = this.source.substring(this.start, this.current);
        // eslint-disable-next-line no-prototype-builtins
        const keyword = KEYWORDS.hasOwnProperty(word) ? KEYWORDS[word] : undefined;
        this.addToken(keyword ?? 'IDENTIFIER');
    }
    /* *** UTILITY TESTS *** */
    isDigit(c) {
        return c >= '0' && c <= '9';
    }
    isAlpha(c) {
        return (c >= 'a' && c <= 'z') ||
            (c >= 'A' && c <= 'Z') ||
            c === '_';
    }
    isAlphaNumeric(c) {
        return this.isAlpha(c) || this.isDigit(c);
    }
    isAtEnd() {
        return this.current >= this.source.length;
    }
}
