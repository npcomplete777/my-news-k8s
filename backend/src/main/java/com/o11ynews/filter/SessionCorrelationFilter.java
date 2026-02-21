package com.o11ynews.filter;

import io.opentelemetry.api.baggage.Baggage;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.context.Context;
import io.opentelemetry.context.Scope;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Reads the X-Session-Id header from incoming requests and:
 * 1. Stores it in a ThreadLocal so SessionCorrelationService can read it.
 * 2. Sets it as an OTel span attribute (app.session.id) on the current span.
 * 3. Propagates it as OTel Baggage so downstream spans inherit it automatically.
 *
 * Registered at filter order 0 (before ApiKeyAuthFilter) so every request gets correlated.
 */
@Component
public class SessionCorrelationFilter implements Filter {

    public static final String SESSION_ID_HEADER = "X-Session-Id";
    public static final String SESSION_ATTR_KEY = "app.session.id";

    private static final ThreadLocal<String> CURRENT_SESSION_ID = new ThreadLocal<>();

    @Override
    public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse, FilterChain chain)
            throws IOException, ServletException {

        var request = (HttpServletRequest) servletRequest;
        String sessionId = request.getHeader(SESSION_ID_HEADER);

        if (sessionId != null && !sessionId.isBlank()) {
            CURRENT_SESSION_ID.set(sessionId);

            // Annotate the current OTel span with the session ID
            Span.current().setAttribute(SESSION_ATTR_KEY, sessionId);

            // Propagate as OTel Baggage so child spans and outbound calls inherit it
            Baggage baggage = Baggage.current().toBuilder()
                    .put(SESSION_ATTR_KEY, sessionId)
                    .build();
            try (Scope ignored = Context.current().with(baggage).makeCurrent()) {
                chain.doFilter(request, servletResponse);
            }
        } else {
            CURRENT_SESSION_ID.remove();
            chain.doFilter(request, servletResponse);
        }
    }

    /**
     * Returns the session ID for the current request thread, or null if not set.
     */
    public static String getCurrentSessionId() {
        return CURRENT_SESSION_ID.get();
    }

    @Override
    public void destroy() {
        CURRENT_SESSION_ID.remove();
    }
}
