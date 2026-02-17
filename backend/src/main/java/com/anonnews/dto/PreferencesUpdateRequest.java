package com.anonnews.dto;

import java.util.List;

public record PreferencesUpdateRequest(
    List<String> sources,
    List<String> keywords,
    List<String> excludedKeywords
) {}
