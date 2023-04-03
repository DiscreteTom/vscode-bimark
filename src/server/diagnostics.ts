// https://github.com/microsoft/TypeScript/issues/49721#issuecomment-1319854183
// @ts-expect-error
import { BiMark, BiDocError, BiParserError } from "bimark";
import { DiagnosticSeverity, _Connection } from "vscode-languageserver/node";
import { DocInfo } from "./bimark";
import { fileUri2relative, position2range } from "./utils";
import { config } from "./config";

export function scanWithDiagnostics<_>(
  connection: _Connection<_, _, _, _, _, _, _, _>,
  scan: (uri: string) => DocInfo,
  uri: string,
  bm: BiMark,
  infoMap: ReadonlyMap<string, DocInfo>,
  biDocError: typeof BiDocError,
  biParserError: typeof BiParserError,
  cascade: boolean
) {
  const defsBeforeScan = infoMap.get(uri)?.defs;

  try {
    scan(uri);
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
  } finally {
    // check if def has been changed, no matter if error or not
    if (cascade && defsBeforeScan) {
      const defsAfterScan = infoMap.get(uri)!.defs;
      // check equivalence
      if (
        defsBeforeScan.length != defsAfterScan.length ||
        defsBeforeScan.some((d) =>
          defsAfterScan.every((dd) => d.fragment.content != dd.fragment.content)
        )
      ) {
        // def has been changed, re-scan all other
        for (const [uri] of config.files) {
          console.log(`cascade scan by diagnostics: ${uri}`);
          if (uri != uri) {
            scanWithDiagnostics(
              connection,
              scan,
              uri,
              bm,
              infoMap,
              biDocError,
              biParserError,
              false
            );
          }
        }
      }
    }
  }

  // clear diagnostics
  connection.sendDiagnostics({
    uri,
    diagnostics: [],
  });
}
