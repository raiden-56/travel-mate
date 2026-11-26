package com.travelmate.auth;

/** Port for transactional email. Implementations: LoggingEmailSender (dev only); SMTP/provider in Phase 2. */
public interface EmailSender {

    void send(String to, String subject, String body);
}
