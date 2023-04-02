// https://github.com/microsoft/TypeScript/issues/49721#issuecomment-1319854183
// @ts-expect-error
import { Definition, Fragment, Position as BMPosition } from "bimark";
import { Position } from "vscode-languageserver/node";
import { config } from "./config";

export function positionInFragment(position: Position, fragment: Fragment) {
  return (
    fragment.position.start.line - 1 == position.line &&
    fragment.position.start.column - 1 < position.character &&
    fragment.position.end.column - 1 > position.character
  );
}

export function fileUri2relative(uri: string) {
  for (const folder of config.workspaceFolders) {
    if (uri.startsWith(folder)) {
      return uri.slice(folder.length + 1); // +1 for the slash
    }
  }
  return uri;
}

export function def2info(def: Definition) {
  return [
    `name = '${def.name}'`,
    `alias = [${def.alias.map((a) => `'${a}'`).join(", ")}]`,
    `id = '${def.id}'`,
    `path = '${fileUri2relative(def.path)}'`,
  ].join("\n");
}

export function position2range(position: BMPosition) {
  return {
    start: {
      line: position.start.line - 1,
      character: position.start.column - 1,
    },
    end: {
      line: position.end.line - 1,
      character: position.end.column,
    },
  };
}

export function fragment2range(fragment: Fragment) {
  return position2range(fragment.position);
}

export function buildMarkupContent(content: string[][]) {
  return content.map((l) => l.join("\n")).join("\n\n---\n\n"); // separator
}

export type DebouncedFunction<T extends (...args: any[]) => void> = (
  ...args: Parameters<T>
) => void;

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): DebouncedFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  return function (this: any, ...args: Parameters<T>): void {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay) as any;
  };
}
