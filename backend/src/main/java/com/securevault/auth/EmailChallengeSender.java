package com.securevault.auth;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
public class EmailChallengeSender {
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
}
