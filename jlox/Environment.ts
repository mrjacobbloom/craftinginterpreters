import { RuntimeError } from './Errors';

export class Environment {
  private values = new Map<string, LiteralType>();

  public constructor(public enclosing: Environment | null = null) {}

  public define(name: string, value: LiteralType): void {
    this.values.set(name, value);
  }

  public assign(name: Token, value: LiteralType): void {
    if (this.values.has(name.lexeme)) {
      this.values.set(name.lexeme, value);
      return;
    }

    if (this.enclosing) {
      this.enclosing.assign(name, value);
      return;
    }

    throw new RuntimeError(name, `Undefined variable '${  name.lexeme  }'.`);
  }

  public assignAt(distance: number, name: Token, value: LiteralType): void {
    this.ancestor(distance).values.set(name.lexeme, value);
  }

  public get(name: Token): LiteralType {
    if (this.values.has(name.lexeme)) {
      return this.values.get(name.lexeme) ?? null;
    }

    if (this.enclosing) return this.enclosing.get(name);

    throw new RuntimeError(name, `Undefined variable '${name.lexeme}'.`);
  }

  public getAt(distance:  number, name: string): LiteralType {
    return this.ancestor(distance).values.get(name) ?? null;
  }

  private ancestor(distance: number): Environment {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let environment: Environment = this;
    for (let i = 0; i < distance; i++) {
      environment = environment.enclosing!; 
    }

    return environment;
  }
}