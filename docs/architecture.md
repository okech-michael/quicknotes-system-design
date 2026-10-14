# QuickNotes Service Architecture

## Requirements

### Functional requirements

- Users can register, authenticate, and access only their own notes.
- Authenticated users can create, read, update, and delete notes, and list them newest first with pagination.
- Users can tag notes and retrieve notes by tag.
- Clients receive clear validation, authentication, authorization, and not-found errors.

### Non-functional requirements

- Serve 1 million registered users with horizontally scalable application capacity.
- Keep note reads responsive and available while individual app instances fail.
- Preserve note data durably and maintain referential integrity.
- Protect credentials and note data in transit and at rest; enforce per-user authorization.
- Monitor request latency, errors, queue lag, database health, and cache performance.
- Recover from service or zone failures using health checks, replication, backups, and tested recovery procedures.

## Capacity estimate for 1 million users

### Assumptions

- 1,000,000 registered users; 10% (100,000) are daily active.
- Each daily active user reads 50 note-feed pages and creates one note per day.
- One paginated feed request counts as one read; note writes are creates, not edits.
- An average stored note row uses 1 KB including typical text and metadata; indexes, backups, replicas, and protocol overhead are excluded from this raw storage estimate.
- Average traffic is evenly spread across 86,400 seconds per day; peak reads are estimated at five times average. Writes are shown as the daily average because no write peak multiplier was supplied.
- Storage accumulates for 365 days without deleting notes.

| Measure | Calculation | Estimate |
| --- | --- | ---: |
| Daily active users | 1,000,000 × 10% | 100,000 |
| Reads per day | 100,000 × 50 feed pages | 5,000,000 |
| Average reads per second | 5,000,000 ÷ 86,400 | 57.9 (about 58) |
| Peak reads per second | 57.9 × 5 | 289.4 (about 289) |
| Writes per day | 100,000 × 1 note | 100,000 |
| Average writes per second | 100,000 ÷ 86,400 | 1.16 |
| Raw note storage per year | 100,000 × 365 × 1 KB | 36.5 GB |

These are starting estimates rather than a capacity guarantee. Production sizing should include burst patterns, larger note bodies, index/replica overhead, backups, growth, and load-test results.

## Architecture diagram

```text
                           +------------------------------+
                           | DNS                          |
                           | service name -> healthy edge |
                           +---------------+--------------+
                                           |
                                           v
+--------+     +-----+     +---------------+--------------+     +-------------------+
| Client |---->| CDN |---->| Load balancer               |---->| App server A      |
+---+----+     +--+--+     +---------------+--------------+     +---------+---------+
    |             ^                            |                          |
    |             | static assets               +---------------------> +--v----------------+
    |             |                                                   | App server B      |
    |             |                                                   +--+---------+------+
    |             |                                                      |         |
    |             |                                            cache read/write   | enqueue
    |             |                                                      v         v
    |             |                                                 +----+---+  +--+--------+
    |             |                                                 | Cache  |  | Queue     |
    |             |                                                 +--------+  +--+--------+
    |             |                                                                  |
    |             |                                                                  v
    |             |                                                          +-------+--------+
    |             |                                                          | Background     |
    |             |                                                          | worker         |
    |             |                                                          +----------------+
    |             |
    |             |                      +-------------------+ replication +----------------+
    |             +--------------------->| Primary database  |------------>| Read replica  |
    |                                    +---------+---------+             +----------------+
    |                                              ^
    +----------------------------------------------+
                     API request via load balancer
```

## Component responsibilities

- **Client:** Sends authenticated API requests and renders the returned notes.
- **DNS:** Maps the service hostname to the edge/load-balancing entry point so the endpoint can move independently of its IP address.
- **CDN:** Caches and serves static client assets near users, reducing latency and origin traffic.
- **Load balancer:** Health-checks app instances and distributes API requests across them.
- **App servers (A and B):** Run stateless API logic, validate input, enforce authorization, and can scale horizontally behind the balancer.
- **Cache:** Stores hot feed pages or note metadata to reduce repeated database reads and improve read latency.
- **Primary database:** Durably stores users, notes, tags, and relationships and handles writes and transactions.
- **Read replica:** Serves eligible read queries to offload the primary, accepting that replication can introduce brief read-after-write lag.
- **Queue:** Buffers non-critical asynchronous work so transient worker slowdowns do not block note creation.
- **Background worker:** Processes queued side effects such as notification delivery or search-index updates with retries.

## GET /notes flow

1. The client resolves the API hostname through DNS, then sends its authenticated `GET /notes` request through the CDN/edge and load balancer; dynamic authenticated responses are not shared-cacheable by the CDN.
2. The load balancer routes the request to a healthy app server, which validates the access token, user identity, pagination parameters, and authorization scope.
3. The app server checks the cache for the current user's feed page; cache keys include the user and pagination cursor to prevent cross-user data leakage.
4. On a cache miss, the app server queries the read replica for that user's notes in descending creation order; if replica lag would violate a read-after-write requirement, it reads from the primary.
5. The app server serializes the page and next cursor, stores an appropriate short-lived result in cache, and returns the response to the client.

## POST /notes flow

1. The client sends `POST /notes` with a title and optional body over TLS through DNS, the edge, and the load balancer.
2. A healthy app server validates the token and verifies that the title is present and within the length limit; invalid data returns `400`, and unauthenticated requests return `401`.
3. The app server writes the note under the authenticated user's ID in a transaction on the primary database and returns the created note with `201 Created`.
4. The app server invalidates or updates affected feed-cache entries so subsequent reads do not keep showing stale results.
5. The app server publishes any non-critical follow-up work to the queue, such as a search-index update; the worker processes it independently and retries transient failures.

## Trade-offs and availability

- **Cache speed versus consistency:** A cache reduces replica load and feed latency, but invalidation is complex and cached pages can briefly be stale. Use short TTLs plus targeted invalidation, and route read-after-write requests to the primary when necessary.
- **Read replicas versus freshness:** Replicas scale read volume without making the primary serve every feed request, but asynchronous replication creates lag. Monitor lag and fall back to the primary for sensitive reads; keep the primary authoritative.
- **Asynchronous queue versus immediate side effects:** A queue keeps note creation fast and absorbs bursts, but queued work may be delayed or retried. Use durable messages, idempotent workers, bounded retries, a dead-letter queue, and queue-lag alerts.
- **Stateless app servers versus operational simplicity:** Multiple app instances behind a balancer avoid tying availability to one process, but require shared state to live in the database/cache and require deployments and configuration to remain consistent.

There should be no single application-server or availability-zone failure point: run at least two app servers across separate zones, health-check them through a redundant load-balancing service, and use redundant DNS/CDN infrastructure. The primary database is a write-path dependency, so deploy it with managed failover to a synchronized standby and regularly test backups and restoration; the read replica is not a substitute for a recoverable primary. Run redundant queue brokers and workers across zones, and replicate durable queue data. Cache loss should degrade performance rather than lose notes, because the database remains authoritative and the cache can be repopulated.
