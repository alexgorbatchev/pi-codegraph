import { spawn } from "node:child_process";
import { access, mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { resolveCodeGraphLaunch, runCodeGraph, sanitizeDiagnostic, } from "./codegraph.js";
import { JsonRpcPeer } from "./jsonrpc.js";
const DAEMON_DIRECTORY = "daemon";
const INITIALIZE_LOCK = ".initialize.lock";
const DATABASE_PATH = join(".codegraph", "codegraph.db");
const LOCK_POLL_MS = 50;
const MIN_STALE_LOCK_MS = 30_000;
function isNodeError(error) {
    return error instanceof Error && "code" in error;
}
async function pathExists(path) {
    try {
        await access(path);
        return true;
    }
    catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") {
            return false;
        }
        throw error;
    }
}
export function codeGraphDaemonRoot(indexStore) {
    return join(indexStore, DAEMON_DIRECTORY);
}
async function acquireInitializeLock(lockPath, timeoutMs) {
    const startedAt = Date.now();
    const staleAfterMs = Math.max(timeoutMs, MIN_STALE_LOCK_MS);
    while (true) {
        try {
            await mkdir(lockPath);
            return () => rm(lockPath, { force: true, recursive: true });
        }
        catch (error) {
            if (!isNodeError(error) || error.code !== "EEXIST") {
                throw error;
            }
            const lockStat = await stat(lockPath).catch(() => undefined);
            if (lockStat && Date.now() - lockStat.mtimeMs > staleAfterMs) {
                await rm(lockPath, { force: true, recursive: true });
                continue;
            }
            if (Date.now() - startedAt >= timeoutMs) {
                throw new Error(`Timed out waiting for CodeGraph daemon initialization lock: ${lockPath}`);
            }
            await delay(LOCK_POLL_MS);
        }
    }
}
async function ensureDaemonRoot(settings) {
    const daemonRoot = codeGraphDaemonRoot(settings.indexStore);
    const databasePath = join(daemonRoot, DATABASE_PATH);
    await mkdir(daemonRoot, { recursive: true });
    if (await pathExists(databasePath)) {
        return daemonRoot;
    }
    const release = await acquireInitializeLock(join(settings.indexStore, INITIALIZE_LOCK), settings.requestTimeoutMs);
    try {
        if (!(await pathExists(databasePath))) {
            await runCodeGraph(settings, daemonRoot, ["init", "-i"], {
                timeoutMs: settings.requestTimeoutMs,
            });
        }
    }
    finally {
        await release();
    }
    return daemonRoot;
}
export class CodeGraphWorkerPool {
    settings;
    projects = new Set();
    entry;
    creating;
    closed = false;
    constructor(settings) {
        this.settings = settings;
    }
    activeProjects() {
        return new Set(this.projects);
    }
    async call(projectPath, toolName, args, signal) {
        if (this.closed) {
            throw new Error("CodeGraph worker pool is closed");
        }
        this.projects.add(projectPath);
        const entry = await this.getOrCreateEntry();
        const result = await entry.peer.request("tools/call", {
            name: toolName,
            arguments: { ...args, projectPath },
        }, {
            signal,
            timeoutMs: this.settings.requestTimeoutMs,
        });
        return result;
    }
    async closeProject(projectPath, _error) {
        this.projects.delete(projectPath);
    }
    async close() {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this.projects.clear();
        const pending = this.creating;
        if (pending) {
            await pending.catch(() => undefined);
        }
        await this.closeEntry();
    }
    async getOrCreateEntry() {
        if (this.entry && !this.entry.exited) {
            return this.entry;
        }
        if (this.creating) {
            return this.creating;
        }
        this.creating = this.createEntry();
        try {
            const entry = await this.creating;
            if (this.closed) {
                await this.stopEntry(entry);
                throw new Error("CodeGraph worker pool closed while connecting");
            }
            this.entry = entry;
            return entry;
        }
        finally {
            this.creating = undefined;
        }
    }
    async createEntry() {
        const daemonRoot = await ensureDaemonRoot(this.settings);
        const launch = await resolveCodeGraphLaunch(this.settings, [
            "serve",
            "--mcp",
            "--path",
            daemonRoot,
        ]);
        const child = spawn(launch.command, launch.args, {
            cwd: daemonRoot,
            env: {
                ...process.env,
                CODEGRAPH_DAEMON_IDLE_TIMEOUT_MS: process.env.CODEGRAPH_DAEMON_IDLE_TIMEOUT_MS ??
                    String(this.settings.workerIdleTimeoutMs),
                CODEGRAPH_QUERY_POOL_SIZE: process.env.CODEGRAPH_QUERY_POOL_SIZE ??
                    String(this.settings.maxWorkers),
            },
            stdio: ["pipe", "pipe", "pipe"],
        });
        const peer = new JsonRpcPeer(child.stdout, child.stdin, {
            name: "shared-codegraph-daemon",
        });
        const entry = { child, peer, exited: false };
        let stderr = "";
        child.stderr.setEncoding("utf8");
        child.stderr.on("data", (chunk) => {
            stderr = (stderr + chunk).slice(-8_192);
        });
        child.once("error", (error) => {
            entry.exited = true;
            peer.close(error);
        });
        child.once("exit", (code, signal) => {
            entry.exited = true;
            if (this.entry === entry) {
                this.entry = undefined;
            }
            const detail = stderr.trim() ? `: ${sanitizeDiagnostic(stderr)}` : "";
            peer.close(new Error(`CodeGraph proxy exited (code=${String(code)}, signal=${String(signal)})${detail}`));
        });
        try {
            await peer.request("initialize", {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: {
                    name: "pi-codegraph",
                    version: "0.0.0",
                },
                rootUri: pathToFileURL(daemonRoot).href,
            }, { timeoutMs: this.settings.requestTimeoutMs });
            peer.notify("notifications/initialized");
            return entry;
        }
        catch (error) {
            await this.stopEntry(entry);
            const detail = stderr.trim() ? `: ${sanitizeDiagnostic(stderr)}` : "";
            throw new Error(`Failed to connect to shared CodeGraph daemon${detail}`, {
                cause: error,
            });
        }
    }
    async closeEntry() {
        const entry = this.entry;
        this.entry = undefined;
        if (entry) {
            await this.stopEntry(entry);
        }
    }
    async stopEntry(entry) {
        entry.peer.close(new Error("CodeGraph proxy closed"));
        if (entry.exited) {
            return;
        }
        entry.child.stdin.end();
        const exited = new Promise((resolve) => {
            entry.child.once("exit", () => resolve());
        });
        await Promise.race([exited, delay(500)]);
        if (!entry.exited) {
            entry.child.kill();
        }
    }
}
//# sourceMappingURL=worker-pool.js.map