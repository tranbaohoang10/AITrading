package com.aitrading.auth;

import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.session.jdbc.JdbcIndexedSessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JdbcIndexedSessionRepository sessions;

    public AuthService(UserRepository users, PasswordEncoder encoder, JdbcIndexedSessionRepository sessions) {
        this.users = users; this.encoder = encoder; this.sessions = sessions;
    }

    public static String checkedName(String value) {
        if (value == null) throw new IllegalArgumentException("Invalid name");
        String name = value.strip();
        if (name.isEmpty() || name.length() > 80 || name.codePoints().anyMatch(Character::isISOControl))
            throw new IllegalArgumentException("Invalid name");
        return name;
    }

    public static void checkedPassword(String value) {
        if (value == null || value.length() < 12 || value.length() > 128 || value.indexOf('\0') >= 0)
            throw new IllegalArgumentException("Invalid password");
    }

    public void register(String email, String displayName, String password) {
        String normalized = UserRepository.normalizeEmail(email);
        if (normalized.length() > 254 || !normalized.matches("[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+"))
            throw new IllegalArgumentException("Invalid email");
        String local = normalized.substring(0, normalized.indexOf('@'));
        String domain = normalized.substring(normalized.indexOf('@') + 1);
        if (local.length() > 64 || local.startsWith(".") || local.endsWith(".") || local.contains("..")
                || java.util.Arrays.stream(domain.split("\\.")).anyMatch(label -> label.length() > 63))
            throw new IllegalArgumentException("Invalid email");
        String name = checkedName(displayName);
        checkedPassword(password);
        users.register(normalized, name, encoder.encode(password));
    }

    public UserRepository.Profile profile(UserPrincipal principal) {
        return users.profile(principal.id()).orElseThrow(() -> new BadCredentialsException("Invalid session"));
    }

    public UserRepository.Profile rename(UserPrincipal principal, String name) {
        if (!users.rename(principal, checkedName(name))) throw new BadCredentialsException("Invalid session");
        return profile(principal);
    }

    @Transactional
    public void changePassword(UserPrincipal principal, String currentPassword, String newPassword) {
        checkedPassword(newPassword);
        if (currentPassword == null || currentPassword.length() > 128)
            throw new BadCredentialsException("Invalid credentials");
        var credential = users.credentials(principal.id()).orElseThrow(() -> new BadCredentialsException("Invalid session"));
        if (credential.version() != principal.credentialVersion() || !encoder.matches(currentPassword, credential.hash()))
            throw new BadCredentialsException("Invalid credentials");
        if (!users.changePassword(principal, encoder.encode(newPassword)))
            throw new BadCredentialsException("Invalid session");
        sessions.findByPrincipalName(principal.getUsername()).keySet().forEach(sessions::deleteById);
    }
}
