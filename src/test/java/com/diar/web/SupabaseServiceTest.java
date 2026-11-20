package com.diar.web;

import com.sun.net.httpserver.HttpServer;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import java.net.InetSocketAddress;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import static org.junit.jupiter.api.Assertions.*;

class SupabaseServiceTest {
    HttpServer server; SupabaseService service; ObjectMapper json=new ObjectMapper();
    record Call(String method,String path,String authorization,String body) { }
    boolean failSave=true;
    final List<Call> calls=new CopyOnWriteArrayList<>();
    @BeforeEach void start() throws Exception {
        server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/",exchange->{
            String path=exchange.getRequestURI().toString(),body=new String(exchange.getRequestBody().readAllBytes());
            calls.add(new Call(exchange.getRequestMethod(),path,exchange.getRequestHeaders().getFirst("Authorization"),body));
            Object response=Map.of();int status=200;
            if(path.contains("grant_type=refresh_token"))response=ApiControllerTest.auth();
            else if(path.startsWith("/rest/v1/favorites")&&exchange.getRequestMethod().equals("GET")) {
                var page=new ArrayList<Map<String,String>>();
                if(path.endsWith("offset=0"))for(int i=0;i<200;i++)page.add(Map.of("listing_id",UUID.nameUUIDFromBytes(("home"+i).getBytes()).toString()));
                response=page;
            } else if(path.equals("/rest/v1/favorites")&&exchange.getRequestMethod().equals("POST")) {status=409;response=Map.of("code","23505","message","private details must not escape");}
            else if(path.startsWith("/rest/v1/listings")&&(exchange.getRequestMethod().equals("POST")||exchange.getRequestMethod().equals("PATCH"))) {
                if(failSave){status=400;response=Map.of("code","23514","message","private SQL details");}
                else response=List.of(json.readValue(body,Map.class));
            }
            else if(path.startsWith("/rest/v1/listings"))response=List.of(ApiControllerTest.home().toRow());
            byte[] bytes=json.writeValueAsBytes(response);exchange.sendResponseHeaders(status,bytes.length);exchange.getResponseBody().write(bytes);exchange.close();
        });server.start();
        service=new SupabaseService(new SupabaseConfig.Settings("http://127.0.0.1:"+server.getAddress().getPort(),"public-test-key"),json);
    }
    @AfterEach void stop() {server.stop(0);}
    @Test void favoritesPageFullyAndUseOnlyTheCurrentAccountsBearerToken() throws Exception {
        var session=new CloudSession(ApiControllerTest.auth());
        assertEquals(200,service.favorites(session).size());
        assertEquals(2,calls.size());
        assertTrue(calls.stream().allMatch(call->call.path.contains("user_id=eq."+ApiControllerTest.OWNER)&&call.authorization.equals("Bearer private-access")));
        service.setFavorite(ApiControllerTest.ID,true,session); // Duplicate save is idempotent.
        var body=json.readTree(calls.get(2).body);
        assertEquals(ApiControllerTest.OWNER,body.path("user_id").asText());
    }
    @Test void failedSaveCleansOnlyItsNewPhotoAndHidesBackendDetails() {
        var error=assertThrows(ApiProblem.class,()->service.save(ApiControllerTest.home(),false,new CloudSession(ApiControllerTest.auth()),new byte[]{1,2,3}));
        assertEquals("23514",error.code());
        var upload=calls.stream().filter(call->call.method.equals("POST")&&call.path.startsWith("/storage/")).findFirst().orElseThrow();
        var cleanup=calls.stream().filter(call->call.method.equals("DELETE")&&call.path.startsWith("/storage/")).findFirst().orElseThrow();
        assertTrue(upload.path.startsWith("/storage/v1/object/listing-photos/"+ApiControllerTest.OWNER+"/"+ApiControllerTest.ID+"/"));
        assertTrue(cleanup.body.contains(upload.path.substring("/storage/v1/object/listing-photos/".length())));
    }
    @Test void successfulReplacementReturnsTheUploadedPhotoAndRemovesOnlyTheOldPhoto() {
        failSave=false;
        var row=new LinkedHashMap<>(ApiControllerTest.home().toRow());
        String old=ApiControllerTest.OWNER+"/"+ApiControllerTest.ID+"/old.jpg";row.put("photo_path",old);
        var saved=service.save(com.diar.shared.Listing.fromRow(row),true,new CloudSession(ApiControllerTest.auth()),new byte[]{1,2,3});
        assertTrue(saved.getPhotoPath().startsWith(ApiControllerTest.OWNER+"/"+ApiControllerTest.ID+"/"));
        assertNotEquals(old,saved.getPhotoPath());
        var cleanup=calls.stream().filter(call->call.method.equals("DELETE")&&call.path.startsWith("/storage/")).findFirst().orElseThrow();
        assertTrue(cleanup.body.contains(old));assertFalse(cleanup.body.contains(saved.getPhotoPath()));
        assertTrue(calls.stream().filter(call->call.method.equals("PATCH")).allMatch(call->call.path.contains("owner_id=eq."+ApiControllerTest.OWNER)));
    }
    @Test void expiredSessionRefreshesBeforeWritesAndOtherOwnerIsRejected() {
        var data=new HashMap<>(ApiControllerTest.auth());data.put("expires_in",0);var session=new CloudSession(data);
        service.setFavorite(ApiControllerTest.ID,false,session);
        assertTrue(calls.get(0).path.contains("grant_type=refresh_token"));
        var stranger=new HashMap<>(ApiControllerTest.auth());stranger.put("user",Map.of("id",UUID.randomUUID().toString(),"email","other@example.invalid"));
        assertEquals(403,assertThrows(ApiProblem.class,()->service.owned(ApiControllerTest.ID,new CloudSession(stranger))).status());
        assertTrue(calls.stream().noneMatch(call->call.method.equals("PATCH")));
    }
}
