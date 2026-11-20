package com.diar.web;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(exclude=org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration.class)
public class DiarApplication {
    public static void main(String[] args) { SpringApplication.run(DiarApplication.class, args); }
}
