import type { Readable, Writable } from "node:stream";
import type { JsonRpcRequestOptions } from "./types.js";
export declare class JsonRpcPeer {
    #private;
    readonly readable: Readable;
    readonly writable: Writable;
    readonly name: string;
    private nextId;
    private readonly pending;
    private buffer;
    private closed;
    constructor(readable: Readable, writable: Writable, options?: {
        name?: string;
    });
    request(method: string, params?: Record<string, unknown>, options?: JsonRpcRequestOptions): Promise<unknown>;
    notify(method: string, params?: Record<string, unknown>): void;
    close(error?: Error): void;
}
//# sourceMappingURL=jsonrpc.d.ts.map