import type { ParsedQuery, Token } from "./types";

const keywords =
    /SELECT|AS|FROM|WHERE|AND|ORDER BY|OFFSET|FETCH (FIRST|NEXT)|LIMIT|(LEFT |INNER |RIGHT )?JOIN/iy;
const symbol = /^\w[\w\d_]*$/;
const number = /^-?\d+(\.\d+)?$/;
const string = /^'[^']*'$|^"[^"]*"$/;

export function tokenise(sql: string): Token[] {
    let index = 0;
    let previousIndex = 0;
    let parenthesisLevel = 0;
    const out: Token[] = [];

    while (index < sql.length) {
        keywords.lastIndex = index;
        const keywordMatch = keywords.exec(sql);
        if (keywordMatch) {
            if (index != previousIndex) {
                tokeniseExpression(sql, previousIndex, index, out);
            }

            out.push({ type: "Keyword", value: keywordMatch[0].toUpperCase() });
            index += keywordMatch[0].length;
            previousIndex = index;
            continue;
        }

        if (sql[index] === "(") {
            parenthesisLevel++;
        } else if (sql[index] === ")") {
            parenthesisLevel--;
        } else if (sql[index] === "," && parenthesisLevel === 0) {
            if (index != previousIndex) {
                tokeniseExpression(sql, previousIndex, index, out);
            }
            out.push({ type: "Comma", value: "," });
            previousIndex = index + 1;
        }

        index++;
    }

    if (index != previousIndex) {
        tokeniseExpression(sql, previousIndex, index, out);
    }

    return out;
}

function tokeniseExpression(
    sql: string,
    previousIndex: number,
    index: number,
    out: Token[]
) {
    const value = sql.substring(previousIndex, index).trim();

    const numberMatch = number.exec(value);
    if (numberMatch) {
        out.push({
            type: "Number",
            value: value,
        });
        return;
    }

    const stringMatch = string.exec(value);
    if (stringMatch) {
        out.push({
            type: "String",
            value: value.substring(1, value.length - 1),
        });
        return;
    }

    const symbolMatch = symbol.exec(value);
    if (symbolMatch) {
        out.push({
            type: "Symbol",
            value: value,
        });
        return;
    }

    out.push({
        type: "Expression",
        value: value,
    });
}

export function parse(tokens: Token[]): ParsedQuery {
    const query = {
        select: {} as { [alias: string]: Token },
        from: "",
        where: [] as Token[],
    };

    let currentClause = "";
    let previousSelectNode = "";

    for (const token of tokens) {
        if (token.type === "Keyword" && token.value != "AND") {
            currentClause = token.value;
        } else if (currentClause === "FROM" && token.type === "Symbol") {
            query.from = token.value;
        } else if (
            ["Symbol", "String", "Number", "Expression"].includes(token.type)
        ) {
            if (currentClause === "SELECT") {
                query.select[token.value] = token;
                previousSelectNode = token.value;
            } else if (currentClause === "AS") {
                query.select[token.value] = query.select[previousSelectNode];
                delete query.select[previousSelectNode];
                currentClause = "SELECT";
            } else if (currentClause === "WHERE") {
                query.where.push(token);
            }
        }
    }

    return query;
}
