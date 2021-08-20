import { readFile } from 'fs/promises';
import { createInterface } from 'readline';
import { Scanner } from './Scanner';
import { Parser } from './Parser';
import { Resolver } from './Resolver';
import { Interpreter } from './Interpreter';
// import { ASTPrinter } from './ASTPrinter';
export class Lox {
    interpreter = new Interpreter(this.runtimeError);
    hadParseError = false;
    hadRuntimeError = false;
    constructor() {
        this.parseError = this.parseError.bind(this); // yayyyyyy
        this.runtimeError = this.runtimeError.bind(this);
    }
    async runFile(path) {
        const bytes = (await readFile(path)).toString();
        this.run(bytes);
        if (this.hadParseError)
            process.exit(65); // Indicate an error in the exit code.
        if (this.hadRuntimeError)
            process.exit(70);
    }
    runPrompt() {
        const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.on('line', (line) => {
            if (!line)
                process.exit();
            this.run(line);
            this.hadParseError = false;
        });
    }
    run(source) {
        const scanner = new Scanner(source, this.parseError);
        const tokens = scanner.scanTokens();
        const parser = new Parser(tokens, this.parseError);
        const statements = parser.parse();
        if (this.hadParseError)
            return;
        const resolver = new Resolver(this.interpreter, this.runtimeError);
        resolver.resolveStmts(statements);
        // Bail if there were "runtime" problems in post-parse passes, like resolver pass
        if (this.hadRuntimeError)
            return;
        // console.log(new ASTPrinter().print(statements!));
        this.interpreter.interpret(statements);
    }
    parseError(lineOrToken, message) {
        if (typeof lineOrToken === 'number') {
            this.report(lineOrToken, '', message);
        }
        else {
            if (lineOrToken.type === 'EOF') {
                this.report(lineOrToken.line, ' at end', message);
            }
            else {
                this.report(lineOrToken.line, ` at '${lineOrToken.lexeme}'`, message);
            }
        }
    }
    report(line, where, message) {
        console.log(`[line ${line}] Error${where}: ${message}`);
        this.hadParseError = true;
    }
    runtimeError(error) {
        console.log(`${error.message}\n[line ${error.token.line}]`);
        this.hadRuntimeError = true;
    }
}
