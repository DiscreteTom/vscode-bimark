import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { init } from "./bimark";
import * as fs from "fs";
import * as url from "url";
import { config } from "./config";
import { registerHover } from "./hover";
import { registerCompletion } from "./completion";
import { registerDefinition } from "./definition";
import { registerReference } from "./reference";
import { registerSemanticToken } from "./semanticToken";

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
  registerReference(connection, infoMap);
  registerSemanticToken(connection, infoMap);

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
