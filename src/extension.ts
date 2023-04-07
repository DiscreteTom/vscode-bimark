import * as path from "path";
import { workspace, ExtensionContext } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import { GitIgnore } from "cspell-gitignore";
import * as url from "url";

let client: LanguageClient;

export async function activate(context: ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    path.join("out", "server/server.js")
  );

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
  await client.start();

  // send initial file list & workspace folders, ignore files that are in .gitignore
  /** file path string list. */
  const allFiles = (await workspace.findFiles("**/*.md")).map((f) => f.fsPath);
  const gitIgnore = new GitIgnore(
    workspace.workspaceFolders?.map((f) => f.uri.fsPath) ?? []
  );
  /** uri string list */
  const files = (await gitIgnore.filterOutIgnored(allFiles)).map((f) =>
    url.pathToFileURL(f).toString()
  );
  console.log(
    `init: filtered ${allFiles.length} files to ${files.length} files`
  );

  await client.sendRequest("bimark/init", {
    files,
    folders: workspace.workspaceFolders?.map((f) => f.uri.toString()) ?? [],
  });
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  // this will also stop the server
  return client.stop();
}
