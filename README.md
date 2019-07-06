# flushout
Flushout is a distributed data model based on event-sourcing written in TypeScript to support single-page applications and mobile clients that need to interact with data models without network delay and support offline processing. Clients interact with a local proxy of a remote master model and can flush changes to the master model for reconciliation at their convenience. 

Flushout design properties
* Minimizes network traffic by only initializing clients with the latest model snapshot and then only send updates
* Makes storing update history optional and history is stored separately from the latest model state
* Is flexible about deployment and agnostic about network transport to fit many sorts of backends and protocols
* Defines communication between client and server as simple interfaces to support inspection and validation
* Optimizes for reducing network traffic and load on the server in favor of performing more work on the client

# Basic use
Clients initialize proxies with the latest snapshot from master and apply commands to the proxies to modify the data model. They occasionally flush changes to the master and receive synchronization responses to stay up to date with changes that other clients have made on the master.
```
const proxy = new Proxy(clientSnapshot);
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
... // Send the flush to the backend and apply it to the master
proxy.endFlush(flushResponse.sync);
```
Backends initialize the master with latest snapshot from the database and apply flushed command batches from the client proxies.
```
const latest: Snapshot<TodoList> = {
      commandCount: 0,
      document: {
        title: '',
        todos: {}
      }
    };
const master = new Master(latest);
...
const flushResponse = await master.apply(flush);
```

# How it works
## Document and snapshot
A document in Flushout is a simple JavaScript object that may contain primitive fields or additional object fields to form a tree graph. Applications modify the model by applying commands. A **snapshot** is simply a document and a count of how many commands have been applied to the document.

## Client proxies
Clients initialize a Proxy model with the latest snapshot from the backend. Clients then apply commands to modify the model and perform flush operations to synchronize their state with the remote master.

## Remote master
The server initialize a Master model with the latest snapshot and an optional history provider. When a command batch from a client proxies is applied, the master returns optional synchronization information to let the proxy update its state to that of the master if other client proxies had modified the model since the last flush. If the master has a history provider, such synchronization responses can consist of command batches, otherwise they consist of the latest model snapshot.

### Commands   
All commands include an action and allow specifying a path to where in the document graph the command should operate (omitting the path uses the root of the document).   
**Create** - Creates a new object field inside an object in the document graph, optionally initializing the object with the values in the command's props object. The field will receive a random ID and the ID is returned to the application.   

**Update** - Updates an object field in the document graph by setting the values specified in the command's props object.   
**Delete** - Deletes the object in the document graph.   

### Interceptor
Both client and master can be initialized with an Interceptor function that can validate and modify commands before they are applied to the model. This provides for security and can help resolve certain conflicts.

### History and undo
The update history of the master and the changes flushed by the proxies are represented by batches of **command completions**. Each batch has a number indicating the command count of the document it was applied to and each command completion includes a command that was successfully applied and optionally its resulting ID (if it created a new node). This means each document can rebuilt from an earlier version by re-applying all command completions that occurred after the document's command count. Applications can implement full or limited undo functionality by preserving the necessary earlier document snapshots and command completions.

### Collisions
* Updates to the same node will simply overwrite each other, but applications that preserve command history may be able to implement more advanced merge operations.
* Updates on deleted nodes will fail silently.
* If two proxies perform create commands that create a node with the same ID before flushing to the master, the flush will remap any queued up commands in the second proxy to the new node's ID and notify the application that IDs may have changed.

### Usage notes and error handling
To offer as good performance as possible for Node's single-threaded event loop Flushout tries to avoid excessive copying and serialization on the Master. This means you should be careful not to modify objects that have been passed in to Flushout.   

Clients can recover from Flush errors by cancelling their flush and trying again, but this may result in duplicate updates to the Master if the error happened when a successful flush response was being sent by the master. You can add code to track each client's latest command number for deduplication. Otherwise, fatal errors in the client can be recovered by discarding the proxy and reinitiating with the latest snapshot from the server.

## Background
Flushout was built to support https://plotdash.com to offer a Google Docs-like experience where data model is always immediately responsive to the user while remote synchronization happens in the background. Flushout was developed to fit systems that use TypeScript as a full-stack language, exploiting the ease of sharing code between clients and server while recognizing the importance of server-side performance due to Node's single-threaded event loop. 

## Differences to CRDT-based libraries
CRDT-based libraries, such as Automerge, is another attractive option for this kind of application, but Flushout may be more practical if the application does not need all their features.    

CRDTs tend to embed update history in the document which may cause slower initial load times for clients, higher memory usage, and more serialization work and traffic to the database. Flushout's simpler operations may make it easier to support validation, security, and model-based limitations on commands. Interceptors also make it possible to implement CRDT-like functionality on top of Flushout's primitives (one can even embed a CRDT-based documents as part of Flushout model).
