import { parse, tokenise } from "./prepare.js";
import type { ParsedQuery, Token } from "./types.ts";

const functionRegex = /^([a-z]+)\(([^)]*)\)$/i;

export class Query {
    #tables: { [name: string]: Iterable<object> };

    addTables(tables: { [name: string]: Iterable<object> }) {
        this.#tables = { ...this.#tables, ...tables };
    }

    query(sql: string) {
        const query = this.#prepareQuery(sql);

        if (query.isAggregate) {
            const clonedA = {
                ...query,
                select: { "*": { type: "Expression" as const, value: "*" } },
            };
            const rows = [...this.#executeQuery(clonedA)];
            return this.#executeAggregateQuery(query, rows);
        }

        return this.#executeQuery(query);
    }

    #prepareQuery(sql: string) {
        const tokens = tokenise(sql);
        console.log(tokens);
        const query = parse(tokens);
        console.log(query);
        return query;
    }

    *#executeQuery(query: ParsedQuery): Iterable<object> {
        const table = this.#tables[query.from];
        if (!table) {
            throw Error(`Table '${query.from}' not defined`);
        }

        const fnCache = {} as { [body: string]: Function };

        let selectEntries: [string, Token][] = [];

        for (const row of table) {
            if (
                query.where.some(
                    (predicate) =>
                        !evaluateExpression(predicate, row, null, fnCache)
                )
            ) {
                continue;
            }

            if (!selectEntries) {
                for (const [alias, token] of Object.entries(query.select)) {
                    if (token.value === "*") {
                        selectEntries.push(
                            ...Object.keys(row).map(
                                (k) =>
                                    [k, { type: "Expression", value: k }] as [
                                        string,
                                        Token
                                    ]
                            )
                        );
                    }
                    selectEntries.push([alias, token]);
                }
            }

            const result = Object.fromEntries(
                selectEntries.map(([alias, token], i) => [
                    alias,
                    evaluateExpression(token, row, null, fnCache),
                ])
            );

            yield result;
        }
    }

    *#executeAggregateQuery(
        query: ParsedQuery,
        rows: object[]
    ): Iterable<object> {
        const fnCache = {} as { [body: string]: Function };

        const result = Object.fromEntries(
            Object.entries(query.select).map(([alias, token], i) => [
                alias,
                evaluateExpression(token, rows[0], rows, fnCache),
            ])
        );

        yield result;
    }
}

function evaluateExpression(
    token: Token,
    row: object,
    rows: object[] | null,
    selectCache: { [body: string]: Function }
) {
    if (token.type === "String") {
        return token.value;
    }

    if (token.type === "Number") {
        return +token.value;
    }

    if (token.type === "Symbol") {
        return row[token.value];
    }

    if (token.type === "Expression") {
        if (!selectCache[token.value]) {
            selectCache[token.value] = Function(
                ...Object.keys(row),
                `return ${token.value}`
            );
        }
        return selectCache[token.value](...Object.values(row));
    }

    if (token.type === "Function") {
        const match = functionRegex.exec(token.value);
        if (!match) {
            throw Error(`Function does not match regex: '${token.value}'`);
        }

        const fnName = match[1].toUpperCase();
        const arg = match[2];

        if (fnName === "COUNT" && arg === "*") {
            return rows.length;
        }

        const dummyToken = { type: "Expression" as const, value: arg };

        const values = rows.map((row) =>
            evaluateExpression(dummyToken, row, null, selectCache)
        );

        if (fnName === "SUM") {
            return values.reduce((a: number, b: number) => a + b, 0);
        }

        if (fnName === "AVG") {
            return (
                values.reduce((a: number, b: number) => a + b, 0) /
                values.length
            );
        }

        if (fnName === "MIN") {
            return values.reduce(
                (min: number, n: number) => Math.min(min, n),
                Number.POSITIVE_INFINITY
            );
        }

        if (fnName === "MAX") {
            return values.reduce(
                (max: number, n: number) => Math.max(max, n),
                Number.NEGATIVE_INFINITY
            );
        }
    }
}
