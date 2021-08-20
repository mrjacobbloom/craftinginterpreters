export class ASTPrinter {
    print(expr) {
        return expr.accept(this); // No stop don't
    }
    visitBinaryExpr(expr) {
        return this.parenthesize(expr.operator.lexeme, expr.left, expr.right);
    }
    visitGroupingExpr(expr) {
        return this.parenthesize('group', expr.expression);
    }
    visitLiteralExpr(expr) {
        if (expr.value === null)
            return 'nil';
        return expr.value.toString();
    }
    visitUnaryExpr(expr) {
        return this.parenthesize(expr.operator.lexeme, expr.right);
    }
    parenthesize(name, ...exprs) {
        let out = `(${name}`;
        for (const expr of exprs) {
            out += ` ${expr.accept(this)}`;
        }
        out += ')';
        return out;
    }
}
