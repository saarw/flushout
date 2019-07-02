export type Result = {isSuccess: true, newId?: string} | {isSuccess: false, error: string};

export type Sync<T extends object> = { 
        isPartial: true, 
        diff: CompletionBatch,
        mappedPaths?: Record<string, string[]>
    } | 
    { 
        isPartial: false,
        latest: Snapshot<T>,
        mappedPaths?: Record<string, string[]>
    };

export enum CommandAction {
    Create = 'create',
    Update = 'update',
    Delete = 'detete'
}
export interface Command {
    path?:  string[];
    action: CommandAction;
    props?: Record<string, any>;
}

export interface CommandCompletion {
    command: Command;
    newId?: string;
}

export interface CompletionBatch {
    from: number;
    completions: CommandCompletion[];
}

export interface Model<T extends object> {
    getDocument(): T;
    getUpdateCount(): number;
    performCommand(command: Command): Result;
}


export interface HistoryStore {
    // Returns the history from the specified update count, if available, otherwise undefined
    get(from: number, to: number): Promise<CommandCompletion[] | undefined>;

    // Stores the completions from the specified update count
    store(from: number, completions: CommandCompletion[]): Promise<void>;
}

export interface Snapshot<T extends object> {
    updateCount: number;
    document: T
}

export interface CompletionError {
    action: CommandAction,
    path: string[],
    errorMessage: string
}
export interface ApplyResult<T extends object> {
    sync?: Sync<T>;
    errors?: CompletionError[]
}