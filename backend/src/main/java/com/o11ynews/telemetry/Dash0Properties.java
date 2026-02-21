package com.o11ynews.telemetry;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Configuration properties for the Dash0 API client and telemetry endpoints.
 * Bound from the {@code dash0.*} namespace in application.yml.
 */
@Component
@ConfigurationProperties(prefix = "dash0")
public class Dash0Properties {

    private Api api = new Api();
    private Telemetry telemetry = new Telemetry();

    public Api getApi() { return api; }
    public void setApi(Api api) { this.api = api; }

    public Telemetry getTelemetry() { return telemetry; }
    public void setTelemetry(Telemetry telemetry) { this.telemetry = telemetry; }

    public static class Api {
        private String baseUrl = "https://api.eu-west-1.aws.dash0.com";
        private String authToken = "";
        private String dataset = "default";

        public String getBaseUrl() { return baseUrl; }
        public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }

        public String getAuthToken() { return authToken; }
        public void setAuthToken(String authToken) { this.authToken = authToken; }

        public String getDataset() { return dataset; }
        public void setDataset(String dataset) { this.dataset = dataset; }
    }

    public static class Telemetry {
        private int maxTraces = 50;
        private int maxLogs = 100;
        private int refreshIntervalSeconds = 3;
        private PiiRedaction piiRedaction = new PiiRedaction();

        public int getMaxTraces() { return maxTraces; }
        public void setMaxTraces(int maxTraces) { this.maxTraces = maxTraces; }

        public int getMaxLogs() { return maxLogs; }
        public void setMaxLogs(int maxLogs) { this.maxLogs = maxLogs; }

        public int getRefreshIntervalSeconds() { return refreshIntervalSeconds; }
        public void setRefreshIntervalSeconds(int refreshIntervalSeconds) {
            this.refreshIntervalSeconds = refreshIntervalSeconds;
        }

        public PiiRedaction getPiiRedaction() { return piiRedaction; }
        public void setPiiRedaction(PiiRedaction piiRedaction) { this.piiRedaction = piiRedaction; }
    }

    public static class PiiRedaction {
        private boolean enabled = true;
        private List<String> stripAttributes = List.of(
                "net.peer.ip",
                "http.client_ip",
                "http.user_agent",
                "http.request.header.cookie",
                "http.request.header.authorization",
                "user.id"
        );

        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }

        public List<String> getStripAttributes() { return stripAttributes; }
        public void setStripAttributes(List<String> stripAttributes) {
            this.stripAttributes = stripAttributes;
        }
    }
}
