package com.aitrading.auth;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    public record Registration(String email, String displayName, String password) { }
    public record NameChange(String displayName) { }
    public record PasswordChange(String currentPassword, String newPassword) { }
    public record Csrf(String headerName, String token) { }
    public record Acknowledgement(String status) { }

    public AuthController(AuthService auth) { this.auth = auth; }
    @GetMapping("/csrf")
    public Csrf csrf(CsrfToken token) { return new Csrf(token.getHeaderName(), token.getToken()); }

    @PostMapping("/register")
    public ResponseEntity<Acknowledgement> register(@RequestBody Registration registration) {
        auth.register(registration.email(), registration.displayName(), registration.password());
        return ResponseEntity.accepted().body(new Acknowledgement("REGISTRATION_RECEIVED"));
    }

    @GetMapping("/me")
    public UserRepository.Profile me(@AuthenticationPrincipal UserPrincipal user) { return auth.profile(user); }

    @PatchMapping("/profile")
    public UserRepository.Profile rename(@AuthenticationPrincipal UserPrincipal user, @RequestBody NameChange change) {
        return auth.rename(user, change.displayName());
    }

    @PostMapping("/password")
    public ResponseEntity<Void> password(@AuthenticationPrincipal UserPrincipal user, @RequestBody PasswordChange change,
                                        HttpServletRequest request) {
        auth.changePassword(user, change.currentPassword(), change.newPassword());
        if (request.getSession(false) != null) request.getSession(false).invalidate();
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }
}
