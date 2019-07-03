export type Result = {isSuccess: true, createdId?: string} | {isSuccess: false, error: string};

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
    createdId?: string;
}

export interface CompletionBatch {
    from: number;
    completions: CommandCompletion[];
}

export interface Model<T extends object> {
    getDocument(): T;
    getUpdateCount(): number;
    apply(command: Command, proposeCreateId?: string): Result;
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
