package com.diar.web;

import com.diar.shared.Listing;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.*;

@RestController
@RequestMapping("/api")
public class ApiController {
    private final SupabaseService cloud;
    private final ObjectMapper json;
    private final PhotoProcessor photos;
    public ApiController(SupabaseService cloud,ObjectMapper json,PhotoProcessor photos) { this.cloud=cloud; this.json=json; this.photos=photos; }
    private CloudSession session(HttpSession session) { return (CloudSession)session.getAttribute("cloud"); }
    private CloudSession required(HttpSession session) {
        CloudSession user=session(session);
        if(user==null) throw new ApiProblem(401,"sign_in_required");
        return user;
    }
    public record AuthRequest(@Email @NotBlank @Size(max=254) String email,
                              @NotBlank @Size(min=6,max=128) String password, @Size(max=100) String name) { }
    @GetMapping("/health") Map<String,String> health() { return Map.of("status","up"); }
    @GetMapping("/session") Map<String,Object> state(HttpSession session,CsrfToken csrf) {
        CloudSession user=session(session);
        return Map.of("configured",cloud.enabled(),"csrf",csrf.getToken(),"user",user==null?Map.of():user.user());
    }
    @PostMapping({"/auth/login","/auth/signup"}) Map<String,Object> login(@Valid @RequestBody AuthRequest input,HttpServletRequest request) {
        boolean signup=request.getRequestURI().endsWith("/signup");
        String name=input.name()==null?"":input.name().trim();
        if(signup && name.length()<2) throw new ApiProblem(400,"invalid_name");
        var result=cloud.authenticate(input.email().trim(),input.password(),name,signup);
        if(!result.containsKey("access_token")) {
            request.getSession().removeAttribute("cloud");
            return Map.of("confirmationRequired",true);
        }
        var user=new CloudSession(result);
        request.getSession(); request.changeSessionId(); request.getSession().setAttribute("cloud",user);
        return Map.of("user",user.user(),"confirmationRequired",false);
    }
    @PostMapping("/auth/logout") Map<String,Object> logout(HttpSession session) {
        CloudSession user=session(session); session.invalidate(); cloud.signOut(user); return Map.of("ok",true);
    }
    private Map<String,Object> view(Listing listing) {
        var row=new LinkedHashMap<>(listing.toRow());
        row.put("photo_url",listing.getPhotoPath().isEmpty()?"":cloud.photoUrl(listing.getPhotoPath()));
        return row;
    }
    @GetMapping("/listings") List<Map<String,Object>> listings() { return cloud.listings().stream().map(this::view).toList(); }
    @GetMapping("/listings/{id}") Map<String,Object> detail(@PathVariable String id) { return view(cloud.find(id)); }
    @RequestMapping(value={"/listings", "/listings/{id}"},method={RequestMethod.POST,RequestMethod.PUT},consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    Map<String,Object> save(@PathVariable(required=false) String id,@RequestParam("listing") String raw,
                           @RequestPart(value="photo",required=false) MultipartFile photo,HttpSession session,HttpServletRequest request) {
        CloudSession user=required(session);
        try {
            boolean existing=request.getMethod().equals("PUT");
            if(existing && id==null) throw new ApiProblem(400,"invalid_input");
            if(!existing && id!=null) throw new ApiProblem(405,"invalid_input");
            Listing previous=existing?cloud.owned(id,user):null;
            var payload=json.readValue(raw,new TypeReference<Map<String,Object>>(){});
            String listingId=existing?id:Objects.toString(payload.get("id"),""); UUID.fromString(listingId);
            payload.put("id",listingId); payload.put("owner_id",user.userId());
            payload.put("photo_path",previous==null?"":previous.getPhotoPath());
            Listing listing=Listing.fromRow(payload);
            return view(cloud.save(listing,existing,user,photos.jpeg(photo)));
        } catch(ApiProblem problem) { throw problem; }
        catch(Exception invalid) { throw new ApiProblem(400,"invalid_listing"); }
    }
    @DeleteMapping("/listings/{id}") Map<String,Boolean> delete(@PathVariable String id,HttpSession session) {
        cloud.delete(id,required(session)); return Map.of("ok",true);
    }
    @GetMapping("/favorites") Set<String> favorites(HttpSession session) {
        return session(session)==null?Set.of():cloud.favorites(required(session));
    }
    public record FavoriteRequest(boolean saved) { }
    @PutMapping("/favorites/{id}") Map<String,Boolean> favorite(@PathVariable String id,@RequestBody FavoriteRequest input,HttpSession session) {
        cloud.setFavorite(id,input.saved(),required(session)); return Map.of("saved",input.saved());
    }
}
