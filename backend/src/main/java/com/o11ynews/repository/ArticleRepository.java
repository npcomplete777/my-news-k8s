package com.o11ynews.repository;

import com.o11ynews.entity.Article;
import com.o11ynews.entity.Source;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ArticleRepository extends JpaRepository<Article, Long> {

    Optional<Article> findByDedupHash(String dedupHash);

    boolean existsByDedupHash(String dedupHash);

    Optional<Article> findBySourceAndExternalId(Source source, String externalId);

    Page<Article> findBySourceSlugInOrderByPublishedAtDesc(List<String> slugs, Pageable pageable);

    @Query(value = "SELECT * FROM articles WHERE "
            + "to_tsvector('english', title) @@ plainto_tsquery('english', :query) "
            + "OR to_tsvector('english', coalesce(content_snippet, '')) @@ plainto_tsquery('english', :query) "
            + "ORDER BY published_at DESC",
            countQuery = "SELECT count(*) FROM articles WHERE "
                    + "to_tsvector('english', title) @@ plainto_tsquery('english', :query) "
                    + "OR to_tsvector('english', coalesce(content_snippet, '')) @@ plainto_tsquery('english', :query)",
            nativeQuery = true)
    Page<Article> search(@Param("query") String query, Pageable pageable);

    Page<Article> findAllByOrderByPublishedAtDesc(Pageable pageable);
}
