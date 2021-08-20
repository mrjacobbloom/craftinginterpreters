import type { Interpreter } from './Interpreter';
import { LoxInstance } from './LoxInstance'

export class LoxClass implements Callable {
  public isCallable = true as const;
  public isLoxClass = true as const;
  public hiddenSlots = new Map<string, any>();

  public constructor(public name: string, public superclass: LoxClass | null, private methods: Map<string, Callable>) {}

  public findMethod(name: string): Callable | null {
    if (this.methods.has(name)) {
      return this.methods.get(name)!;
    }

    if (this.superclass !== null) {
      return this.superclass.findMethod(name);
    }


    return null;
  }

  public call(interpreter: Interpreter, args: LiteralType[]): LiteralType {
    const instance = new LoxInstance(this);
    const initializer = this.findMethod('init');
    if (initializer !== null) {
      initializer.bind(instance).call(interpreter, args);
    }
    return instance;
  }

  public arity(): number {
    const initializer = this.findMethod('init');
    if (initializer === null) return 0;
    return initializer.arity()
  }

  public bind(): Callable {
    return this;
  }

  public toString(): string {
    return this.name;
  }
}