package com.anonnews.service;

import com.anonnews.entity.DeadLetter;
import com.anonnews.entity.Source;
import com.anonnews.repository.DeadLetterRepository;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class DeadLetterService {

    private static final Logger log = LoggerFactory.getLogger(DeadLetterService.class);

    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_RETRYING = "RETRYING";
    private static final String STATUS_FAILED = "FAILED";
    private static final String STATUS_EXHAUSTED = "EXHAUSTED";

    private final DeadLetterRepository deadLetterRepository;

    @Value("${dead-letter.retry.max-retries:5}")
    private int maxRetries;

    @Value("${dead-letter.retry.backoff-multiplier:2.0}")
    private double backoffMultiplier;

    @Value("${dead-letter.retry.initial-delay-seconds:60}")
    private long initialDelaySeconds;

    public DeadLetterService(DeadLetterRepository deadLetterRepository) {
        this.deadLetterRepository = deadLetterRepository;
    }

    @WithSpan("deadletter.record")
    @Transactional
    public void recordFailure(Source source, String errorMessage, String payload) {
        var deadLetter = new DeadLetter();
        deadLetter.setSource(source);
        deadLetter.setErrorMessage(errorMessage);
        deadLetter.setPayload(payload);
        deadLetter.setStatus(STATUS_PENDING);
        deadLetter.setRetryCount(0);
        deadLetter.setNextRetryAt(Instant.now().plus(initialDelaySeconds, ChronoUnit.SECONDS));

        deadLetterRepository.save(deadLetter);
        log.info("Recorded dead letter for source '{}': {}", source.getSlug(), errorMessage);
    }

    @Transactional(readOnly = true)
    public Page<DeadLetter> getDeadLetters(String status, Pageable pageable) {
        if (status != null && !status.isBlank()) {
            return deadLetterRepository.findByStatusOrderByCreatedAtDesc(status, pageable);
        }
        return deadLetterRepository.findAll(pageable);
    }

    @WithSpan("deadletter.retry")
    @Transactional
    public void retryDeadLetter(Long id) {
        DeadLetter deadLetter = deadLetterRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Dead letter not found: " + id));

        deadLetter.setStatus(STATUS_RETRYING);
        deadLetter.setNextRetryAt(Instant.now());
        deadLetterRepository.save(deadLetter);
        log.info("Queued dead letter {} for retry", id);
    }

    /**
     * Scheduled job that picks up dead letters due for retry and processes them.
     * Uses exponential backoff: delay = initialDelay * (backoffMultiplier ^ retryCount).
     */
    @WithSpan("deadletter.process")
    @Scheduled(cron = "${dead-letter.retry.cron:0 */30 * * * *}")
    @Transactional
    public void processRetryableDeadLetters() {
        Instant now = Instant.now();

        List<DeadLetter> pendingRetries = deadLetterRepository
                .findByStatusAndNextRetryAtBefore(STATUS_PENDING, now);
        List<DeadLetter> retrying = deadLetterRepository
                .findByStatusAndNextRetryAtBefore(STATUS_RETRYING, now);

        var allRetryable = new java.util.ArrayList<>(pendingRetries);
        allRetryable.addAll(retrying);

        if (allRetryable.isEmpty()) {
            return;
        }

        log.info("Processing {} retryable dead letters", allRetryable.size());

        for (DeadLetter deadLetter : allRetryable) {
            if (deadLetter.getRetryCount() >= maxRetries) {
                deadLetter.setStatus(STATUS_EXHAUSTED);
                deadLetterRepository.save(deadLetter);
                log.warn("Dead letter {} exhausted all {} retries for source '{}'",
                        deadLetter.getId(), maxRetries, deadLetter.getSource().getSlug());
                continue;
            }

            // Increment retry count and compute next retry time with exponential backoff
            int newRetryCount = deadLetter.getRetryCount() + 1;
            long delaySeconds = (long) (initialDelaySeconds * Math.pow(backoffMultiplier, newRetryCount));

            deadLetter.setRetryCount(newRetryCount);
            deadLetter.setStatus(STATUS_RETRYING);
            deadLetter.setNextRetryAt(now.plus(delaySeconds, ChronoUnit.SECONDS));
            deadLetterRepository.save(deadLetter);

            log.info("Dead letter {} retry {}/{} scheduled in {}s for source '{}'",
                    deadLetter.getId(), newRetryCount, maxRetries,
                    delaySeconds, deadLetter.getSource().getSlug());
        }
    }
}
