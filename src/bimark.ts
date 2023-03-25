export async function init() {
  const { BiMark } = await import("bimark"); // esm import
  const bm = new BiMark();

  return {
    bm,
    scan: (uri: string, document: string) => {
      bm.purge(uri);

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
