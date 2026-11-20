package com.diar.web;

import com.diar.shared.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;

@Service
public class SupabaseService {
    private final SupabaseConfig.Settings settings;
    private final ObjectMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10))
        .followRedirects(HttpClient.Redirect.NEVER).build();
    public SupabaseService(SupabaseConfig.Settings settings, ObjectMapper json) { this.settings=settings; this.json=json; }
    public boolean enabled() { return settings.enabled(); }
    public String photoUrl(String path) {
        return settings.url()+"/storage/v1/object/public/listing-photos/"+path;
    }
    public Object call(String method, String path, Object body, String token, String contentType, boolean representation) {
        if (!enabled()) throw new ApiProblem(503,"backend_not_configured");
        try {
            byte[] bytes = body == null ? null : body instanceof byte[] ? (byte[])body : json.writeValueAsBytes(body);
            var request = HttpRequest.newBuilder(URI.create(settings.url()+path)).timeout(Duration.ofSeconds(20))
                .header("apikey",settings.key()).header("Content-Type",contentType);
            if (token != null) request.header("Authorization","Bearer "+token);
            if (representation) request.header("Prefer","return=representation");
            request.method(method, bytes == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofByteArray(bytes));
            var response = http.send(request.build(),HttpResponse.BodyHandlers.ofByteArray());
            byte[] responseBody = response.body();
            if (response.statusCode() < 200 || response.statusCode() > 299) {
                String code = "backend_error";
                try { code = json.readTree(responseBody).path("code").asText(code); } catch (Exception ignored) { }
                if (!code.matches("[a-zA-Z0-9_]{1,80}")) code = "backend_error";
                throw new ApiProblem(response.statusCode(),code);
            }
            return responseBody.length == 0 ? null : json.readValue(responseBody,new TypeReference<Object>(){});
        } catch (ApiProblem problem) { throw problem; }
        catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); throw new ApiProblem(503,"connection_failed"); }
        catch (Exception failure) { throw new ApiProblem(503,"connection_failed"); }
    }
    @SuppressWarnings("unchecked")
    public Map<String,Object> authenticate(String email, String password, String name, boolean signup) {
        Map<String,Object> payload = new LinkedHashMap<>(); payload.put("email",email); payload.put("password",password);
        if (signup) payload.put("data",Map.of("full_name",name));
        return (Map<String,Object>) call("POST",signup?"/auth/v1/signup":"/auth/v1/token?grant_type=password",payload,null,"application/json",false);
    }
    @SuppressWarnings("unchecked")
    public String token(CloudSession session) {
        if (session == null) throw new ApiProblem(401,"sign_in_required");
        synchronized(session) {
            if (session.expiresAt() <= System.currentTimeMillis()/1000+60) {
                session.update((Map<String,Object>)call("POST","/auth/v1/token?grant_type=refresh_token",
                    Map.of("refresh_token",session.refreshToken()),null,"application/json",false));
            }
            return session.accessToken();
        }
    }
    public void signOut(CloudSession session) {
        if (session != null) try { call("POST","/auth/v1/logout?scope=local",null,session.accessToken(),"application/json",false); }
        catch (ApiProblem ignored) { }
    }
    @SuppressWarnings("unchecked")
    public List<Listing> listings() {
        List<Listing> result = new ArrayList<>();
        int offset=0;
        while (true) {
            var page = (List<Map<String,Object>>)call("GET","/rest/v1/listings?select=*&order=created_at.desc,id&limit=200&offset="+offset,null,null,"application/json",false);
            for (var row : page) result.add(Listing.fromRow(row));
            if (page.size()<200) return result;
            offset += page.size();
            if (offset >= 10000) throw new ApiProblem(503,"collection_too_large");
        }
    }
    @SuppressWarnings("unchecked")
    public Listing find(String id) {
        UUID.fromString(id);
        var rows = (List<Map<String,Object>>)call("GET","/rest/v1/listings?id=eq."+id+"&select=*",null,null,"application/json",false);
        if (rows.isEmpty()) throw new ApiProblem(404,"listing_not_found");
        return Listing.fromRow(rows.get(0));
    }
    public Listing owned(String id, CloudSession session) {
        token(session);
        var listing = find(id);
        if (!listing.getOwnerId().equals(session.userId())) throw new ApiProblem(403,"not_owner");
        return listing;
    }
    @SuppressWarnings("unchecked")
    public Listing save(Listing listing, boolean existing, CloudSession session, byte[] photo) {
        String access = token(session), path = listing.getPhotoPath(), uploaded = null;
        if (!listing.getOwnerId().equals(session.userId())) throw new ApiProblem(403,"not_owner");
        if (photo != null) {
            uploaded=session.userId()+"/"+listing.getId()+"/"+UUID.randomUUID()+".jpg";
            call("POST","/storage/v1/object/listing-photos/"+uploaded,photo,access,"image/jpeg",false);
            path=uploaded;
        }
        var row = new LinkedHashMap<>(listing.toRow()); row.put("photo_path",path);
        try {
            var rows = (List<Map<String,Object>>)call(existing?"PATCH":"POST","/rest/v1/listings"+
                (existing?"?id=eq."+listing.getId()+"&owner_id=eq."+session.userId():""),row,access,"application/json",true);
            if (rows.size()!=1) throw new ApiProblem(403,"not_owner");
            if (uploaded != null && !listing.getPhotoPath().isEmpty()) cleanup(listing.getPhotoPath(),access);
            return Listing.fromRow(rows.get(0));
        } catch (RuntimeException failure) { if (uploaded!=null) cleanup(uploaded,access); throw failure; }
    }
    @SuppressWarnings("unchecked")
    public void delete(String id, CloudSession session) {
        Listing listing = owned(id,session); String access=token(session);
        var rows=(List<?>)call("DELETE","/rest/v1/listings?id=eq."+id+"&owner_id=eq."+session.userId(),null,access,"application/json",true);
        if (rows.size()!=1) throw new ApiProblem(403,"not_owner");
        if (!listing.getPhotoPath().isEmpty()) cleanup(listing.getPhotoPath(),access);
    }
    private void cleanup(String path, String access) {
        try { call("DELETE","/storage/v1/object/listing-photos",Map.of("prefixes",List.of(path)),access,"application/json",false); }
        catch (ApiProblem ignored) { /* A failed cleanup can be retried by the project owner in Storage. */ }
    }
    @SuppressWarnings("unchecked")
    public Set<String> favorites(CloudSession session) {
        String access=token(session);
        Set<String> result=new LinkedHashSet<>(); int offset=0;
        while (true) {
            var rows=(List<Map<String,Object>>)call("GET","/rest/v1/favorites?select=listing_id&user_id=eq."+session.userId()+"&order=listing_id&limit=200&offset="+offset,null,access,"application/json",false);
            for(var row:rows) result.add(row.get("listing_id").toString());
            if(rows.size()<200) return result;
            offset+=rows.size();
        }
    }
    public void setFavorite(String id, boolean saved, CloudSession session) {
        String access=token(session); Favorite favorite=new Favorite(session.userId(),id);
        if (saved) {
            try { call("POST","/rest/v1/favorites",favorite.toRow(),access,"application/json",false); }
            catch (ApiProblem problem) { if (problem.status()!=409 || !problem.code().equals("23505")) throw problem; }
        } else call("DELETE","/rest/v1/favorites?user_id=eq."+session.userId()+"&listing_id=eq."+id,null,access,"application/json",false);
    }
}
