import { applyCompletions, applyCommandWithInterception } from "./functions";
import {
  Command,
  CommandCompletion,
  CompletionBatch,
  Model,
  Result,
  Snapshot,
  Sync,
  Interceptor
} from "./types";
import { Inner } from "./inner";
import { PathMapper } from "./path-mapper";

export interface FlushResult {
  // If IDs in the model may have changed
  idsChanged: boolean;
  error?: string;
}

export interface ProxyConfig<T extends object> {
  sequentialIds?: boolean;
  interceptor?: Interceptor<T, any>;
}

/**
 * A proxy with a local copy of a data model that supports flushing changes to the master
 * in beginFlush-endFlush cycles.
 */
export class Proxy<T extends object> implements Model<T> {
  private lastCommittedDocument: string;
  private lastCommittedUpdateCount: number;
  private model: Inner<T>;
  private uncommittedCompletions: CommandCompletion[];
  private nextCommittedDocument?: string;
  private nextCommittedUpdateCount?: number;

  /**
   * Instantiated with the latest snapshot from the master.
   * @param snapshot Snapshot to begin building the proxy model on.
   * @param config Optional configuration options.
   */
  constructor(snapshot: Snapshot<T>, private config?: ProxyConfig<T>) {
    this.model = new Inner(snapshot, config && config.sequentialIds != undefined ? config.sequentialIds : false);
    this.uncommittedCompletions = [];
    this.lastCommittedDocument = JSON.stringify(snapshot.document);
    this.lastCommittedUpdateCount = snapshot.commandCount;
  }
  public getDocument(): T {
    return this.model.getDocument();
  }
  public getCommandCount(): number {
    return this.model.getCommandCount();
  }
  public apply(command: Command): Result {
    const interception = this.config != undefined && this.config.interceptor != undefined ? 
        this.config.interceptor(this.model.getDocument(), command) : 
        undefined;
    const resultWithCommand = applyCommandWithInterception(this.model, command, interception);
    if (resultWithCommand.result.isSuccess) {
      // Only store successfully applied commands in proxies
      this.uncommittedCompletions.push({
        command: resultWithCommand.modifiedCommand ? resultWithCommand.modifiedCommand : command,
        createdId: resultWithCommand.result.createdId
      });
    } else {
      // If there's a risk that the failed command modified the model, we would want to
      // rebuild it from our last committed snapshot and uncommitted commands, but we
      // don't yet have commands that can fail in that way yet
    }
    return resultWithCommand.result;
  }
  /**
   * Returns a batch of currently uncommited changes and prepares the proxy for accepting
   * more changes that get sent in the next flush. The flush must be ended with endFlush
   * or cancelFlush before the next flush can begin.
   */
  public beginFlush(): CompletionBatch {
    if (this.nextCommittedDocument != undefined) {
      throw Error("Flush already in progress");
    }
    this.nextCommittedDocument = JSON.stringify(this.model.getDocument());
    this.nextCommittedUpdateCount = this.model.getCommandCount();
    const batch: CompletionBatch = {
      from: this.lastCommittedUpdateCount,
      completions: this.uncommittedCompletions
    };
    this.uncommittedCompletions = [];
    return batch;
  }
  /**
   * Cancels the current flush and puts the changes back at the start of the uncommitted queue
   * to be sent in the next flush. Can be used if the flush fails to communicate with the master.
   * @param flush The started the flush.
   */
  public cancelFlush(flush: CompletionBatch) {
    this.uncommittedCompletions = flush.completions.concat(
      this.uncommittedCompletions
    );
    this.nextCommittedDocument = undefined;
    this.nextCommittedUpdateCount = undefined;
  }

  public hasUnflushedCommands(): boolean {
    return this.uncommittedCompletions.length > 0;
  }

  /**
   * Ends an ongoing flush with the result of how the flushed changes were reconciled
   * at the Master.
   * @param sync Undefined if the changes were integrated as-is in the master, or a Sync
   * that specifies how to update the proxy to latest stage of the Master.
   *
   */
  public endFlush(sync?: Sync<T>): FlushResult {
    let idsChanged = false;
    if (
      this.nextCommittedDocument == undefined ||
      this.nextCommittedUpdateCount == undefined
    ) {
      return {
        idsChanged: false,
        error: "No flush in progress"
      };
    }
    if (!sync) {
      this.lastCommittedDocument = this.nextCommittedDocument;
      this.lastCommittedUpdateCount = this.nextCommittedUpdateCount;
      this.nextCommittedDocument = undefined;
      this.nextCommittedUpdateCount = undefined;
    } else {
      if (sync.isPartial) {
        const err = this.applyDiff(sync.diff);
        if (err) {
          return {
            idsChanged: true,
            error: err
          };
        }
        idsChanged = sync.mappedPaths != undefined;
      } else {
        this.model = new Inner(
          JSON.parse(JSON.stringify(sync.latest)),
          this.config && this.config.sequentialIds != undefined ? this.config.sequentialIds : false
        );
        idsChanged = true;
      }
      this.lastCommittedDocument = JSON.stringify(this.model.getDocument());
      this.lastCommittedUpdateCount = this.model.getCommandCount();
      const uncommittedApplied = applyCompletions(
        this.model,
        this.uncommittedCompletions,
        new PathMapper(sync.mappedPaths),
        undefined
      );
      if (uncommittedApplied) {
        idsChanged = true;
        this.uncommittedCompletions = uncommittedApplied.applied.completions;
        // Silently discard errors in uncommitted
      }
      this.nextCommittedDocument = undefined;
      this.nextCommittedUpdateCount = undefined;
    }
    return {
      idsChanged
    };
  }
  private applyDiff(diff: CompletionBatch): undefined | string {
    if (this.lastCommittedUpdateCount === diff.from) {
      this.model = new Inner(
        {
          commandCount: this.lastCommittedUpdateCount,
          document: JSON.parse(this.lastCommittedDocument)
        },
        this.config && this.config.sequentialIds != undefined ? this.config.sequentialIds : false
      );
      const diffApplied = applyCompletions(
        this.model,
        diff.completions,
        new PathMapper(),
        undefined
      );
      if (diffApplied && diffApplied.errors) {
        return "Errors when applying diff on previous model";
      }
      return undefined;
    }
    return "Failed to apply diff because its from-update-count did not match last committed";
  }
}
