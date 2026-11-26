package com.travelmate.auth;

import java.time.Duration;

/**
 * Port for request rate limiting. Phase 1 ships an in-memory implementation (single instance);
 * Phase 2 swaps in a Redis-backed implementation for multi-instance deployments.
 */
public interface RateLimiter {

    /** @return true if the call is allowed and counted, false if the limit is exceeded. */
    boolean tryAcquire(String key, int limit, Duration window);
}
