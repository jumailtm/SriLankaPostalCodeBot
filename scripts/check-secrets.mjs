import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function runGit(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error("Unable to inspect Git files for secrets.");
  }
  return result.stdout.trim();
}

const trackedAndCandidateFiles = runGit([
  "ls-files",
  "--cached",
  "--others",
  "--exclude-standard",
])
  .split(/\r?\n/u)
  .filter((file) => file.length > 0 && existsSync(file));

const forbiddenFiles = trackedAndCandidateFiles.filter((file) =>
  /(^|\/)(?:\.env(?:\..+)?|[^/]+\.(?:pem|key|p12|pfx))$/iu.test(file),
);

const unexpectedForbiddenFiles = forbiddenFiles.filter((file) => file !== ".env.example");

const highRiskPatterns = [
  new RegExp("postgres(?:ql)?" + "://[^\\s\"']+:[^\\s\"']+@", "iu"),
  new RegExp("\\b[0-9]{6,12}" + ":[A-Za-z0-9_-]{30,}\\b", "u"),
  new RegExp("-----BEGIN " + "(?:RSA |EC |OPENSSH )?PRIVATE KEY-----", "u"),
  new RegExp("\\bBearer " + "[A-Za-z0-9._-]{20,}", "iu"),
];

const suspiciousFiles = [];
for (const file of trackedAndCandidateFiles) {
  const content = readFileSync(file, "utf8");
  if (highRiskPatterns.some((pattern) => pattern.test(content))) {
    suspiciousFiles.push(file);
  }
}

if (unexpectedForbiddenFiles.length > 0 || suspiciousFiles.length > 0) {
  console.error("Potential credential material was found. No files were changed.");
  for (const file of [...new Set([...unexpectedForbiddenFiles, ...suspiciousFiles])]) {
    console.error(`- ${file}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Secret scan passed for ${trackedAndCandidateFiles.length} tracked or candidate files.`,
  );
}
