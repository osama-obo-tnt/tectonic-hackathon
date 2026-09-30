export type Role = "consultant" | "expert";
export type Language = "en" | "nl" | "fr";
export type AgentId = "scout" | "critic" | "arbiter";

export type SourceType =
  | "procedure"
  | "policy"
  | "faq"
  | "checklist"
  | "teams"
  | "email"
  | "handover"
  | "expert-answer";

export interface Claim {
  key: string; // what the claim is about, e.g. "yeb.leavers"
  value: string; // what the source says
}

export interface Source {
  id: string;
  title: string;
  type: SourceType;
  location: string; // where it lives (SharePoint path, Teams channel...)
  topic: string;
  tags: string[];
  content: string;
  author: string;
  ownerId: string | null; // person responsible for keeping it correct
  updatedAt: string; // ISO date
  countries: string[]; // ISO country codes it applies to
  jointCommittees: string[] | null; // Belgian paritair comité, null = all
  clientId: string | null; // client-specific knowledge
  validatedBy: string | null; // expert id
  supersededBy: string | null;
  claims: Claim[];
}

export interface Client {
  id: string;
  name: string;
  country: string;
  jointCommittee: string | null;
  employees: number;
  sector: string;
  note?: string;
}

export interface Person {
  id: string;
  name: string;
  title: string;
  active: boolean;
  leftOn?: string;
}

export interface Expert extends Person {
  topics: string[];
  countries: string[];
  answered: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  title: string;
  clientIds: string[];
  expertId: string | null;
}

export type SignalLevel = "good" | "warn" | "bad";

export interface Signal {
  key: "freshness" | "ownership" | "scope" | "validation";
  label: string;
  level: SignalLevel;
  detail: string;
  score: number; // 0..1
}

export interface ScoredSource {
  source: Source;
  signals: Signal[];
  score: number; // 0..100
  usable: boolean; // false when it does not apply to this context at all
  ownerName: string | null;
  validatorName: string | null;
}

export interface Conflict {
  key: string;
  topicLabel: string;
  positions: { sourceId: string; value: string; score: number }[];
  winnerId: string;
  explanation: string;
}

export interface Turn {
  agent: AgentId;
  stage: "present" | "challenge" | "rebuttal" | "verdict";
  text: string;
  points: string[];
  sourceIds: string[];
}

export interface ExpertSuggestion {
  expertId: string;
  name: string;
  title: string;
  reason: string;
  answered: number;
}

export interface AskResult {
  question: string;
  clientId: string;
  language: Language;
  topic: string | null;
  answer: string;
  verdict: "trusted" | "caution" | "expert";
  trustScore: number;
  scoreExplanation: string[];
  trustedSourceIds: string[];
  sources: ScoredSource[];
  conflicts: Conflict[];
  gaps: string[];
  expert: ExpertSuggestion | null;
  turns: Turn[];
  engine: "claude" | "demo";
}

export type AskEvent =
  | { type: "stage"; stage: "retrieving" | "scout" | "critic" | "rebuttal" | "arbiter" }
  | { type: "sources"; sources: ScoredSource[]; conflicts: Conflict[] }
  | { type: "turn"; turn: Turn }
  | { type: "result"; result: AskResult }
  | { type: "error"; message: string };

export interface ExpertQuestion {
  id: string;
  askerId: string;
  askerName: string;
  expertId: string;
  clientId: string;
  topic: string;
  question: string;
  context: string;
  createdAt: string;
  status: "open" | "answered";
  answer?: string;
  answeredAt?: string;
  capturedSourceId?: string;
}
