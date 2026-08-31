package com.aitrading.api;

import com.aitrading.auth.*;
import java.util.Arrays;
import java.util.HashSet;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {
    @Bean
    PasswordEncoder passwordEncoder() { return new Argon2PasswordEncoder(16, 32, 1, 19456, 2); }

    @Bean
    WebSecurityCustomizer rejectedRequests() {
        return web -> web.requestRejectedHandler((request, response, exception) ->
                ApiErrors.write(request, response, 400, ApiErrors.Code.INVALID_REQUEST));
    }

    @Bean
    SecurityFilterChain apiSecurity(HttpSecurity http, UserRepository users, AuthRateLimiter limits,
            @Value("${aitrading.allowed-origins}") String origins) throws Exception {
        return http
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/api/health", "/api/auth/csrf").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login", "/api/auth/logout").permitAll()
                        .requestMatchers("/api/auth/me", "/api/auth/profile", "/api/auth/password").authenticated()
                        .requestMatchers("/api/conversations", "/api/conversations/**").authenticated()
                        .requestMatchers("/api/dsl/schema", "/api/dsl/capabilities", "/api/dsl/validate").authenticated()
                        .requestMatchers("/api/datasets", "/api/datasets/**").authenticated()
                        .requestMatchers("/api/strategies", "/api/strategies/**").authenticated()
                        .anyRequest().denyAll())
                .csrf(Customizer.withDefaults())
                .addFilterBefore(new AuthInputFilter(new HashSet<>(Arrays.asList(origins.split(",")))), CsrfFilter.class)
                .addFilterBefore(new AuthGuardFilter(users, limits), UsernamePasswordAuthenticationFilter.class)
                .formLogin(form -> form.loginPage("/api/auth/login").loginProcessingUrl("/api/auth/login")
                        .usernameParameter("email")
                        .successHandler((request, response, authentication) -> response.setStatus(204))
                        .failureHandler((request, response, exception) ->
                                ApiErrors.write(request, response, 401, ApiErrors.Code.UNAUTHORIZED)))
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(logout -> logout.logoutUrl("/api/auth/logout").invalidateHttpSession(true)
                        .clearAuthentication(true).deleteCookies("SESSION")
                        .logoutSuccessHandler((request, response, authentication) -> response.setStatus(204)))
                .sessionManagement(session -> session.sessionFixation(fixation -> fixation.changeSessionId()))
                .requestCache(AbstractHttpConfigurer::disable)
                .headers(headers -> headers
                        .contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'none'; frame-ancestors 'none'")))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, exception) ->
                                ApiErrors.write(request, response, 401, ApiErrors.Code.UNAUTHORIZED))
                        .accessDeniedHandler((request, response, exception) ->
                                ApiErrors.write(request, response, 403, ApiErrors.Code.FORBIDDEN)))
                .build();
    }
}
