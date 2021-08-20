import type { LoxClass } from './LoxClass';
import { RuntimeError } from './Errors';

export class LoxInstance {
  public isLoxInstance = true as const;
  private fields: Map<string, LiteralType> = new Map();
  public hiddenSlots = new Map<string, any>();

  public constructor(private klass: LoxClass) {}

  public get(name: Token): LiteralType {
    if (this.fields.has(name.lexeme)) {
      return this.fields.get(name.lexeme)!;
    }

    const method = this.klass.findMethod(name.lexeme);
    if (method) return method.bind(this);


    throw new RuntimeError(name, `Undefined property '${name.lexeme}'.`);
  }

  public set(name: Token, value: LiteralType): void {
    this.fields.set(name.lexeme, value);
  }

  public toString(): string {
    return `${this.klass.name} instance`;
  }
}