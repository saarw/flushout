export type Result = {isSuccess: true, newId?: string} | {isSuccess: false, error: string};

export type Sync = { 
        isPartial: true, 
        diff: CompletionBatch,
        mappedPaths?: Record<string, string[]>
    } | 
    { 
        isPartial: false,
        latest: Snapshot,
        mappedPaths?: Record<string, string[]>
    };

export enum CommandAction {
    New = 'new',
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

export interface Model {
    getDocument(): object;
    getUpdateCount(): number;
    performCommand(command: Command): Result;
}


export interface HistoryStore {
    // Returns the history from the specified update number, if available, otherwise undefined
    get(from: number, to: number): CommandCompletion[] | undefined;

    // Stores the execution with its model udate number
    store(update: number, command: CommandCompletion);
}

export interface Snapshot {
    updateCount: number;
    document: object
}

export interface CompletionError {
    action: CommandAction,
    path: string[],
    errorMessage: string
}
export interface ApplyResult {
    sync?: Sync;
    errors?: CompletionError[]
}