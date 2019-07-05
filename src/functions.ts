import {
  Command,
  CommandCompletion,
  CommandInterception,
  CompletionBatch,
  CompletionError,
  Model,
  Interceptor,
  Result,
  CommandAction
} from "./types";
import { PathMapper } from "./path-mapper";

export function applyCompletions<T extends object, C>(
  model: Model<T>,
  completions: CommandCompletion[],
  pathMapper: PathMapper,
  intercept: Interceptor<T, C> | undefined,
  context?: C
): undefined | { applied: CompletionBatch; errors?: CompletionError[] } {
  const startUpdate = model.getCommandCount();
  let modifiedBatch: CommandCompletion[] | undefined;
  let errors: CompletionError[] | undefined;
  completions.forEach((c, idx) => {
    let path = c.command.path || [];
    const mapped = pathMapper.get(path);
    let command: Command = c.command;
    if (mapped != undefined) {
        const {path, ...restOfCommand} = c.command;
        command = { path: mapped, ...restOfCommand };
    } 
    path = mapped || path;
    const interception = intercept ? intercept(model.getDocument(), command, context) : undefined;
    let isModified = mapped != undefined || interception != undefined;
    const resultWithCommand = applyCommandWithInterception(model, command, interception, c.createdId);
    const result: Result = resultWithCommand.result 
    if (resultWithCommand.modifiedCommand) {
        command = resultWithCommand.modifiedCommand;
    }
    if (result.isSuccess === true) {
      if (
        result.createdId != undefined &&
        c.createdId != undefined &&
        result.createdId !== c.createdId
      ) {
        isModified = true;
        pathMapper.put(path.concat(c.createdId), path.concat(result.createdId));
      }
      if (modifiedBatch != undefined || isModified) {
        modifiedBatch = modifiedBatch || completions.slice(0, idx);
        const appliedCompletion: CommandCompletion = {
          command,
          createdId: result.createdId
        };
        modifiedBatch.push(appliedCompletion);
      }
    } else {
      modifiedBatch = modifiedBatch || completions.slice(0, idx);
      if (errors == undefined) {
        errors = [];
      }
      errors.push({
        action: c.command.action,
        path,
        errorMessage: result.error
      });
    }
  });
  if (modifiedBatch) {
    return {
      applied: {
        from: startUpdate,
        completions: modifiedBatch
      },
      errors
    };
  } else {
    return undefined;
  }
}

export function applyCommandWithInterception<T extends object, P extends object>(model: Model<T>, 
    command: Command<P>, 
    interception?: CommandInterception,
    proposedCreateId?: string): {
        result: Result,
        modifiedCommand?: Command<P> // set if interception wasn't rejection
    } {
    if (interception == undefined) {
        return {
            result: model.apply(command, proposedCreateId)
        };
    } else if (command.action !== CommandAction.Delete &&
        (interception as {newProps: any}).newProps != undefined) {
        let c: Command<P>;
        if (command.action === CommandAction.Create) {
            c = {
                path: command.path,
                action: command.action,
                props: (interception as {newProps: P}).newProps
            }
        } else {
            c = {
                path: command.path,
                action: command.action,
                props: (interception as {newProps: Partial<P>}).newProps
            }
        }
        return {
            result: model.apply(c, proposedCreateId),
            modifiedCommand: c
        };
    } 
    return {
        result: {
            isSuccess: false,
            error: (interception as {rejection: string}).rejection
        }
    };
}