import { RuntimeError } from './Errors';
export class LoxInstance {
    klass;
    isLoxInstance = true;
    fields = new Map();
    hiddenSlots = new Map();
    constructor(klass) {
        this.klass = klass;
    }
    get(name) {
        if (this.fields.has(name.lexeme)) {
            return this.fields.get(name.lexeme);
        }
        const method = this.klass.findMethod(name.lexeme);
        if (method)
            return method.bind(this);
        throw new RuntimeError(name, `Undefined property '${name.lexeme}'.`);
    }
    set(name, value) {
        this.fields.set(name.lexeme, value);
    }
    toString() {
        return `${this.klass.name} instance`;
    }
}
