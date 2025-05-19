export type TokenType =
    | "Keyword"
    | "Symbol"
    | "String"
    | "Number"
    | "Expression"
    | "Parenthesis"
    | "Comma"
    | "Function";

export type Token = {
    type: TokenType;
    value: string;
};

export type ParsedQuery = {
    select: { [alias: string]: Token };
    from: string;
    where: Token[];
    isAggregate: boolean;
};
