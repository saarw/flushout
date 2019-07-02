# flushout
Flushout is an event-sourcing based alternative to REST/GraphQL for SPAs, PWAs and mobile applications where clients interact local proxy of a data model that can flush its changes to a remote master in the background.

## Background
Flushout was built for clients that can maintain a local copy of its data model state to support fast model interactions without load times, offline model updates, and to enable high-performance memory-cached or queue-based serverless backends.   
   
Flushout design properties
* Minimize network traffic by only initializing clients with current model state and sending updates
* Store update history separately from current model state to support limiting or customizing history 
* Be agnostic about network transport (flushes can be performed over regular fetch calls or websockets etc.)
* Make all commands that clients send to the server inspectable and interceptable to support validation
* Reduce performance load on the server in favour of performing more work on the client
