package com.securevault.vault;
import com.securevault.common.AccountAuthenticationInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/account/notifications")
@CrossOrigin(origins={"http://localhost:3000","http://127.0.0.1:3000"})
public class NotificationController {
    private final NotificationService service;
    public NotificationController(NotificationService service){this.service=service;}
    private UUID owner(HttpServletRequest r){return AccountAuthenticationInterceptor.principal(r).userId();}
    @GetMapping public Object list(@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size,@RequestParam(defaultValue="false")boolean unread,HttpServletRequest r){return service.list(owner(r),page,size,unread);}
    @GetMapping("/unread") public Object unread(HttpServletRequest r){return Map.of("unread",service.unread(owner(r)));}
    @PutMapping("/{id}/read") public ResponseEntity<Void> read(@PathVariable UUID id,HttpServletRequest r){service.mark(owner(r),id);return ResponseEntity.noContent().build();}
    @PutMapping("/read") public ResponseEntity<Void> readAll(HttpServletRequest r){service.markAll(owner(r));return ResponseEntity.noContent().build();}
}
