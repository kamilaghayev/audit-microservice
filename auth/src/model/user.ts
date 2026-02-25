export enum Role {
  ADMIN = "admin",
  USER = "user",
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  firstname: string | null;
  lastname: string | null;
  phoneNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  created_at: Date;
  updated_at: Date;
}

export function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role === Role.ADMIN ? Role.ADMIN : Role.USER,
    firstname: row.first_name ?? null,
    lastname: row.last_name ?? null,
    phoneNumber: row.phone_number ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// --- API request/response types ---
export interface RegisterBody {
  email: string;
  password: string;
  role?: Role;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface TokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
  user: { id: string; email: string; role: Role; firstname?: string | null; lastname?: string | null; phoneNumber?: string | null };
}

export interface ForgotPasswordBody {
  email: string;
}

export interface ResetPasswordBody {
  token: string;
  newPassword: string;
}

export interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

export interface RefreshBody {
  refreshToken: string;
}

export interface LogoutBody {
  refreshToken: string;
}
