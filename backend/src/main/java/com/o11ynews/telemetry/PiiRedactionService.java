package com.o11ynews.telemetry;

import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Strips PII from OTel attribute maps before they are serialized to the frontend (SG-S1).
 *
 * Two-pass approach:
 * 1. Remove any attribute key in the configured strip-attributes list (exact match).
 * 2. Remove any attribute key that matches PII-likely patterns (http.request.header.*,
 *    *.ip, *.user_agent) not caught by the allowlist.
 */
@Service
public class PiiRedactionService {

    // Patterns for attribute keys that should never reach the browser
    private static final Pattern HEADER_PATTERN =
            Pattern.compile("^http\\.request\\.header\\..+$", Pattern.CASE_INSENSITIVE);
    private static final Pattern IP_SUFFIX_PATTERN =
            Pattern.compile("^.+\\.ip$", Pattern.CASE_INSENSITIVE);
    private static final Pattern USER_AGENT_PATTERN =
            Pattern.compile("^.+\\.user.?agent$", Pattern.CASE_INSENSITIVE);

    private final Set<String> stripAttributes;
    private final boolean enabled;

    public PiiRedactionService(Dash0Properties properties) {
        this.enabled = properties.getTelemetry().getPiiRedaction().isEnabled();
        this.stripAttributes = Set.copyOf(properties.getTelemetry().getPiiRedaction().getStripAttributes());
    }

    /**
     * Returns a new map with PII attributes removed.
     * The input map is not mutated.
     */
    public Map<String, Object> redact(Map<String, Object> attributes) {
        if (!enabled || attributes == null || attributes.isEmpty()) {
            return attributes;
        }

        Map<String, Object> result = new HashMap<>(attributes.size());
        for (var entry : attributes.entrySet()) {
            String key = entry.getKey();
            if (!shouldStrip(key)) {
                result.put(key, entry.getValue());
            }
        }
        return result;
    }

    private boolean shouldStrip(String key) {
        if (stripAttributes.contains(key)) {
            return true;
        }
        return HEADER_PATTERN.matcher(key).matches()
                || IP_SUFFIX_PATTERN.matcher(key).matches()
                || USER_AGENT_PATTERN.matcher(key).matches();
    }
}
