import { Visitor, Expr, ExprT } from './AST';

export class ASTPrinter implements Partial<Visitor<string>> {
  public print(expr: Expr): string {
    return expr.accept(this as unknown as Visitor<string>); // No stop don't
  }

  public visitBinaryExpr(expr: ExprT<'Binary'>): string {
    return this.parenthesize(expr.operator.lexeme,
      expr.left, expr.right);
  }

  public visitGroupingExpr(expr: ExprT<'Grouping'>): string {
    return this.parenthesize('group', expr.expression);
  }

  public visitLiteralExpr(expr: ExprT<'Literal'>): string {
    if (expr.value === null) return 'nil';
    return expr.value.toString();
  }

  public visitUnaryExpr(expr: ExprT<'Unary'>): string {
    return this.parenthesize(expr.operator.lexeme, expr.right);
  }

  private parenthesize(name: string, ...exprs: Expr[]): string {
    let out = `(${  name}`;
    for (const expr of exprs) {
      out += ` ${  expr.accept(this as unknown as Visitor<string>)}`;
    }
    out += ')';

    return out;
  }
}