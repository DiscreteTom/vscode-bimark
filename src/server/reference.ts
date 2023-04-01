import { _Connection } from "vscode-languageserver/node";
import { DocInfo } from "./bimark";
import { fragment2range, positionInFragment } from "./utils";

export function registerReference<_>(
  connection: _Connection<_, _, _, _, _, _, _, _>,
  infoMap: ReadonlyMap<string, DocInfo>
) {
  connection.onReferences((params) => {
    const doc = infoMap.get(params.textDocument.uri)!;
    if (!doc) return;

    // ensure the position is in the range of a def
    for (const def of doc.defs) {
      if (positionInFragment(params.position, def.fragment)) {
        return def.refs.map((ref) => {
          return {
            uri: ref.path,
            range: fragment2range(ref.fragment),
          };
        });
      }
    }
  });
}
