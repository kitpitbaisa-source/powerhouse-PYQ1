import type { Container, Database } from "@azure/cosmos";
import { getOrCreateAlias } from "./alias-names.js";
import { hash } from "./model.js";

interface LoginProfile {
  id: string;
  email: string;
  alias?: string;
  status: string;
  registrationSource?: string;
  createdAt?: string;
  modifiedAt?: string;
  isActive?: boolean;
}

export const managedUsersQuery = "SELECT c.id, c.email, c.status, c.expiryDate, c.createdAt, c.isActive FROM c WHERE (NOT IS_DEFINED(c.isActive) OR c.isActive = true) AND NOT (c.registrationSource = 'login' AND c.status = 'not_subscribed' AND (NOT IS_DEFINED(c.expiryDate) OR IS_NULL(c.expiryDate)))";

async function readProfile(users: Container, email: string): Promise<LoginProfile | null> {
  try {
    const { resource } = await users.item(email, email).read<LoginProfile>();
    return resource ?? null;
  } catch (error: any) {
    if (error.code === 404) return null;
    throw error;
  }
}

export async function ensureLoginProfile(database: Database, email: string): Promise<LoginProfile> {
  const userEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@gmail\.com$/.test(userEmail)) throw new Error("A valid Gmail address is required");
  return ensureLearnerProfile(database, userEmail);
}

export async function ensureLearnerProfile(database: Database, email: string): Promise<LoginProfile> {
  const userEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) throw new Error("A valid email address is required");
  const users = database.container("users");
  const existing = await readProfile(users, userEmail);
  if (existing) return existing;

  await database.containers.createIfNotExists({ id: "settings", partitionKey: { paths: ["/id"] } });
  const settings = database.container("settings");
  const { resources } = await users.items.query<{ alias?: string }>(
    "SELECT c.alias FROM c WHERE IS_STRING(c.alias)"
  ).fetchAll();
  const taken = resources.flatMap(profile => profile.alias ? [profile.alias] : []);

  for (let retry = 0; retry < 10; retry++) {
    const alias = getOrCreateAlias(undefined, taken);
    taken.push(alias);
    const reservationId = `leaderboard-alias:${hash(alias.toLowerCase())}`;
    const now = new Date().toISOString();
    let reservationEtag: string | undefined;
    try {
      const { resource } = await settings.items.create({
        id: reservationId, type: "leaderboard-alias-reservation",
        alias, email: userEmail, createdAt: now,
      });
      reservationEtag = resource?._etag;
    } catch (error: any) {
      if (error.code === 409) continue;
      throw error;
    }

    const profile: LoginProfile = {
      id: userEmail, email: userEmail, alias, status: "not_subscribed",
      registrationSource: "login", isActive: true, createdAt: now, modifiedAt: now,
    };
    try {
      const { resource } = await users.items.create(profile);
      return resource ?? profile;
    } catch (error) {
      const saved = await readProfile(users, userEmail);
      if (!saved) throw error;
      if (saved.alias?.trim().toLowerCase() !== alias.toLowerCase() && reservationEtag) {
        await settings.item(reservationId, reservationId).delete({
          accessCondition: { type: "IfMatch", condition: reservationEtag },
        }).catch(() => {});
      }
      return saved;
    }
  }
  throw new Error("Could not reserve a unique leaderboard alias. Please try signing in again.");
}
