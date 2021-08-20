import { Environment } from './Environment';
import { Return } from './Errors';
export class LoxFunction {
    declaration;
    closure;
    isInitializer;
    isCallable = true;
    constructor(declaration, closure, isInitializer = false) {
        this.declaration = declaration;
        this.closure = closure;
        this.isInitializer = isInitializer;
    }
    arity() {
        return this.declaration.params.length;
    }
    call(interpreter, argValues) {
        const environment = new Environment(this.closure);
        for (let i = 0; i < this.declaration.params.length; i++) {
            environment.define(this.declaration.params[i].lexeme, argValues[i]);
        }
        try {
            interpreter.executeBlock(this.declaration.body, environment);
        }
        catch (error) {
            if (error instanceof Return) {
                if (this.isInitializer)
                    return this.closure.getAt(0, 'this');
                return error.value;
            }
            throw error;
        }
        if (this.isInitializer)
            return this.closure.getAt(0, 'this');
        return null;
    }
    bind(instance) {
        const environment = new Environment(this.closure);
        environment.define('this', instance);
        return new LoxFunction(this.declaration, environment, this.isInitializer);
    }
    toString() {
        return `<fn ${this.declaration.name.lexeme}>`;
    }
}
