package com.anonnews.controller;

import com.anonnews.dto.FeedSourceDTO;
import com.anonnews.entity.Source;
import com.anonnews.repository.SourceRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/feeds")
public class FeedController {

    private final SourceRepository sourceRepository;
    private final ObjectMapper objectMapper;

    public FeedController(SourceRepository sourceRepository, ObjectMapper objectMapper) {
        this.sourceRepository = sourceRepository;
        this.objectMapper = objectMapper;
    }

    @GetMapping
    public ResponseEntity<List<FeedSourceDTO>> listFeeds() {
        List<FeedSourceDTO> feeds = sourceRepository.findAll().stream()
                .map(this::toDTO)
                .toList();
        return ResponseEntity.ok(feeds);
    }

    @PatchMapping("/{id}")
    public ResponseEntity<FeedSourceDTO> updateFeed(
            @PathVariable Long id,
            @RequestBody Map<String, Object> updates) {

        Source source = sourceRepository.findById(id)
                .orElseThrow(() -> new SourceNotFoundException(id));

        if (updates.containsKey("enabled")) {
            source.setEnabled((Boolean) updates.get("enabled"));
        }
        if (updates.containsKey("pollInterval")) {
            source.setPollInterval((Integer) updates.get("pollInterval"));
        }

        Source saved = sourceRepository.save(source);
        return ResponseEntity.ok(toDTO(saved));
    }

    private FeedSourceDTO toDTO(Source source) {
        Map<String, Object> configMap = null;
        if (source.getConfigJson() != null) {
            try {
                configMap = objectMapper.readValue(source.getConfigJson(),
                        new TypeReference<Map<String, Object>>() {});
            } catch (Exception e) {
                configMap = Map.of();
            }
        }
        return new FeedSourceDTO(
                source.getId(),
                source.getName(),
                source.getSlug(),
                source.getPollInterval(),
                source.isEnabled(),
                configMap
        );
    }

    public static class SourceNotFoundException extends RuntimeException {
        public SourceNotFoundException(Long id) {
            super("Source not found with id: " + id);
        }
    }
}
