export class Chunk {
  public code: number[] = []; // OpCodes and numberic operands
  public constants: Value[] = [];
  public lines: number[] = [];

  public write(byte: number, line: number): void {
    this.code.push(byte);
    this.lines.push(line);
  }

  public addConstant(value: Value): number {
    this.constants.push(value)
    return this.constants.length - 1;
  }
}