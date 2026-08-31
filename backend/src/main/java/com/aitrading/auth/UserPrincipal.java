package com.aitrading.auth;

import java.util.List;
import java.util.UUID;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;

/** Server-only principal. ProviderManager erases the inherited password before session storage. */
public final class UserPrincipal extends User {
    private static final long serialVersionUID = 1L;
    private final UUID id;
    private final long credentialVersion;

    public UserPrincipal(UUID id, String email, String hash, long version) {
        super(email, hash, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        this.id = id;
        this.credentialVersion = version;
    }

    public UUID id() { return id; }
    public long credentialVersion() { return credentialVersion; }
}
