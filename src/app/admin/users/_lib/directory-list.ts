import type { CoarseRole } from "@/lib/roles";
import {
  directoryEntryMatches,
  type SearchableDirectoryEntry,
} from "@/lib/directory-search";

/*
 * Pure list logic for the /admin/users split view. Shared by the server
 * layout (which shapes rows) and the client list pane (which filters and
 * groups them from the URL), and unit-tested on its own.
 */

export const ROLE_ORDER = ["admin", "tutor", "parent", "student"] as const;

export const ROLE_PLURAL = {
  admin: "Admins",
  tutor: "Tutors",
  parent: "Parents",
  student: "Students",
} as const satisfies Record<CoarseRole, string>;

export type DirectoryStatusFilter = "active" | "discontinued" | "all";
export type NameSort = "asc" | "desc";

export type RowFlag = {
  label: string;
  tone: "bad" | "warn" | "info" | "good";
};

export type DirectoryListItem = SearchableDirectoryEntry & {
  id: string;
  role: CoarseRole;
  status: "active" | "discontinued";
  school: string | null;
  yearLevel: string | null;
  /** Secondary line under the name: subjects, children, or email. */
  sub: string;
  flag: RowFlag | null;
};

/** The params that describe the list. Carried on every row and tab link so
 *  opening a person never resets the list the admin was looking at. */
export const LIST_PARAM_KEYS = ["role", "q", "status", "school", "name"] as const;

type ParamSource =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function readParam(source: ParamSource, key: string): string | undefined {
  if (source instanceof URLSearchParams) return source.get(key) ?? undefined;
  const value = source[key];
  return Array.isArray(value) ? value[0] : value;
}

/** The list params of `source` as a query string, without the leading "?". */
export function listQueryString(source: ParamSource): string {
  const params = new URLSearchParams();
  for (const key of LIST_PARAM_KEYS) {
    const value = readParam(source, key);
    if (value) params.set(key, value);
  }
  return params.toString();
}

/** `path` plus the list params, then any extra params (e.g. `tab`). */
export function withListQuery(
  path: string,
  source: ParamSource,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams(listQueryString(source));
  for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function parseRoleParam(value: string | null | undefined): CoarseRole | null {
  return (ROLE_ORDER as readonly string[]).includes(value ?? "")
    ? (value as CoarseRole)
    : null;
}

export function parseStatusParam(
  value: string | null | undefined,
): DirectoryStatusFilter {
  return value === "discontinued" || value === "all" ? value : "active";
}

export type YearLevel = {
  /** Stable grouping key: "10", "Year 10" and "Yr 10" all share one. */
  key: string;
  label: string;
  /** Numeric years first (ascending), then named levels, then unset. */
  rank: number;
};

const NO_YEAR: YearLevel = { key: "none", label: "No year level", rank: 1000 };
const NAMED_RANK = 100;

/**
 * Normalise a free-text year level. Profiles hold whatever was typed ("10",
 * "Year 10", "Yr 10", "year10"), so grouping and labels go through here to
 * stop one year appearing twice or rendering as "Yr Year 10".
 */
export function normaliseYearLevel(raw: string | null | undefined): YearLevel {
  const value = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!value) return NO_YEAR;
  const numeric = /^(?:(?:year|yr|y|grade|gr)\.?\s*)*(\d{1,2})$/i.exec(value);
  if (numeric) {
    const year = Number(numeric[1]);
    return { key: `year-${year}`, label: `Year ${year}`, rank: year };
  }
  return { key: `named-${value.toLowerCase()}`, label: value, rank: NAMED_RANK };
}

export type ListFilters = {
  role: CoarseRole | null;
  status: DirectoryStatusFilter;
  school: string | null;
  query: string;
};

export function filterDirectory(
  items: DirectoryListItem[],
  filters: ListFilters,
  aliasSubjectIds: Set<string>,
): DirectoryListItem[] {
  return items.filter(
    (item) =>
      (filters.status === "all" || item.status === filters.status) &&
      (!filters.school || item.school === filters.school) &&
      (!filters.role || item.role === filters.role) &&
      directoryEntryMatches(item, filters.query, aliasSubjectIds),
  );
}

export type DirectoryGroup = {
  key: string;
  label: string;
  people: DirectoryListItem[];
};

function fullName(item: DirectoryListItem) {
  return `${item.firstName} ${item.lastName}`.trim();
}

/**
 * Group the listed people the way each tab is read: everyone by role (centre
 * staff first), students by year level, and a single role by initial.
 */
export function groupDirectory(
  items: DirectoryListItem[],
  role: CoarseRole | null,
  sort: NameSort,
): DirectoryGroup[] {
  const sorted = [...items].sort((a, b) => {
    const cmp = fullName(a).localeCompare(fullName(b), undefined, {
      sensitivity: "base",
    });
    return sort === "desc" ? -cmp : cmp;
  });

  if (role === null) {
    return ROLE_ORDER.map((r) => ({
      key: r,
      label: ROLE_PLURAL[r],
      people: sorted.filter((item) => item.role === r),
    })).filter((group) => group.people.length > 0);
  }

  if (role === "student") {
    const groups = new Map<string, DirectoryGroup & { rank: number }>();
    for (const item of sorted) {
      const level = normaliseYearLevel(item.yearLevel);
      const group = groups.get(level.key) ?? {
        key: level.key,
        label: level.label,
        rank: level.rank,
        people: [],
      };
      group.people.push(item);
      groups.set(level.key, group);
    }
    return [...groups.values()]
      .sort(
        (a, b) =>
          a.rank - b.rank ||
          a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
      )
      .map(({ key, label, people }) => ({ key, label, people }));
  }

  const byInitial = new Map<string, DirectoryGroup>();
  for (const item of sorted) {
    const first = fullName(item).charAt(0).toUpperCase();
    const letter = /[A-Z]/.test(first) ? first : "#";
    const group = byInitial.get(letter) ?? { key: letter, label: letter, people: [] };
    group.people.push(item);
    byInitial.set(letter, group);
  }
  return [...byInitial.values()];
}
