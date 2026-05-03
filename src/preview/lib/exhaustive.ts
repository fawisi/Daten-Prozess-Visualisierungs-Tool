/**
 * Exhaustive-Switch-Helper.
 *
 * Aufruf in `default:`-Branches von switch-Statements ueber Union-Types.
 * TypeScript prueft zur Compile-Zeit, dass `value` vom Type `never` ist —
 * das ist nur dann der Fall, wenn alle Union-Mitglieder im switch
 * abgedeckt sind. Wird ein neuer Wert zur Union hinzugefuegt, schlaegt
 * der Compile-Fehler an genau den Stellen an, wo eine Erweiterung
 * noetig ist.
 *
 * Siehe Plan-Anhang D.4.
 *
 * Beispiel:
 *   switch (diagramType) {
 *     case 'bpmn': ...
 *     case 'erd': ...
 *     case 'landscape': ...
 *     default: return assertNever(diagramType);
 *   }
 */
export function assertNever(value: never, context?: string): never {
  throw new Error(
    `Unhandled discriminant${context ? ` in ${context}` : ''}: ${JSON.stringify(value)}`,
  );
}
