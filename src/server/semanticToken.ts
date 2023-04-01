import { SemanticTokens, _Connection } from "vscode-languageserver/node";
import { DocInfo } from "./bimark";

export function registerSemanticToken<_>(
  connection: _Connection<_, _, _, _, _, _, _, _>,
  infoMap: ReadonlyMap<string, DocInfo>
) {
  connection.languages.semanticTokens.on((params) => {
    const doc = infoMap.get(params.textDocument.uri)!;
    if (!doc) return { data: [] };

    // sort by line and column, since we need to encode the data as delta position
    const refs = [...doc.refs, ...doc.escaped].sort((a, b) => {
      if (a.fragment.position.start.line == b.fragment.position.start.line) {
        return (
          a.fragment.position.start.column - b.fragment.position.start.column
        );
      }
      return a.fragment.position.start.line - b.fragment.position.start.line;
    });

    // init result with unencoded data
    const result: SemanticTokens = { data: [] };
    refs.forEach((ref) => {
      result.data.push(
        ref.fragment.position.start.line - 1, // line
        ref.fragment.position.start.column - 1, // start character
        ref.fragment.position.end.column -
          ref.fragment.position.start.column +
          1, // length
        0, // token type, array index of capabilities.semanticTokens.legend.tokenTypes
        1 // token modifiers, bitmap of capabilities.semanticTokens.legend.tokenModifiers
      );
    });
    // according to the spec, the data should be encoded as the delta to the previous data
    // so we have to process it from the end
    for (let i = result.data.length - 5; i >= 5; i -= 5) {
      // delta line
      result.data[i] = result.data[i] - result.data[i - 5];
      if (result.data[i] == 0)
        // delta start character, only if the line is the same
        result.data[i + 1] = result.data[i + 1] - result.data[i - 4];
    }
    // console.log(result.data);

    return result;
  });
}
