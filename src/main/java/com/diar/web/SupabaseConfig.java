package com.diar.web;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.nio.file.*;
import java.net.URI;
import java.util.Properties;

@Configuration
public class SupabaseConfig {
    public record Settings(String url, String key) {
        public boolean enabled() { return url != null && !url.isBlank() && key != null && !key.isBlank(); }
    }
    @Bean Settings settings() throws Exception {
        Properties local = new Properties();
        for (Path path : new Path[]{Path.of("../diar/local.properties"), Path.of("local.properties")})
            if (Files.isRegularFile(path)) try (var input = Files.newInputStream(path)) { local.load(input); }
        String url = System.getenv().getOrDefault("SUPABASE_URL", local.getProperty("supabase.url", "")).replaceAll("/+$", "");
        String key = System.getenv().getOrDefault("SUPABASE_PUBLISHABLE_KEY", local.getProperty("supabase.publishableKey", ""));
        if (!url.isBlank() && (!"https".equals(URI.create(url).getScheme()) || URI.create(url).getHost() == null))
            throw new IllegalArgumentException("SUPABASE_URL must use HTTPS");
        if (key.startsWith("sb_secret_") || key.contains("service_role")) throw new IllegalArgumentException("Use a publishable key, not an admin key");
        return new Settings(url, key);
    }
}
