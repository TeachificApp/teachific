#!/usr/bin/env node
/**
 * Inspect / update the existing Teachific + UltrasoundAssist Railway projects.
 *
 * Does NOT create new projects. Known IDs (from dashboard):
 *   bd15256f-be9c-4d5e-838d-daae94448fa1
 *   b708c39f-23fe-4547-b1b5-9a53104e94b4
 *
 * Usage:
 *   RAILWAY_API_TOKEN=... node scripts/railway-update-existing.mjs
 *   RAILWAY_API_TOKEN=... node scripts/railway-update-existing.mjs --apply
 *
 * --apply upserts only missing safe vars (NODE_ENV, JWT_SECRET, DATABASE_URL
 * reference to MySQL). It never deletes variables or creates extra projects.
 *
 * Secret values are never printed — only variable names.
 */

import { randomBytes } from "node:crypto";

const API = "https://backboard.railway.com/graphql/v2";
const KNOWN_PROJECT_IDS = [
  "bd15256f-be9c-4d5e-838d-daae94448fa1",
  "b708c39f-23fe-4547-b1b5-9a53104e94b4",
];

const APPLY = process.argv.includes("--apply");

function token() {
  return process.env.RAILWAY_API_TOKEN || process.env.RAILWAY_TOKEN || "";
}

async function gql(query, variables = {}) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token()}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).join("; ");
    const err = new Error(msg);
    err.graphql = json.errors;
    throw err;
  }
  return json.data;
}

async function tryGql(query, variables = {}) {
  try {
    return await gql(query, variables);
  } catch (err) {
    return { error: err.message };
  }
}

function isMysqlService(name = "") {
  return /mysql/i.test(name);
}

function isAppService(name = "") {
  return !isMysqlService(name) && !/redis|postgres|mongo|volume/i.test(name);
}

async function loadProject(id) {
  return gql(
    `query project($id: String!) {
      project(id: $id) {
        id
        name
        description
        environments { edges { node { id name } } }
        services { edges { node { id name } } }
      }
    }`,
    { id }
  );
}

async function loadVariableKeys(projectId, environmentId, serviceId) {
  const data = await tryGql(
    `query vars($projectId: String!, $environmentId: String!, $serviceId: String) {
      variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
    }`,
    { projectId, environmentId, serviceId }
  );
  if (data.error) return { keys: [], error: data.error };
  const vars = data.variables || {};
  return { keys: Object.keys(vars).sort(), map: vars };
}

async function upsertVars(projectId, environmentId, serviceId, variables) {
  return gql(
    `mutation upsert($input: VariableCollectionUpsertInput!) {
      variableCollectionUpsert(input: $input)
    }`,
    {
      input: {
        projectId,
        environmentId,
        serviceId,
        variables,
        replace: false,
      },
    }
  );
}

function guessApp(projectName = "", serviceNames = []) {
  const hay = `${projectName} ${serviceNames.join(" ")}`.toLowerCase();
  if (hay.includes("ultrasound") || hay.includes("aaus") || hay.includes("iheartecho")) {
    return "ultrasound-app";
  }
  if (hay.includes("teachific")) return "teachific";
  return "unknown";
}

async function main() {
  if (!token()) {
    console.error("RAILWAY_API_TOKEN is not set in this environment.");
    console.error("Add a workspace/account token from https://railway.com/account/tokens");
    console.error("(not a project token from Project Settings).");
    process.exit(1);
  }

  console.log(APPLY ? "Mode: APPLY missing vars" : "Mode: inspect only (pass --apply to upsert missing vars)");
  console.log("");

  const who = await tryGql(`query { me { name email } }`);
  if (who.error) {
    console.error("Railway API auth failed:", who.error);
    console.error("If this is a project token, replace it with a workspace/account token.");
    process.exit(1);
  }
  console.log(`Authenticated as: ${who.me?.name || "?"} <${who.me?.email || "?"}>`);

  const listed = await tryGql(`query { projects { edges { node { id name } } } }`);
  if (!listed.error) {
    const all = listed.projects?.edges?.map((e) => e.node) || [];
    console.log(`Workspace projects (${all.length}):`);
    for (const p of all) console.log(`  - ${p.name}  ${p.id}`);
    console.log("");
  }

  for (const id of KNOWN_PROJECT_IDS) {
    console.log(`=== Project ${id} ===`);
    let data;
    try {
      data = await loadProject(id);
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
      console.log("");
      continue;
    }
    const project = data.project;
    if (!project) {
      console.log("  Not found (wrong workspace or deleted).");
      console.log("");
      continue;
    }
    const services = project.services?.edges?.map((e) => e.node) || [];
    const environments = project.environments?.edges?.map((e) => e.node) || [];
    const appGuess = guessApp(project.name, services.map((s) => s.name));
    console.log(`  name: ${project.name}`);
    console.log(`  guessed app: ${appGuess}`);
    console.log(`  environments: ${environments.map((e) => `${e.name} (${e.id})`).join(", ") || "(none)"}`);
    console.log(`  services:`);
    for (const s of services) {
      const kind = isMysqlService(s.name) ? "mysql" : isAppService(s.name) ? "app" : "other";
      console.log(`    - ${s.name} [${kind}] ${s.id}`);
    }

    const env = environments.find((e) => /prod|production|main/i.test(e.name)) || environments[0];
    if (!env) {
      console.log("  No environment — skip variables.");
      console.log("");
      continue;
    }

    const mysql = services.find((s) => isMysqlService(s.name));
    const app = services.find((s) => isAppService(s.name)) || services.find((s) => !isMysqlService(s.name));

    if (!mysql) console.log("  MySQL: MISSING — add Database → MySQL in this existing project (do not create a new project).");
    if (!app) console.log("  App service: MISSING — connect the GitHub repo to this project.");

    if (app) {
      const { keys, error } = await loadVariableKeys(project.id, env.id, app.id);
      if (error) {
        console.log(`  variables: error (${error})`);
      } else {
        console.log(`  ${app.name} variable keys (${keys.length}): ${keys.join(", ") || "(none)"}`);
      }

      if (APPLY && !error) {
        const existing = new Set(keys);
        const toSet = {};
        if (!existing.has("NODE_ENV")) toSet.NODE_ENV = "production";
        if (!existing.has("JWT_SECRET")) toSet.JWT_SECRET = randomBytes(64).toString("hex");
        if (!existing.has("DATABASE_URL") && mysql) {
          toSet.DATABASE_URL = `\${{${mysql.name}.MYSQL_URL}}`;
        }
        const extras = ["OPENAI_API_KEY", "SENDGRID_API_KEY", "SENDGRID_FROM_EMAIL", "SENDGRID_FROM_NAME"];
        for (const name of extras) {
          if (!existing.has(name) && process.env[name]) toSet[name] = process.env[name];
        }
        if (Object.keys(toSet).length === 0) {
          console.log("  apply: nothing missing");
        } else {
          await upsertVars(project.id, env.id, app.id, toSet);
          console.log(`  apply: upserted ${Object.keys(toSet).join(", ")}`);
        }
      }
    }
    console.log("");
  }

  if (!APPLY) {
    console.log("Re-run with --apply to set missing NODE_ENV / JWT_SECRET / DATABASE_URL on the app services.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
