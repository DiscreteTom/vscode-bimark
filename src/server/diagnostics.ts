// https://github.com/microsoft/TypeScript/issues/49721#issuecomment-1319854183
// @ts-expect-error
import { BiMark, BiDocError, BiParserError } from "bimark";
import { DiagnosticSeverity, _Connection } from "vscode-languageserver/node";
import { DocInfo } from "./bimark";
import { fileUri2relative, position2range } from "./utils";

export function scanWithDiagnostics<_>(
  connection: _Connection<_, _, _, _, _, _, _, _>,
  scan: (uri: string, document: string) => DocInfo,
  uri: string,
  document: string,
  bm: BiMark,
  biDocError: typeof BiDocError,
  biParserError: typeof BiParserError
) {
  try {
    scan(uri, document);
  } catch (e) {
    if (e instanceof biParserError) {
      if (e.type == "DEF_NOT_FOUND") {
        const msg = e.defName ? `name=\`${e.defName}\`` : `id=\`${e.defId}\``;
        connection.sendDiagnostics({
          uri,
          diagnostics: [
            {
              severity: DiagnosticSeverity.Error,
              range: position2range(e.position!),
              message: `Definition not found: ${msg}`,
              source: "bimark",
            },
          ],
        });
      } else {
        console.log(`unknown error: ${e}`);
      }
    } else if (e instanceof biDocError) {
      if (e.type == "DEF_NOT_FOUND") {
        const msg = e.defName ? `name=\`${e.defName}\`` : `id=\`${e.defId}\``;
        connection.sendDiagnostics({
          uri,
          diagnostics: [
            {
              severity: DiagnosticSeverity.Error,
              range: position2range(e.position!),
              message: `Definition not found: ${msg}`,
              source: "bimark",
            },
          ],
        });
      } else if (e.type == "DUP_DEF_ID") {
        const def = bm.id2def.get(e.defId!)!;
        connection.sendDiagnostics({
          uri,
          diagnostics: [
            {
              severity: DiagnosticSeverity.Error,
              range: position2range(e.position!),
              message: `Duplicate definition id: \`${
                e.defId
              }\`, first defined at ${fileUri2relative(def.path)} ${
                def.fragment.position.start.line
              }:${def.fragment.position.start.column}`,
              source: "bimark",
            },
          ],
        });
      } else if (e.type == "DUP_DEF_NAME") {
        const def = bm.name2def.get(e.defName!)!;
        connection.sendDiagnostics({
          uri,
          diagnostics: [
            {
              severity: DiagnosticSeverity.Error,
              range: position2range(e.position!),
              message: `Duplicate definition name: \`${
                e.defName
              }\`, first defined at ${fileUri2relative(def.path)} ${
                def.fragment.position.start.line
              }:${def.fragment.position.start.column}`,
              source: "bimark",
            },
          ],
        });
      }
    }

    return;
  }

  // clear
  connection.sendDiagnostics({
    uri,
    diagnostics: [],
  });
}
