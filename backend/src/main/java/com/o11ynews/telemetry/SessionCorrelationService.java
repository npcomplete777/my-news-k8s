package com.o11ynews.telemetry;

import com.o11ynews.filter.SessionCorrelationFilter;
import org.springframework.stereotype.Service;

/**
 * Provides access to the current browser session ID for telemetry correlation (FR-T2).
 *
 * The session ID is captured by {@link SessionCorrelationFilter} from the X-Session-Id
 * request header and stored in a ThreadLocal for the duration of the request.
 *
 * When a traceId in the Dash0 query results has {@code app.session.id} matching the
 * current session ID, TelemetryService marks that trace as {@code isCurrentSession=true}.
 */
@Service
public class SessionCorrelationService {

    /**
     * Returns the session ID for the current request thread, or null if not present.
     */
    public String getCurrentSessionId() {
        return SessionCorrelationFilter.getCurrentSessionId();
    }

    /**
     * Returns true if the given span attribute map contains an app.session.id that
     * matches the current request's session ID.
     */
    public boolean isCurrentSession(String sessionId, Object spanSessionAttrValue) {
        if (sessionId == null || spanSessionAttrValue == null) {
            return false;
        }
        return sessionId.equals(spanSessionAttrValue.toString());
    }
}
