export type Phase = "focus" | "break";
export type Size = "s" | "m" | "l" | "xl";
export type Priority = "" | "low" | "med" | "high";
export type DateMode = "both" | "eth" | "greg";
export type BgStyle = "plain" | "glow" | "aurora" | "dots" | "photo";
export type AiScope = "tasks" | "launchpad" | "fields" | "widgets" | "appearance";
export type AiClientId = "claude" | "gemini" | "chatgpt" | "generic";
export type AiTransport = "stdio" | "http";

export interface Task {
  text: string;
  done: boolean;
  project?: string;
  due?: string;
  pri?: Priority;
  note?: string;
}

export interface BacklogItem extends Task {
  from?: string;
  added?: number;
}

export interface ParkedItem {
  text: string;
  time: number;
}

export type LaunchpadSource = "manual" | "bookmark" | "saved";

export interface LaunchpadApp {
  name: string;
  tag?: string;
  icon?: string;
  url: string;
  guard?: boolean;
  category?: string;
  labels?: string[];
  source?: LaunchpadSource;
  addedAt?: number;
  lastOpenedAt?: number;
  opens?: number;
}

export interface LaunchpadPrefs {
  categories: string[];
  labels: string[];
  bookmarkFolders: Record<string, string>;
  bookmarkImportDone: boolean;
  lastImportAt?: number;
}

export interface Settings {
  f: number;
  b: number;
  l: number;
  g: number;
  max: number;
  auto: boolean;
  sound: boolean;
  alarm: boolean;
  leave: "always" | "focus" | "off";
  dimFocus: boolean;
  motion: "full" | "calm" | "off";
}

export interface Stats {
  day: string;
  n: number;
  min: number;
}

export interface Look {
  theme: string;
  accent: string;
  bgStyle: BgStyle;
  dim: number;
  blur: number;
  radius: number;
  font: "serif" | "sans";
  dateMode: DateMode;
}

export interface Widget {
  id: string;
  fieldId: string;
  itemIds: string[] | null;
  size: Size;
  cols: "1" | "2";
  noHead: boolean;
}

export interface LayoutEntry {
  id: string;
  size: Size;
  hidden: boolean;
  name?: string;
  h?: "auto" | "sm" | "md" | "lg";
  st?: "card" | "glass" | "accent" | "flat";
}

export interface AiClientConfig {
  on: boolean;
  port: number;
  token: string;
  scopes: Record<AiScope, boolean>;
  /** ChatGPT web only: the public HTTPS tunnel URL shown to the connector. */
  tunnelUrl?: string;
}

export interface AiConfig {
  /** Master switch. Every client session is paused when this is off. */
  on: boolean;
  /** Legacy mirror of the Claude client, kept for older configs and backups. */
  port: number;
  token: string;
  scopes: Record<AiScope, boolean>;
  clients: Record<AiClientId, AiClientConfig>;
}

export interface TimerState {
  phase: Phase;
  long: boolean;
  total: number;
  remaining: number;
  running: boolean;
  endAt: number;
}

export interface AlarmState {
  was: Phase;
}

export interface AnchorState {
  motto: string;
  tasks: Task[];
  apps: LaunchpadApp[];
  launchpadPrefs: LaunchpadPrefs;
  resumeUrl: string;
  careerNotes: string;
  archiveNotes: string;
  set: Settings;
  now: string;
  stats: Stats;
  hist: Record<string, number>;
  parked: ParkedItem[];
  widgets: Widget[];
  layout: LayoutEntry[];
  look: Look;
  cycle: number;
  backlog: BacklogItem[];
  alarm: AlarmState | null;
  ai: AiConfig;
  timer: TimerState | null;
}

export type FieldType =
  | "text"
  | "textarea"
  | "select"
  | "multi"
  | "checkbox"
  | "url"
  | "question"
  | "number"
  | "date"
  | "rating"
  | "image"
  | "clip";

export interface FieldConfig {
  [key: string]: string | number | undefined;
}

export interface FieldItem {
  id: string;
  type: FieldType;
  title: string;
  help: string;
  required: boolean;
  cfg: FieldConfig;
  value: unknown;
}

export interface Field {
  id: string;
  title: string;
  help: string;
  items: FieldItem[];
}

export interface DriveConfig {
  clientId: string;
  connected: boolean;
  auto: boolean;
  token: string;
  exp: number;
  remoteMod: string;
  lastHash: string;
  lastSync: number;
  adoptHash: boolean;
  deviceId: string;
}

export interface BackupPayload {
  state: Omit<AnchorState, "timer" | "ai" | "alarm">;
  fields: Field[] | null;
}