package com.travelmate.auth;

import com.travelmate.config.AppProperties;
import com.travelmate.users.User;
import com.travelmate.users.UserProfile;
import com.travelmate.users.UserProfileRepository;
import com.travelmate.users.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates the first SUPER_ADMIN when TRAVELMATE_BOOTSTRAP_ADMIN_EMAIL and _PASSWORD are set
 * and no account with that email exists. Never overwrites an existing account.
 */
@Component
public class BootstrapAdminRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(BootstrapAdminRunner.class);

    private final AppProperties props;
    private final UserRepository users;
    private final UserProfileRepository profiles;
    private final PasswordEncoder encoder;

    public BootstrapAdminRunner(AppProperties props, UserRepository users, UserProfileRepository profiles,
                                PasswordEncoder encoder) {
        this.props = props;
        this.users = users;
        this.profiles = profiles;
        this.encoder = encoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        var cfg = props.bootstrap();
        if (cfg == null || isBlank(cfg.adminEmail()) || isBlank(cfg.adminPassword())) return;
        String email = AuthService.normalizeEmail(cfg.adminEmail());
        if (users.existsByEmailIgnoreCase(email)) return;
        User admin = new User();
        admin.setEmail(email);
        admin.setDisplayName("TravelMate Admin");
        admin.setPasswordHash(encoder.encode(cfg.adminPassword()));
        admin.setEmailVerified(true);
        admin.getRoles().add("SUPER_ADMIN");
        users.save(admin);
        profiles.save(new UserProfile(admin.getId()));
        log.info("Bootstrap super admin created for {}", email);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
