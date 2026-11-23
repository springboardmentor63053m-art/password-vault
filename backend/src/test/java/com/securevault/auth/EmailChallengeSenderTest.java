package com.securevault.auth;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EmailChallengeSenderTest {
    @Test
    void failedSmtpDeliveryDoesNotStopLaterAlerts() {
        JavaMailSender mail = mock(JavaMailSender.class);
        doThrow(new MailSendException("synthetic SMTP failure")).doNothing()
                .when(mail).send(any(SimpleMailMessage.class));
        EmailChallengeSender sender = new EmailChallengeSender(provider(mail), "mail.test", "alerts@example.test");
        try {
            Instant time = Instant.parse("2026-11-12T10:31:42Z");
            sender.queuePasswordFailureAlert("first@example.test", 3, time);
            sender.queuePasswordFailureAlert("owner@example.test", 3, time);

            var messages = ArgumentCaptor.forClass(SimpleMailMessage.class);
            verify(mail, timeout(3000).times(2)).send(messages.capture());
            SimpleMailMessage delivered = messages.getAllValues().get(1);
            assertArrayEquals(new String[]{"owner@example.test"}, delivered.getTo());
            assertTrue(delivered.getText().contains("3 incorrect password attempts"));
            assertTrue(delivered.getText().contains("2026-11-12T10:31:00Z"));
            assertFalse(delivered.getText().contains("first@example.test"));
        } finally {
            sender.stopAlertDelivery();
        }
    }

    @Test
    void missingSmtpDoesNotTryToSend() {
        JavaMailSender mail = mock(JavaMailSender.class);
        EmailChallengeSender sender = new EmailChallengeSender(provider(mail), "", "");
        try {
            assertDoesNotThrow(() -> sender.queuePasswordFailureAlert("owner@example.test", 3, Instant.now()));
            verifyNoInteractions(mail);
        } finally {
            sender.stopAlertDelivery();
        }
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<JavaMailSender> provider(JavaMailSender mail) {
        ObjectProvider<JavaMailSender> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(mail);
        return provider;
    }
}
