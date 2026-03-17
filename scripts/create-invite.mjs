import crypto from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Pool } = pg;

const buildCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  const token = Array.from(bytes)
    .map((b) => alphabet[b % alphabet.length])
    .join('')
    .slice(0, 6);
  return `CM-${token}`;
};

const main = async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Missing DATABASE_URL.');
    process.exitCode = 1;
    return;
  }

  const emailArg = process.argv.find((arg) => arg.startsWith('--email='));
  const email = emailArg ? emailArg.slice('--email='.length).trim() : null;

  const pool = new Pool({ connectionString });
  const code = buildCode();
  try {
    await pool.query('INSERT INTO public.invites (code, email) VALUES ($1, $2)', [code, email]);
    console.log(code);
  } finally {
    await pool.end().catch(() => {});
  }
};

await main();
