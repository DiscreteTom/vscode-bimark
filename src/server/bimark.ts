// https://github.com/microsoft/TypeScript/issues/49721#issuecomment-1319854183
// @ts-expect-error
import { EscapedReference, Reference, Definition } from "bimark";
import { config } from "./config";

export type DocInfo = {
  defs: Definition[];
  refs: Reference[];
  escaped: EscapedReference[];
};

export async function init() {
  const { BiMark, BiDocError, BiParserError } = await import("bimark"); // esm import
  const bm = new BiMark();

  /**
   * `document uri -> { defs, refs, escaped }`
   */
  const infoMap = new Map<string, DocInfo>();

  return {
    bm,
    /**
     * `document uri -> { defs, refs, escaped }`
     */
    infoMap: infoMap as ReadonlyMap<string, DocInfo>,
    BiDocError,
    BiParserError,
    scan: (uri: string) => {
      bm.purge(uri); // remove old data

      const document = config.files.get(uri)!;

      // ensure docMap has this uri
      if (!infoMap.has(uri))
        infoMap.set(uri, { defs: [], refs: [], escaped: [] });

      const doc = infoMap.get(uri)!;
      // re-collect defs
      doc.defs = bm.collectDefs(uri, document);

      // debug output
      console.log(
        `collect defs from ${uri}: ${doc.defs
          .map((d) => `'${d.name}'`)
          .join(", ")}`
      );

      // re-collect refs
      const res = bm.collectRefs(uri, document);
      doc.refs = res.refs.map((r) => r.ref);
      doc.escaped = res.escaped.map((r) => r.ref);

      // debug output
      console.log(`collect ${doc.refs.length} refs from ${uri}`);
      console.log(`collect ${doc.escaped.length} escaped refs from ${uri}`);

      return doc;
    },
  };
}
