package com.travelmate.auth;

import com.travelmate.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Collection;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class JwtService {

    private final SecretKey key;
    private final AppProperties.Jwt config;

    public JwtService(AppProperties props) {
        this.config = props.jwt();
        String secret = config.secret();
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SECRET must be set and at least 32 bytes long");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public long accessTtlSeconds() {
        return config.accessTtl().toSeconds();
    }

    public String issueAccessToken(UUID userId, String email, Collection<String> roles, Collection<String> permissions) {
        Instant now = Instant.now();
        return Jwts.builder()
                .issuer(config.issuer())
                .subject(userId.toString())
                .claim("email", email)
                .claim("roles", List.copyOf(roles))
                .claim("perms", List.copyOf(permissions))
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(config.accessTtl())))
                .signWith(key)
                .compact();
    }

    public Optional<AuthUser> parse(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).requireIssuer(config.issuer()).build()
                    .parseSignedClaims(token).getPayload();
            UUID id = UUID.fromString(claims.getSubject());
            String email = claims.get("email", String.class);
            Set<String> roles = toSet(claims.get("roles"));
            Set<String> perms = toSet(claims.get("perms"));
            return Optional.of(new AuthUser(id, email, roles, perms));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private static Set<String> toSet(Object raw) {
        Set<String> out = new HashSet<>();
        if (raw instanceof Collection<?> c) {
            for (Object o : c) if (o != null) out.add(o.toString());
        }
        return out;
    }
}
