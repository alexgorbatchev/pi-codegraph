import type { CodeGraphSettings, ToolResult } from "./types.js";
export declare function codeGraphDaemonRoot(indexStore: string): string;
export declare class CodeGraphWorkerPool {
    readonly settings: CodeGraphSettings;
    readonly projects: Set<string>;
    private entry?;
    private creating?;
    private closed;
    constructor(settings: CodeGraphSettings);
    activeProjects(): Set<string>;
    call(projectPath: string, toolName: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<ToolResult>;
    closeProject(projectPath: string, _error?: Error): Promise<void>;
    close(): Promise<void>;
    private getOrCreateEntry;
    private createEntry;
    private closeEntry;
    private stopEntry;
}
//# sourceMappingURL=worker-pool.d.ts.map