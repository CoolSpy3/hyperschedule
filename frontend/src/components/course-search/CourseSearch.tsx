import * as React from "react";

import { useMeasure } from "@react-hookz/web";

import * as APIv4 from "hyperschedule-shared/api/v4";

import { useCourseAreaDescription } from "@hooks/api/query";
import useStore from "@hooks/store";
import * as Search from "@lib/search";

import SearchControls from "@components/course-search/SearchControls";
import CourseRow from "@components/course-search/CourseRow";

import Css from "./CourseSearch.module.css";
import { memo, useCallback } from "react";
import { useActiveSectionsQuery } from "@hooks/section";

export default memo(function CourseSearch() {
    const sections: APIv4.Section[] | undefined = useActiveSectionsQuery();
    const searchText = useStore((store) => store.searchText);
    const searchFilters = useStore((store) => store.searchFilters);
    const areas = useCourseAreaDescription().data;

    const filteredSections: APIv4.Section[] | undefined = React.useMemo(() => {
        if (sections === undefined) return undefined;

        return searchFilters.length === 0
            ? sections
            : sections.filter((s) =>
                  Search.filterSection(
                      s,
                      searchFilters.map((s) => s.filter),
                  ),
              );
    }, [searchFilters, sections]);

    const sectionsToShow: APIv4.Section[] | undefined = React.useMemo(() => {
        if (searchText === "") return filteredSections;
        if (filteredSections === undefined) return undefined;

        let res: [number, APIv4.Section][] = [];

        for (const s of filteredSections) {
            const score = Search.matchesText(searchText, s, areas);
            if (score !== null) {
                res.push([score, s]);
            }
        }
        const sorted = res.sort((a, b) => b[0] - a[0]);
        return sorted.map((a) => a[1]);
    }, [sections, searchText, searchFilters]);

    return (
        <div className={Css.container}>
            <SearchControls />
            {sectionsToShow !== undefined ? (
                <CourseSearchResults
                    sections={sectionsToShow}
                    searchKey={btoa(searchText)}
                />
            ) : (
                <CourseSearchEnd text="loading courses..." />
            )}
        </div>
    );
});

const CourseSearchEnd = memo(function CourseSearchEnd(props: { text: string }) {
    return <div className={Css.end}>({props.text})</div>;
});

function computeIndices(state: {
    rowHeight: number;
    expandHeight: number;
    scroll: number;
    viewportHeight: number;
}): readonly [number, number] {
    // number of extra viewport heights above and below actual visible region to render; reduces "ghost" effect wherein elements scroll into visible region, but take a slight delay to actually render.
    const padFactor = 0.5;
    return [
        Math.max(
            Math.floor(
                (state.scroll -
                    padFactor * state.viewportHeight -
                    2 * state.expandHeight) /
                    state.rowHeight,
            ),
            0,
        ),
        Math.ceil(
            (state.scroll + (1 + padFactor) * state.viewportHeight) /
                state.rowHeight,
        ),
    ];
}

const CourseSearchResults = memo(function CourseSearchResults(props: {
    sections: APIv4.Section[];
    searchKey: string;
}) {
    // https://github.com/streamich/react-use/issues/1264#issuecomment-721645100
    const [rowBounds, rowMeasureRef] = useMeasure<HTMLDivElement>();
    const [viewportBounds, viewportRef] = useMeasure<HTMLDivElement>();

    const [scroll, setScroll] = React.useState(0);

    const expandKey = useStore((store) => store.expandKey);
    const expandHeight = useStore((store) => store.expandHeight);

    const [expandIndex, setExpandIndex] = React.useState<number | null>(null);

    const [indexStart, indexEnd] = React.useMemo(
        () =>
            computeIndices({
                scroll,
                rowHeight: rowBounds?.height ?? 1,
                viewportHeight: viewportBounds?.height ?? 0,
                expandHeight,
            }),
        [rowBounds, viewportBounds, scroll, expandHeight],
    );

    // recompute expand index when section list or expand key changes. potential optimization:
    // pre-compute (and memoize) a key↦index mapping of all sections in the data;
    // when updates happen due to search query changes, binary search to find
    // the new expand index.
    React.useEffect(() => {
        if (expandKey === null) {
            setExpandIndex(null);
            return;
        }

        const key = APIv4.stringifySectionCodeLong(expandKey);
        const index = props.sections.findIndex(
            (section) =>
                APIv4.stringifySectionCodeLong(section.identifier) === key,
        );
        setExpandIndex(index === -1 ? null : index);
    }, [expandKey, props.sections]);

    const sections = props.sections
        .slice(indexStart, indexEnd)
        .map((section, i) => ({ index: i + indexStart, section }));

    // always render expanded entry even if it's outside the viewport bounds, to
    // ensure height measurements/calculations are up-to-date
    //if (
    //    expandIndex !== null &&
    //    !(indexStart <= expandIndex && expandIndex < indexEnd)
    //)
    //    sections.push({
    //        index: expandIndex,
    //        section: props.sections[expandIndex]!,
    //    });

    if (props.sections.length === 0)
        return <CourseSearchEnd text="no courses found" />;

    return (
        <>
            <div
                ref={viewportRef}
                className={Css.resultsContainer}
                onScroll={(ev) => setScroll(ev.currentTarget.scrollTop)}
            >
                {viewportBounds && rowBounds && (
                    <>
                        <div
                            style={{
                                height: `${
                                    props.sections.length * rowBounds.height +
                                    expandHeight
                                }px`,
                            }}
                            className={Css.spacer}
                        >
                            {sections.map(({ index, section }) => (
                                <CourseSearchRow
                                    key={APIv4.stringifySectionCodeLong(
                                        section.identifier,
                                    )}
                                    expandIndex={expandIndex}
                                    index={index}
                                    section={section}
                                    scroll={scroll}
                                    rowHeight={rowBounds.height}
                                    viewportHeight={viewportBounds.height}
                                />
                            ))}
                        </div>
                        <CourseSearchEnd text="end of search results" />
                    </>
                )}
            </div>
            <div className={Css.hiddenMeasureContainer}>
                <div ref={rowMeasureRef}>
                    <CourseRow section={props.sections[0]!} expand={false} />
                </div>
            </div>
        </>
    );
});

const CourseSearchRow = memo(function CourseSearchRow(props: {
    index: number;
    section: APIv4.Section;
    scroll: number;
    rowHeight: number;
    viewportHeight: number;
    expandIndex: number | null;
}): JSX.Element | null {
    const setExpandKey = useStore((store) => store.setExpandKey);
    const setExpandHeight = useStore((store) => store.setExpandHeight);
    const expandHeight = useStore((store) => store.expandHeight);
    const clearExpand = useStore((store) => store.clearExpand);

    const pos =
        props.index * props.rowHeight +
        (props.expandIndex !== null && props.index > props.expandIndex
            ? expandHeight
            : 0);

    const expand = props.index === props.expandIndex;

    const onClick = useCallback(
        () => (expand ? clearExpand() : setExpandKey(props.section.identifier)),
        [expand],
    );

    return (
        <div
            style={{ transform: `translateY(${pos}px)` }}
            className={Css.courseRowPosition}
        >
            <CourseRow
                section={props.section}
                expand={expand}
                onClick={onClick}
                updateDetailsSize={expand ? setExpandHeight : undefined}
            />
        </div>
    );
});
