export class ParseError extends Error {
}
export class RuntimeError extends Error {
    token;
    constructor(token, message) {
        super(message);
        this.token = token;
    }
}
export class Return extends Error {
    value;
    constructor(value) {
        super();
        this.value = value;
    }
}
