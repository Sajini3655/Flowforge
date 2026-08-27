package com.flowforge.api;

import com.flowforge.user.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ApiDefinitionRepository extends JpaRepository<ApiDefinition, Long> {

	List<ApiDefinition> findAllByOwner(User owner);

	Optional<ApiDefinition> findByIdAndOwner(Long id, User owner);
}
