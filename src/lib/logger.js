import fs from "node:fs";
import path from "node:path";

function makeEntry(level, message, data) {
  return {
    ts: new Date().toISOString(),
    level,
    message,
    data: data ?? null
  };
}

export function createMemoryLogger() {
  const logger = {
    entries: [],
    counts: { info: 0, warn: 0, error: 0 },
    log(level, message, data) {
      const entry = makeEntry(level, message, data);
      this.entries.push(entry);
      this.counts[level] = (this.counts[level] ?? 0) + 1;
    },
    info(message, data) {
      this.log("info", message, data);
    },
    warn(message, data) {
      this.log("warn", message, data);
    },
    error(message, data) {
      this.log("error", message, data);
    }
  };
  return logger;
}

export function createFileLogger(logDir) {
  fs.mkdirSync(logDir, { recursive: true });
  const memory = createMemoryLogger();
  const logFile = path.join(logDir, `build-${new Date().toISOString().replaceAll(":", "")}.jsonl`);
  const write = memory.log.bind(memory);

  memory.log = (level, message, data) => {
    write(level, message, data);
    const entry = memory.entries.at(-1);
    fs.appendFileSync(logFile, `${JSON.stringify(entry)}\n`, "utf8");
    const line = data ? `${message} ${JSON.stringify(data)}` : message;
    console.log(`[${entry.ts}] ${level.toUpperCase()} ${line}`);
  };
  memory.logFile = logFile;
  return memory;
}
