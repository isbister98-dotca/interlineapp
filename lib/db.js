import postgres from 'postgres';

// Connects using the DATABASE_URL environment variable you set in Vercel
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

export { sql };
