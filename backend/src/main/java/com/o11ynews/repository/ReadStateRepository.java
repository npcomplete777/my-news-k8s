package com.o11ynews.repository;

import com.o11ynews.entity.ReadState;
import com.o11ynews.entity.ReadStateId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReadStateRepository extends JpaRepository<ReadState, ReadStateId> {

    boolean existsByIdUserIdAndIdArticleId(Long userId, Long articleId);

    List<ReadState> findByIdUserIdAndIdArticleIdIn(Long userId, List<Long> articleIds);
}
