import { Query } from "./Query.js";

const objects = [
    { id: 1, name: "Amy", birthDate: new Date(1900, 0, 1) },
    { id: 2, name: "Boris", birthDate: new Date(1910, 4, 1) },
    { id: 3, name: "Cherie", birthDate: new Date(1930, 8, 1) },
    { id: 4, name: "Doug", birthDate: new Date(1920, 6, 1) },
    { id: 5, name: "Ethel", birthDate: new Date(1940, 7, 1) },
];

const query = new Query();
query.addTables({ objects });

const results = query.query(
    `FROM objects
    WHERE
        birthDate.toISOString() > '1915-01-01' AND
        id > 2
    SELECT
        name.substring(1, 3) AS it,
        name.length + id AS num,
        Math.PI as pi,
        3 AS close_enough,
        "hi" AS greeting`
);

console.log([...results]);
