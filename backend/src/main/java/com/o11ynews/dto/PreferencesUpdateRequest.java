package com.o11ynews.dto;

import java.util.List;

public record PreferencesUpdateRequest(
    List<String> sources,
    List<String> keywords,
    List<String> excludedKeywords
) {}
