package com.aitrading.api;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.dao.DataAccessException;
import org.springframework.transaction.TransactionException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    private ResponseEntity<ApiErrors.ErrorBody> error(HttpServletRequest request, int status, ApiErrors.Code code) {
        return ResponseEntity.status(status).body(new ApiErrors.ErrorBody(code.name(), ApiErrors.requestId(request)));
    }
    @ExceptionHandler({IllegalArgumentException.class, HttpMessageNotReadableException.class,
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
    public ResponseEntity<?> invalid(HttpServletRequest request) { return error(request, 400, ApiErrors.Code.INVALID_REQUEST); }
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<?> unauthorized(HttpServletRequest request) { return error(request, 401, ApiErrors.Code.UNAUTHORIZED); }
    @ExceptionHandler(ResourceFailure.class)
    public ResponseEntity<?> resource(HttpServletRequest request, ResourceFailure failure) {
        return error(request, failure.status(), failure.status() == 404 ? ApiErrors.Code.NOT_FOUND : ApiErrors.Code.CONFLICT);
    }
    @ExceptionHandler({DataAccessException.class, TransactionException.class})
    public ResponseEntity<?> unavailable(HttpServletRequest request) { return error(request, 503, ApiErrors.Code.UNAVAILABLE); }
}
