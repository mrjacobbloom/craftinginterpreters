import { readFile } from 'fs/promises';
import { createInterface } from 'readline';

import { Scanner } from './Scanner';
import { Parser } from './Parser';
import { Resolver } from './Resolver';
import { Interpreter } from './Interpreter';

import type { RuntimeError } from './Errors';
// import { ASTPrinter } from './ASTPrinter';

export class Lox {
  private interpreter = new Interpreter(this.runtimeError);
  private hadParseError = false;
  private hadRuntimeError = false;

  public constructor() {
    this.parseError = this.parseError.bind(this); // yayyyyyy
    this.runtimeError = this.runtimeError.bind(this);
  }

  public async runFile(path: string): Promise<void> {
    const bytes = (await readFile(path)).toString();
    this.run(bytes);


    if (this.hadParseError) process.exit(65); // Indicate an error in the exit code.
    if (this.hadRuntimeError) process.exit(70);
  }
  public runPrompt(): void {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.on('line', (line) => {
      if (!line) process.exit();
      this.run(line);
      this.hadParseError = false;
    });
  }

  public run(source: string): void {
    const scanner = new Scanner(source, this.parseError);
    const tokens = scanner.scanTokens();

    const parser = new Parser(tokens, this.parseError);
    const statements = parser.parse();

    if (this.hadParseError) return;

    const resolver = new Resolver(this.interpreter, this.runtimeError);
    resolver.resolveStmts(statements!);

    // Bail if there were "runtime" problems in post-parse passes, like resolver pass
    if (this.hadRuntimeError) return;

    // console.log(new ASTPrinter().print(statements!));
    this.interpreter.interpret(statements!);
  }

  private parseError(lineOrToken: number | Token, message: string): void {
    if (typeof lineOrToken === 'number') {
      this.report(lineOrToken, '', message);
    } else {
      if (lineOrToken.type === 'EOF') {
        this.report(lineOrToken.line, ' at end', message);
      } else {
        this.report(lineOrToken.line, ` at '${  lineOrToken.lexeme  }'`, message);
      }
    }
  }

  private report(line: number, where: string, message: string): void {
    console.log(`[line ${line}] Error${where}: ${message}`);
    this.hadParseError = true;
  }

  private runtimeError(error: RuntimeError): void {
    console.log(`${error.message  }\n[line ${  error.token.line  }]`)
    this.hadRuntimeError = true;
  }
}