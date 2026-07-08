import { Pool } from "pg";

const pool = new Pool({
  host: process.env.PAYMENT_DB_HOST || "localhost",
  port: Number(process.env.PAYMENT_DB_PORT) || 5432,
  database: process.env.PAYMENT_DB_NAME || "payment_db",
  user: process.env.PAYMENT_DB_USER || "payment_user",
  password: process.env.PAYMENT_DB_PASSWORD || "payment_password"
});

export async function runQuery(sql, params = []) {
  const result = await pool.query(sql, params);
  return result;
}

export async function checkDatabaseHealth() {
  await pool.query("SELECT 1");
}

export async function closeDatabaseConnection() {
  await pool.end();
}
