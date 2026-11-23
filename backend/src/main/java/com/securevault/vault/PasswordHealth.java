package com.securevault.vault;
import java.util.*;

/** Explainable local quality heuristic, not a breach check or an attack-time estimate. */
public final class PasswordHealth {
    private PasswordHealth(){}
    public record Assessment(int score,String strength,List<String> suggestions){}
    public static Assessment assess(String password){
        String p=password==null?"":password;
        int groups=(p.chars().anyMatch(c->c>='a'&&c<='z')?1:0)+(p.chars().anyMatch(c->c>='A'&&c<='Z')?1:0)
                +(p.chars().anyMatch(c->c>='0'&&c<='9')?1:0)+(p.chars().anyMatch(c->!(c>='a'&&c<='z')&&!(c>='A'&&c<='Z')&&!(c>='0'&&c<='9'))?1:0);
        String lower=p.toLowerCase(Locale.ROOT);
        boolean guessed=p.isEmpty()||p.matches("(.)\\1{3,}")||List.of("password","123456","qwerty","letmein","iloveyou","welcome","admin").stream().anyMatch(lower::contains);
        int score=guessed?Math.min(15,p.length()):Math.min(100,Math.min(60,p.length()*3)+groups*10);
        List<String> advice=new ArrayList<>();
        if(p.length()<16)advice.add("Use at least 16 characters; longer unique passwords are preferable.");
        if(guessed)advice.add("Avoid common passwords, sequences and repeated characters.");
        if(groups<3)advice.add("Consider a longer random password or varied character groups.");
        advice.add("Use a unique password for each account. This is not a breach check.");
        return new Assessment(score,score<20?"Very Weak":score<40?"Weak":score<70?"Moderate":score<90?"Strong":"Very Strong",advice);
    }
}
