This repo contains the results of my read-through of [Crafting Interpreters](https://craftinginterpreters.com/), which walks you through building 2 interpreters for a toy programming language called Lox. The book implements them in Java and C, but I ported each to TypeScript instead.

It's not _super_ well-commented and there are basically no tests, sorry. Under no circumstances should this be used in production code (not that I'll try and stop you).

## Implementation Notes
There were naturally some changes that fell out of the move from Java/C to TypeScript. Here's an inexhaustive list:

### jlox
- Instead of generating AST.ts, I used extensive type-f*ckery in that file to make a Visitor type that grabs the properties off of Expr/Stmt. I'm actually pretty proud of how I did this while staying fairly close to the book, but it's definitely not idiomatic TypeScript.
- The Lox class' methods aren't all static, it's instantiated in index.ts
- Overloaded functions are replaced with differently-named functions
- There's some jankiness regarding passing around `Lox.error`, `Lox.runtimeError`, etc.

### clox
- Way more object-oriented where appropriate
- Pointers are largely replaced with raw indexes and index addition. To compensate, a lot of variables' names have changed. For example, `CallFrame.slots` is renamed to `CallFrame.firstSlotIndex`
- I just... straight-up didn't do a lot of the memory management stuff.
  - There's no garbage collector. We just depend on JS's GC
  - Strings are treated like any other primitive JS value. No string interning
  - Instead of 3ish Value types and a bunch of Obj types, there are just a bunch of Value types and no concept of Obj's.
- All arrays are dynamically-sized (`Array.push`/`pop`). I initially used pre-sized arrays and a separate length variable like the book does, but that's a recipe for memory leaks in JS. Also, V8's devs [specifically recommend against it](https://v8.dev/blog/elements-kinds#avoid-creating-holes) for performance reasons
  - Note: Initially I did the "fixed-size arrays and separate length variable" thing, and I saw no performance difference after I switched. But I wasn't benchmarking memory. And also it's not idiomatic JS. And also whatever
- Uses native JS Maps instead of custom-built Tables. I used Tables initially (they're still there in clox/Table.ts) but during the optimization chapter I found native Maps to be faster.

## Running it
```bash
nvm use 15 # I always forget this. If it says something like "can't find fs/promises" this is why

npm run build

npm run jlox
npm run jlox examples/microbenchmarks.lox

npm run clox
npm run clox examples/microbenchmarks.lox


# chrome://inspect
npm run jlox-inspect
npm run clox-inspect
```

## Builtins
I added a handful of builtins that make Lox easier to work with

- `runtime()` - returns `"clox"` or `"jlox"`. It's used  by the benchmarks to print which runtime we're benchmarking
- `schedule(secs, callbackWith0Params)` - schedules the given function to run in `secs` seconds
- `typeOf(value)` - returns one of `"object"` `"function"` `"string"` `"boolean"` `"number"` or `"nil"`
- `toString(value)` - stringifies the given value, so it can be concatenated in print statements, etc.
- `Array()` (jlox only) - minimal implementation of array class. It probably does what you expect:
  - `.length`
  - `.set(index, value)`
  - `.get(index)`
  - `.push(value)`
  - `.forEach(callbackWith1Param)`


## Navigating this repo
- `challenges` - I did a handful of the many challenges throughout the book. Each file is one challenge, named `<chapter#>.<challenge#>.<extension>` -- so `25.3.lox` is [chapter 25, challenge 3](https://craftinginterpreters.com/closures.html#challenges) and it's a lox program.
- `clox` - The source for the clox implementation
- `examples` - Example lox programs. Some of them are pulled straight from the book, some are of my own devising. I pruned the least interesting ones. A couple noteworthy ones:
  - `builtins.lox` - A test suite for the built-in functions
  - `microbenchmarks.lox` - A benchmark suite to compare jlox vs clox
- `jlox` - The source for the jlox implementation
- `mochita.ts` - a janky little library I wrote that provides a similar API to Mocha, but (a) can just be imported instead of run as a standalone binary and (b) didn't require me to figure out how to get ts-node and mocha working together when I was using ts-node, since I've struggled with TS+Mocha before (albeit a couple years ago)
  - I know "mocha" isn't the Spanish word for coffee with chocolate in it. It means, uh, [something else](https://en.wiktionary.org/wiki/mocho#Spanish). Shh.


## Clox Optimizations
Execution speed is so variable, maybe I need to up the iteration count?
- Switch from custom-built Table to builtin `Map`
  - zoo.benchmark.lox went from 50 secs to 34 secs
- Replace `vm.push` and `vm.pop` with `vm.stack.push` and `vm.stack.pop`
  - zoo.benchmark.lox went from 34 secs to 27 secs
- _[ABORTED]_ Inline `vm.readByte`, `vm.readConstant`, and `vm.readString`
  - Provided no/negligible speed boost: zoo.benchmark.lox went from 27.761 secs to 27.188 secs (which I'd consider within the margin of error)
  - And it makes everything SO MUCH UGLIER, I wish TS had macros/inlining but I'm not gonna complicate my build process with a n additional preprocessor
- Store `frame.closure.fun.chunk.code` and `....constants` on `CallFrame` (a la `frame.funCode`)
  - zoo.benchmark.lox went from 35 secs to 30-31 secs

## License
> Note: The source of the original Lox interpreters, and a few of the example programs in this repo which were taken from the book, are available at https://github.com/munificent/craftinginterpreters and are under an MIT license.

Copyright 2021 Jacob Bloom

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.