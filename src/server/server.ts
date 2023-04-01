import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  SemanticTokens,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { init } from "./bimark";
import * as fs from "fs";
import * as url from "url";
import { config } from "./config";
import { registerHover } from "./hover";
import { registerCompletion } from "./completion";
import { registerDefinition } from "./definition";

init().then(({ bm, scan, infoMap }) => {
  const connection = createConnection(ProposedFeatures.all);
  const documents: TextDocuments<TextDocument> = new TextDocuments(
    TextDocument
  );

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
        definitionProvider: true,
        referencesProvider: true,
      },
    };
  });

  registerHover(connection, infoMap);
  registerCompletion(connection, documents, bm);
  registerDefinition(connection, infoMap);

  connection.languages.semanticTokens.on((params) => {
    const doc = infoMap.get(params.textDocument.uri)!;
    if (!doc) return { data: [] };

    // sort by line and column, since we need to encode the data as delta position
    const refs = [...doc.refs, ...doc.escaped].sort((a, b) => {
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
  connection.onReferences((params) => {
    const doc = infoMap.get(params.textDocument.uri)!;
    if (!doc) return;

    // ensure the position is in the range of a def
    for (const def of doc.defs) {
      if (
        def.fragment.position.start.line - 1 == params.position.line &&
        def.fragment.position.start.column - 1 < params.position.character &&
        def.fragment.position.end.column - 1 > params.position.character
      ) {
        return def.refs.map((ref) => {
          return {
            uri: ref.path,
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
        });
      }
    }
  });
  connection.onRequest(
    "bimark/init",
    async (params: { files: string[]; folders: string[] }) => {
      console.log(`init ${params.files.length} files`);
      await Promise.all(
        params.files.map((uri) => {
          new Promise<void>((resolve) => {
            const filePath = url.fileURLToPath(uri);
            fs.readFile(filePath, "utf8", (err, data) => {
              if (err) {
                console.error(`Error reading file ${filePath}: ${err}`);
              } else {
                scan(uri, data);
              }
              resolve();
            });
          });
        })
      );
      config.workspaceFolders = params.folders;
      console.log(`init folders: ${config.workspaceFolders.join(", ")}`);
      console.log(`init done`);
    }
  );

  documents.listen(connection);
  documents.onDidOpen((event) => {
    console.log(`open ${event.document.uri}`);
    scan(event.document.uri, event.document.getText());
  });
  documents.onDidChangeContent((change) => {
    console.log(`change ${change.document.uri}`);
    scan(change.document.uri, change.document.getText());
  });
  connection.listen();
});
