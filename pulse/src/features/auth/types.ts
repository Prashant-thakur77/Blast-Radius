export interface AuthUser {
  id: string
  username: string
}

export interface SessionPayload {
  sub: string
  username: string
}
