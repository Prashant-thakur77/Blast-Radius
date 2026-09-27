import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import type { SessionPayload } from "./types"

const SECRET = new TextEncoder().encode(process.env.SERVER_SECRET || "dev-secret-change-me")
const COOKIE_NAME = "session"
const EXPIRY_DAYS = 7

export async function createSession(user: { id: string; username: string }) {
  const token = await new SignJWT({
    sub: user.id,
    username: user.username,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${EXPIRY_DAYS}d`)
    .setIssuedAt()
    .sign(SECRET)

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: EXPIRY_DAYS * 24 * 60 * 60,
  })
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, SECRET)
    return {
      sub: payload.sub as string,
      username: payload.username as string,
    }
  } catch {
    return null
  }
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return {
      sub: payload.sub as string,
      username: payload.username as string,
    }
  } catch {
    return null
  }
}
