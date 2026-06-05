require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { seed } = require('./seed');

async function migrate() {
  const isProduction = process.env.NODE_ENV === 'production';
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ...(isProduction && { ssl: { rejectUnauthorized: false } }),
  });
  const client = await pool.connect();
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    console.log('Running Bedaya migration...');
    await client.query(sql);
    console.log('Schema applied. Seeding letter data model...');
    await seed(client);
    console.log('Migration completed.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
