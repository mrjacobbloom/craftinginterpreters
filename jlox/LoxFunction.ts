import type { StmtT } from './AST';
import { Environment } from './Environment';
import { Return } from './Errors';
import type { Interpreter } from './Interpreter';
import type { LoxInstance } from './LoxInstance';

export class LoxFunction implements Callable {
  public isCallable = true as const;
  public constructor(private declaration: StmtT<'Function'>, private closure: Environment, private isInitializer = false) {}

  public arity(): number {
    return this.declaration.params.length;
  }

  public call(interpreter: Interpreter, argValues: LiteralType[]): LiteralType {
    const environment = new Environment(this.closure);
    for (let i = 0; i < this.declaration.params.length; i++) {
      environment.define(this.declaration.params[i].lexeme, argValues[i]);
    }

    try {
      interpreter.executeBlock(this.declaration.body, environment);
    } catch (error) {
      if (error instanceof Return) {
        if (this.isInitializer) return this.closure.getAt(0, 'this');
        return error.value;
      }
      throw error;
    }
    if (this.isInitializer) return this.closure.getAt(0, 'this');
    return null;
  }

  public bind(instance: LoxInstance): LoxFunction {
    const environment = new Environment(this.closure);
    environment.define('this', instance);
    return new LoxFunction(this.declaration, environment, this.isInitializer);
  }

  public toString(): string {
    return `<fn ${this.declaration.name.lexeme}>`;
  }
}