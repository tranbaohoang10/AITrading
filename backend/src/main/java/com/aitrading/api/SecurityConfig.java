package com.aitrading.api;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {
    @Bean
    UserDetailsService noDefaultAccounts() {
        return username -> { throw new UsernameNotFoundException("Authentication is not configured"); };
    }

    @Bean
    WebSecurityCustomizer rejectedRequests() {
        return web -> web.requestRejectedHandler((request, response, exception) ->
                ApiErrors.write(request, response, 400, ApiErrors.Code.INVALID_REQUEST));
    }

    @Bean
    SecurityFilterChain apiSecurity(HttpSecurity http) throws Exception {
        return http
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/api/health").permitAll()
                        .anyRequest().denyAll())
                .csrf(Customizer.withDefaults())
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
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
