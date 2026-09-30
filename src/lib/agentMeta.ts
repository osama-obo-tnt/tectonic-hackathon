import type { AgentId } from "./types";

// Client-safe agent metadata (names, roles, colours, voices).
export const AGENT_META: Record<AgentId, { name: string; role: string; color: string; voice: AgentId; tagline: string }> = {
  scout: { name: "Nova", role: "The Scout", color: "var(--scout)", voice: "scout", tagline: "Finds every relevant source" },
  critic: { name: "Rex", role: "The Critic", color: "var(--critic)", voice: "critic", tagline: "Challenges every claim" },
  arbiter: { name: "Sage", role: "The Arbiter", color: "var(--arbiter)", voice: "arbiter", tagline: "Weighs it and decides" },
};

export const STAGE_TEXT: Record<string, string> = {
  retrieving: "Searching SharePoint, Teams, email and handover notes…",
  scout: "Nova is assembling the evidence…",
  critic: "Rex is challenging the sources…",
  rebuttal: "Nova is responding to Rex…",
  arbiter: "Sage is weighing the arguments…",
};
