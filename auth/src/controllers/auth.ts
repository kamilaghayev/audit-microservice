import { Response } from "express";
import crypto from "crypto";
import { config } from "../config";
import {
  signAccessToken,
  signRefreshToken,
  signResetToken,
  verifyRefreshToken,
  verifyResetToken,
  parseExpiry,
} from "../services/jwt";
import { hashPassword, comparePassword, hashToken } from "../services/hash";
import * as repo from "../repositories/userRepository";
import { AuthRequest } from "../middleware/auth";
import { Role } from "../model/user";

const refreshExpirySeconds = parseExpiry(config.jwt.refreshExpiresIn);
const resetExpirySeconds = parseExpiry(config.jwt.resetExpiresIn);

function userPayload(user: { id: string; email: string; role: Role; firstname?: string | null; lastname?: string | null; phoneNumber?: string | null }) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstname: user.firstname ?? null,
    lastname: user.lastname ?? null,
    phoneNumber: user.phoneNumber ?? null,
  };
}

function tokensResponse(res: Response, status: number, user: { id: string; email: string; role: Role; firstname?: string | null; lastname?: string | null; phoneNumber?: string | null }) {
  return (accessToken: string, refreshToken: string, expiresIn: number) => {
    res.status(status).json({
      accessToken,
      refreshToken,
      expiresIn,
      user: userPayload(user),
    });
  };
}

export async function register(req: AuthRequest, res: Response): Promise<void> {
  const { email, password, role, phoneNumber, firstname, lastname } = req.body;
  const existing = await repo.findByEmail(email);
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }
  const passwordHash = await hashPassword(password);
  const user = await repo.createUser(email, passwordHash, (role as Role) ?? Role.USER, phoneNumber ?? null, firstname ?? null, lastname ?? null);
  const jti = crypto.randomUUID();
  const access = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken(user.id, jti);
  await repo.saveRefreshToken(user.id, hashToken(refreshToken), new Date(Date.now() + refreshExpirySeconds * 1000));
  tokensResponse(res, 201, user)(access.token, refreshToken, access.expiresIn);
}

export async function registerUser(req: AuthRequest, res: Response): Promise<void> {
  const { email, password, phoneNumber, firstname, lastname } = req.body;
  const existing = await repo.findByEmail(email);
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }
  const passwordHash = await hashPassword(password);
  const user = await repo.createUser(email, passwordHash, Role.USER, phoneNumber ?? null, firstname ?? null, lastname ?? null);
  const jti = crypto.randomUUID();
  const access = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken(user.id, jti);
  await repo.saveRefreshToken(user.id, hashToken(refreshToken), new Date(Date.now() + refreshExpirySeconds * 1000));
  tokensResponse(res, 201, user)(access.token, refreshToken, access.expiresIn);
}

export async function login(req: AuthRequest, res: Response): Promise<void> {
  const { email, password } = req.body;
  const user = await repo.findByEmail(email);
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const jti = crypto.randomUUID();
  const access = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken(user.id, jti);
  await repo.saveRefreshToken(user.id, hashToken(refreshToken), new Date(Date.now() + refreshExpirySeconds * 1000));
  tokensResponse(res, 200, user)(access.token, refreshToken, access.expiresIn);
}

export async function refresh(req: AuthRequest, res: Response): Promise<void> {
  const { refreshToken: token } = req.body;
  try {
    const payload = verifyRefreshToken(token);
    const tokenHash = hashToken(token);
    const row = await repo.findRefreshTokenByHash(tokenHash);
    if (!row || row.user_id !== payload.sub) {
      res.status(401).json({ error: "Invalid refresh token" });
      return;
    }
    await repo.deleteRefreshTokenByHash(tokenHash);
    const user = await repo.findById(payload.sub);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    const jti = crypto.randomUUID();
    const access = signAccessToken({ sub: user.id, email: user.email, role: user.role });
    const newRefresh = signRefreshToken(user.id, jti);
    await repo.saveRefreshToken(user.id, hashToken(newRefresh), new Date(Date.now() + refreshExpirySeconds * 1000));
    tokensResponse(res, 200, user)(access.token, newRefresh, access.expiresIn);
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
}

export async function logout(req: AuthRequest, res: Response): Promise<void> {
  const tokenHash = hashToken(req.body.refreshToken);
  await repo.deleteRefreshTokenByHash(tokenHash);
  res.status(204).send();
}

export async function forgotPassword(req: AuthRequest, res: Response): Promise<void> {
  const { email } = req.body;
  const user = await repo.findByEmail(email);
  if (!user) {
    res.status(204).send();
    return;
  }
  const jti = crypto.randomUUID();
  const resetToken = signResetToken(user.id, jti);
  await repo.saveResetToken(user.id, hashToken(resetToken), new Date(Date.now() + resetExpirySeconds * 1000));
  res.json({ message: "If the email exists, a reset link would be sent.", resetToken });
}

export async function resetPassword(req: AuthRequest, res: Response): Promise<void> {
  const { token, newPassword } = req.body;
  try {
    const payload = verifyResetToken(token);
    const tokenHash = hashToken(token);
    const row = await repo.findResetTokenByHash(tokenHash);
    if (!row || row.user_id !== payload.sub) {
      res.status(400).json({ error: "Invalid or expired reset token" });
      return;
    }
    await repo.deleteResetTokenByHash(tokenHash);
    await repo.updatePassword(payload.sub, await hashPassword(newPassword));
    res.json({ message: "Password updated" });
  } catch {
    res.status(400).json({ error: "Invalid or expired reset token" });
  }
}

export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user!.sub;
  const user = await repo.findById(userId);
  if (!user || !(await comparePassword(currentPassword, user.passwordHash))) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }
  await repo.updatePassword(userId, await hashPassword(newPassword));
  res.json({ message: "Password updated" });
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  const user = await repo.findById(req.user!.sub);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(userPayload(user));
}

export async function deleteMe(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.sub;
  const deleted = await repo.deleteUser(userId);
  if (!deleted) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.status(204).send();
}
