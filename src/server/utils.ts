// https://github.com/microsoft/TypeScript/issues/49721#issuecomment-1319854183
// @ts-expect-error
import { Definition, Fragment } from "bimark";
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
  return (
    `name = '${def.name}'\n` +
    `alias = [${def.alias.map((a) => `'${a}'`).join(", ")}]\n` +
    `id = '${def.id}'\n` +
    `path = '${fileUri2relative(def.path)}'\n`
  );
}

export function fragment2range(fragment: Fragment) {
  return {
    start: {
      line: fragment.position.start.line - 1,
      character: fragment.position.start.column - 1,
    },
    end: {
      line: fragment.position.end.line - 1,
      character: fragment.position.end.column,
    },
  };
}
