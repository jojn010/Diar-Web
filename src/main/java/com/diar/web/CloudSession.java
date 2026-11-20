package com.diar.web;

import java.io.Serializable;
import java.util.Map;

/** Server-side only: no password, access token or refresh token is returned to browser JavaScript. */
public final class CloudSession implements Serializable {
    private String accessToken, refreshToken;
    private long expiresAt;
    private final String userId, email, name;
    @SuppressWarnings("unchecked")
    public CloudSession(Map<String,Object> payload) {
        var user = (Map<String,Object>) payload.get("user");
        userId = user.get("id").toString(); email = user.get("email").toString();
        var metadata = (Map<String,Object>) user.getOrDefault("user_metadata", Map.of());
        name = metadata.getOrDefault("full_name", "").toString();
        update(payload);
    }
    public synchronized void update(Map<String,Object> payload) {
        accessToken = payload.get("access_token").toString();
        refreshToken = payload.get("refresh_token").toString();
        expiresAt = System.currentTimeMillis()/1000 + ((Number)payload.getOrDefault("expires_in",3600)).longValue();
    }
    String accessToken() { return accessToken; } String refreshToken() { return refreshToken; }
    long expiresAt() { return expiresAt; }
    public String userId() { return userId; }
    public Map<String,String> user() { return Map.of("id",userId,"email",email,"name",name); }
}
