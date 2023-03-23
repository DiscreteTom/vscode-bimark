import * as path from "path";
import { workspace, ExtensionContext } from "vscode";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  const serverModule = context.asAbsolutePath(path.join("out", "server.js"));

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "markdown" }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher("**/*.md"),
    },
  };

  client = new LanguageClient(
    "bimark",
    "BiMark Language Server",
    serverOptions,
    clientOptions
  );

  // this will also launch the server
  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  // this will also stop the server
  return client.stop();
}
