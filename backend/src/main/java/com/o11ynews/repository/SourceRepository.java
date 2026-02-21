package com.o11ynews.repository;

import com.o11ynews.entity.Source;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SourceRepository extends JpaRepository<Source, Long> {

    Optional<Source> findBySlug(String slug);

    List<Source> findByEnabledTrue();
}
