import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(npmCommand, ["run", "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NITRO_PRESET: "node_server",
  },
});

child.on("error", (error) => {
  console.error("Failed to start VPS build:", error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
