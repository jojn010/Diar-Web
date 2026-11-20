package com.diar.web;

import com.diar.shared.Listing;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import java.math.BigDecimal;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.hamcrest.Matchers.*;

@WebMvcTest({ApiController.class,WebController.class})
@Import({SecurityConfig.class,ApiErrors.class,PhotoProcessor.class})
class ApiControllerTest {
    static final String OWNER="f592f18e-0225-49f4-b012-9d9e419ae709", ID="4f4bc2e2-3e24-4e44-9450-c8a1cd0d095a";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockitoBean SupabaseService cloud;
    static Map<String,Object> auth() {return Map.of("access_token","private-access","refresh_token","private-refresh","expires_in",3600,"user",Map.of("id",OWNER,"email","test@example.invalid","user_metadata",Map.of("full_name","Test")));}
    static Listing home() {return new Listing(ID,OWNER,"بيت الحديقة","القدس",new BigDecimal("125.50"),73500,"<script>not executable</script>",true,"sale","house",2,31.78,35.22,"map","");}
    MockHttpSession signedIn() {var session=new MockHttpSession();session.setAttribute("cloud",new CloudSession(auth()));return session;}
    @Test void publicHomesUseSharedSnakeCaseContract() throws Exception {
        when(cloud.listings()).thenReturn(List.of(home()));when(cloud.photoUrl(anyString())).thenReturn("");
        mvc.perform(get("/api/listings")).andExpect(status().isOk()).andExpect(jsonPath("$[0].title").value("بيت الحديقة")).andExpect(jsonPath("$[0].price").value(73500)).andExpect(jsonPath("$[0].owner_id").value(OWNER)).andExpect(jsonPath("$[0].ownerId").doesNotExist());
    }
    @Test void writesRequireCsrfAndAnAuthenticatedAccount() throws Exception {
        mvc.perform(put("/api/favorites/"+ID).contentType("application/json").content("{\"saved\":true}")).andExpect(status().isForbidden());
        mvc.perform(put("/api/favorites/"+ID).with(csrf()).contentType("application/json").content("{\"saved\":true}")).andExpect(status().isUnauthorized());
        verifyNoInteractions(cloud);
    }
    @Test void loginNeverReturnsPasswordsOrTokensToTheBrowser() throws Exception {
        when(cloud.authenticate(anyString(),anyString(),anyString(),eq(false))).thenReturn(auth());
        var result=mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json").content("{\"email\":\"test@example.invalid\",\"password\":\"secret-password\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.user.id").value(OWNER)).andExpect(content().string(not(containsString("private-access")))).andExpect(content().string(not(containsString("secret-password")))).andReturn();
        var session=(MockHttpSession)result.getRequest().getSession();
        mvc.perform(get("/api/session").session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.csrf").isString()).andExpect(content().string(not(containsString("private-refresh"))));
    }
    @Test void authenticatedSaveOverwritesForgedOwnerAndRejectsFractionalPrice() throws Exception {
        when(cloud.save(any(),eq(false),any(),isNull())).thenAnswer(invocation->invocation.getArgument(0));
        var row=new LinkedHashMap<>(home().toRow());row.put("owner_id","forged-owner");
        mvc.perform(multipart("/api/listings").param("listing",json.writeValueAsString(row)).session(signedIn()).with(csrf())).andExpect(status().isOk()).andExpect(jsonPath("$.owner_id").value(OWNER));
        row.put("price",1.5);
        mvc.perform(multipart("/api/listings").param("listing",json.writeValueAsString(row)).session(signedIn()).with(csrf())).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("invalid_listing"));
        verify(cloud,times(1)).save(any(),eq(false),any(),isNull());
    }
    @Test void ownerCheckStopsAnotherUsersEditBeforeAnyWrite() throws Exception {
        when(cloud.owned(eq(ID),any())).thenThrow(new ApiProblem(403,"not_owner"));
        mvc.perform(multipart("/api/listings/"+ID).with(req->{req.setMethod("PUT");return req;}).param("listing",json.writeValueAsString(home().toRow())).session(signedIn()).with(csrf())).andExpect(status().isForbidden());
        verify(cloud,never()).save(any(),anyBoolean(),any(),any());
    }
    @Test void invalidCloudSessionIsClearedWithoutExposingItsTokens() throws Exception {
        var session=signedIn();
        when(cloud.favorites(any())).thenThrow(new ApiProblem(401,"session_expired"));
        mvc.perform(get("/api/favorites").session(session)).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("session_expired"));
        org.junit.jupiter.api.Assertions.assertNull(session.getAttribute("cloud"));
        mvc.perform(get("/api/session").session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.user.id").doesNotExist());
    }
    @Test void deepLinksRenderTheAppAndSecurityHeadersRestrictScripts() throws Exception {
        mvc.perform(get("/listing/"+ID)).andExpect(status().isOk()).andExpect(forwardedUrl("/index.html")).andExpect(header().string("Content-Security-Policy",containsString("script-src 'self'")));
    }
}
