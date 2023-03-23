import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { init } from "./bimark";

init().then(({ bm, scan }) => {
  const connection = createConnection(ProposedFeatures.all);
  connection.onInitialize((params: InitializeParams) => {
    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        hoverProvider: true,
      },
    };
  });
  connection.onDidOpenTextDocument((params) => {
    scan(params.textDocument.uri, params.textDocument.text);
  });
  connection.onHover((params) => {
    // check if this is a def
    for (const def of bm.id2def.values()) {
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
              "```",
          },
          range: {
            start: {
              line: def.fragment.position.start.line - 1,
              character: def.fragment.position.start.column - 1,
            },
            end: {
              line: def.fragment.position.end.line - 1,
              character: def.fragment.position.end.column - 1,
            },
          },
        };
      }
    }
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
