export async function init() {
  const { BiMark } = await import("bimark"); // esm import
  const bm = new BiMark();

  return {
    bm,
    scan: (uri: string, document: string) => {
      // first, remove existing def in the document
      const ids: string[] = [];
      const names: string[] = [];
      bm.id2def.forEach((def) => {
        if (def.path == uri) {
          ids.push(def.id);
          names.push(def.name);
          names.push(...def.alias);
        }
      });
      ids.forEach((id) => bm.id2def.delete(id));
      names.forEach((name) => bm.name2def.delete(name));

      // then, remove existing ref in the document
      // bm.id2def.forEach((def) => {
      //   def.refs = def.refs.filter((ref) => ref != uri);
      // });
      // bm.name2def.forEach((def) => {
      //   def.refs = def.refs.filter((ref) => ref != uri);
      // });

      // re-collect defs
      bm.collect(uri, document);

      // debug output
      const collectedDefs: string[] = [];
      bm.id2def.forEach((def) => {
        if (def.path == uri) {
          collectedDefs.push(def.id);
        }
      });
      console.log(
        `BiMark: collect defs from ${uri}: ${collectedDefs.join(",")}`
      );

      // re-collect refs
      // TODO
    },
  };
}
