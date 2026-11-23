package com.securevault.vault;

import com.securevault.common.AccountPrincipal;
import com.securevault.threat.ThreatTelemetry;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VaultEvents {
    private final ThreatTelemetry telemetry;
    public VaultEvents(ThreatTelemetry telemetry) { this.telemetry = telemetry; }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void denied(AccountPrincipal actor, String ip, String agent, UUID reference) {
        var metadata = telemetry.metadata(agent, null, "Not evaluated", ip);
        metadata.put("credentialRef", reference.toString());
        telemetry.audit(actor.userId(), "VAULT_ACCESS_DENIED", "FAILURE", ip,
                "Credential access rejected; no credential values recorded", metadata);
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sharedDenied(AccountPrincipal actor,String ip,String agent,UUID reference){
        var metadata=telemetry.metadata(agent,null,"Not evaluated",ip);metadata.put("shareRef",reference.toString());
        telemetry.audit(actor.userId(),"VAULT_ACCESS_DENIED","FAILURE",ip,"Shared credential access rejected; no credential values recorded",metadata);
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void shareDenied(AccountPrincipal actor,String ip,String agent,UUID reference){
        var metadata=telemetry.metadata(agent,null,"Not evaluated",ip);
        metadata.put("credentialRef",reference.toString());
        telemetry.audit(actor.userId(),"CREDENTIAL_SHARE_DENIED","FAILURE",ip,
                "Sharing request rejected; account and secret values omitted",metadata);
    }
}
