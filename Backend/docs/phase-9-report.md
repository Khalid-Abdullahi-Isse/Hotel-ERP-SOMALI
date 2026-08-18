# Phase 9 completion report: measured optimization

## Simple summary

The API and PostgreSQL were profiled before adding optimization infrastructure. The
measured system is already comfortably inside the initial latency targets, so Phase 9
does not add Redis, caching, BullMQ, background workers, or speculative indexes.

This keeps deployment inexpensive and avoids cache invalidation and queue operations
that a small or medium hotel does not currently need.

## Load profile

The production container was tested with 100 rooms, 600 authenticated requests, and
10 concurrent workers. Traffic was split equally across session authorization, room
inventory, and the management dashboard.

| Measurement         | Result       |
| ------------------- | ------------ |
| Successful requests | 600 / 600    |
| Throughput          | 183.06 req/s |
| Overall p50         | 51.35 ms     |
| Overall p95         | 83.64 ms     |
| Overall p99         | 141.17 ms    |
| Room inventory p95  | 100.74 ms    |
| Dashboard p95       | 79.73 ms     |

The documented targets are 300 ms p95 for normal reads and 700 ms p95 for dashboard
and availability reads. This local result is a baseline, not a cloud-production
guarantee; repeat it on the selected production host with realistic network latency.

## PostgreSQL evidence

`EXPLAIN (ANALYZE, BUFFERS)` showed the room list using the existing unique
`(hotelId, roomNumber)` index, with a 0.199 ms execution time for the 100-room hotel.
The existing reporting indexes were retained. No additional index had measured
benefit large enough to justify its write and storage cost.

## Delivered tooling

`npm run load:smoke` runs the dependency-free load harness. Configuration is provided
through `LOAD_IDENTIFIER`, `LOAD_PASSWORD`, `LOAD_REQUESTS`, `LOAD_CONCURRENCY`, and
optional `LOAD_PATHS` environment variables. The normal 100-request/minute limit stays
enabled; only an isolated profiling environment should temporarily raise
`RATE_LIMIT_PER_MINUTE`.

## Future optimization trigger

Add caching or a queue only when production measurements repeatedly exceed the SLO,
database pool waits become material, or a new long-running export/integration cannot
fit the request lifecycle. Any future cache must preserve immediate user deactivation,
logout, financial correctness, and hotel isolation.
