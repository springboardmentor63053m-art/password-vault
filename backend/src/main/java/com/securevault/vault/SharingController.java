package com.securevault.vault;
import com.securevault.common.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
@RestController @Validated @RequestMapping("/api/account/shares")
@CrossOrigin(origins={"http://localhost:3000","http://127.0.0.1:3000"})
public class SharingController {
    private final SharingService service;private final ClientIpResolver ips;
    public SharingController(SharingService service,ClientIpResolver ips){this.service=service;this.ips=ips;}
    private AccountPrincipal actor(HttpServletRequest r){return AccountAuthenticationInterceptor.principal(r);}
    public record ShareRequest(@NotNull UUID credentialId,@NotNull UUID recipientId,Instant expiresAt){}
    public record ExpiryRequest(Instant expiresAt){}
    @GetMapping("/recipients") public Object recipients(@RequestParam @Size(min=3,max=120) String search,HttpServletRequest r){return service.recipients(actor(r).userId(),search);}
    @PostMapping public Object create(@Valid @RequestBody ShareRequest body,HttpServletRequest r){return service.create(actor(r),body.credentialId(),body.recipientId(),body.expiresAt(),ips.resolve(r),r.getHeader("User-Agent"));}
    @GetMapping("/sent") public Object sent(HttpServletRequest r){return service.list(actor(r),true);}
    @GetMapping("/received") public Object received(HttpServletRequest r){return service.list(actor(r),false);}
    @GetMapping("/history") public Object history(HttpServletRequest r){return service.history(actor(r));}
    @GetMapping("/{id}/credential") public Object read(@PathVariable UUID id,HttpServletRequest r){return service.read(actor(r),id,ips.resolve(r),r.getHeader("User-Agent"));}
    @DeleteMapping("/{id}") public ResponseEntity<Void> revoke(@PathVariable UUID id,HttpServletRequest r){service.revoke(actor(r),id,ips.resolve(r),r.getHeader("User-Agent"));return ResponseEntity.noContent().build();}
    @PatchMapping("/{id}/expiry") public ResponseEntity<Void> expiry(@PathVariable UUID id,@Valid @RequestBody ExpiryRequest body,HttpServletRequest r){service.updateExpiry(actor(r),id,body.expiresAt(),ips.resolve(r),r.getHeader("User-Agent"));return ResponseEntity.noContent().build();}
}
