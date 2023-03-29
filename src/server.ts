import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  CompletionItem,
  CompletionItemKind,
  SemanticTokens,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { init } from "./bimark";
// https://github.com/microsoft/TypeScript/issues/49721#issuecomment-1319854183
// @ts-expect-error
import type { Reference } from "bimark";

init().then(({ bm, scan }) => {
  const connection = createConnection(ProposedFeatures.all);
  connection.onInitialize((params: InitializeParams) => {
    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        hoverProvider: true,
        completionProvider: {
          resolveProvider: false,
          triggerCharacters: ["[", " ", "!", "#"],
        },
        semanticTokensProvider: {
          legend: {
            tokenTypes: ["type"],
            tokenModifiers: ["defaultLibrary"],
          },
          full: {
            delta: false,
          },
        },
      },
    };
  });
  connection.onDidOpenTextDocument((params) => {
    scan(params.textDocument.uri, params.textDocument.text);
  });
  connection.onHover((params) => {
    for (const def of bm.id2def.values()) {
      // check if this is a def
      if (
        def.path == params.textDocument.uri &&
        def.fragment.position.start.line - 1 == params.position.line &&
        def.fragment.position.start.column - 1 < params.position.character &&
        def.fragment.position.end.column - 1 > params.position.character
      ) {
        return {
          contents: {
            kind: "markdown",
            value:
              "```ts\n" +
              `// BiMark Definition\n` +
              `name = '${def.name}'\n` +
              `alias = [${def.alias.map((a) => `'${a}'`).join(", ")}]\n` +
              `id = '${def.id}'\n` +
              `path = '${def.path}'\n` +
              "```",
          },
          range: {
            start: {
              line: def.fragment.position.start.line - 1,
              character: def.fragment.position.start.column - 1,
            },
            end: {
              line: def.fragment.position.end.line - 1,
              character: def.fragment.position.end.column,
            },
          },
        };
      }
      // check if this is a ref
      for (const ref of def.refs) {
        if (
          ref.path == params.textDocument.uri &&
          ref.fragment.position.start.line - 1 == params.position.line &&
          ref.fragment.position.start.column - 1 < params.position.character &&
          ref.fragment.position.end.column - 1 > params.position.character
        ) {
          return {
            contents: {
              kind: "markdown",
              value:
                "```ts\n" +
                `// BiMark ${ref.type} reference\n` +
                `name = '${def.name}'\n` +
                `alias = [${def.alias.map((a) => `'${a}'`).join(", ")}]\n` +
                `id = '${def.id}'\n` +
                `path = '${def.path}'\n` +
                "```",
            },
            range: {
              start: {
                line: ref.fragment.position.start.line - 1,
                character: ref.fragment.position.start.column - 1,
              },
              end: {
                line: ref.fragment.position.end.line - 1,
                character: ref.fragment.position.end.column,
              },
            },
          };
        }
      }
    }
  });
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
        value:
          "```ts\n" +
          `// BiMark Definition\n` +
          `name = '${def.name}'\n` +
          `alias = [${def.alias.map((a) => `'${a}'`).join(", ")}]\n` +
          `id = '${def.id}'\n` +
          `path = '${def.path}'\n` +
          "```",
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
        label: `[[!${name}]]`,
        kind: CompletionItemKind.Constant,
        documentation,
        detail: "escaped reference",
        labelDetails: {
          description: def.name,
        },
        sortText: `${name}-2`,
        filterText: name,
      });
    }

    return result;
  });
  connection.languages.semanticTokens.on((params) => {
    const refs: Reference[] = [];
    // collect refs
    bm.id2def.forEach((def) => {
      def.refs
        .filter((ref) => ref.path == params.textDocument.uri)
        .forEach((ref) => refs.push(ref));
    });
    // sort by line and column, since we need to encode the data as delta position
    refs.sort((a, b) => {
      if (a.fragment.position.start.line == b.fragment.position.start.line) {
        return (
          a.fragment.position.start.column - b.fragment.position.start.column
        );
      }
      return a.fragment.position.start.line - b.fragment.position.start.line;
    });
    // init result with unencoded data
    const result: SemanticTokens = { data: [] };
    refs.forEach((ref) => {
      result.data.push(
        ref.fragment.position.start.line - 1, // line
        ref.fragment.position.start.column - 1, // start character
        ref.fragment.position.end.column -
          ref.fragment.position.start.column +
          1, // length
        0, // token type, array index of capabilities.semanticTokens.legend.tokenTypes
        1 // token modifiers, bitmap of capabilities.semanticTokens.legend.tokenModifiers
      );
    });
    // according to the spec, the data should be encoded as the delta to the previous data
    // so we have to process it from the end
    for (let i = result.data.length - 5; i >= 5; i -= 5) {
      // delta line
      result.data[i] = result.data[i] - result.data[i - 5];
      if (result.data[i] == 0)
        // delta start character, only if the line is the same
        result.data[i + 1] = result.data[i + 1] - result.data[i - 4];
    }
    // console.log(result.data);

    return result;
  });

  const documents: TextDocuments<TextDocument> = new TextDocuments(
    TextDocument
  );
  documents.listen(connection);
  documents.onDidChangeContent((change) => {
    scan(change.document.uri, change.document.getText());
  });

  connection.listen();
});
