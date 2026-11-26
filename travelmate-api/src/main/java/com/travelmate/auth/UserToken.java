package com.travelmate.auth;

import com.travelmate.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** One-time token for password reset or email verification. Only the hash is stored. */
@Entity
@Table(name = "user_tokens")
public class UserToken extends BaseEntity {

    public static final String PASSWORD_RESET = "PASSWORD_RESET";
    public static final String EMAIL_VERIFY = "EMAIL_VERIFY";

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 20)
    private String purpose;

    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    protected UserToken() {}

    public UserToken(UUID userId, String purpose, String tokenHash, Instant expiresAt) {
        this.userId = userId;
        this.purpose = purpose;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
    }

    public boolean isUsable(String expectedPurpose, Instant now) {
        return purpose.equals(expectedPurpose) && usedAt == null && expiresAt.isAfter(now);
    }

    public UUID getUserId() { return userId; }
    public void markUsed(Instant at) { this.usedAt = at; }
}
