import { getClient } from "../db";
import { sanitizeEmail, sanitizeName, sanitizePhoneNumber, sanitizeUuid } from "../lib/sanitize";
import { Role, User, UserRow, rowToUser } from "../model/user";

export async function createUser(
  email: string,
  passwordHash: string,
  role: Role = Role.USER,
  phoneNumber: string | null = null,
  firstname: string | null = null,
  lastname: string | null = null
): Promise<User> {
  const safeEmail = sanitizeEmail(email);
  const safePhone = sanitizePhoneNumber(phoneNumber);
  const safeFirst = sanitizeName(firstname);
  const safeLast = sanitizeName(lastname);
  const client = await getClient();
  try {
    const res = await client.query<UserRow>(
      `INSERT INTO users (email, password_hash, role, phone_number, first_name, last_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, password_hash, role, phone_number, first_name, last_name, created_at, updated_at`,
      [safeEmail, passwordHash, role, safePhone, safeFirst, safeLast]
    );
    const row = res.rows[0];
    if (!row) throw new Error("Insert failed");
    return rowToUser(row);
  } finally {
    client.release();
  }
}

export async function findByEmail(email: string): Promise<User | null> {
  const safeEmail = sanitizeEmail(email);
  const client = await getClient();
  try {
    const res = await client.query<UserRow>(
      `SELECT id, email, password_hash, role, phone_number, first_name, last_name, created_at, updated_at
       FROM users WHERE email = $1`,
      [safeEmail]
    );
    const row = res.rows[0];
    return row ? rowToUser(row) : null;
  } finally {
    client.release();
  }
}

export async function findById(id: string): Promise<User | null> {
  const safeId = sanitizeUuid(id);
  if (!safeId) return null;
  const client = await getClient();
  try {
    const res = await client.query<UserRow>(
      `SELECT id, email, password_hash, role, phone_number, first_name, last_name, created_at, updated_at
       FROM users WHERE id = $1`,
      [safeId]
    );
    const row = res.rows[0];
    return row ? rowToUser(row) : null;
  } finally {
    client.release();
  }
}

export async function updatePassword(userId: string, passwordHash: string): Promise<void> {
  const client = await getClient();
  try {
    await client.query(
      `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`,
      [passwordHash, userId]
    );
  } finally {
    client.release();
  }
}

export async function updateUser(
  userId: string,
  data: { email?: string; phoneNumber?: string | null; firstname?: string | null; lastname?: string | null }
): Promise<User | null> {
  const safeUserId = sanitizeUuid(userId);
  if (!safeUserId) return null;
  const client = await getClient();
  try {
    const updates: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (data.email !== undefined) {
      updates.push(`email = $${i++}`);
      values.push(sanitizeEmail(data.email));
    }
    if (data.phoneNumber !== undefined) {
      updates.push(`phone_number = $${i++}`);
      values.push(sanitizePhoneNumber(data.phoneNumber));
    }
    if (data.firstname !== undefined) {
      updates.push(`first_name = $${i++}`);
      values.push(sanitizeName(data.firstname));
    }
    if (data.lastname !== undefined) {
      updates.push(`last_name = $${i++}`);
      values.push(sanitizeName(data.lastname));
    }
    if (updates.length === 0) return findById(safeUserId);
    updates.push("updated_at = now()");
    values.push(safeUserId);
    const res = await client.query<UserRow>(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${i}
       RETURNING id, email, password_hash, role, phone_number, first_name, last_name, created_at, updated_at`,
      values
    );
    const row = res.rows[0];
    return row ? rowToUser(row) : null;
  } finally {
    client.release();
  }
}

export async function deleteUser(userId: string): Promise<boolean> {
  const safeId = sanitizeUuid(userId);
  if (!safeId) return false;
  const client = await getClient();
  try {
    const res = await client.query(`DELETE FROM users WHERE id = $1`, [safeId]);
    return (res.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

export async function findAll(): Promise<User[]> {
  const client = await getClient();
  try {
    const res = await client.query<UserRow>(
      `SELECT id, email, password_hash, role, phone_number, first_name, last_name, created_at, updated_at FROM users ORDER BY created_at DESC`
    );
    return res.rows.map(rowToUser);
  } finally {
    client.release();
  }
}

// --- Refresh tokens ---
export async function saveRefreshToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date
): Promise<void> {
  const client = await getClient();
  try {
    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    );
  } finally {
    client.release();
  }
}

export async function findRefreshTokenByHash(tokenHash: string): Promise<{ user_id: string } | null> {
  const client = await getClient();
  try {
    const res = await client.query<{ user_id: string }>(
      `SELECT user_id FROM refresh_tokens
       WHERE token_hash = $1 AND expires_at > now()`,
      [tokenHash]
    );
    return res.rows[0] ?? null;
  } finally {
    client.release();
  }
}

export async function deleteRefreshTokenByHash(tokenHash: string): Promise<boolean> {
  const client = await getClient();
  try {
    const res = await client.query(
      `DELETE FROM refresh_tokens WHERE token_hash = $1`,
      [tokenHash]
    );
    return (res.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

export async function deleteAllRefreshTokensForUser(userId: string): Promise<void> {
  const client = await getClient();
  try {
    await client.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
  } finally {
    client.release();
  }
}

// --- Password reset tokens ---
export async function saveResetToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date
): Promise<void> {
  const client = await getClient();
  try {
    await client.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    );
  } finally {
    client.release();
  }
}

export async function findResetTokenByHash(tokenHash: string): Promise<{ user_id: string } | null> {
  const client = await getClient();
  try {
    const res = await client.query<{ user_id: string }>(
      `SELECT user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND expires_at > now()`,
      [tokenHash]
    );
    return res.rows[0] ?? null;
  } finally {
    client.release();
  }
}

export async function deleteResetTokenByHash(tokenHash: string): Promise<void> {
  const client = await getClient();
  try {
    await client.query(
      `DELETE FROM password_reset_tokens WHERE token_hash = $1`,
      [tokenHash]
    );
  } finally {
    client.release();
  }
}
