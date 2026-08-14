#!/usr/bin/env node
/**
 * Load Manus → Railway replication settings from environment variables,
 * falling back to replication-config.json when present (local only; that
 * file is gitignored).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "../replication-config.json");

function fromFile() {
  if (!fs.existsSync(configPath)) return {};
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function mysqlFromEnv(prefix, fallback = {}) {
  const host = process.env[`${prefix}_HOST`] ?? fallback.host;
  const port = Number(process.env[`${prefix}_PORT`] ?? fallback.port ?? 0);
  const username = process.env[`${prefix}_USER`] ?? fallback.username;
  const password = process.env[`${prefix}_PASS`] ?? fallback.password;
  const database = process.env[`${prefix}_NAME`] ?? fallback.database;
  const sslEnv = process.env[`${prefix}_SSL`];
  const ssl =
    sslEnv === undefined ? Boolean(fallback.ssl) : sslEnv === "1" || sslEnv.toLowerCase() === "true";
  if (!host || !username || !password || !database || !port) return null;
  return { host, port, username, password, database, ssl };
}

export function loadReplicationConfig() {
  const file = fromFile();
  const manus = mysqlFromEnv("MANUS_DB", file.manus?.mysql ?? {});
  const railway = mysqlFromEnv("RAILWAY_DB", file.railway?.mysql ?? {});
  const r2Fallback = file.cloudflare?.r2 ?? {};
  const r2 = {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? r2Fallback.accountId ?? "",
    bucketName: process.env.CLOUDFLARE_R2_BUCKET ?? r2Fallback.bucketName ?? "",
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY ?? r2Fallback.accessKeyId ?? "",
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY ?? r2Fallback.secretAccessKey ?? "",
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT ?? r2Fallback.endpoint ?? "",
  };

  return { manus, railway, r2, configPath };
}

export function requireMysqlTargets() {
  const { manus, railway } = loadReplicationConfig();
  if (!manus) {
    throw new Error(
      "Manus DB settings missing. Set MANUS_DB_HOST/PORT/USER/PASS/NAME or provide replication-config.json (see replication-config.example.json)."
    );
  }
  if (!railway) {
    throw new Error(
      "Railway DB settings missing. Set RAILWAY_DB_HOST/PORT/USER/PASS/NAME or provide replication-config.json (see replication-config.example.json)."
    );
  }
  return { manus, railway };
}
