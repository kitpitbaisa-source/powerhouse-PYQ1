import { randomInt } from "node:crypto";

export const ALIAS_ADJECTIVES = [
  "Agile",
  "Amber",
  "Brave",
  "Bright",
  "Calm",
  "Clever",
  "Coral",
  "Cosmic",
  "Curious",
  "Daring",
  "Eager",
  "Emerald",
  "Gentle",
  "Golden",
  "Grand",
  "Happy",
  "Jade",
  "Jolly",
  "Joyful",
  "Keen",
  "Kind",
  "Lively",
  "Lucky",
  "Lunar",
  "Merry",
  "Mighty",
  "Nimble",
  "Patient",
  "Peaceful",
  "Quiet",
  "Radiant",
  "Silver",
  "Solar",
  "Spirited",
  "Steady",
  "Sunny",
  "Swift",
  "Vivid",
  "Warm",
  "Wise",
] as const;

export const ALIAS_NOUNS = [
  "Acorn",
  "Aurora",
  "Bamboo",
  "Banyan",
  "Birch",
  "Brook",
  "Cedar",
  "Cloud",
  "Comet",
  "Coral",
  "Crane",
  "Dolphin",
  "Dove",
  "Dune",
  "Falcon",
  "Fern",
  "Finch",
  "Forest",
  "Fox",
  "Grove",
  "Heron",
  "Hill",
  "Jasmine",
  "Lake",
  "Lotus",
  "Maple",
  "Meadow",
  "Meteor",
  "Oak",
  "Otter",
  "Owl",
  "Panda",
  "Pebble",
  "Pine",
  "River",
  "Sparrow",
  "Star",
  "Summit",
  "Willow",
  "Wren",
] as const;

export function getOrCreateAlias(currentAlias: string | null | undefined, existingAliases: Iterable<string>): string {
  if (currentAlias?.trim()) return currentAlias;

  const taken = new Set(Array.from(existingAliases, alias => alias.trim().toLowerCase()));
  const base = `${ALIAS_ADJECTIVES[randomInt(ALIAS_ADJECTIVES.length)]} ${ALIAS_NOUNS[randomInt(ALIAS_NOUNS.length)]}`;
  let candidate = base;
  let suffix = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base} ${suffix++}`;
  }
  return candidate;
}
