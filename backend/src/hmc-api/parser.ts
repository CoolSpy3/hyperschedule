// Currently, we have two different formats with different separators, one is
// rather standard csv files that may or may not have column headers. The other is
// something we call bssv: BullShit-Separated Values file. it's like CSVs, but instead of
// commas you have ||`||. every cell should be surrounded in double-quotes
// (which are deleted when parsing); if not, the cell is parsed as-is (and a
// `MalformedCell` warning is emitted). rows are still delimited by newlines.
// within every cell:
// - contents should not contain any occurrences of ||`|| or newlines.
// - to encode/escape newlines, use ||``||

export const enum WarningTag {
    MalformedCell = "MalformedCell",
    InconsistentRowLength = "InconsistentRowLength",
}

export type Warning =
    | { tag: WarningTag.MalformedCell; row: number; column: number }
    | { tag: WarningTag.InconsistentRowLength; row: number; length: number };

export type Result<Spec> =
    | { ok: true; records: Record<keyof Spec, string>[]; warnings: Warning[] }
    | { ok: false; missingColumns: string[] };

function parseCell(cell: string): { parsed: string; malformed: boolean } {
    const malformed = !(cell.startsWith('"') && cell.endsWith('"'));
    const trimmed = malformed ? cell : cell.slice(1, cell.length - 1);
    return { malformed, parsed: trimmed };
}

/**
 * Parse course data with given specification
 *
 * @param specification: an object with fields, hasHeader, separator
 * hasHeader: whether the file comes with a header column
 * separator, the separator value of the data, such as comma or ||`||
 * fields: a map between the header value and the returned variable name. If there
 * is no header, then the fields object will be used using the order passed in
 * @param data: the data file as a string
 */
export function parse<Fields extends Record<string, string>>(
    specification: { fields: Fields; hasHeader: boolean; separator: string },
    data: string,
): Result<Fields> {
    const { fields, hasHeader, separator } = specification;

    const records: Record<keyof Fields, string>[] = [];
    const warnings: Warning[] = [];

    const lines = data.trim().split("\n");

    let headerCells: string[];
    let headerIndex: Map<string, number> = new Map();
    let maxIndex: number;

    if (hasHeader) {
        // construct header-to-columnindex mapping
        headerCells = lines[0]!.split(separator);
        for (let j = 0; j < headerCells.length; ++j) {
            const result = parseCell(headerCells[j]!);
            if (result.malformed)
                warnings.push({
                    tag: WarningTag.MalformedCell,
                    row: 0,
                    column: j,
                });
            headerIndex.set(result.parsed, j);
        }

        // check that all columns exist in the header
        const missingColumns: string[] = [];
        maxIndex = -1;
        for (const columnName of Object.values(fields)) {
            if (!headerIndex.has(columnName)) missingColumns.push(columnName);
            maxIndex = Math.max(maxIndex, headerIndex.get(columnName)!);
        }
        if (missingColumns.length > 0) return { ok: false, missingColumns };
    } else {
        // we assume that the columns follow the order of the format in the spec
        // since ES2020, Object.keys are guaranteed to follow the order from when
        // the object was defined
        headerCells = [...Object.keys(fields)];
        maxIndex = headerCells.length;
        headerIndex = new Map(headerCells.map((v, i) => [v, i]));
    }

    // parse each row
    for (let i = 1; i < lines.length; ++i) {
        const row: string[] = [];

        const cells = lines[i]!.split(separator);
        for (let j = 0; j < cells.length; ++j) {
            const result = parseCell(cells[j]!);
            if (result.malformed)
                warnings.push({
                    tag: WarningTag.MalformedCell,
                    row: i,
                    column: j,
                });
            row.push(result.parsed);
        }

        if (row.length !== headerCells.length)
            warnings.push({
                tag: WarningTag.InconsistentRowLength,
                row: i,
                length: row.length,
            });

        // be forgiving: even if the row length might be wrong, only delete the
        // row if it doesn't have enough columns to cover all the _needed_
        // ones
        if (row.length <= maxIndex) continue;

        const record = Object.fromEntries(
            Object.entries(fields).map(([key, columnName]) => [
                key,
                row[headerIndex.get(columnName)!]!,
            ]),
        );

        // BEGIN UNSAFE: manually check dynamically-generated record has the right type
        records.push(record as any);
        // END UNSAFE
    }

    return { ok: true, warnings, records };
}