import type { CodeGraphSettings, ToolResult } from "./types.js";
export declare class PiCodeGraphClient {
    #private;
    readonly settings: CodeGraphSettings;
    readonly baseRoot: string;
    private startPromise?;
    private child?;
    private peer?;
    constructor(settings: CodeGraphSettings, baseRoot: string);
    start(): Promise<void>;
    request(method: string, params?: Record<string, unknown>, signal?: AbortSignal): Promise<unknown>;
    callTool(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<ToolResult>;
    close(): Promise<void>;
}
//# sourceMappingURL=pi-mcp-client.d.ts.map