import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { init } from "./bimark";
import { config } from "./config";
import { registerHover } from "./hover";
import { registerCompletion } from "./completion";
import { registerDefinition } from "./definition";
import { registerReference } from "./reference";
import { registerSemanticToken } from "./semanticToken";
import { scanWithDiagnostics } from "./diagnostics";
import { debounce, loadAll, scanAll } from "./utils";

init().then(({ bm, scan: _scan, infoMap, BiDocError, BiParserError }) => {
  const connection = createConnection(ProposedFeatures.all);
  const documents: TextDocuments<TextDocument> = new TextDocuments(
    TextDocument
  );
  const scan = (uri: string, cascade: boolean) => {
    scanWithDiagnostics(
      connection,
      _scan,
      uri,
      bm,
      infoMap,
      BiDocError,
      BiParserError,
      cascade
    );
  };

  connection.onInitialize((params: InitializeParams) => {
    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        hoverProvider: true,
        completionProvider: {
          resolveProvider: false,
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
      await loadAll(params.files);
      scanAll(params.files, (uri) => scan(uri, false)); // first scan to get all defs
      scanAll(params.files, (uri) => scan(uri, false)); // second scan to get all refs
      config.workspaceFolders = params.folders;
      console.log(`init folders: ${config.workspaceFolders.join(", ")}`);
      console.log(`init done`);
      // re-highlight all files
      params.files.forEach((uri) => {
        connection.sendNotification("semanticTokens/full", {
          textDocument: { uri },
        });
      });
    }
  );

  documents.listen(connection);
  documents.onDidOpen((event) => {
    console.log(`open ${event.document.uri}`);
    config.files.set(event.document.uri, event.document.getText());
    scan(event.document.uri, true);
  });
  documents.onDidChangeContent(
    debounce((change) => {
      console.log(`change ${change.document.uri}`);
      config.files.set(change.document.uri, change.document.getText());
      scan(change.document.uri, true);
    }, 200)
  );
  connection.listen();
});
