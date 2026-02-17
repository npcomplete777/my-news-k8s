package com.anonnews.service;

import com.anonnews.dto.PreferencesUpdateRequest;
import com.anonnews.dto.UserDTO;
import com.anonnews.entity.User;
import com.anonnews.repository.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public UserService(UserRepository userRepository, ObjectMapper objectMapper) {
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
    }

    @WithSpan("user.get")
    @Transactional(readOnly = true)
    public UserDTO getUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        return toDTO(user);
    }

    @WithSpan("user.updatePreferences")
    @Transactional
    public UserDTO updatePreferences(Long userId, PreferencesUpdateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        Map<String, Object> preferences = parsePreferences(user.getPreferences());

        if (request.sources() != null) {
            preferences.put("sources", request.sources());
        }
        if (request.keywords() != null) {
            preferences.put("keywords", request.keywords());
        }
        if (request.excludedKeywords() != null) {
            preferences.put("excludedKeywords", request.excludedKeywords());
        }

        user.setPreferences(serializePreferences(preferences));
        userRepository.save(user);

        return toDTO(user);
    }

    public UserDTO toDTO(User user) {
        return new UserDTO(
                user.getId(),
                user.getUsername(),
                parsePreferences(user.getPreferences()),
                user.getCreatedAt()
        );
    }

    private Map<String, Object> parsePreferences(String json) {
        if (json == null || json.isBlank()) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse user preferences JSON: {}", e.getMessage());
            return new HashMap<>();
        }
    }

    private String serializePreferences(Map<String, Object> preferences) {
        try {
            return objectMapper.writeValueAsString(preferences);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize user preferences: {}", e.getMessage());
            return "{}";
        }
    }
}
