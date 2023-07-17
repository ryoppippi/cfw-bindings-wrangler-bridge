// @ts-check
import { deepStrictEqual } from "node:assert";
import {
  createRunner,
  equalRejectedResult,
  sleepAfterRejectedResult,
} from "../test-utils.js";

/**
 * @param {D1Result} actual
 * @param {D1Result} expect
 */
const _equalD1Result = (actual, expect) => {
  deepStrictEqual(actual.results, expect.results);
  deepStrictEqual(actual.success, expect.success);
  deepStrictEqual(actual.error, expect.error);

  const [aKeys, eKeys] = [Object.keys(actual.meta), Object.keys(expect.meta)];
  deepStrictEqual(aKeys.sort(), eKeys.sort());
};

/**
 * @param {D1PreparedStatement} actual
 * @param {D1PreparedStatement} expect
 */
const _equalD1PreparedStatement = (actual, expect) => {
  deepStrictEqual(typeof actual.bind, typeof expect.bind);
  deepStrictEqual(typeof actual.first, typeof expect.first);
  deepStrictEqual(typeof actual.run, typeof expect.run);
  deepStrictEqual(typeof actual.all, typeof expect.all);
  deepStrictEqual(typeof actual.raw, typeof expect.raw);
};

/**
 * @param {D1ExecResult} actual
 * @param {D1ExecResult} expect
 */
const _equalD1ExecResult = (actual, expect) => {
  deepStrictEqual(actual.count, expect.count);
  deepStrictEqual(typeof actual.duration, typeof expect.duration);
};

/**
 * @param {PromiseSettledResult<unknown>} aRes
 * @param {PromiseSettledResult<unknown>} eRes
 */
const equalD1Result = (aRes, eRes) => {
  if (aRes.status === "fulfilled" && eRes.status === "fulfilled")
    return _equalD1Result(
      /** @type {D1Result} */ (aRes.value),
      /** @type {D1Result} */ (eRes.value),
    );

  deepStrictEqual(aRes, eRes);
};

/**
 * @param {PromiseSettledResult<unknown>} aRes
 * @param {PromiseSettledResult<unknown>} eRes
 */
const equalD1PreparedStatement = (aRes, eRes) => {
  if (aRes.status === "fulfilled" && eRes.status === "fulfilled")
    return _equalD1PreparedStatement(
      /** @type {D1PreparedStatement} */ (aRes.value),
      /** @type {D1PreparedStatement} */ (eRes.value),
    );

  deepStrictEqual(aRes, eRes);
};

/**
 * @param {PromiseSettledResult<unknown>} aRes
 * @param {PromiseSettledResult<unknown>} eRes
 */
const equalD1ExecResult = (aRes, eRes) => {
  if (aRes.status === "fulfilled" && eRes.status === "fulfilled")
    return _equalD1ExecResult(
      /** @type {D1ExecResult} */ (aRes.value),
      /** @type {D1ExecResult} */ (eRes.value),
    );

  deepStrictEqual(aRes, eRes);
};

/** @param {[D1Database, D1Database]} bindings */
export const createSpecs = ([ACTUAL, EXPECT]) => {
  const beforeEach = async () => {
    /** @type {[{ results: any[] }, { results: any[] }]} */
    const [{ results: aResults }, { results: eResults }] = await Promise.all([
      ACTUAL.prepare("PRAGMA table_list").all(),
      EXPECT.prepare("PRAGMA table_list").all(),
    ]);
    const [aTableNames, eTableNames] = [
      aResults
        .filter((r) => r.type === "table" && !r.name.startsWith("sqlite_"))
        .map((r) => r.name),
      eResults
        .filter((r) => r.type === "table" && !r.name.startsWith("sqlite_"))
        .map((r) => r.name),
    ];

    await Promise.all([
      ACTUAL.exec(
        aTableNames.map((n) => `DROP TABLE IF EXISTS ${n};`).join("\n"),
      ).catch(() => {}),
      EXPECT.exec(
        eTableNames.map((n) => `DROP TABLE IF EXISTS ${n};`).join("\n"),
      ).catch(() => {}),
    ]);
  };

  /** @type {[name: string, spec: () => Promise<void>][]} */
  const specs = [];
  const run = createRunner([ACTUAL, EXPECT]);

  specs.push([
    "D1.prepare(query)",
    async () => {
      let prepareRes = await run((D1) =>
        D1.prepare("SELECT * FROM sqlite_master"),
      );
      equalD1PreparedStatement(prepareRes[0], prepareRes[1]);
      prepareRes = await run((D1) => D1.prepare(""));
      equalD1PreparedStatement(prepareRes[0], prepareRes[1]);
    },
  ]);

  specs.push([
    "D1PreparedStatement.bind(...values)",
    async () => {
      let prepareRes = await run((D1) =>
        D1.prepare("SELECT ? AS value;").bind("foo"),
      );
      equalD1PreparedStatement(prepareRes[0], prepareRes[1]);
    },
  ]);

  specs.push([
    "D1PreparedStatement.first() / D1PreparedStatement.first(column)",
    async () => {
      await run((D1) =>
        D1.exec(
          [
            "CREATE TABLE todos (TodoId INTEGER PRIMARY KEY, Name TEXT);",
            "INSERT INTO todos VALUES (1, 'Buy coffee'), (2, 'Play the guitar');",
          ].join("\n"),
        ),
      );

      let firstRes = await run((D1) =>
        D1.prepare("SELECT COUNT(*) AS total FROM points").first(),
      );
      deepStrictEqual(firstRes[0], firstRes[1]);
      firstRes = await run((D1) =>
        D1.prepare("SELECT COUNT(*) AS total FROM points").first("total"),
      );
      deepStrictEqual(firstRes[0], firstRes[1]);
      firstRes = await run((D1) =>
        D1.prepare("SELECT COUNT(*) AS total FROM points").first("typo"),
      );
      equalRejectedResult(firstRes[0], firstRes[1]);
      await sleepAfterRejectedResult();
    },
  ]);

  specs.push([
    "D1PreparedStatement.all()",
    async () => {
      await run((D1) =>
        D1.exec(
          [
            "CREATE TABLE todos (TodoId INTEGER PRIMARY KEY, Name TEXT);",
            "INSERT INTO todos VALUES (1, 'Buy coffee'), (2, 'Play the guitar');",
          ].join("\n"),
        ),
      );

      let allRes = await run((D1) =>
        D1.prepare("SELECT * FROM todos;").all(),
      );
      equalD1Result(allRes[0], allRes[1]);
    },
  ]);

  specs.push([
    "D1PreparedStatement.raw()",
    async () => {
      await run((D1) =>
        D1.exec(
          [
            "CREATE TABLE todos (TodoId INTEGER PRIMARY KEY, Name TEXT);",
            "INSERT INTO todos VALUES (1, 'Buy coffee'), (2, 'Play the guitar');",
          ].join("\n"),
        ),
      );

      let rawRes = await run((D1) =>
        D1.prepare("SELECT * FROM todos LIMIT 1;").raw(),
      );
      deepStrictEqual(rawRes[0], rawRes[1]);
    },
  ]);

  specs.push([
    "D1PreparedStatement.run()",
    async () => {
      await run((D1) =>
        D1.exec(
          [
            "CREATE TABLE todos (TodoId INTEGER PRIMARY KEY, Name TEXT);",
            "INSERT INTO todos VALUES (1, 'Buy coffee'), (2, 'Play the guitar');",
          ].join("\n"),
        ),
      );

      let runRes = await run((D1) =>
        D1.prepare("INSERT INTO todos VALUES (3, 'Learn SQL')").run(),
      );
      equalD1Result(runRes[0], runRes[1]);
      runRes = await run((D1) =>
        D1.prepare("INSERT INTO todos VALUES (3, 'DUPLICATE')").run(),
      );
      equalRejectedResult(runRes[0], runRes[1]);
      await sleepAfterRejectedResult();
    },
  ]);

  specs.push([
    "D1.dump()",
    async () => {
      let dumpRes = await run((D1) => D1.dump());
      deepStrictEqual(dumpRes[0], dumpRes[1]);
    },
  ]);

  // D1.batch()

  specs.push([
    "D1.exec(query)",
    async () => {
      let execRes = await run((D1) => D1.exec("INVALID"));
      equalRejectedResult(execRes[0], execRes[1]);
      await sleepAfterRejectedResult();

      execRes = await run((D1) =>
        D1.exec(
          [
            "DROP TABLE IF EXISTS Customers;",
            "CREATE TABLE Customers (CustomerId INTEGER PRIMARY KEY, CompanyName TEXT, ContactName TEXT);",
            "INSERT INTO Customers VALUES (1, 'Alfreds Futterkiste', 'Maria Anders');",
          ].join("\n"),
        ),
      );
      equalD1ExecResult(execRes[0], execRes[1]);
    },
  ]);

  return { beforeEach, specs };
};
