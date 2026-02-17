package com.anonnews.filter;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Checks whether article text (title and/or content snippet) contains
 * cloud-native / CNCF ecosystem keywords, indicating relevance to the
 * target audience.
 */
@Component
public class KeywordRelevanceFilter {

    private static final List<String> KEYWORDS = List.of(
            "kubernetes", "k8s", "docker", "container", "helm", "istio", "envoy",
            "service mesh", "cncf", "cloud native", "cloudnative", "observability",
            "opentelemetry", "otel", "prometheus", "grafana", "cilium", "ebpf",
            "argo", "argocd", "flux", "gitops", "devops", "sre",
            "platform engineering", "crossplane", "linkerd", "kustomize",
            "operator", "crd", "kubectl", "pod", "deployment", "statefulset",
            "daemonset", "ingress", "gateway api", "cert-manager", "tekton",
            "knative", "serverless", "wasm", "kubevirt", "kata containers",
            "containerd", "cri-o"
    );

    /**
     * Pre-compiled pattern that matches any of the keywords as whole words
     * (case-insensitive). Word boundaries prevent false positives like
     * "deployed" matching "deploy".
     */
    private static final Pattern KEYWORD_PATTERN;

    static {
        String regex = KEYWORDS.stream()
                .map(Pattern::quote)
                .collect(Collectors.joining("|", "(?i)\\b(?:", ")\\b"));
        KEYWORD_PATTERN = Pattern.compile(regex);
    }

    /**
     * Returns {@code true} if either the title or the content snippet contains
     * at least one cloud-native keyword.
     *
     * @param title          the article title (may be null)
     * @param contentSnippet the article content snippet (may be null)
     * @return true if the article is relevant to the cloud-native ecosystem
     */
    public boolean isRelevant(String title, String contentSnippet) {
        if (title != null && KEYWORD_PATTERN.matcher(title).find()) {
            return true;
        }
        return contentSnippet != null && KEYWORD_PATTERN.matcher(contentSnippet).find();
    }
}
