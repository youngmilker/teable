/** Initial number of past/future days rendered when the gantt loads */
export const INITIAL_PAST_DAYS = 30;

/** Pixel width of each day column (initial value — can be adjusted on resize) */
export const DEFAULT_DAY_WIDTH = 60;

/** Minimum pixel width of a day column */
export const MIN_DAY_WIDTH = 40;

/** Minimum number of visible date columns (triggers DAY_WIDTH shrink on resize) */
export const MIN_VISIBLE_COLS = 3;

/** Number of off-screen buffer columns for horizontal virtualization */
export const HORIZONTAL_BUFFER_COLS = 5;

/** Width of the left/right fixed arrow columns (px) */
export const ARROW_COL_WIDTH = 36;

/** Milliseconds in one day */
export const MS_PER_DAY = 86_400_000;

/** Chinese weekday characters indexed by `Date.getDay()` */
export const WEEKDAY_CHARS = ['日', '一', '二', '三', '四', '五', '六'] as const;
