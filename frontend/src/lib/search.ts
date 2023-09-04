import * as APIv4 from "hyperschedule-shared/api/v4";

export enum MatchCategory {
    // full course code match. e.g. csci131
    code = 1 << 7,
    title = 1 << 6,
    department = 1 << 5,
    number = 1 << 4,
    instructor = 1 << 3,
    description = 1 << 2,
    courseArea = 1 << 1,
    campus = 1 << 0,
}

export const exactMatchThreshold = 1 << 8;

type Match = {
    category: MatchCategory;
    isExactMatch: boolean;
};

// compute match score such that the lowest exact match is higher than the highest fuzzy match
function computeMatchScore(categories: Match[]): number | null {
    if (categories.length === 0) return null;
    return categories.reduce(
        (accumulator, value) =>
            accumulator + (value.category << (+value.isExactMatch * 8)),
        0,
    );
}

const tokensRegex = /[0-9]+|[a-z]+/g;

/*

  try all exact matches

  match each token,
  return true if every token matches true




  */

/**
 * the most generic text search. this function returns a positive integer indicating the priority (1 being lowest) or null indicating no match
 * this is necessary in the case of, e.g., a search term of "rust". in this case, we should rank courses from the
 * russian studies department (whose department code is RUST), followed by anything containing the phrase "rust" in the
 * title, followed by anything with the word rust in the description, and, lastly, anything taught by coach Rusty Berry.
 */
export function matchesText(
    text: string,
    section: APIv4.Section,
): number | null {
    if (text === "") return 1; // everything matches with the same score
    const matches: Match[] = [];

    const searchString = text.toLocaleLowerCase();
    const tokens = Array.from(searchString.matchAll(tokensRegex)).map(
        (v) => v[0],
    );

    const dept = section.identifier.department.toLowerCase();
    const suffix = section.identifier.suffix.toLowerCase();
    const affiliation = section.identifier.affiliation.toLowerCase();
    const title = section.course.title.toLocaleLowerCase();
    const instructors = section.instructors.map((i) =>
        i.name.toLocaleLowerCase(),
    );
    const description = section.course.description.toLocaleLowerCase();

    // --------- first priority: code ----------
    // exact match
    const code = APIv4.stringifySectionCode(section.identifier).toLowerCase();
    if (code.startsWith(tokens.join(" ")) || code.startsWith(searchString)) {
        matches.push({
            category: MatchCategory.code,
            isExactMatch: true,
        });
    }

    // fuzzy match
    else {
        const codeSegments = [
            dept,
            section.identifier.courseNumber.toString().padStart(3, "0"),
            suffix,
            affiliation,
            section.identifier.sectionNumber.toString().padStart(2, "0"),
        ].filter((s) => s);

        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/label
        m: if (codeSegments.length >= tokens.length) {
            for (let i = 0; i < tokens.length; ++i) {
                if (!codeSegments[i]!.includes(tokens[i]!)) {
                    break m;
                }
            }
            matches.push({
                category: MatchCategory.code,
                isExactMatch: false,
            });
        }
    }

    // --------- second priority: title ------------

    if (title === searchString) {
        matches.push({
            category: MatchCategory.title,
            isExactMatch: true,
        });
    } else if (title.includes(searchString)) {
        matches.push({
            category: MatchCategory.title,
            isExactMatch: false,
        });
    } else {
        const titleFragments = title.split(" ");
        for (const t of tokens) {
            if (titleFragments.includes(t)) {
                matches.push({
                    category: MatchCategory.title,
                    isExactMatch: false,
                });
                break;
            }
        }
    }

    // --------- third priority: department ----------

    // exact match
    // we only match the first element because, e.g. if someone searches for intro to lit, we want that
    // class to show up first, instead of everything from the lit department.
    if (tokens[0] === dept) {
        matches.push({
            category: MatchCategory.department,
            isExactMatch: true,
        });
    }
    // fuzzy match
    else {
        for (const t of tokens) {
            if (dept.includes(t)) {
                matches.push({
                    category: MatchCategory.department,
                    isExactMatch: false,
                });
                break;
            }
        }
    }

    // --------- fourth priority: course number --------

    // if array is out of bound this will become NaN, which will be false
    if (
        parseInt(tokens[0]!, 10) === section.identifier.courseNumber ||
        parseInt(tokens[1]!, 10) === section.identifier.courseNumber
    ) {
        matches.push({
            category: MatchCategory.number,
            isExactMatch: true,
        });
    } else {
        for (const t of tokens) {
            if (section.identifier.courseNumber.toString(10).includes(t)) {
                matches.push({
                    category: MatchCategory.number,
                    isExactMatch: false,
                });
                break;
            }
        }
    }

    // --------- fifth priority: instructor --------

    if (instructors.includes(searchString)) {
        matches.push({
            category: MatchCategory.instructor,
            isExactMatch: true,
        });
    } else {
        for (const instructor of instructors) {
            if (instructor.includes(searchString)) {
                matches.push({
                    category: MatchCategory.instructor,
                    isExactMatch: false,
                });
            }
        }
    }

    // --------- sixth priority: description --------

    /// can this even happen?
    if (description === searchString) {
        matches.push({
            category: MatchCategory.description,
            isExactMatch: true,
        });
    } else {
        for (const t of tokens) {
            if (description.includes(t)) {
                matches.push({
                    category: MatchCategory.description,
                    isExactMatch: false,
                });
            }
        }
    }

    // --------- seventh priority: course areas --------
    // #TODO

    return computeMatchScore(matches);
}

export enum FilterKey {
    Department = "dept",
    Title = "title",
    Campus = "campus",
    Description = "desc",
    CourseCode = "code",
    Instructor = "instr",
    ScheduleDays = "days",
    CourseArea = "area",
    MeetingTime = "time",
}

export const filterKeyRegexp = RegExp(
    `\\b(${Object.values(FilterKey).join("|")})$`,
    "i",
);

export type FilterData = {
    [FilterKey.Department]: {
        text: string;
    };
    [FilterKey.Instructor]: {
        text: string;
    };
    [FilterKey.Description]: {
        text: string;
    };
    [FilterKey.CourseCode]: {
        text: string;
    };
    [FilterKey.Title]: {
        text: string;
    };
    [FilterKey.ScheduleDays]: {
        days: Set<APIv4.Weekday>;
    };
    [FilterKey.MeetingTime]: {
        startTime: number;
        endTime: number;
    };
    [FilterKey.CourseArea]: {
        area: string | null;
    };
    [FilterKey.Campus]: {
        campus: APIv4.School;
    };
};

export type Filter = {
    [K in FilterKey]: {
        key: K;
        data: FilterData[K] | null;
    };
}[FilterKey];

export const exampleFilters: Filter[] = [
    // {
    //     key: FilterKey.CourseArea,
    //     data: { area: "5WRT" },
    // },
    // {
    //     key: FilterKey.MeetingTime,
    //     data: { startTime: 0, endTime: 17 * 60 + 30 },
    // },
    { key: FilterKey.Title, data: { text: "" } },
    { key: FilterKey.Description, data: { text: "" } },
    { key: FilterKey.Department, data: { text: "" } },
];

export function filterSection(
    section: APIv4.Section,
    filters: Filter[],
): boolean {
    // a section is a match iff all filters match
    for (const filter of filters) {
        if (!filter.data) continue;
        switch (filter.key) {
            case FilterKey.Department:
                if (
                    !section.identifier.department
                        .toLowerCase()
                        .includes(filter.data.text)
                )
                    return false;
                break;
            case FilterKey.Campus:
                break;
            case FilterKey.Description:
                if (
                    !section.course.description
                        .toLowerCase()
                        .includes(filter.data.text)
                )
                    return false;
                break;
            case FilterKey.CourseCode:
                const tokens = Array.from(
                    filter.data.text.matchAll(tokensRegex),
                ).map((v) => v[0]);
                if (tokens.length > 3) return false;
                switch (tokens.length) {
                    case 3:
                        if (!section.identifier.suffix.includes(tokens[2]!))
                            return false;
                    case 2:
                        if (
                            !section.identifier.courseNumber
                                .toString()
                                .padStart(3, "0")
                                .includes(tokens[1]!)
                        )
                            return false;
                    case 1:
                        if (
                            !section.identifier.department
                                .toLowerCase()
                                .includes(tokens[0]!)
                        )
                            return false;
                }
                break;
            case FilterKey.Instructor:
                const data = filter.data;
                if (
                    !section.instructors.some((instr) =>
                        instr.name.toLowerCase().includes(data.text),
                    )
                )
                    return false;
                break;
            case FilterKey.ScheduleDays:
                break;
            case FilterKey.CourseArea:
                break;
            case FilterKey.MeetingTime:
                break;
            case FilterKey.Title:
                if (
                    !section.course.title
                        .toLocaleLowerCase()
                        .includes(filter.data.text.toLocaleLowerCase())
                )
                    return false;
                break;
        }
    }
    return true;
}

export function editDistance(
    start: string,
    end: string,
    cost?: Partial<{ insert: number; delete: number; replace: number }>,
): number {
    const insertCost = cost?.insert ?? 1;
    const deleteCost = cost?.delete ?? 1;
    const replaceCost = cost?.replace ?? 1;

    const table: number[] = [];
    const index = (i: number, j: number) => i * (end.length + 1) + j;

    for (let i = 0; i <= start.length; ++i) table[index(i, 0)] = i * deleteCost;
    for (let j = 0; j <= end.length; ++j) table[index(0, j)] = j * insertCost;

    for (let i = 1; i <= start.length; ++i)
        for (let j = 1; j <= end.length; ++j) {
            table[index(i, j)] = Math.min(
                deleteCost + table[index(i - 1, j)]!,
                replaceCost * +(start[i - 1]! !== end[j - 1]!) +
                    table[index(i - 1, j - 1)]!,
                insertCost + table[index(i, j - 1)]!,
            );
        }

    return table[index(start.length, end.length)]!;
}
