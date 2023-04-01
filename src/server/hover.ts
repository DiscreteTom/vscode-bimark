import { _Connection } from "vscode-languageserver/node";
import { DocInfo } from "./bimark";
import { def2info, fragment2range, positionInFragment } from "./utils";

export function registerHover<_>(
  connection: _Connection<_, _, _, _, _, _, _, _>,
  infoMap: ReadonlyMap<string, DocInfo>
) {
  connection.onHover((params) => {
    const doc = infoMap.get(params.textDocument.uri);
    if (!doc) return;

    // check if the hover text is a def
    for (const def of doc.defs) {
      if (positionInFragment(params.position, def.fragment)) {
        return {
          contents: {
            kind: "markdown",
            value: "```ts\n" + `// BiMark Definition\n` + def2info(def) + "```",
          },
          range: fragment2range(def.fragment),
        };
      }
    }

    // check if the hover text is a ref
    for (const ref of doc.refs) {
      if (positionInFragment(params.position, ref.fragment)) {
        return {
          contents: {
            kind: "markdown",
            value:
              "```ts\n" +
              `// BiMark ${ref.type} reference\n` +
              def2info(ref.def) +
              "```",
          },
          range: fragment2range(ref.fragment),
        };
      }
    }

    // check if the hover text is an escaped ref
    for (const ref of doc.escaped) {
      if (positionInFragment(params.position, ref.fragment)) {
        return {
          contents: {
            kind: "markdown",
            value: `BiMark ${ref.type} reference`,
          },
          range: fragment2range(ref.fragment),
        };
      }
    }
  });
}