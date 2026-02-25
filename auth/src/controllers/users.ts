import { Response } from "express";
import { hashPassword } from "../services/hash";
import * as repo from "../repositories/userRepository";
import { AuthRequest } from "../middleware/auth";
import { Role } from "../model/user";

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

export async function create(req: AuthRequest, res: Response): Promise<void> {
  const { email, password, role, phoneNumber, firstname, lastname } = req.body;
  const existing = await repo.findByEmail(email);
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }
  const passwordHash = await hashPassword(password);
  const user = await repo.createUser(email, passwordHash, (role as Role) ?? Role.USER, phoneNumber ?? null, firstname ?? null, lastname ?? null);
  res.status(201).json(userPayload(user));
}

export async function update(req: AuthRequest, res: Response): Promise<void> {
  const targetId = req.params.id;
  const currentUserId = req.user!.sub;
  const isAdmin = req.user!.role === Role.ADMIN;
  if (!isAdmin && targetId !== currentUserId) {
    res.status(403).json({ error: "Forbidden: can only edit own profile" });
    return;
  }
  const user = await repo.findById(targetId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const data: { email?: string; phoneNumber?: string | null; firstname?: string | null; lastname?: string | null } = {};
  if (req.body.email !== undefined) data.email = req.body.email;
  if (req.body.phoneNumber !== undefined) data.phoneNumber = req.body.phoneNumber;
  if (req.body.firstname !== undefined) data.firstname = req.body.firstname;
  if (req.body.lastname !== undefined) data.lastname = req.body.lastname;
  if (!isAdmin && data.email !== undefined) {
    res.status(403).json({ error: "Forbidden: only admin can change email" });
    return;
  }
  const updated = await repo.updateUser(targetId, data);
  res.json(userPayload(updated!));
}

export async function remove(req: AuthRequest, res: Response): Promise<void> {
  const targetId = req.params.id;
  const isAdmin = req.user!.role === Role.ADMIN;
  if (!isAdmin && targetId !== req.user!.sub) {
    res.status(403).json({ error: "Forbidden: can only delete own account" });
    return;
  }
  const deleted = await repo.deleteUser(targetId);
  if (!deleted) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.status(204).send();
}

export async function list(req: AuthRequest, res: Response): Promise<void> {
  const users = await repo.findAll();
  res.json(users.map(userPayload));
}
