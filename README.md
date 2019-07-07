# flushout
Flushout is a distributed data model based on event-sourcing to support single-page applications and mobile clients that need to interact with data models without network delay and support offline processing. Clients interact with a local proxy of a remote master model and flush changes to the master in the background for reconciliation with changes from other clients. 

# Installation
```
npm install --save flushout
```

# Example usage
A client initializes a proxy with the latest snapshot of a Todo-list model from the backend and applies commands to create and update a Todo-item. The client flushes its changes to the master and ends the flush with the master's synchronization response that brings the proxy model up to the state of the master, including changes flushed by other clients.
```
const proxy = new Proxy(latestSnapshot);
const result = proxy.apply({ 
    action: CommandAction.Create,
    path: ['todos'],
    props: {
    title: 'shopping',
    details: 'coffee'
    }
});
proxy.apply({
    action: CommandAction.Update,
    path: ['todos', result.createdId],
    props: {
    details: 'coffee and cookies'
    }
});
const flush = proxy.beginFlush();
... // Send the flush to the backend to apply it to the master, use its response to end the flush
proxy.endFlush(flushResponse.sync);
// The current document is always available to the app using
const currentTodoList = proxy.getDocument();
```
The backend initializes a master with latest snapshot from the database and an optional command history provider. The application then applies flushed command batches from clients, adding the commands that were applied to the command history and returning any sync information to the proxy that sent the flush.
```
const latest: Snapshot<TodoList> = {
      commandCount: 0,
      document: {
        title: '',
        todos: {}
      }
    };
const master = new Master(latest, { historyProvider: historyStore.createProvider() });
...
const flushResponse = await master.apply(flush);
historyStore.store(flushResponse.applied.from, flushResponse.applied.completions);
```
For complete examples, check out the integration tests https://github.com/saarw/flushout/blob/master/src/index.test.ts

# How it works
Flushout is written in TypeScript and has no other dependencies.   

Design properties
* Minimizes network traffic by only initializing clients with the latest model snapshot and then only send updates
* Storing update history is optional and command history is kept separate from the model state
* Flexible about deployment and agnostic about network transport to fit many sorts of backends and protocols
* Defines communication between client and server as data-only interfaces to support inspection and validation
* Optimizes for reducing network traffic and load on the server in favor of performing more work on the client

## Document and snapshot
A document in Flushout is a simple JavaScript object that may contain primitive fields or additional object fields to form a tree graph. Applications modify the model by applying commands. A **snapshot** is simply a document and a count of how many commands have been applied to the document.

## Client proxies
Clients initialize a Proxy model with the latest snapshot from the backend. Clients then apply commands to modify the model and perform flush operations to synchronize their state with the remote master.

## Remote master
The server initialize a Master model with the latest snapshot and an optional history provider. When a command batch from a client proxies is applied, the master returns optional synchronization information to let the proxy update its state to that of the master if other client proxies had modified the model since the last flush. If the master has a history provider, such synchronization responses can consist of command batches, otherwise they consist of the latest model snapshot.

### Commands   
All commands include an action and allow specifying a path to where in the document graph the command should operate (omitting the path uses the root of the document).   
**Create** - Creates a new object field inside an object in the document graph, optionally initializing the object with the values in the command's props object. The field will receive a random ID and the ID is returned to the application.   **Update** - Updates an object field in the document graph by setting the values specified in the command's props object.   **Delete** - Deletes the object in the document graph.   

### History provider
The master can be initialized with an optional history provider function. This lets master produce partial flush synchronization responses with a batches of commands that bring each proxy up to latest state when multiple proxies flush to the master simultanteously. Without the history provider, or with insufficient history (the amount of history to store is optional), flush synchronizations will include the full model snapshot.

### Interceptor
Both client and master can be initialized with interceptor functions that can validate and modify command properties before they are applied to the model. This provides for security and can help resolve certain conflicts, as interceptors at the master can modify command properties based on the final state of the model.

### Storing history, replays, and implementing undo
When flushes are applied to the master, the master's response contains an **applied** field that returns the batch of **command completions** that were successfully applied to the master, along with the master model's command count at the start of the batch. This information can be stored as history and each document can rebuilt from an earlier version by re-applying all command completions that occurred after the older snapshot's command count. Applications can implement undo by storing older snapshots of the master model and apply all commands to just before the operation that should be undone (it may be necessary to implement and pass in a context to the apply-operation that tells the interceptor to disable itself for replays). 

### Collisions
* Updates to the same node will simply overwrite each other, but applications that preserve command history may be able to implement more advanced merge operations.
* Updates on deleted nodes will fail silently.
* If two proxies perform create commands that create a node with the same ID before flushing to the master, the flush will remap any queued up commands in the second proxy to the new node's ID and notify the application that IDs may have changed.

### Usage notes and error handling
To not waste performance in Node's single-threaded event loop, Flushout avoids functional-style protective object copying so you should be careful not to manually modify objects once they have been passed in to Flushout, or to modify objects received from the proxy's and master's getDocument/getSnapshot methods.   

Clients can recover from errors to send flushes by cancelling their flush and trying again, but this may result in duplicate updates to the Master if the error happened when a successful flush had already been applied but there was a problem sending the response. Applications can add code to track each client's latest command count in the backend for deduplication. Otherwise, fatal errors in the client can be recovered by recreating the proxy with the latest snapshot from the server.

## Background
Flushout was built for https://plotdash.com to offer a Google Docs-like experience where data model is always immediately responsive to the user while remote synchronization happens in the background. Flushout was developed to fit systems that use TypeScript as a full-stack language, exploiting the ease of sharing code between clients and server while recognizing the importance of server-side performance due to Node's single-threaded event loop. 
