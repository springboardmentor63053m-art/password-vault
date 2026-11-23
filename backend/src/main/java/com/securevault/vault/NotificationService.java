package com.securevault.vault;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
@Service
public class NotificationService {
    private final JdbcTemplate db;
    public NotificationService(JdbcTemplate db){this.db=db;}
    public record Notice(UUID id,String title,String message,String type,boolean read,Instant createdAt){}
    public record Page(List<Notice> items,long total,long unread,int page,int size){}
    public long unread(UUID owner){return db.queryForObject("SELECT count(*) FROM notifications WHERE user_id=? AND is_read=FALSE",Long.class,owner);}
    public Page list(UUID owner,int page,int size,boolean onlyUnread){
        if(page<0||page>10000||size<1||size>100)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid notification page or size.");
        String from=" FROM notifications WHERE user_id=?"+(onlyUnread?" AND is_read=FALSE":"");
        long total=db.queryForObject("SELECT count(*)"+from,Long.class,owner);
        var rows=db.query("SELECT id,title,message,notification_type,is_read,created_at"+from+" ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?",
                (r,n)->new Notice(r.getObject(1,UUID.class),r.getString(2),r.getString(3),r.getString(4),r.getBoolean(5),r.getTimestamp(6).toInstant()),owner,size,page*size);
        return new Page(rows,total,unread(owner),page,size);
    }
    public void mark(UUID owner,UUID id){
        if(db.update("UPDATE notifications SET is_read=TRUE WHERE id=? AND user_id=?",id,owner)!=1)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Notification not found.");
    }
    public void markAll(UUID owner){db.update("UPDATE notifications SET is_read=TRUE WHERE user_id=? AND is_read=FALSE",owner);}
}
