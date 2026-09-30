import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { users } from "@/data/knowledge";
import { SESSION_COOKIE, verifySession } from "./session";
import { getUser, getUserByEmail } from "./store";
import type { User } from "./types";

// Demo accounts share one password taken from the environment; it is hashed
// once at startup so plaintext is never compared or kept around.
let hashes: Map<string, string> | null = null;
function passwordHashes() {
  if (hashes) return hashes;
  const password = process.env.DEMO_PASSWORD;
  hashes = new Map();
  if (!password || password.length < 8) return hashes;
  for (const u of users) hashes.set(u.id, bcrypt.hashSync(password, 10));
  return hashes;
}

// Hash of a random string, compared when the email is unknown so timing does not reveal valid accounts.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomUUID(), 10);

export async function verifyCredentials(email: string, password: string): Promise<User | null> {
  const user = getUserByEmail(email);
  const hash = user ? passwordHashes().get(user.id) : undefined;
  const ok = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return ok && user && hash ? user : null;
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const id = await verifySession(token);
  return id ? getUser(id) : null;
}

/** For pages: redirect to login when there is no valid session. */
export async function requirePageUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

/** For API routes: returns the user or a 401 response. */
export async function requireApiUser(): Promise<{ user: User; error?: never } | { user?: never; error: NextResponse }> {
  const user = await currentUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { user };
}
