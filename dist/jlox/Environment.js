import { RuntimeError } from './Errors';
export class Environment {
    enclosing;
    values = new Map();
    constructor(enclosing = null) {
        this.enclosing = enclosing;
    }
    define(name, value) {
        this.values.set(name, value);
    }
    assign(name, value) {
        if (this.values.has(name.lexeme)) {
            this.values.set(name.lexeme, value);
            return;
        }
        if (this.enclosing) {
            this.enclosing.assign(name, value);
            return;
        }
        throw new RuntimeError(name, `Undefined variable '${name.lexeme}'.`);
    }
    assignAt(distance, name, value) {
        this.ancestor(distance).values.set(name.lexeme, value);
    }
    get(name) {
        if (this.values.has(name.lexeme)) {
            return this.values.get(name.lexeme) ?? null;
        }
        if (this.enclosing)
            return this.enclosing.get(name);
        throw new RuntimeError(name, `Undefined variable '${name.lexeme}'.`);
    }
    getAt(distance, name) {
        return this.ancestor(distance).values.get(name) ?? null;
    }
    ancestor(distance) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let environment = this;
        for (let i = 0; i < distance; i++) {
            environment = environment.enclosing;
        }
        return environment;
    }
}
