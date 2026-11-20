package com.diar.web;

import com.diar.shared.Listing;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/** Isolated browser QA server. Never contacts Supabase, never included in the release JAR. */
public class BrowserQa {
    public static void main(String[] args) {
        var app=new SpringApplication(DiarApplication.class,Fixture.class);
        app.setDefaultProperties(Map.of("server.port","8081","server.address","127.0.0.1"));app.run("--server.port=8081","--server.address=127.0.0.1");
    }
    @TestConfiguration static class Fixture {
        @Bean @Primary SupabaseService fixtureCloud(ObjectMapper json) {
            return new SupabaseService(new SupabaseConfig.Settings("",""),json) {
                final Map<String,Listing> homes=new ConcurrentHashMap<>(Map.of(ApiControllerTest.ID,ApiControllerTest.home()));
                final Map<String,Set<String>> saved=new ConcurrentHashMap<>();
                @Override public boolean enabled(){return true;}
                @Override public Map<String,Object> authenticate(String email,String password,String name,boolean signup) {
                    if(!password.equals("demo-password"))throw new ApiProblem(400,"invalid_credentials");
                    return ApiControllerTest.auth();
                }
                @Override public List<Listing> listings(){return new ArrayList<>(homes.values());}
                @Override public Listing find(String id){var home=homes.get(id);if(home==null)throw new ApiProblem(404,"listing_not_found");return home;}
                @Override public String token(CloudSession user){return "fixture";}
                @Override public String photoUrl(String path){return "/assets/sample-house.jpg";}
                @Override public Set<String> favorites(CloudSession user){return saved.computeIfAbsent(user.userId(),key->ConcurrentHashMap.newKeySet());}
                @Override public void setFavorite(String id,boolean value,CloudSession user){if(value)favorites(user).add(id);else favorites(user).remove(id);}
                @Override public Listing save(Listing home,boolean existing,CloudSession user,byte[] photo){homes.put(home.getId(),home);return home;}
                @Override public void delete(String id,CloudSession user){owned(id,user);homes.remove(id);saved.values().forEach(ids->ids.remove(id));}
                @Override public void signOut(CloudSession user){}
            };
        }
    }
}
