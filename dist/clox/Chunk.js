export class Chunk {
    code = []; // OpCodes and numberic operands
    constants = [];
    lines = [];
    write(byte, line) {
        this.code.push(byte);
        this.lines.push(line);
    }
    addConstant(value) {
        this.constants.push(value);
        return this.constants.length - 1;
    }
}
