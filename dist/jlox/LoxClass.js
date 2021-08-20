import { LoxInstance } from './LoxInstance';
export class LoxClass {
    name;
    superclass;
    methods;
    isCallable = true;
    isLoxClass = true;
    hiddenSlots = new Map();
    constructor(name, superclass, methods) {
        this.name = name;
        this.superclass = superclass;
        this.methods = methods;
    }
    findMethod(name) {
        if (this.methods.has(name)) {
            return this.methods.get(name);
        }
        if (this.superclass !== null) {
            return this.superclass.findMethod(name);
        }
        return null;
    }
    call(interpreter, args) {
        const instance = new LoxInstance(this);
        const initializer = this.findMethod('init');
        if (initializer !== null) {
            initializer.bind(instance).call(interpreter, args);
        }
        return instance;
    }
    arity() {
        const initializer = this.findMethod('init');
        if (initializer === null)
            return 0;
        return initializer.arity();
    }
    bind() {
        return this;
    }
    toString() {
        return this.name;
    }
}
