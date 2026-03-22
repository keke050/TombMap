import process from 'node:process';

const main = async () => {
  // Tomb records are currently served from `data/seed/tombs.json` by default.
  // This script intentionally does not import 30k+ tomb rows into Postgres.
  //
  // If you later decide to run tomb search/list from DB, you can implement a
  // dedicated tomb-seeding script and set `TOMBS_DATABASE=1`.
  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL; nothing to seed.');
    process.exitCode = 1;
    return;
  }
  console.log('DB seed: no-op (interactions tables only).');
};

await main();

