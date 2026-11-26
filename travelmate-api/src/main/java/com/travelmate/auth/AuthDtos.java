package com.travelmate.auth;

import com.travelmate.users.UserDto;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {}

    static final String PASSWORD_RULE = "^(?=.*[A-Za-z])(?=.*\\d).{8,72}$";
    static final String PASSWORD_MESSAGE = "Use 8 to 72 characters with at least one letter and one number";

    public record RegisterRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Pattern(regexp = PASSWORD_RULE, message = PASSWORD_MESSAGE) String password,
            @NotBlank @Size(min = 2, max = 60) String displayName) {}

    public record LoginRequest(@NotBlank @Email String email, @NotBlank @Size(max = 200) String password) {}

    public record ForgotPasswordRequest(@NotBlank @Email String email) {}

    public record ResetPasswordRequest(
            @NotBlank @Size(max = 200) String token,
            @NotBlank @Pattern(regexp = PASSWORD_RULE, message = PASSWORD_MESSAGE) String newPassword) {}

    public record VerifyEmailRequest(@NotBlank @Size(max = 200) String token) {}

    public record AuthResponse(String accessToken, long expiresIn, UserDto user) {}

    /** Internal: the response body plus the raw refresh token destined for the cookie. */
    public record AuthResult(AuthResponse response, String refreshToken) {}
}
