import { parse, tokenise } from "./prepare.js";
import type { ParsedQuery, Token } from "./types.ts";

export class Query {
    #tables: { [name: string]: Iterable<object> };

    addTables(tables: { [name: string]: Iterable<object> }) {
        this.#tables = { ...this.#tables, ...tables };
    }

    query(sql: string) {
        const query = this.#prepareQuery(sql);

        return this.#executeQuery(query);
    }

    #prepareQuery(sql: string) {
        const tokens = tokenise(sql);
        // console.log(tokens);
        const query = parse(tokens);
        // console.log(query);
        return query;
    }

    *#executeQuery(query: ParsedQuery): Iterable<object> {
        const table = this.#tables[query.from];
        if (!table) {
            throw Error(`Table '${query.from}' not defined`);
        }

        const fnCache = {} as { [body: string]: Function };

        for (const row of table) {
            if (
                query.where.some(
                    (predicate) => !evaluateExpression(predicate, row, fnCache)
                )
            ) {
                continue;
            }

            const result = Object.fromEntries(
                Object.entries(query.select).map(([alias, token], i) => [
                    alias,
                    evaluateExpression(token, row, fnCache),
                ])
            );

            yield result;
        }
    }
}

function evaluateExpression(
    token: Token,
    row: object,
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
}
