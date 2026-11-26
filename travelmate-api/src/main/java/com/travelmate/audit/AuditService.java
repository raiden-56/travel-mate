package com.travelmate.audit;

import com.travelmate.auth.AuthUser;
import com.travelmate.auth.CurrentUser;
import com.travelmate.common.PageResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class AuditService {

    public record AuditLogDto(UUID id, String actorEmail, String action, String targetType, String targetId,
                              String details, Instant createdAt) {}

    private final AuditLogRepository repo;

    public AuditService(AuditLogRepository repo) {
        this.repo = repo;
    }

    /** Records an action by the current user (if any). Runs in its own transaction so it survives rollbacks. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String action, String targetType, Object targetId, String details) {
        AuthUser actor = CurrentUser.optional().orElse(null);
        repo.save(new AuditLog(actor == null ? null : actor.id(), actor == null ? null : actor.email(),
                action, targetType, targetId == null ? null : targetId.toString(), details));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordAs(UUID actorId, String actorEmail, String action, String targetType, Object targetId, String details) {
        repo.save(new AuditLog(actorId, actorEmail, action, targetType, targetId == null ? null : targetId.toString(), details));
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditLogDto> list(int page, int size) {
        var result = repo.findAll(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResponse.of(result, a -> new AuditLogDto(a.getId(), a.getActorEmail(), a.getAction(),
                a.getTargetType(), a.getTargetId(), a.getDetails(), a.getCreatedAt()));
    }
}
