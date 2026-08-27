package com.flowforge.job;

import com.flowforge.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface JobRepository extends JpaRepository<Job, UUID> {

	List<Job> findAllBySubmittedBy(User submittedBy);

	Optional<Job> findByIdAndSubmittedBy(UUID id, User submittedBy);

	Optional<Job> findBySubmittedByAndIdempotencyKey(User submittedBy, String idempotencyKey);

	@Modifying
	@Transactional
	@Query("update Job j set j.status = :processing, j.attemptCount = j.attemptCount + 1 "
			+ "where j.id = :id and j.status = :queued")
	int claimForProcessing(@Param("id") UUID id,
							   @Param("queued") JobStatus queued,
							   @Param("processing") JobStatus processing);
}
