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
import { scanWithDiagnostics } from "./diagnostics";
import { debounce } from "./utils";

init().then(({ bm, scan, infoMap, BiDocError, BiParserError }) => {
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
                scanWithDiagnostics(
                  connection,
                  scan,
                  uri,
                  data,
                  bm,
                  BiDocError,
                  BiParserError
                );
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
    scanWithDiagnostics(
      connection,
      scan,
      event.document.uri,
      event.document.getText(),
      bm,
      BiDocError,
      BiParserError
    );
  });
  documents.onDidChangeContent(
    debounce((change) => {
      console.log(`change ${change.document.uri}`);
      scanWithDiagnostics(
        connection,
        scan,
        change.document.uri,
        change.document.getText(),
        bm,
        BiDocError,
        BiParserError
      );
    }, 200)
  );
  connection.listen();
});
