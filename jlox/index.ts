/// <reference path="./interfaces.d.ts" />
import { Lox } from './lox';

const lox = new Lox();

if (process.argv.length > 3) {
  console.log('Usage: npx ts-node jlox/index.ts [script]');
  process.exit(64);
} else if (process.argv.length === 3) {
  lox.runFile(process.argv[2]);
} else {
  lox.runPrompt();
}