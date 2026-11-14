import { defaultAiClients } from "./ai";
import type { AnchorState, LaunchpadApp, Look, Size } from "./types";

export const APPS: LaunchpadApp[] = [
  { name: "Notion", tag: "Work", category: "Work", labels: [], icon: "◫", url: "https://www.notion.so", source: "manual" },
  { name: "Jira", tag: "Work", category: "Work", labels: [], icon: "▦", url: "https://www.atlassian.com/software/jira", source: "manual" },
  { name: "Figma", tag: "Design", category: "Design", labels: [], icon: "◈", url: "https://www.figma.com", source: "manual" },
  { name: "GitHub", tag: "Build", category: "Build", labels: [], icon: "⌘", url: "https://github.com", source: "manual" },
  { name: "RemNote", tag: "Learn", category: "Learn", labels: [], icon: "✳", url: "https://www.remnote.com", source: "manual" },
  { name: "YouTube", tag: "Break", category: "Break", labels: [], icon: "▷", url: "https://www.youtube.com", guard: true, source: "manual" },
];

export const PRESETS: Array<[string, number, number]> = [
  ["Sprint", 10, 2],
  ["Pomodoro", 25, 5],
  ["Deep", 30, 5],
  ["Flow", 50, 10],
];

export const DEFAULT_LOOK: Look = {
  theme: "sage",
  accent: "",
  bgStyle: "plain",
  dim: 45,
  blur: 0,
  radius: 20,
  font: "serif",
  dateMode: "both",
};

export const defaults: AnchorState = {
  motto: "Have a very blessed and productive and intentional day queen 😉.",
  tasks: [],
  apps: APPS,
  launchpadPrefs: {
    categories: [],
    labels: [],
    bookmarkFolders: {},
    bookmarkImportDone: false,
  },
  resumeUrl: "",
  careerNotes: "",
  archiveNotes: "",
  set: {
    f: 25,
    b: 5,
    l: 15,
    g: 120,
    max: 3,
    auto: true,
    sound: true,
    alarm: true,
    leave: "always",
    dimFocus: true,
    motion: "full",
  },
  now: "",
  stats: { day: "", n: 0, min: 0 },
  hist: {},
  parked: [],
  widgets: [],
  layout: [],
  look: DEFAULT_LOOK,
  cycle: 0,
  backlog: [],
  alarm: null,
  ai: {
    on: false,
    port: 7777,
    token: "",
    scopes: { tasks: true, launchpad: true, fields: true, widgets: true, appearance: true },
    clients: defaultAiClients(),
  },
  timer: null,
};

export const BLOCKS: Record<string, { name: string; size: Size }> = {
  banner: { name: "North star and stats", size: "xl" },
  dates: { name: "Addis clock", size: "m" },
  intent: { name: "Focus prompt", size: "m" },
  timer: { name: "Focus timer", size: "m" },
  tasks: { name: "Today’s moves", size: "m" },
  later: { name: "Later", size: "m" },
  launchpad: { name: "Launchpad", size: "m" },
  vault: { name: "Vault", size: "m" },
};

export const SIZES: Array<[Size, string, string]> = [
  ["s", "S", "Small (one third)"],
  ["m", "M", "Medium (half)"],
  ["l", "L", "Large (two thirds)"],
  ["xl", "Full", "Full width"],
];

export const THEMES = [
  { id: "sage", name: "Sage & Brass", dark: false, paper: "#f4f2ec", surface: "#fffefa", ink: "#17201b", accent: "#3f6b57", brass: "#b8925a", deep: "#14261e" },
  { id: "navy", name: "Ivory & Navy", dark: false, paper: "#f3f1ea", surface: "#fffdf8", ink: "#14213d", accent: "#2a4a7f", brass: "#c8a24c", deep: "#14213d" },
  { id: "rose", name: "Rose Quartz", dark: false, paper: "#f7efec", surface: "#fffaf8", ink: "#2a1f22", accent: "#a85b6b", brass: "#c79b6a", deep: "#3a1f27" },
  { id: "ocean", name: "Ocean Mist", dark: false, paper: "#eef3f4", surface: "#fbfefe", ink: "#11262b", accent: "#2f7f86", brass: "#d1a35a", deep: "#0f2f35" },
  { id: "plum", name: "Plum & Champagne", dark: false, paper: "#f3eef2", surface: "#fffcfe", ink: "#261a2b", accent: "#6d3f7c", brass: "#cfa86a", deep: "#2a1733" },
  { id: "sunset", name: "Sunset Clay", dark: false, paper: "#f8eee6", surface: "#fffaf5", ink: "#2b1c14", accent: "#b8553a", brass: "#d09a4e", deep: "#3a1d12" },
  { id: "forest", name: "Forest Dark", dark: true, paper: "#0b130f", surface: "#131d17", ink: "#e9f0e9", accent: "#6fbf8f", brass: "#c9a85f", deep: "#1a2a20" },
  { id: "mono", name: "Paper Mono", dark: false, paper: "#f2f2f0", surface: "#ffffff", ink: "#1a1a1a", accent: "#333333", brass: "#a08a5a", deep: "#1f1f1f" },
  { id: "night", name: "Midnight Gold", dark: true, paper: "#0e1512", surface: "#17211c", ink: "#eef1ec", accent: "#5fae8a", brass: "#d4af6a", deep: "#1d2e25" },
];

export const ACCENTS = ["#3f6b57", "#2a4a7f", "#a85b6b", "#2f7f86", "#6d3f7c", "#b8663a", "#5b6b2f", "#8a3b3b"];

export const FIELD_TYPES = {
  text: { label: "Short text", icon: "Aa", desc: "One line of text" },
  textarea: { label: "Long text", icon: "¶", desc: "Notes and paragraphs" },
  select: { label: "Dropdown", icon: "▾", desc: "Pick one option" },
  multi: { label: "Multi-select", icon: "☑", desc: "Pick several options" },
  checkbox: { label: "Checkbox", icon: "✓", desc: "Checked or not" },
  url: { label: "Link / URL", icon: "↗", desc: "A web address" },
  question: { label: "Question", icon: "?", desc: "A prompt you answer" },
  number: { label: "Number", icon: "#", desc: "With min, max, unit" },
  date: { label: "Date", icon: "▦", desc: "Pick a day" },
  rating: { label: "Rating", icon: "★", desc: "Stars, 3 to 10" },
  image: { label: "Image", icon: "▣", desc: "Paste, drop or upload" },
  clip: { label: "Copy-paste box", icon: "❐", desc: "Snippet with Copy button" },
} as const;

export type FieldTypeKey = keyof typeof FIELD_TYPES;