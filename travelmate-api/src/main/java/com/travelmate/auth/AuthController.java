package com.travelmate.auth;

import com.travelmate.auth.AuthDtos.AuthResponse;
import com.travelmate.auth.AuthDtos.AuthResult;
import com.travelmate.common.ApiException;
import com.travelmate.config.AppProperties;
import com.travelmate.users.UserDto;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Auth")
public class AuthController {

    static final String COOKIE = "tm_refresh";
    private static final String COOKIE_PATH = "/api/v1/auth";
    private static final String CSRF_HEADER = "X-Requested-With";
    private static final String CSRF_VALUE = "travelmate";

    private final AuthService authService;
    private final RateLimiter rateLimiter;
    private final AppProperties props;

    public AuthController(AuthService authService, RateLimiter rateLimiter, AppProperties props) {
        this.authService = authService;
        this.rateLimiter = rateLimiter;
        this.props = props;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody AuthDtos.RegisterRequest req,
                                                 HttpServletRequest http, HttpServletResponse res) {
        limit("register", http);
        AuthResult result = authService.register(req, http.getHeader(HttpHeaders.USER_AGENT));
        setCookie(res, result.refreshToken());
        return ResponseEntity.status(HttpStatus.CREATED).body(result.response());
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody AuthDtos.LoginRequest req, HttpServletRequest http,
                              HttpServletResponse res) {
        limit("login", http);
        AuthResult result = authService.login(req, http.getHeader(HttpHeaders.USER_AGENT));
        setCookie(res, result.refreshToken());
        return result.response();
    }

    @PostMapping("/refresh")
    public AuthResponse refresh(@CookieValue(name = COOKIE, required = false) String token,
                                HttpServletRequest http, HttpServletResponse res) {
        requireCsrfHeader(http);
        try {
            AuthResult result = authService.refresh(token, http.getHeader(HttpHeaders.USER_AGENT));
            setCookie(res, result.refreshToken());
            return result.response();
        } catch (ApiException e) {
            clearCookie(res);
            throw e;
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@CookieValue(name = COOKIE, required = false) String token,
                                       HttpServletRequest http, HttpServletResponse res) {
        requireCsrfHeader(http);
        authService.logout(token);
        clearCookie(res);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public UserDto me() {
        return authService.me(CurrentUser.id());
    }

    @PostMapping("/password/forgot")
    public ResponseEntity<Void> forgot(@Valid @RequestBody AuthDtos.ForgotPasswordRequest req, HttpServletRequest http) {
        limit("forgot", http);
        authService.forgotPassword(req.email());
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/password/reset")
    public ResponseEntity<Void> reset(@Valid @RequestBody AuthDtos.ResetPasswordRequest req, HttpServletRequest http) {
        limit("reset", http);
        authService.resetPassword(req);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/email/verify")
    public ResponseEntity<Void> verify(@Valid @RequestBody AuthDtos.VerifyEmailRequest req) {
        authService.verifyEmail(req.token());
        return ResponseEntity.noContent().build();
    }

    private void limit(String action, HttpServletRequest http) {
        var cfg = props.rateLimit();
        if (!rateLimiter.tryAcquire("auth:" + action + ":" + http.getRemoteAddr(), cfg.authPerWindow(), cfg.authWindow())) {
            throw ApiException.rateLimited();
        }
    }

    private static void requireCsrfHeader(HttpServletRequest http) {
        if (!CSRF_VALUE.equals(http.getHeader(CSRF_HEADER))) {
            throw ApiException.forbidden("Missing request header.");
        }
    }

    private void setCookie(HttpServletResponse res, String value) {
        res.addHeader(HttpHeaders.SET_COOKIE, cookie(value, props.jwt().refreshTtl()).toString());
    }

    private void clearCookie(HttpServletResponse res) {
        res.addHeader(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString());
    }

    private ResponseCookie cookie(String value, Duration maxAge) {
        return ResponseCookie.from(COOKIE, value)
                .httpOnly(true)
                .secure(props.cookie().secure())
                .sameSite("Strict")
                .path(COOKIE_PATH)
                .maxAge(maxAge)
                .build();
    }
}
