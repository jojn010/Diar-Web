package com.diar.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class WebController {
    @GetMapping({"/", "/listings", "/listing/{id}", "/favorites", "/my-listings", "/list-home", "/account"})
    String website() { return "forward:/index.html"; }
}
