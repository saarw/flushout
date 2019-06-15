# flushout
Flushout is an event-sourcing based alternative to REST/GraphQL for single-page applications where clients interact with a local copy of a data model and changes propagate to the remote source model in the background.

## Background
Flushout was built for clients that can maintain a copy of its data model state to support low-latency local model interactions, offline capabilities of progressive web applications, and to be a good fit for queue-based serverless backends.   
   
Flushout design properties
* Minimize network traffic by only initializing clients with current model state and sending future updates
* Support limiting update history and store update history separately from current model state
* Be agnostic about network transport (flushes can be performed over regular fetch calls or websockets etc.)
* Make commands and model update inspectable and interceptable to support validation
* Reduce performance load on the server in favour of performing more work on the client
