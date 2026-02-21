package com.o11ynews.telemetry;

import java.util.List;

/**
 * Service topology derived from recent span data, returned by GET /api/telemetry/service-map.
 * Nodes represent services; edges represent observed call relationships.
 */
public record ServiceMapDTO(
        List<ServiceNode> nodes,
        List<ServiceEdge> edges
) {

    public record ServiceNode(
            String id,
            String displayName,
            String type   // "backend", "database", "external"
    ) {}

    public record ServiceEdge(
            String source,
            String target,
            double requestsPerMinute,
            double errorRate
    ) {}
}
