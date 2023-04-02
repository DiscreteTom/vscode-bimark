import { _Connection } from "vscode-languageserver/node";
import { DocInfo } from "./bimark";
import {
  buildMarkupContent,
  def2info,
  fragment2range,
  positionInFragment,
} from "./utils";

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
            value: buildMarkupContent([
              ["```ts", def2info(def), "```"],
              ["BiMark definition."],
            ]),
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
            value: buildMarkupContent([
              ["```ts", def2info(ref.def), "```"],
              [
                `BiMark ${
                  ref.type == "implicit" ? "_implicit_" : "**explicit**"
                } reference.`,
              ],
              ["_[ctrl+click]_ to jump to definition."],
            ]),
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
            value: `BiMark escaped reference.`,
          },
          range: fragment2range(ref.fragment),
        };
      }
    }
  });
}
