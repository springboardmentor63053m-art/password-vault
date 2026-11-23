package com.securevault.auth;

import java.time.Instant;
import java.util.Properties;
import jakarta.mail.Part;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.Multipart;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ExternalSharingMailTest {
    @Test
    void submitsSeparateInvitationAndVerificationMessages() throws Exception {
        JavaMailSender smtp = mock(JavaMailSender.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<JavaMailSender> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(smtp);
        when(smtp.createMimeMessage()).thenAnswer(invocation -> new MimeMessage(Session.getInstance(new Properties())));
        var sender = new EmailChallengeSender(provider, "mailpit", "vault@example.test");
        try {
            String recipient = "recipient@example.test";
            String link = "http://127.0.0.1:3300/external.html#fixture";
            sender.sendExternalInvitation(recipient, "<Fixture sender>", link,
                    Instant.parse("2026-11-17T10:00:00Z"), "<img src=x>");
            sender.sendExternalCode(recipient, "012345");

            var invitations = ArgumentCaptor.forClass(MimeMessage.class);
            verify(smtp).send(invitations.capture());
            var invitation = invitations.getValue();
            invitation.saveChanges();
            assertEquals(recipient, invitation.getAllRecipients()[0].toString());
            assertEquals("vault@example.test", ((jakarta.mail.internet.InternetAddress) invitation.getFrom()[0]).getAddress());
            String plain = textPart(invitation, "text/plain");
            String html = textPart(invitation, "text/html");
            assertTrue(plain.contains(link));
            assertTrue(html.contains("href=\"" + link + "\""));
            assertTrue(html.contains("Access Shared Credential"));
            assertTrue(html.contains("17 Nov 2026, 10:00 UTC"));
            assertTrue(html.contains("&lt;Fixture sender&gt;"));
            assertTrue(html.contains("&lt;img src=x&gt;"));
            assertFalse(html.contains("<img"));
            assertFalse((plain + html).contains("012345"));
            assertFalse((plain + html).contains("synthetic-vault-test-value"));

            var codes = ArgumentCaptor.forClass(SimpleMailMessage.class);
            verify(smtp).send(codes.capture());
            var code = codes.getValue();
            assertArrayEquals(new String[]{recipient}, code.getTo());
            assertTrue(code.getText().contains("012345"));
            assertFalse(code.getText().contains(link));
            doThrow(new org.springframework.mail.MailSendException("Synthetic transport failure")).when(smtp).send(any(MimeMessage.class));
            assertThrows(org.springframework.mail.MailSendException.class,
                    () -> sender.sendExternalInvitation(recipient, "Fixture sender", link, Instant.now(), null));
        } finally {
            sender.stopAlertDelivery();
        }
    }
    private static String textPart(Part part, String type) throws Exception {
        if (part.isMimeType(type)) return (String) part.getContent();
        if (part.getContent() instanceof Multipart multipart) {
            for (int i = 0; i < multipart.getCount(); i++) {
                String value = textPart(multipart.getBodyPart(i), type);
                if (value != null) return value;
            }
        }
        return null;
    }

}
