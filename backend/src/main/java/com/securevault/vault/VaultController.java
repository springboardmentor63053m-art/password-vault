package com.securevault.vault;
import com.securevault.common.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController @Validated
@RequestMapping("/api/account/vault")
@CrossOrigin(origins={"http://localhost:3000","http://127.0.0.1:3000"})
public class VaultController {
    private final VaultService service; private final ClientIpResolver ips; private final BreachService breachService;
    @org.springframework.beans.factory.annotation.Autowired
    public VaultController(VaultService service,ClientIpResolver ips,BreachService breachService){this.service=service;this.ips=ips;this.breachService=breachService!=null?breachService:new BreachService();}
    public VaultController(VaultService service,ClientIpResolver ips){this(service,ips,new BreachService());}
    private AccountPrincipal actor(HttpServletRequest request){return AccountAuthenticationInterceptor.principal(request);}
    @GetMapping("/overview") public Object overview(HttpServletRequest r){return service.overview(actor(r));}
    public record CandidateRequest(@NotNull @Size(max=1024) String password,UUID excludedId){
        @Override public String toString(){return "CandidateRequest[redacted]";}
    }
    @PostMapping("/password-health") public Object assess(@Valid @RequestBody CandidateRequest body,HttpServletRequest r){return service.assess(actor(r),body.password(),body.excludedId());}
    @PostMapping("/check-breach") public Object checkBreach(@Valid @RequestBody CandidateRequest body,HttpServletRequest r){return breachService.check(body.password());}
    @GetMapping("/categories") public Object categories(HttpServletRequest r){return service.categories(actor(r).userId());}
    public record CategoryRequest(@NotBlank @Size(max=80) String name){}
    @PostMapping("/categories") public Object category(@Valid @RequestBody CategoryRequest body,HttpServletRequest r){return service.createCategory(actor(r).userId(),body.name());}
    @GetMapping("/credentials") public Object list(@RequestParam(defaultValue="") @Size(max=120) String search,
            @RequestParam(defaultValue="") String category,@RequestParam(defaultValue="NEWEST") String sort,
            @RequestParam(defaultValue="false") boolean favorites,HttpServletRequest r){
        return service.list(actor(r),search,category,sort,favorites);
    }
    @GetMapping("/credentials/{id}") public Object read(@PathVariable UUID id,HttpServletRequest r){return service.read(actor(r),id,ips.resolve(r),r.getHeader("User-Agent"));}
    @PostMapping("/credentials") public Object add(@Valid @RequestBody VaultService.Input body,HttpServletRequest r){return service.save(actor(r),null,body,ips.resolve(r),r.getHeader("User-Agent"));}
    @PutMapping("/credentials/{id}") public Object update(@PathVariable UUID id,@Valid @RequestBody VaultService.Input body,HttpServletRequest r){return service.save(actor(r),id,body,ips.resolve(r),r.getHeader("User-Agent"));}
    @DeleteMapping("/credentials/{id}") public ResponseEntity<Void> delete(@PathVariable UUID id,HttpServletRequest r){service.delete(actor(r),id,ips.resolve(r),r.getHeader("User-Agent"));return ResponseEntity.noContent().build();}
    public record FavoriteRequest(@NotNull Boolean favorite){}
    @PatchMapping("/credentials/{id}/favorite") public ResponseEntity<Void> favorite(@PathVariable UUID id,@Valid @RequestBody FavoriteRequest body,HttpServletRequest r){service.favorite(actor(r),id,body.favorite(),ips.resolve(r),r.getHeader("User-Agent"));return ResponseEntity.noContent().build();}
}
