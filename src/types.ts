export type Result =
  | { isSuccess: true; createdId?: string }
  | { isSuccess: false; error: string };

/**
 * A sync to update a Proxy to the Master model's state after a flush. mappedPaths are ID's that
 * got renamed when Create commands resulted in name collisions in the master. Depending on
 * whether the Master has access to history, it may return a full or partial sync that either
 * returns a complete snapshot, or the commands necessary to update the proxy to the master's state.
 */
export type Sync<T extends object> = {
  mappedPaths?: Record<string, string[]>;
} & (
  | {
      isPartial: true;
      diff: CompletionBatch;
    }
  | {
      isPartial: false;
      latest: Snapshot<T>;
    });

export enum CommandAction {
  Create = "create",
  Update = "update",
  Delete = "detete"
}
export interface Command {
  path?: string[];
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
  getCommandCount(): number;
  apply(command: Command, proposeCreateId?: string): Result;
}

export interface Snapshot<T extends object> {
  commandCount: number;
  document: T;
}

export interface CompletionError {
  action: CommandAction;
  path: string[];
  errorMessage: string;
}
