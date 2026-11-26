package com.travelmate.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * DEV ONLY: does not send email. Writes the message (including one-time links) to the application
 * log so that password reset and email verification can be exercised locally. Replace with a real
 * provider before any deployment where logs are shared.
 */
@Component
public class LoggingEmailSender implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(LoggingEmailSender.class);

    @Override
    public void send(String to, String subject, String body) {
        log.warn("[DEV EMAIL - not delivered] to={} subject=\"{}\"\n{}", to, subject, body);
    }
}
