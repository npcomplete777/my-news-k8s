package com.o11ynews.service;

import com.o11ynews.dto.ArticleDTO;
import com.o11ynews.repository.ArticleRepository;
import io.opentelemetry.instrumentation.annotations.SpanAttribute;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SearchService {

    private final ArticleRepository articleRepository;
    private final ArticleService articleService;

    public SearchService(ArticleRepository articleRepository,
                         ArticleService articleService) {
        this.articleRepository = articleRepository;
        this.articleService = articleService;
    }

    @WithSpan("search.execute")
    @Transactional(readOnly = true)
    public Page<ArticleDTO> search(@SpanAttribute("search.query") String query,
                                    Long userId,
                                    Pageable pageable) {
        var articles = articleRepository.search(query, pageable);
        return articles.map(article -> articleService.toDTO(article, userId));
    }
}
