package com.securevault.vault;
import com.securevault.common.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/account/security")
@CrossOrigin(origins={"http://localhost:3000","http://127.0.0.1:3000"})
public class AccountSecurityController {
 private final AccountSecurityService service;private final ClientIpResolver ips;
 public AccountSecurityController(AccountSecurityService service,ClientIpResolver ips){this.service=service;this.ips=ips;}
 private AccountPrincipal actor(HttpServletRequest r){return AccountAuthenticationInterceptor.principal(r);}
 public record PasswordRequest(@NotBlank @Size(max=72) @BcryptPasswordLength String currentPassword,
  @NotBlank @Size(min=12,max=72) @BcryptPasswordLength String newPassword,@Pattern(regexp="^$|[0-9]{6}") String code){@Override public String toString(){return "PasswordChange[redacted]";}}
 @GetMapping public Object overview(HttpServletRequest r){return service.overview(actor(r));}
 @PostMapping("/password") public ResponseEntity<Void> password(@Valid @RequestBody PasswordRequest body,HttpServletRequest r){service.changePassword(actor(r),body.currentPassword(),body.newPassword(),body.code(),ips.resolve(r),r.getHeader("User-Agent"));return ResponseEntity.noContent().build();}
 @DeleteMapping("/sessions/{id}") public ResponseEntity<Void> session(@PathVariable UUID id,HttpServletRequest r){service.revokeSession(actor(r),id,ips.resolve(r),r.getHeader("User-Agent"));return ResponseEntity.noContent().build();}
 @DeleteMapping("/devices/{id}") public ResponseEntity<Void> device(@PathVariable UUID id,HttpServletRequest r){service.revokeDevice(actor(r),id,ips.resolve(r),r.getHeader("User-Agent"));return ResponseEntity.noContent().build();}
}
