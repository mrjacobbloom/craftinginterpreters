export class Scanner {
    source;
    start = 0;
    current = 0;
    line = 1;
    constructor(source) {
        this.source = source;
    }
    scanToken() {
        this.skipWhitespace();
        this.start = this.current;
        if (this.isAtEnd())
            return this.makeToken(39 /* EOF */);
        const c = this.advance();
        if (this.isAlpha(c))
            return this.identifier();
        if (this.isDigit(c))
            return this.number();
        switch (c) {
            case '(': return this.makeToken(0 /* LEFT_PAREN */);
            case ')': return this.makeToken(1 /* RIGHT_PAREN */);
            case '{': return this.makeToken(2 /* LEFT_BRACE */);
            case '}': return this.makeToken(3 /* RIGHT_BRACE */);
            case ';': return this.makeToken(8 /* SEMICOLON */);
            case ',': return this.makeToken(4 /* COMMA */);
            case '.': return this.makeToken(5 /* DOT */);
            case '-': return this.makeToken(6 /* MINUS */);
            case '+': return this.makeToken(7 /* PLUS */);
            case '/': return this.makeToken(9 /* SLASH */);
            case '*': return this.makeToken(10 /* STAR */);
            case '!': return this.makeToken(this.match('=') ? 12 /* BANG_EQUAL */ : 11 /* BANG */);
            case '=': return this.makeToken(this.match('=') ? 14 /* EQUAL_EQUAL */ : 13 /* EQUAL */);
            case '<': return this.makeToken(this.match('=') ? 18 /* LESS_EQUAL */ : 17 /* LESS */);
            case '>': return this.makeToken(this.match('=') ? 16 /* GREATER_EQUAL */ : 15 /* GREATER */);
            case '"': return this.string();
        }
        return this.errorToken('Unexpected character.');
    }
    makeToken(type) {
        return {
            type,
            lexeme: this.source.substring(this.start, this.current),
            line: this.line,
        };
    }
    errorToken(message) {
        return {
            type: 38 /* ERROR */,
            lexeme: message,
            line: this.line,
        };
    }
    skipWhitespace() {
        while (true) {
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
                        while (this.peek() != '\n' && !this.isAtEnd())
                            this.advance();
                    }
                    else {
                        return;
                    }
                    break;
                default:
                    return;
            }
        }
    }
    identifierType() {
        switch (this.source.charAt(this.start)) {
            case 'a': return this.checkKeyword(1, "nd", 22 /* AND */);
            case 'c': return this.checkKeyword(1, "lass", 23 /* CLASS */);
            case 'e': return this.checkKeyword(1, "lse", 24 /* ELSE */);
            case 'f':
                if (this.current - this.start > 1) {
                    switch (this.source.charAt(this.start + 1)) {
                        case 'a': return this.checkKeyword(2, "lse", 25 /* FALSE */);
                        case 'o': return this.checkKeyword(2, "r", 26 /* FOR */);
                        case 'u': return this.checkKeyword(2, "n", 27 /* FUN */);
                    }
                }
                break;
            case 'i': return this.checkKeyword(1, "f", 28 /* IF */);
            case 'n': return this.checkKeyword(1, "il", 29 /* NIL */);
            case 'o': return this.checkKeyword(1, "r", 30 /* OR */);
            case 'p': return this.checkKeyword(1, "rint", 31 /* PRINT */);
            case 'r': return this.checkKeyword(1, "eturn", 32 /* RETURN */);
            case 's': return this.checkKeyword(1, "uper", 33 /* SUPER */);
            case 't':
                if (this.current - this.start > 1) {
                    switch (this.source.charAt(this.start + 1)) {
                        case 'h': return this.checkKeyword(2, "is", 34 /* THIS */);
                        case 'r': return this.checkKeyword(2, "ue", 35 /* TRUE */);
                    }
                }
                break;
            case 'v': return this.checkKeyword(1, "ar", 36 /* VAR */);
            case 'w': return this.checkKeyword(1, "hile", 37 /* WHILE */);
        }
        return 19 /* IDENTIFIER */;
    }
    checkKeyword(start, rest, type) {
        if (this.current - this.start == start + rest.length && rest === this.source.substring(this.start + start, this.start + start + rest.length)) {
            return type;
        }
        return 19 /* IDENTIFIER */;
    }
    /* *** PRIMITIVE OPERATIONS *** */
    advance() {
        return this.source.charAt(this.current++);
    }
    match(expected) {
        if (this.isAtEnd())
            return false;
        if (this.source.charAt(this.current) != expected)
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
        while (this.peek() != '"' && !this.isAtEnd()) {
            if (this.peek() == '\n')
                this.line++;
            this.advance();
        }
        if (this.isAtEnd()) {
            return this.errorToken("Unterminated string.");
        }
        // The closing ".
        this.advance();
        return this.makeToken(20 /* STRING */);
    }
    number() {
        while (this.isDigit(this.peek()))
            this.advance();
        // Look for a fractional part.
        if (this.peek() == '.' && this.isDigit(this.peekNext())) {
            // Consume the "."
            this.advance();
            while (this.isDigit(this.peek()))
                this.advance();
        }
        return this.makeToken(21 /* NUMBER */);
    }
    identifier() {
        while (this.isAlphaNumeric(this.peek()))
            this.advance();
        return this.makeToken(this.identifierType());
    }
    /* *** UTILITY TESTS *** */
    isDigit(c) {
        return c >= '0' && c <= '9';
    }
    isAlpha(c) {
        return (c >= 'a' && c <= 'z') ||
            (c >= 'A' && c <= 'Z') ||
            c == '_';
    }
    isAlphaNumeric(c) {
        return this.isAlpha(c) || this.isDigit(c);
    }
    isAtEnd() {
        return this.current >= this.source.length;
    }
}
