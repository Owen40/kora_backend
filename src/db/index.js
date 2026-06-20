const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const dotenvPath = path.resolve(__dirname, '../../.env');
console.log('Loading .env from:', dotenvPath);
console.log('File exists?', require('fs').existsSync(dotenvPath));

console.log("All env vars loaded:", Object.keys(process.env).filter(k => k.startsWith('DB_')));

console.log("DB_PASSWORD:", typeof process.env.DB_PASSWORD, process.env.DB_PASSWORD?.length);

const { Pool } = require('pg');
// require('dotenv').config();
let sslConfig = false;

if (process.env.DB_CA) {
  const caCert = process.env.DB_CA.replace(/\\n/g, '\n');

  console.log("🔐 DB_CA detected in environment");
  console.log("📄 CA certificate preview:", caCert.substring(0, 60) + '...');
  sslConfig = { ca: caCert };
} else if (process.env.DB_SSL === 'true') {
  console.log("⚠️ No CA found in env, falling back to rejectUnauthorized: false");
  sslConfig = { rejectUnauthorized: false };
} else {
  console.log("ℹ️ SSL disabled (local dev mode)");
  sslConfig = false;
}

// Use original DATABASE_URL with SSL configuration
const pool = new Pool({
  // connectionString: process.env.DATABASE_URL,
  // ssl: { rejectUnauthorized: false }
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: sslConfig,
  // ssl: { rejectUnauthorized: false },
  // ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Helper function to execute queries
const query = async (text, params = []) => {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } catch (error) {
    console.error('❌ Database query error:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

// Get pool client
const getClient = () => pool;

module.exports = {
  query,
  getClient,
  pool
};