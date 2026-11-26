package com.travelmate.auth;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Sliding-window limiter held in memory. Suitable for a single API instance. */
@Component
public class InMemoryRateLimiter implements RateLimiter {

    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    @Override
    public boolean tryAcquire(String key, int limit, Duration window) {
        long now = System.currentTimeMillis();
        long cutoff = now - window.toMillis();
        Deque<Long> deque = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (deque) {
            while (!deque.isEmpty() && deque.peekFirst() < cutoff) deque.pollFirst();
            if (deque.size() >= limit) return false;
            deque.addLast(now);
            return true;
        }
    }

    @Scheduled(fixedDelay = 600_000)
    void evictIdle() {
        long cutoff = System.currentTimeMillis() - Duration.ofHours(2).toMillis();
        hits.entrySet().removeIf(e -> {
            synchronized (e.getValue()) {
                Long last = e.getValue().peekLast();
                return last == null || last < cutoff;
            }
        });
    }
}
