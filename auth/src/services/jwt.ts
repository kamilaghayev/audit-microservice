import jwt from "jsonwebtoken";
import { config } from "../config";
import { Role } from "../model/user";

const { secret, accessExpiresIn, refreshExpiresIn, resetExpiresIn } = config.jwt;

export interface AccessPayload {
  sub: string;
  email: string;
  role: Role;
  type: "access";
}

export interface RefreshPayload {
  sub: string;
  jti: string;
  type: "refresh";
}

export interface ResetPayload {
  sub: string;
  jti: string;
  type: "reset";
}

export function signAccessToken(payload: Omit<AccessPayload, "type">): { token: string; expiresIn: number } {
  const expiresIn = parseExpiry(accessExpiresIn);
  const token = jwt.sign(
    { ...payload, type: "access" as const },
    secret,
    { expiresIn }
  );
  return { token, expiresIn };
}

export function signRefreshToken(userId: string, jti: string): string {
  return jwt.sign(
    { sub: userId, jti, type: "refresh" as const },
    secret,
    { expiresIn: parseExpiry(refreshExpiresIn) }
  );
}

export function signResetToken(userId: string, jti: string): string {
  return jwt.sign(
    { sub: userId, jti, type: "reset" as const },
    secret,
    { expiresIn: parseExpiry(resetExpiresIn) }
  );
}

export function verifyAccessToken(token: string): AccessPayload {
  const decoded = jwt.verify(token, secret) as AccessPayload;
  if (decoded.type !== "access") throw new Error("Invalid token type");
  return decoded;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  const decoded = jwt.verify(token, secret) as RefreshPayload;
  if (decoded.type !== "refresh") throw new Error("Invalid token type");
  return decoded;
}

export function verifyResetToken(token: string): ResetPayload {
  const decoded = jwt.verify(token, secret) as ResetPayload;
  if (decoded.type !== "reset") throw new Error("Invalid token type");
  return decoded;
}

export function parseExpiry(str: string): number {
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return 900;
  const n = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === "s") return n;
  if (unit === "m") return n * 60;
  if (unit === "h") return n * 3600;
  if (unit === "d") return n * 86400;
  return 900;
}
