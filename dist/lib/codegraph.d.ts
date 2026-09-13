import type { CodeGraphSettings, WorkspaceIdentity, WorkspaceStatus } from "./types.js";
interface CodeGraphRunOptions {
    signal?: AbortSignal;
    timeoutMs?: number;
    forceSync?: boolean;
}
interface CodeGraphRunResult {
    stdout: string;
    stderr: string;
}
export declare function sanitizeDiagnostic(value: unknown, maxLength?: number): string;
export declare function truncateText(value: unknown, maxChars: number): {
    text: string;
    truncated: boolean;
};
export declare function normalizeFilesPath(inputPath: unknown, projectCwd?: string): string | undefined;
export declare function annotateFilesResult(text: string, originalPath?: string): string;
export declare function gitIdentity(input: string): Promise<WorkspaceIdentity>;
export declare class ProjectGuard {
    readonly base: WorkspaceIdentity;
    readonly allowedRoots: string[];
    static create(baseRoot: string, settings: CodeGraphSettings): Promise<ProjectGuard>;
    constructor(base: WorkspaceIdentity, allowedRoots: string[]);
    resolve(requestedPath?: string): Promise<WorkspaceIdentity>;
}
export declare function resolveCodeGraphLaunch(settings: CodeGraphSettings, args?: string[]): Promise<{
    command: string;
    args: string[];
}>;
export declare function runCodeGraph(settings: CodeGraphSettings, cwd: string, args: string[], options?: CodeGraphRunOptions): Promise<CodeGraphRunResult>;
export declare class WorkspaceManager {
    #private;
    readonly settings: CodeGraphSettings;
    readonly lastSync: Map<string, number>;
    private lastGc;
    constructor(settings: CodeGraphSettings);
    prepare(identity: WorkspaceIdentity, options?: CodeGraphRunOptions): Promise<{
        schemaVersion: number;
        sourcePath: string;
        repoIdentity: string;
        worktreeIdentity: string;
        managed: boolean;
        lastPreparedAt: string;
        lastSyncAt: number | null;
        indexPath: string;
        state: string;
    }>;
    status(identity: WorkspaceIdentity): Promise<WorkspaceStatus>;
    doctor(identity: WorkspaceIdentity): Promise<{
        executable: string;
        workspace: WorkspaceStatus;
        settings: Omit<CodeGraphSettings, "codegraphExecutable"> & {
            codegraphExecutable: string;
        };
    }>;
    gc(activeProjects?: ReadonlySet<string>, force?: boolean): Promise<{
        removed: string[];
    }>;
}
export declare function workspaceSummary(cwd: string): Promise<WorkspaceStatus>;
export declare function publicSettings(settings: CodeGraphSettings): Omit<CodeGraphSettings, "codegraphExecutable"> & {
    codegraphExecutable: string;
};
export {};
//# sourceMappingURL=codegraph.d.ts.map