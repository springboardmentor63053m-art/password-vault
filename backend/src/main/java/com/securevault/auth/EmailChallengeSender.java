package com.securevault.auth;

import jakarta.annotation.PreDestroy;
import jakarta.mail.MessagingException;
import java.nio.charset.StandardCharsets;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.web.util.HtmlUtils;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
public class EmailChallengeSender {
    private static final Logger LOG = LoggerFactory.getLogger(EmailChallengeSender.class);
    private final ThreadPoolExecutor alertDelivery = new ThreadPoolExecutor(
            1, 1, 0, TimeUnit.SECONDS, new ArrayBlockingQueue<>(32),
            task -> new Thread(task, "password-alert-mail"));
    private final JavaMailSender mailSender;
    private final String mailHost;
    private final String fromAddress;

    public EmailChallengeSender(
            ObjectProvider<JavaMailSender> senderProvider,
            @Value("${spring.mail.host:}") String mailHost,
            @Value("${securevault.mail.from:}") String fromAddress) {
        this.mailSender = senderProvider.getIfAvailable();
        this.mailHost = mailHost == null ? "" : mailHost.trim();
        this.fromAddress = fromAddress == null ? "" : fromAddress.trim();
    }

    public boolean isConfigured() {
        return mailSender != null && !mailHost.isBlank() && !fromAddress.isBlank();
    }

    public void sendLoginCode(String address, String code) {
        if (!isConfigured()) throw new IllegalStateException("Email delivery is not configured.");
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(address);
        message.setSubject("Your SecureVault sign-in code");
        message.setText("Your SecureVault sign-in code is " + code
                + ". It expires in 5 minutes. If you did not request it, secure your account.");
        mailSender.send(message);
    }

    private static final DateTimeFormatter INVITATION_EXPIRY = DateTimeFormatter
            .ofPattern("d MMM uuuu, HH:mm 'UTC'", Locale.ENGLISH).withZone(ZoneOffset.UTC);

    public void sendExternalInvitation(String address, String sender, String link, Instant expiry, String note) {
        if (!isConfigured()) throw new IllegalStateException("Email delivery is not configured.");

        String expires = INVITATION_EXPIRY.format(expiry);
        boolean hasNote = note != null && !note.isBlank();
        String warning = "If you weren't expecting this invitation, ignore it. Keep the link and verification code private.";
        String plain = """
                SecureVault

                %s shared a credential with you. Open the link and verify your email before viewing it.

                Access Shared Credential: %s
                Access expires on %s.
                %s
                %s
                """.formatted(sender, link, expires, hasNote ? "Message from the sender: " + note : "", warning);
        String html = """
                <!doctype html>
                <html lang="en"><head><meta charset="UTF-8"></head>
                <body style="margin:0;background:#eef2f7;color:#13233b;font-family:Arial,sans-serif">
                  <table role="presentation" width="100%%" cellspacing="0" cellpadding="16">
                    <tr><td align="center">
                      <table role="presentation" width="100%%" cellspacing="0" cellpadding="24"
                             style="max-width:560px;background:#ffffff;border:1px solid #dce5f0;border-radius:14px">
                        <tr><td style="background:#101d35;color:#ffffff;font-weight:bold;font-size:20px">SecureVault</td></tr>
                        <tr><td>
                          <h1 style="margin:0 0 14px;font-size:24px">A credential was shared with you</h1>
                          <p><strong>%s</strong> shared a credential with you. Verify your email before viewing it.</p>
                          %s
                          <p style="margin:24px 0">
                            <a href="%s" style="display:inline-block;padding:14px 18px;background:#164bc5;color:#ffffff;border-radius:8px;font-weight:bold;text-decoration:none">Access Shared Credential</a>
                          </p>
                          <p><strong>Access expires:</strong> %s</p>
                          <p style="border-top:1px solid #dce5f0;padding-top:14px;color:#364b66">%s</p>
                        </td></tr>
                      </table>
                    </td></tr>
                  </table>
                </body></html>
                """.formatted(HtmlUtils.htmlEscape(sender),
                hasNote ? "<p><strong>Message from the sender:</strong> " + HtmlUtils.htmlEscape(note) + "</p>" : "",
                HtmlUtils.htmlEscape(link), expires, HtmlUtils.htmlEscape(warning));

        var message = mailSender.createMimeMessage();
        try {
            var helper = new MimeMessageHelper(message, MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED,
                    StandardCharsets.UTF_8.name());
            helper.setFrom(fromAddress, "SecureVault");
            helper.setTo(address);
            helper.setSubject("A credential has been securely shared with you");
            helper.setText(plain, html);
        } catch (MessagingException | java.io.UnsupportedEncodingException exception) {
            throw new IllegalStateException("The SecureVault invitation could not be prepared.");
        }
        mailSender.send(message);
    }

    public void sendExternalCode(String address, String code) {
        sendExternalMessage(address, "Verify your SecureVault shared access",
                "Your SecureVault shared access code is " + code + ". It expires in 5 minutes. Do not share it.");
    }

    private void sendExternalMessage(String address, String subject, String body) {
        if (!isConfigured()) throw new IllegalStateException("Email delivery is not configured.");
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(address);
        message.setSubject(subject);
        message.setText(body);
        mailSender.send(message);
    }

    public void queuePasswordFailureAlert(String address, long attempts, Instant alertTime) {
        if (!isConfigured()) {
            LOG.warn("Password failure alert recorded; SMTP is unavailable.");
            return;
        }
        try {
            alertDelivery.execute(() -> {
                try {
                    SimpleMailMessage message = new SimpleMailMessage();
                    message.setFrom(fromAddress);
                    message.setTo(address);
                    message.setSubject("SecureVault security alert: failed sign-in attempts");
                    message.setText("""
                            SecureVault detected %d incorrect password attempts for your account within 15 minutes.
                            The alert was triggered at approximately %s (UTC).

                            If this was you, check your saved sign-in details before trying again.
                            If you do not recognize this activity, open SecureVault directly, review your
                            account security, and change your password if you suspect it was exposed.
                            Never share your password or verification codes.
                            """.formatted(attempts, alertTime.truncatedTo(ChronoUnit.MINUTES)));
                    mailSender.send(message);
                } catch (RuntimeException exception) {
                    LOG.warn("Password failure alert email could not be delivered.");
                }
            });
        } catch (RejectedExecutionException exception) {
            LOG.warn("Password failure alert delivery queue is unavailable.");
        }
    }

    @PreDestroy
    void stopAlertDelivery() {
        alertDelivery.shutdown();
    }
}
