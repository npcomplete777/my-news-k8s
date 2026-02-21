package com.o11ynews.config;

import org.springframework.context.annotation.Configuration;

/**
 * Resilience4j configuration.
 *
 * Circuit breakers, retry policies, and rate limiters are configured entirely
 * via application.yml under the {@code resilience4j} key. Spring Boot's
 * auto-configuration picks up those properties and creates the corresponding
 * instances automatically.
 *
 * Per-source instances are defined for: reddit, hackernews, devto, github,
 * lobsters, and rss. Each source has its own circuit breaker, retry, and
 * rate limiter instance so that failures in one source do not cascade to others.
 *
 * This class exists as a placeholder for any future programmatic resilience
 * configuration that cannot be expressed in YAML.
 */
@Configuration
public class ResilienceConfig {
    // All Resilience4j instances are auto-configured from application.yml.
    // See the resilience4j.circuitbreaker, resilience4j.retry, and
    // resilience4j.ratelimiter sections in application.yml for details.
}
