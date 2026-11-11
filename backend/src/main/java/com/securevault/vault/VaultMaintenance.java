package com.securevault.vault;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;
@Configuration @EnableScheduling
@ConditionalOnProperty(name="security.vault.maintenance-enabled",havingValue="true")
public class VaultMaintenance {
    private final ShareExpiryService expiry;
    public VaultMaintenance(ShareExpiryService expiry){this.expiry=expiry;}
    @Scheduled(fixedDelay=60000,initialDelay=60000) public void expireShares(){expiry.expire();}
}
