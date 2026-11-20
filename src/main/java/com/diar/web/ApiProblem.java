package com.diar.web;

public class ApiProblem extends RuntimeException {
    private final int status;
    private final String code;
    public ApiProblem(int status, String code) { super(code); this.status = status; this.code = code; }
    public int status() { return status; } public String code() { return code; }
}
