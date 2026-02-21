package com.o11ynews.filter;

import com.o11ynews.entity.ApiKey;
import com.o11ynews.repository.ApiKeyRepository;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;

@Component
public class ApiKeyAuthFilter implements Filter {

    private static final Logger log = LoggerFactory.getLogger(ApiKeyAuthFilter.class);

    public static final String AUTHENTICATED_USER_ATTR = "authenticatedUser";
    private static final String API_KEY_HEADER = "X-API-Key";
    private static final List<String> PUBLIC_PATHS = List.of(
            "/api/health",
            "/actuator/**",
            "/api/telemetry/**",
            "/api/articles",
            "/api/articles/**",
            "/api/feeds",
            "/api/sources"
    );

    private final ApiKeyRepository apiKeyRepository;
    private final AntPathMatcher pathMatcher = new AntPathMatcher();

    public ApiKeyAuthFilter(ApiKeyRepository apiKeyRepository) {
        this.apiKeyRepository = apiKeyRepository;
    }

    @Override
    public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse, FilterChain chain)
            throws IOException, ServletException {

        var request = (HttpServletRequest) servletRequest;
        var response = (HttpServletResponse) servletResponse;
        String path = request.getRequestURI();

        // Skip authentication for public paths
        if (isPublicPath(path)) {
            chain.doFilter(request, response);
            return;
        }

        String apiKeyValue = request.getHeader(API_KEY_HEADER);
        if (apiKeyValue == null || apiKeyValue.isBlank()) {
            sendError(response, HttpServletResponse.SC_UNAUTHORIZED,
                    "Missing API key. Provide the X-API-Key header.");
            return;
        }

        String keyHash = sha256(apiKeyValue);

        var maybeApiKey = apiKeyRepository.findByKeyHashAndActiveTrue(keyHash);
        if (maybeApiKey.isEmpty()) {
            log.warn("Invalid API key attempt from {}", request.getRemoteAddr());
            sendError(response, HttpServletResponse.SC_UNAUTHORIZED,
                    "Invalid or inactive API key.");
            return;
        }

        ApiKey apiKey = maybeApiKey.get();
        apiKey.setLastUsedAt(Instant.now());
        apiKeyRepository.save(apiKey);

        request.setAttribute(AUTHENTICATED_USER_ATTR, apiKey.getUser());
        chain.doFilter(request, response);
    }

    private boolean isPublicPath(String path) {
        return PUBLIC_PATHS.stream().anyMatch(pattern -> pathMatcher.match(pattern, path));
    }

    private void sendError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        String body = """
                {"error": "%s", "status": %d}""".formatted(message, status);
        response.getWriter().write(body);
    }

    static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is guaranteed to be available in every JVM
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }
}
