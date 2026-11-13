// Entry point loaded lazily by the search UI, so the index isn't in every page's initial bundle.
export { searchTools, popularSearches } from "./search";
export { getTool, getCategory, relatedTools, editorsPicks } from "./registry";
