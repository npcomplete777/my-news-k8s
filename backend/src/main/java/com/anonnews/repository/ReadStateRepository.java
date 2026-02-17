package com.anonnews.repository;

import com.anonnews.entity.ReadState;
import com.anonnews.entity.ReadStateId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReadStateRepository extends JpaRepository<ReadState, ReadStateId> {

    boolean existsByIdUserIdAndIdArticleId(Long userId, Long articleId);

    List<ReadState> findByIdUserIdAndIdArticleIdIn(Long userId, List<Long> articleIds);
}
