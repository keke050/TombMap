import { cookies } from 'next/headers';
import crypto from 'crypto';
import { hasDatabase, query } from './db';
import { pickLabel } from './utils';
import type { UserProfile } from './types';

export const USER_COOKIE = 'cm_uid';

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const PASSWORD_SCRYPT = {
  N: 16384,
  r: 8,
  p: 1,
  keylen: 64
};

const hashPassword = (password: string) => {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, PASSWORD_SCRYPT.keylen, {
    N: PASSWORD_SCRYPT.N,
    r: PASSWORD_SCRYPT.r,
    p: PASSWORD_SCRYPT.p
  });
  return [
    'scrypt',
    PASSWORD_SCRYPT.N,
    PASSWORD_SCRYPT.r,
    PASSWORD_SCRYPT.p,
    salt.toString('base64'),
    derived.toString('base64')
  ].join('$');
};

const verifyPassword = (password: string, stored: string) => {
  const parts = stored.split('$');
  if (parts.length !== 6) return false;
  if (parts[0] !== 'scrypt') return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const saltB64 = parts[4];
  const dkB64 = parts[5];
  if (![N, r, p].every((v) => Number.isFinite(v) && v > 0)) return false;
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(dkB64, 'base64');
  if (expected.length < 16) return false;
  const derived = crypto.scryptSync(password, salt, expected.length, { N, r, p });
  return crypto.timingSafeEqual(expected, derived);
};

const isPgConstraintViolation = (error: unknown, constraintName: string) => {
  if (!error || typeof error !== 'object') return false;
  const anyError = error as { code?: unknown; constraint?: unknown; message?: unknown };
  const code = typeof anyError.code === 'string' ? anyError.code : null;
  const constraint = typeof anyError.constraint === 'string' ? anyError.constraint : null;
  const message = typeof anyError.message === 'string' ? anyError.message : null;

  // Postgres unique violation
  if (code === '23505' && constraint === constraintName) return true;
  if (message && message.includes(`"${constraintName}"`)) return true;
  return false;
};

export const readUserId = async () => {
  const cookieStore = await cookies();
  return cookieStore.get(USER_COOKIE)?.value ?? null;
};

export const clearUserCookie = async () => {
  const cookieStore = await cookies();
  cookieStore.set(USER_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });
};

export const setUserCookie = async (userId: string) => {
  const cookieStore = await cookies();
  cookieStore.set(USER_COOKIE, userId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365
  });
};

export const createGuestUser = async (): Promise<UserProfile> => {
  if (!hasDatabase) {
    throw new Error('DATABASE_URL is not configured');
  }
  const userId = crypto.randomUUID();
  await query(
    'INSERT INTO public.users (id, is_guest, display_label) VALUES ($1, $2, $3)',
    [userId, true, '游客']
  );
  await setUserCookie(userId);
  return { id: userId, isGuest: true, label: '游客', email: null, avatarUrl: null, gender: null, age: null };
};

const readUserPasswordHash = async (userId: string) => {
  if (!hasDatabase) throw new Error('DATABASE_URL is not configured');
  const res = await query<{ password_hash: string }>('SELECT password_hash FROM public.user_credentials WHERE user_id = $1', [
    userId
  ]);
  return res.rows?.[0]?.password_hash ?? null;
};

const findUserByEmail = async (email: string) => {
  const normalized = normalizeEmail(email);
  if (!hasDatabase) throw new Error('DATABASE_URL is not configured');
  const res = await query<{ id: string }>('SELECT id FROM public.users WHERE email = $1 LIMIT 1', [normalized]);
  const id = res.rows?.[0]?.id ?? null;
  if (!id) return null;
  return await getUserProfile(id);
};

const setUserPassword = async (userId: string, password: string) => {
  const passwordHash = hashPassword(password);
  if (!hasDatabase) throw new Error('DATABASE_URL is not configured');
  await query(
    `INSERT INTO public.user_credentials (user_id, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = NOW()`,
    [userId, passwordHash]
  );
};

export const setAccountPassword = async (userId: string, payload: { oldPassword?: string | null; password: string }) => {
  const existing = await readUserPasswordHash(userId);
  if (existing) {
    const old = payload.oldPassword ?? '';
    if (!old.trim()) {
      throw new Error('请填写原密码');
    }
    const ok = verifyPassword(old, existing);
    if (!ok) {
      throw new Error('原密码错误');
    }
  }

  await setUserPassword(userId, payload.password);
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!hasDatabase) throw new Error('DATABASE_URL is not configured');

  const result = await query<{
    id: string;
    email: string | null;
    is_guest: boolean;
    display_label: string;
    avatar_url: string | null;
    gender: string | null;
    age: number | null;
  }>(
    `SELECT u.id, u.email, u.is_guest, u.display_label, p.avatar_url, p.gender, p.age
     FROM public.users u
     LEFT JOIN public.user_profiles p ON p.user_id::text = u.id::text
     WHERE u.id = $1`,
    [userId]
  );
  const row = result.rows?.[0];
  if (!row) return null;
  const gender = row.gender === 'male' || row.gender === 'female' || row.gender === 'unknown' ? row.gender : null;
  return {
    id: row.id,
    email: row.email,
    isGuest: row.is_guest,
    label: row.display_label ?? pickLabel(row.email),
    avatarUrl: row.avatar_url ?? null,
    gender,
    age: row.age ?? null
  };
};

export const registerWithPassword = async (payload: { userId?: string | null; email: string; password: string }) => {
  if (!hasDatabase) throw new Error('DATABASE_URL is not configured');
  const email = normalizeEmail(payload.email);
  const existingAccount = await findUserByEmail(email);
  if (existingAccount) {
    throw new Error('该账号已存在：如未设置密码，请先用邀请码登录后到“个人信息”设置密码');
  }

  const currentUserId = payload.userId ?? null;
  const currentProfile = currentUserId ? await getUserProfile(currentUserId) : null;

  // Prefer upgrading guest-in-place so user interactions carry over.
  if (currentProfile?.isGuest) {
    try {
      await query('UPDATE public.users SET email = $1, is_guest = false, display_label = $2 WHERE id = $3', [
        email,
        pickLabel(email),
        currentProfile.id
      ]);
    } catch (error) {
      if (isPgConstraintViolation(error, 'users_email_key')) {
        throw new Error('该邮箱已注册，请直接登录');
      }
      throw error;
    }
    await setUserPassword(currentProfile.id, payload.password);
    await setUserCookie(currentProfile.id);
    const upgraded = await getUserProfile(currentProfile.id);
    if (!upgraded) throw new Error('注册失败');
    return upgraded;
  }

  const userId = crypto.randomUUID();
  try {
    await query('INSERT INTO public.users (id, email, is_guest, display_label) VALUES ($1, $2, $3, $4)', [
      userId,
      email,
      false,
      pickLabel(email)
    ]);
  } catch (error) {
    if (isPgConstraintViolation(error, 'users_email_key')) {
      throw new Error('该邮箱已注册，请直接登录');
    }
    throw error;
  }
  await setUserPassword(userId, payload.password);
  await setUserCookie(userId);
  const created = await getUserProfile(userId);
  if (!created) throw new Error('注册失败');
  return created;
};

export const loginWithPassword = async (payload: { email: string; password: string }) => {
  if (!hasDatabase) throw new Error('DATABASE_URL is not configured');
  const email = normalizeEmail(payload.email);
  const account = await findUserByEmail(email);
  if (!account) {
    throw new Error('账号或密码错误');
  }
  const stored = await readUserPasswordHash(account.id);
  if (!stored) {
    throw new Error('该账号尚未设置密码，请先使用“邀请码登录”，再到“个人信息”设置密码');
  }
  const ok = verifyPassword(payload.password, stored);
  if (!ok) {
    throw new Error('账号或密码错误');
  }
  await setUserCookie(account.id);
  return account;
};

export const upgradeWithEmail = async (userId: string, email: string, inviteCode: string) => {
  if (!hasDatabase) throw new Error('DATABASE_URL is not configured');

  const invite = await query<{ code: string; used_by: string | null }>(
    'SELECT code, used_by FROM public.invites WHERE code = $1',
    [inviteCode]
  );
  if (!invite.rows[0] || invite.rows[0].used_by) {
    throw new Error('邀请码不可用');
  }

  await query('UPDATE public.invites SET used_by = $1, used_at = NOW(), email = COALESCE(email, $2) WHERE code = $3', [
    userId,
    normalizeEmail(email),
    inviteCode
  ]);

  await query(
    'UPDATE public.users SET email = $1, is_guest = false, display_label = $2 WHERE id = $3',
    [normalizeEmail(email), pickLabel(normalizeEmail(email)), userId]
  );

  const normalized = normalizeEmail(email);
  return { id: userId, email: normalized, isGuest: false, label: pickLabel(normalized), avatarUrl: null, gender: null, age: null };
};

export const updateUserProfile = async (
  userId: string,
  patch: { label?: string | null; avatarUrl?: string | null; gender?: 'unknown' | 'male' | 'female' | null; age?: number | null }
) => {
  if (!hasDatabase) throw new Error('DATABASE_URL is not configured');

  if (patch.label != null) {
    await query('UPDATE public.users SET display_label = $1 WHERE id = $2', [patch.label, userId]).catch(() => null);
  }

  if (patch.avatarUrl !== undefined || patch.gender !== undefined || patch.age !== undefined) {
    await query('INSERT INTO public.user_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]).catch(() => null);
    const updates: string[] = [];
    const params: Array<string | number | null> = [];
    let idx = 1;

    if (patch.avatarUrl !== undefined) {
      updates.push(`avatar_url = $${idx++}`);
      params.push(patch.avatarUrl ?? null);
    }
    if (patch.gender !== undefined) {
      updates.push(`gender = $${idx++}`);
      params.push(patch.gender ?? null);
    }
    if (patch.age !== undefined) {
      updates.push(`age = $${idx++}`);
      params.push(patch.age ?? null);
    }
    updates.push('updated_at = NOW()');

    params.push(userId);
    await query(`UPDATE public.user_profiles SET ${updates.join(', ')} WHERE user_id = $${idx}`, params).catch(() => null);
  }

  return await getUserProfile(userId);
};
