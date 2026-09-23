export const image = (c: { id: string }) =>
  (typeof location !== "undefined" &&
  location.pathname.startsWith("/pocket-native/")
    ? "/pocket-native"
    : "") +
  "/cards/" +
  c.id +
  ".png";
