package com.o11ynews.repository;

import com.o11ynews.entity.DeadLetter;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface DeadLetterRepository extends JpaRepository<DeadLetter, Long> {

    Page<DeadLetter> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);

    List<DeadLetter> findByStatusAndNextRetryAtBefore(String status, Instant now);
}
