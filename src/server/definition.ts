import { _Connection } from "vscode-languageserver/node";
import { DocInfo } from "./bimark";
import { fragment2range, positionInFragment } from "./utils";

export function registerDefinition<_>(
  connection: _Connection<_, _, _, _, _, _, _, _>,
  infoMap: ReadonlyMap<string, DocInfo>
) {
  connection.onDefinition((params) => {
    const doc = infoMap.get(params.textDocument.uri)!;
    if (!doc) return;

    // ensure the position is in the range of a ref
    for (const ref of doc.refs) {
      if (positionInFragment(params.position, ref.fragment)) {
        return {
          uri: ref.def.path,
          range: fragment2range(ref.def.fragment),
        };
      }
    }
  });
}
