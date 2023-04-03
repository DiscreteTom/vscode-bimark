// https://github.com/microsoft/TypeScript/issues/49721#issuecomment-1319854183
// @ts-expect-error
import { BiMark } from "bimark";
import {
  CompletionItem,
  CompletionItemKind,
  TextDocuments,
  _Connection,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { buildMarkupContent, def2info } from "./utils";

export function registerCompletion<_>(
  connection: _Connection<_, _, _, _, _, _, _, _>,
  documents: TextDocuments<TextDocument>,
  bm: BiMark
) {
  connection.onCompletion((params) => {
    // get prefix in current line
    const prefix = documents.get(params.textDocument.uri)!.getText({
      start: { line: params.position.line, character: 0 },
      end: { line: params.position.line, character: params.position.character },
    });

    const result: CompletionItem[] = [];

    for (const name of bm.name2def.keys()) {
      const def = bm.name2def.get(name)!;
      const documentation = {
        kind: "markdown" as const,
        value: buildMarkupContent([["```ts", def2info(def), "```"]]),
      };
      result.push({
        label: name,
        kind: CompletionItemKind.Class,
        documentation,
        detail: "implicit reference",
        labelDetails: {
          description:
            name == def.name
              ? undefined // this is not an alias
              : def.name, // this is an alias, show the original name
        },
        sortText: `${name}-0`,
        filterText: name,
      });
      if (name == def.name) {
        // this is not an alias
        // this is to prevent duplicate explicit reference
        result.push({
          label: `[[#${def.id}]]`,
          kind: CompletionItemKind.Reference,
          documentation,
          detail: "explicit reference",
          labelDetails: {
            description: def.name,
          },
          sortText: `${name}-1`,
          filterText: name,
        });
      }
      result.push({
        label: `[[@${name}]]`,
        kind: CompletionItemKind.Reference,
        documentation,
        detail: "explicit reference",
        labelDetails: {
          description: def.name,
        },
        sortText: `${name}-2`,
        filterText: name,
      });
      result.push({
        label: `[[!${name}]]`,
        kind: CompletionItemKind.Constant,
        documentation,
        detail: "escaped reference",
        labelDetails: {
          description: def.name,
        },
        sortText: `${name}-3`,
        filterText: name,
      });
    }

    return result;
  });
}
