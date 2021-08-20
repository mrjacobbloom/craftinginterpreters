/**
 * Mini mocha-like system for testing stuff, because I don't wanna deal with mocha
 */

const ANSI = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

let depth = 0;

function printDescription(description: string): void {
  console.log('  '.repeat(depth) + description);
}

function printError(error: Error): void {
  let lines = String(error).split(/\n/g);
  lines = lines.map(s => '  '.repeat(depth + 1) + s);
  console.log(lines.join('\n'));
}

export async function describe(description: string, cb: () => (void | Promise<void>)): Promise<void> {
  printDescription(description);
  depth++;
  await cb();
  depth--;
}

export async function it(description: string, cb: () => (void | Promise<void>)): Promise<void> {
  let passed = true;
  let error: Error | null = null;
  try {
    await cb();
  } catch (error_) {
    error = error_;
    passed = false;
  }
  if (passed) {
    printDescription(ANSI.green + description + ANSI.reset);
  } else {
    printDescription(ANSI.red + description + ANSI.reset);
    printError(error!);
  }
}
