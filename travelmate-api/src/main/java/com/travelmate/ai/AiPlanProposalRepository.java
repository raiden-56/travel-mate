package com.travelmate.ai;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AiPlanProposalRepository extends JpaRepository<AiPlanProposal, UUID> {

    Optional<AiPlanProposal> findByIdAndUserId(UUID id, UUID userId);
}
