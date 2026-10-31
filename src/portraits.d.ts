// Written by the plugin in vite.config.ts: character id, then mood, then the numbers of the
// pictures found for it, lowest first.
declare module 'virtual:portraits' {
  const pictures: Record<string, Record<string, number[] | undefined> | undefined>;
  export default pictures;
}
