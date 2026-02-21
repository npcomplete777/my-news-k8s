package com.o11ynews.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "read_states")
public class ReadState {

    @EmbeddedId
    private ReadStateId id;

    @Column(name = "read_at", nullable = false)
    private Instant readAt;

    public ReadState() {
    }

    public ReadState(Long userId, Long articleId) {
        this.id = new ReadStateId(userId, articleId);
    }

    @PrePersist
    protected void onCreate() {
        if (this.readAt == null) {
            this.readAt = Instant.now();
        }
    }

    public ReadStateId getId() {
        return id;
    }

    public void setId(ReadStateId id) {
        this.id = id;
    }

    public Instant getReadAt() {
        return readAt;
    }

    public void setReadAt(Instant readAt) {
        this.readAt = readAt;
    }
}
