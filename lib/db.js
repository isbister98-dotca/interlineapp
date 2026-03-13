import postgres from 'postgres';

// Connects using the DATABASE_URL environment variable you set in Vercel
// prepare: false is required for pgbouncer transaction mode (port 6543)
const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  prepare: false,
});

export { sql };
