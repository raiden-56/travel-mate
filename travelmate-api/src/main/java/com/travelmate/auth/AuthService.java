package com.travelmate.auth;

import com.travelmate.audit.AuditService;
import com.travelmate.auth.AuthDtos.AuthResponse;
import com.travelmate.auth.AuthDtos.AuthResult;
import com.travelmate.common.ApiException;
import com.travelmate.config.AppProperties;
import com.travelmate.users.PermissionService;
import com.travelmate.users.User;
import com.travelmate.users.UserDto;
import com.travelmate.users.UserProfile;
import com.travelmate.users.UserProfileRepository;
import com.travelmate.users.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class AuthService {

    private static final Duration RESET_TTL = Duration.ofHours(1);
    private static final Duration VERIFY_TTL = Duration.ofDays(3);

    private final UserRepository users;
    private final UserProfileRepository profiles;
    private final RefreshTokenRepository refreshTokens;
    private final UserTokenRepository userTokens;
    private final PermissionService permissionService;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailSender emailSender;
    private final AuditService audit;
    private final AppProperties props;

    public AuthService(UserRepository users, UserProfileRepository profiles, RefreshTokenRepository refreshTokens,
                       UserTokenRepository userTokens, PermissionService permissionService,
                       PasswordEncoder passwordEncoder, JwtService jwtService, EmailSender emailSender,
                       AuditService audit, AppProperties props) {
        this.users = users;
        this.profiles = profiles;
        this.refreshTokens = refreshTokens;
        this.userTokens = userTokens;
        this.permissionService = permissionService;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.emailSender = emailSender;
        this.audit = audit;
        this.props = props;
    }

    static String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    @Transactional
    public AuthResult register(AuthDtos.RegisterRequest req, String userAgent) {
        String email = normalizeEmail(req.email());
        if (users.existsByEmailIgnoreCase(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "An account with this email already exists.");
        }
        User user = new User();
        user.setEmail(email);
        user.setDisplayName(req.displayName().trim());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.getRoles().add("TRAVELER");
        users.save(user);
        profiles.save(new UserProfile(user.getId()));
        sendVerification(user);
        audit.recordAs(user.getId(), email, "auth.register", "USER", user.getId(), null);
        return issue(user, UUID.randomUUID(), userAgent);
    }

    @Transactional
    public AuthResult login(AuthDtos.LoginRequest req, String userAgent) {
        String email = normalizeEmail(req.email());
        User user = users.findByEmailIgnoreCase(email).orElse(null);
        if (user == null || !passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            audit.recordAs(user == null ? null : user.getId(), email, "auth.login_failed", "USER",
                    user == null ? null : user.getId(), null);
            throw ApiException.unauthorized("INVALID_CREDENTIALS", "Email or password is incorrect.");
        }
        if (!user.isActive()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_SUSPENDED",
                    "This account is suspended. Contact support for help.");
        }
        user.setLastLoginAt(Instant.now());
        audit.recordAs(user.getId(), user.getEmail(), "auth.login", "USER", user.getId(), null);
        return issue(user, UUID.randomUUID(), userAgent);
    }

    /**
     * Rotates a refresh token. Presenting an already-used token is treated as theft: the whole
     * token family is revoked and the caller must sign in again.
     */
    @Transactional(noRollbackFor = ApiException.class)
    public AuthResult refresh(String rawToken, String userAgent) {
        if (rawToken == null || rawToken.isBlank()) {
            throw ApiException.unauthorized("UNAUTHORIZED", "Session expired. Please sign in again.");
        }
        Instant now = Instant.now();
        RefreshToken token = refreshTokens.findByTokenHash(Tokens.sha256(rawToken))
                .orElseThrow(() -> ApiException.unauthorized("UNAUTHORIZED", "Session expired. Please sign in again."));
        if (token.getRevokedAt() != null) {
            refreshTokens.revokeFamily(token.getFamilyId(), now);
            audit.recordAs(token.getUserId(), null, "auth.refresh_reuse_detected", "USER", token.getUserId(), null);
            throw ApiException.unauthorized("UNAUTHORIZED", "Session expired. Please sign in again.");
        }
        if (!token.isUsable(now)) {
            throw ApiException.unauthorized("UNAUTHORIZED", "Session expired. Please sign in again.");
        }
        User user = users.findById(token.getUserId())
                .orElseThrow(() -> ApiException.unauthorized("UNAUTHORIZED", "Session expired. Please sign in again."));
        if (!user.isActive()) {
            refreshTokens.revokeFamily(token.getFamilyId(), now);
            throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_SUSPENDED", "This account is suspended.");
        }
        AuthResult result = issue(user, token.getFamilyId(), userAgent);
        RefreshToken replacement = refreshTokens.findByTokenHash(Tokens.sha256(result.refreshToken())).orElseThrow();
        token.revoke(now, replacement.getId());
        return result;
    }

    @Transactional
    public void logout(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return;
        refreshTokens.findByTokenHash(Tokens.sha256(rawToken))
                .ifPresent(t -> refreshTokens.revokeFamily(t.getFamilyId(), Instant.now()));
    }

    @Transactional(readOnly = true)
    public UserDto me(UUID userId) {
        User user = users.findById(userId).orElseThrow(() -> ApiException.notFound("User"));
        return UserDto.of(user, permissionService.permissionsFor(user.getRoles()));
    }

    @Transactional
    public void forgotPassword(String rawEmail) {
        users.findByEmailIgnoreCase(normalizeEmail(rawEmail)).filter(User::isActive).ifPresent(user -> {
            String raw = Tokens.newOpaqueToken();
            userTokens.save(new UserToken(user.getId(), UserToken.PASSWORD_RESET, Tokens.sha256(raw),
                    Instant.now().plus(RESET_TTL)));
            emailSender.send(user.getEmail(), "Reset your TravelMate password",
                    "Use this link within 1 hour to choose a new password:\n"
                            + props.frontendUrl() + "/reset-password?token=" + raw
                            + "\n\nIf you did not ask for this, you can ignore this email.");
        });
    }

    @Transactional
    public void resetPassword(AuthDtos.ResetPasswordRequest req) {
        Instant now = Instant.now();
        UserToken token = userTokens.findByTokenHash(Tokens.sha256(req.token()))
                .filter(t -> t.isUsable(UserToken.PASSWORD_RESET, now))
                .orElseThrow(() -> ApiException.badRequest("token", "This reset link is invalid or has expired."));
        User user = users.findById(token.getUserId()).orElseThrow(() -> ApiException.notFound("User"));
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        token.markUsed(now);
        refreshTokens.revokeAllForUser(user.getId(), now);
        audit.recordAs(user.getId(), user.getEmail(), "auth.password_reset", "USER", user.getId(), null);
    }

    @Transactional
    public void verifyEmail(String rawToken) {
        Instant now = Instant.now();
        UserToken token = userTokens.findByTokenHash(Tokens.sha256(rawToken))
                .filter(t -> t.isUsable(UserToken.EMAIL_VERIFY, now))
                .orElseThrow(() -> ApiException.badRequest("token", "This verification link is invalid or has expired."));
        User user = users.findById(token.getUserId()).orElseThrow(() -> ApiException.notFound("User"));
        user.setEmailVerified(true);
        token.markUsed(now);
    }

    private void sendVerification(User user) {
        String raw = Tokens.newOpaqueToken();
        userTokens.save(new UserToken(user.getId(), UserToken.EMAIL_VERIFY, Tokens.sha256(raw),
                Instant.now().plus(VERIFY_TTL)));
        emailSender.send(user.getEmail(), "Verify your TravelMate email",
                "Welcome to TravelMate. Confirm your email address:\n"
                        + props.frontendUrl() + "/verify-email?token=" + raw);
    }

    private AuthResult issue(User user, UUID familyId, String userAgent) {
        Set<String> permissions = permissionService.permissionsFor(user.getRoles());
        String access = jwtService.issueAccessToken(user.getId(), user.getEmail(), user.getRoles(), permissions);
        String rawRefresh = Tokens.newOpaqueToken();
        refreshTokens.save(new RefreshToken(user.getId(), familyId, Tokens.sha256(rawRefresh),
                Instant.now().plus(props.jwt().refreshTtl()), userAgent));
        AuthResponse body = new AuthResponse(access, jwtService.accessTtlSeconds(), UserDto.of(user, permissions));
        return new AuthResult(body, rawRefresh);
    }
}
