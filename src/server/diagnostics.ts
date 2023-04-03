// https://github.com/microsoft/TypeScript/issues/49721#issuecomment-1319854183
// @ts-expect-error
import { BiMark, BiDocError, BiParserError, Definition } from "bimark";
import {
  Diagnostic,
  DiagnosticSeverity,
  _Connection,
} from "vscode-languageserver/node";
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
  const result = {
    uri,
    diagnostics: [] as Diagnostic[],
  };

  let counter = 100; // prevent infinite loop
  while (counter-- > 0) {
    result.diagnostics = []; // reset diagnostics in the last loop

    const defsBeforeScan = infoMap.get(uri)?.defs ?? [];

    try {
      scan(uri);
    } catch (e) {
      if (e instanceof biParserError) {
        if (e.type == "DEF_NOT_FOUND") {
          const msg = e.defName ? `name=\`${e.defName}\`` : `id=\`${e.defId}\``;
          result.diagnostics = [
            {
              severity: DiagnosticSeverity.Error,
              range: position2range(e.position!),
              message: `Definition not found: ${msg}`,
              source: "bimark",
            },
          ];
        } else {
          console.log(`unknown error: ${e}`);
        }
      } else if (e instanceof biDocError) {
        if (e.type == "DEF_NOT_FOUND") {
          const msg = e.defName ? `name=\`${e.defName}\`` : `id=\`${e.defId}\``;
          result.diagnostics = [
            {
              severity: DiagnosticSeverity.Error,
              range: position2range(e.position!),
              message: `Definition not found: ${msg}`,
              source: "bimark",
            },
          ];
        } else if (e.type == "DUP_DEF_ID") {
          const def = bm.id2def.get(e.defId!)!;
          result.diagnostics = [
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
          ];
        } else if (e.type == "DUP_DEF_NAME") {
          const def = bm.name2def.get(e.defName!)!;
          result.diagnostics = [
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
          ];
        } else {
          console.log(`unknown error: ${e}`);
        }
      }
    }

    // check if def has been changed, no matter if error or not
    if (cascade) {
      const defsAfterScan = infoMap.get(uri)!.defs;
      // check equivalence
      if (!equal(defsBeforeScan, defsAfterScan)) {
        // def has been changed, re-scan all other
        let otherDefChanged = false;
        for (const [otherFile] of config.files) {
          if (otherFile != uri) {
            console.log(`cascade scan by diagnostics: ${otherFile}`);
            const otherDefBeforeScan = infoMap.get(otherFile)?.defs ?? [];
            scanWithDiagnostics(
              connection,
              scan,
              otherFile,
              bm,
              infoMap,
              biDocError,
              biParserError,
              false
            );
            const otherDefAfterScan = infoMap.get(otherFile)!.defs;
            if (!equal(otherDefBeforeScan, otherDefAfterScan)) {
              otherDefChanged = true;
              console.log(
                `cascade scan found definitions in ${otherFile} changed`
              );
            }
          }
        }
        if (!otherDefChanged) {
          // no other def changed, break
          break;
        }
        // else, other def changed, we need to re-scan this file
        continue;
      } else {
        // no def changed
        break;
      }
    } else {
      // no cascade, break
      break;
    }
  }

  connection.sendDiagnostics(result);
}

function equal(a: Definition[], b: Definition[]) {
  if (a.length != b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].fragment.content != b[i].fragment.content) return false;
  }
  return true;
}
