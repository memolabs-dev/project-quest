// The database tests empty their tables. They must never run against the database the game plays on:
// on 2026-11-17 they did, and wiped a player's real progress and logbook. The clean-up runs only on *_test.
export function assertTestDatabase(url: string) {
  let name = "";
  try {
    name = new URL(url).pathname.replace(/^\//, "");
  } catch {
    throw new Error("The database tests need a postgres URL to a database whose name ends in _test");
  }
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to empty "${name}": the database tests run only on a database whose name ends in _test`);
  }
}
