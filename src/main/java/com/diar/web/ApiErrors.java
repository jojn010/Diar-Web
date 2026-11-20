package com.diar.web;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import java.util.Map;

@RestControllerAdvice
public class ApiErrors {
    @ExceptionHandler(ApiProblem.class) ResponseEntity<?> problem(ApiProblem error, jakarta.servlet.http.HttpServletRequest request) {
        if (error.status()==401 && request.getSession(false)!=null) request.getSession(false).removeAttribute("cloud");
        int status=error.status(); if(status<400 || status>599) status=502;
        return ResponseEntity.status(status).body(Map.of("code",error.code()));
    }
    @ExceptionHandler({IllegalArgumentException.class,MethodArgumentNotValidException.class,
        org.springframework.http.converter.HttpMessageNotReadableException.class})
    ResponseEntity<?> invalid(Exception error) { return ResponseEntity.badRequest().body(Map.of("code","invalid_input")); }
    @ExceptionHandler(MaxUploadSizeExceededException.class) ResponseEntity<?> photo(Exception error) {
        return ResponseEntity.status(413).body(Map.of("code","photo_too_large"));
    }
}
