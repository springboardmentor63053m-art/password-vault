package com.securevault.vault;

import com.securevault.common.AccountPrincipal;
import com.securevault.threat.ThreatTelemetry;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

@Service
public class VaultService {
    private final JdbcTemplate db;
    private final VaultCrypto crypto;
    private final ThreatTelemetry telemetry;
    private final VaultEvents events;
    private final JsonMapper json = JsonMapper.builder().build();
    public VaultService(JdbcTemplate db, VaultCrypto crypto, ThreatTelemetry telemetry, VaultEvents events) {
        this.db = db; this.crypto = crypto; this.telemetry = telemetry; this.events = events;
    }

    public record Input(@NotBlank @Size(max=255) String title,
            @Size(max=2048) String url, @Size(max=320) String username,
            @NotBlank @Size(max=1024) String password, @NotBlank @Size(max=60) String categoryId,
            @Size(max=4000) String notes, boolean favorite) {
        @Override public String toString() { return "CredentialInput[redacted]"; }
    }
    public record Payload(String title, String url, String username, String password, String notes) {
        @Override public String toString() { return "CredentialPayload[redacted]"; }
    }
    public record Item(UUID id, String title, String url, String username, String password, String notes,
            String categoryId, String category, boolean favorite, Instant updatedAt, int strengthScore, String strength) {
        @Override public String toString() { return "CredentialItem[redacted]"; }
    }
    public record Category(String id, String name, boolean custom) {}
    private record CategoryRef(int systemId, UUID customId) {}
    private record Stored(UUID id, UUID owner, String data, String nonce, String categoryId,
            String category, boolean favorite, Instant updatedAt) {}
    private static final String SELECT = "SELECT c.id,v.owner_id,c.encrypted_data,c.encryption_iv," +
            "c.category_id,c.custom_category_id,COALESCE(uc.name,cat.category_name) AS category," +
            "c.is_favorite,c.updated_at FROM credentials c JOIN vaults v ON v.id=c.vault_id " +
            "JOIN categories cat ON cat.id=c.category_id LEFT JOIN user_vault_categories uc ON uc.id=c.custom_category_id ";
    private List<Stored> stored(String where, Object... args) {
        return db.query(SELECT + where, (r,n) -> new Stored(r.getObject("id",UUID.class),
                r.getObject("owner_id",UUID.class),r.getString("encrypted_data"),r.getString("encryption_iv"),
                r.getObject("custom_category_id")==null?"system:"+r.getInt("category_id"):"custom:"+r.getObject("custom_category_id"),
                r.getString("category"),r.getBoolean("is_favorite"),r.getTimestamp("updated_at").toInstant()), args);
    }
    private Item open(Stored row, boolean reveal) {
        Payload p;
        try { p=json.readValue(crypto.decrypt(row.owner(),row.id(),row.data(),row.nonce()),Payload.class); }
        catch(ResponseStatusException e){throw e;}
        catch(Exception e){throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Credential data could not be read.");}
        var assessment=PasswordHealth.assess(p.password());
        return new Item(row.id(),p.title(),p.url(),p.username(),reveal?p.password():null,reveal?p.notes():null,
                row.categoryId(),row.category(),row.favorite(),row.updatedAt(),assessment.score(),assessment.strength());
    }
    Item sharedItem(UUID owner,UUID id){
        var rows=stored("WHERE c.id=? AND v.owner_id=? AND c.deleted_at IS NULL",id,owner);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Shared credential unavailable.");
        return open(rows.get(0),true);
    }
    private Stored own(AccountPrincipal actor,UUID id,String ip,String agent) {
        var rows=stored("WHERE c.id=? AND v.owner_id=? AND c.deleted_at IS NULL",id,actor.userId());
        if(rows.isEmpty()){
            events.denied(actor,ip,agent,id);
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Credential not found or access unavailable.");
        }
        return rows.get(0);
    }
    public List<Category> categories(UUID user) {
        var result=new ArrayList<>(db.query("SELECT id,category_name FROM categories ORDER BY category_name",
                (r,n)->new Category("system:"+r.getInt(1),r.getString(2),false)));
        result.addAll(db.query("SELECT id,name FROM user_vault_categories WHERE owner_id=? ORDER BY name",
                (r,n)->new Category("custom:"+r.getObject(1),r.getString(2),true),user));
        return result;
    }
    @Transactional
    public Category createCategory(UUID user,String requested) {
        String name=requested.trim();
        if(name.isEmpty()||name.length()>80)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Category must contain 1–80 characters.");
        db.queryForObject("SELECT id FROM users WHERE id=? FOR UPDATE",UUID.class,user);
        String key=name.toLowerCase(Locale.ROOT);
        var existing=db.query("SELECT id,name FROM user_vault_categories WHERE owner_id=? AND name_key=?",
                (r,n)->new Category("custom:"+r.getObject(1),r.getString(2),true),user,key);
        if(!existing.isEmpty())return existing.get(0);
        UUID id=UUID.randomUUID();db.update("INSERT INTO user_vault_categories(id,owner_id,name,name_key) VALUES (?,?,?,?)",id,user,name,key);
        return new Category("custom:"+id,name,true);
    }
    private CategoryRef category(UUID user,String id) {
        try {
            if(id.startsWith("system:")){
                int n=Integer.parseInt(id.substring(7));
                if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM categories WHERE id=?)",Boolean.class,n)))return new CategoryRef(n,null);
            }else if(id.startsWith("custom:")){
                UUID n=UUID.fromString(id.substring(7));
                if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM user_vault_categories WHERE id=? AND owner_id=?)",Boolean.class,n,user)))
                    return new CategoryRef(db.queryForObject("SELECT id FROM categories WHERE category_name='Other'",Integer.class),n);
            }
        }catch(IllegalArgumentException ignored){}
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Select an available credential category.");
    }
    private void audit(AccountPrincipal actor,UUID id,String action,String ip,String agent) {
        var context=telemetry.metadata(agent,actor.deviceId()==null?null:actor.deviceId().toString(),"Session device",ip);
        context.put("credentialRef",id.toString());
        telemetry.audit(actor.userId(),action,"SUCCESS",ip,"Credential operation completed; secret fields omitted",context);
    }
    public List<Item> list(AccountPrincipal actor,String search,String category,String sort,boolean favorites) {
        if(search==null)search="";
        if(search.length()>120)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Search is limited to 120 characters.");
        String query=search.toLowerCase(Locale.ROOT);
        Comparator<Item> comparator=switch(sort){
            case "TITLE"->Comparator.comparing(Item::title,String.CASE_INSENSITIVE_ORDER);
            case "OLDEST"->Comparator.comparing(Item::updatedAt);
            case "NEWEST"->Comparator.comparing(Item::updatedAt).reversed();
            default->throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unsupported credential sort.");
        };
        return stored("WHERE v.owner_id=? AND c.deleted_at IS NULL ORDER BY c.updated_at DESC LIMIT 1001",actor.userId())
                .stream().map(r->open(r,false)).filter(i->!favorites||i.favorite())
                .filter(i->category==null||category.isEmpty()||i.categoryId().equals(category))
                .filter(i->(i.title()+" "+i.username()+" "+i.url()).toLowerCase(Locale.ROOT).contains(query))
                .sorted(comparator.thenComparing(Item::id)).toList();
    }
    @Transactional
    public Item read(AccountPrincipal actor,UUID id,String ip,String agent) {
        Item item=open(own(actor,id,ip,agent),true);
        audit(actor,id,"CREDENTIAL_READ",ip,agent);return item;
    }
    @Transactional
    public Item save(AccountPrincipal actor,UUID id,Input input,String ip,String agent) {
        boolean creating=id==null;
        if(!creating)own(actor,id,ip,agent);
        db.queryForObject("SELECT id FROM users WHERE id=? FOR UPDATE",UUID.class,actor.userId());
        if(creating&&db.queryForObject("SELECT COUNT(*) FROM credentials c JOIN vaults v ON v.id=c.vault_id WHERE v.owner_id=? AND c.deleted_at IS NULL",Long.class,actor.userId())>=1000)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"This vault supports up to 1000 credentials.");
        CategoryRef cat=category(actor.userId(),input.categoryId());
        if(creating)id=UUID.randomUUID();
        String encoded=json.writeValueAsString(new Payload(input.title().trim(),clean(input.url()),clean(input.username()),input.password(),clean(input.notes())));
        var sealed=crypto.encrypt(actor.userId(),id,encoded);
        if(creating){
            var vaults=db.query("SELECT id FROM vaults WHERE owner_id=? AND vault_type='PERSONAL' ORDER BY created_at LIMIT 1",(r,n)->r.getObject(1,UUID.class),actor.userId());
            UUID vault;
            if(vaults.isEmpty()){vault=UUID.randomUUID();db.update("INSERT INTO vaults(id,owner_id,vault_name,vault_type) VALUES (?,?,'Personal vault','PERSONAL')",vault,actor.userId());}
            else vault=vaults.get(0);
            db.update("INSERT INTO credentials(id,vault_id,category_id,custom_category_id,credential_type,title,encrypted_data,encryption_iv,key_version,is_favorite,strength_score) VALUES (?,?,?,?,'LOGIN','Encrypted credential',?,?,1,?,?)",
                    id,vault,cat.systemId(),cat.customId(),sealed.data(),sealed.nonce(),input.favorite(),PasswordHealth.assess(input.password()).score());
        }else if(db.update("UPDATE credentials SET category_id=?,custom_category_id=?,encrypted_data=?,encryption_iv=?,is_favorite=?,strength_score=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL",
                cat.systemId(),cat.customId(),sealed.data(),sealed.nonce(),input.favorite(),PasswordHealth.assess(input.password()).score(),id)!=1)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Credential changed. Refresh your vault.");
        audit(actor,id,creating?"CREDENTIAL_ADDED":"CREDENTIAL_UPDATED",ip,agent);
        synchronizeHealth(actor.userId());
        return open(own(actor,id,ip,agent),false);
    }
    @Transactional
    public void delete(AccountPrincipal actor,UUID id,String ip,String agent) {
        own(actor,id,ip,agent);
        db.queryForObject("SELECT id FROM users WHERE id=? FOR UPDATE",UUID.class,actor.userId());
        if(db.update("UPDATE credentials SET deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL",id)!=1)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Credential changed. Refresh your vault.");
        var revoked=db.query("UPDATE sharing SET status='REVOKED' WHERE credential_id=? AND shared_by_user_id=? AND status='ACTIVE' RETURNING id,shared_with_user_id",
            (r,n)->new UUID[]{r.getObject(1,UUID.class),r.getObject(2,UUID.class)},id,actor.userId());
        for(var share:revoked){
            var context=telemetry.metadata(agent,actor.deviceId()==null?null:actor.deviceId().toString(),"Session device",ip);
            context.put("credentialRef",id.toString());context.put("shareRef",share[0].toString());context.put("recipientRef",share[1].toString());context.put("permission","VIEW");
            telemetry.audit(actor.userId(),"SHARE_REVOKED","SUCCESS",ip,"Credential deletion revoked access; secret fields omitted",context);
        }
        audit(actor,id,"CREDENTIAL_DELETED",ip,agent);
        synchronizeHealth(actor.userId());
    }
    @Transactional
    public void favorite(AccountPrincipal actor,UUID id,boolean value,String ip,String agent) {
        own(actor,id,ip,agent);db.update("UPDATE credentials SET is_favorite=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",value,id);
        audit(actor,id,"CREDENTIAL_UPDATED",ip,agent);
    }
    private String clean(String value){return value==null?"":value;}

    public record Warning(UUID credentialId,String kind,String message){}
    public record Health(int total,int strong,int moderate,int weak,int reused,Integer score,List<Warning> warnings){}
    public record Activity(UUID id,String action,String result,Instant timestamp){}
    public record Overview(Health health,long sharedByMe,long sharedWithMe,List<Activity> recentActivities,List<String> suggestions){}
    public record CandidateAssessment(PasswordHealth.Assessment quality,boolean reused){}
    public CandidateAssessment assess(AccountPrincipal actor,String password,UUID excludedId){
        boolean reused=stored("WHERE v.owner_id=? AND c.deleted_at IS NULL",actor.userId()).stream()
                .filter(row->!row.id().equals(excludedId)).map(row->open(row,true)).anyMatch(item->item.password().equals(password));
        return new CandidateAssessment(PasswordHealth.assess(password),reused);
    }
    private Health health(UUID owner){
        var rows=stored("WHERE v.owner_id=? AND c.deleted_at IS NULL",owner);
        List<Item> items=rows.stream().map(r->open(r,true)).toList();
        Map<String,Long> occurrences=new HashMap<>();
        for(Item item:items)occurrences.merge(item.password(),1L,Long::sum);
        int strong=0,moderate=0,weak=0,reused=0,totalScore=0;
        List<Warning> warnings=new ArrayList<>();
        for(Item item:items){
            totalScore+=item.strengthScore();
            if(item.strengthScore()<40){weak++;warnings.add(new Warning(item.id(),"WEAK","Replace this easily guessed or short password with a longer unique password."));}
            else if(item.strengthScore()<70)moderate++;else strong++;
            if(occurrences.get(item.password())>1){reused++;warnings.add(new Warning(item.id(),"REUSED","This password is used by another credential in your vault. Generate a unique replacement."));}
        }
        Integer score=items.isEmpty()?null:Math.max(0,totalScore/items.size()-Math.min(40,reused*10));
        return new Health(items.size(),strong,moderate,weak,reused,score,warnings);
    }
    private void synchronizeHealth(UUID owner){
        Health h=health(owner);
        // Preserve any existing external compromise assessment; this implementation is not a breach provider.
        db.update("INSERT INTO password_health(user_id,overall_health_score,weak_passwords_count,reused_passwords_count,last_calculated) VALUES (?,?,?,?,CURRENT_TIMESTAMP) "
                +"ON CONFLICT(user_id) DO UPDATE SET overall_health_score=EXCLUDED.overall_health_score,weak_passwords_count=EXCLUDED.weak_passwords_count,reused_passwords_count=EXCLUDED.reused_passwords_count,last_calculated=CURRENT_TIMESTAMP",
                owner,h.score()==null?100:h.score(),h.weak(),h.reused());
    }
    public Overview overview(AccountPrincipal actor){
        Health h=health(actor.userId());
        long sent=db.queryForObject("SELECT count(DISTINCT s.credential_id) FROM sharing s JOIN credentials c ON c.id=s.credential_id WHERE s.shared_by_user_id=? AND s.status='ACTIVE' AND (s.expires_at IS NULL OR s.expires_at>CURRENT_TIMESTAMP) AND c.deleted_at IS NULL",Long.class,actor.userId());
        long received=db.queryForObject("SELECT count(DISTINCT s.credential_id) FROM sharing s JOIN credentials c ON c.id=s.credential_id WHERE s.shared_with_user_id=? AND s.status='ACTIVE' AND (s.expires_at IS NULL OR s.expires_at>CURRENT_TIMESTAMP) AND c.deleted_at IS NULL",Long.class,actor.userId());
        List<Activity> activities=db.query("SELECT id,action_type,status,timestamp FROM audit_logs WHERE user_id=? AND (action_type LIKE 'CREDENTIAL_%' OR action_type LIKE 'SHARE_%' OR action_type='VAULT_ACCESS_DENIED') ORDER BY timestamp DESC,id DESC LIMIT 12",
                (r,n)->new Activity(r.getObject(1,UUID.class),r.getString(2),r.getString(3),r.getTimestamp(4).toInstant()),actor.userId());
        var suggestions=new ArrayList<String>();
        if(h.total()==0)suggestions.add("Add a credential to calculate your password health. No score is estimated for an empty vault.");
        if(h.weak()>0)suggestions.add("Replace weak passwords with unique passwords of at least 16 characters.");
        if(h.reused()>0)suggestions.add("Replace reused passwords so each account has its own password.");
        suggestions.add("This score is a local quality/reuse heuristic, not a breach check or a security guarantee.");
        return new Overview(h,sent,received,activities,suggestions);
    }
}
