/// <reference path="./interfaces.d.ts" />
import { readFile } from 'fs/promises';
import { createInterface } from 'readline';
import { VM } from './VM';

const vm = new VM();

if (process.argv.length > 3) {
  console.log('Usage: npx ts-node clox/index.ts [script]');
  process.exit(64);
} else if (process.argv.length === 3) {
  runFile(process.argv[2]);
} else {
  repl();
}

function repl(): void {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.on('line', (line) => {
    if (!line) process.exit();
    vm.interpret(line);
  });
}

async function runFile(path: string): Promise<void> {
  const bytes = (await readFile(path)).toString();
  const result = vm.interpret(bytes);

  if (result === 'INTERPRET_COMPILE_ERROR') process.exit(65); // Indicate an error in the exit code.
  if (result === 'INTERPRET_RUNTIME_ERROR') process.exit(70);
}