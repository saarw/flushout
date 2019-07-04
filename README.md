# flushout
Flushout is an event-sourcing based data model where clients interact with a local proxy of a remote master
model and flush changes to the master in the background. Flushout is written in TypeScript to support single-page applications, progressive web applications, and mobile clients that need to interact with data models without network delay and to support periods of offline data model manipulation. 

Flushout design properties
* Minimizes network traffic by only initializing clients with the latest model snapshot and then only sends updates
* Makes storing update history optional and history is stored separately from the latest model state
* Is flexible about deployment and agnostic about network transport to fit many sorts of backends and protocols
* Defines communication between client and server as simple interfaces to support inspection and validation
* Optimizes for reducing network traffic and load on the server in favor of performing more work on the client

## How it works
### Clients
Clients initialize a Proxy model with the latest snapshot from the backend. They then apply commands to modify the model any may periodically perform flushes to synchronize their state with the remote master.

#### Commands

### Server
The server initialize a Master model with the latest snapshot and apply flushes it receives from the clients to update the model and produce sync messages that let the proxies update their state to that of the master.

## Collisions


## Background
Flushout was built to support https://plotdash.com to offer a Google Docs-like experience where data model is always immediately responsive to the user while backend communication happens in the background. Flushout was also inspired by TypeScript's rise as a full-stack language and the powerful benefit it provides to share code between server and many sorts of clients.

## Differences to Automerge
Another attractive alternative for this kind of application is the CRDT-based library Automerge. Automerge has more features, but Flushout may be more practical. Automerge embeds the full update history in every document which may cause slower initial load times for clients, higher memory usage, and more serialization work and traffic to the database whenever the document gets saved. Flushout only needs to maintain the latest model state while preserving update history is optional and flexible. Flushout's use of transparent messages defined as interfaces should make it easy to support validation, security, and model-based limits.
