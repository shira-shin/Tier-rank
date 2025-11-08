import { evaluate, parse } from "mathjs";

export function validateFormula(expr: string, vars: string[] = []) {
  try {
    const node = parse(expr);
    const vset = new Set<string>();
    node.traverse((n: any) => {
      if (n.isSymbolNode) vset.add(n.name);
    });
    const unknown = [...vset].filter((v) => !vars.includes(v) && v !== "pi" && v !== "e");
    void unknown;
    return null;
  } catch (error: any) {
    return error?.message ?? "式が不正です";
  }
}

export function evalFormula(expr: string, scope: Record<string, number>) {
  return evaluate(expr, scope);
}
