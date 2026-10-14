
package com.medistock.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http)
            throws Exception {

        http
                .csrf(csrf -> csrf.disable())

                .cors(cors ->
                        cors.configurationSource(corsConfigurationSource())
                )

                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )

                .authorizeHttpRequests(auth -> auth

                        // Allow CORS preflight requests
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // Public endpoints
                        .requestMatchers(
                                "/",
                                "/health",
                                "/api/auth/register",
                                "/api/auth/login",
                                "/error",
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs/**"
                        ).permitAll()

                        // Authenticated users
                        .requestMatchers("/api/auth/me").authenticated()

                        // Medicine permissions
                        .requestMatchers(HttpMethod.GET, "/api/medicines/**")
                        .hasAnyRole("ADMIN", "PHARMACIST", "STAFF")

                        .requestMatchers(HttpMethod.POST, "/api/medicines")
                        .hasAnyRole("ADMIN", "PHARMACIST")

                        .requestMatchers(HttpMethod.PUT, "/api/medicines/**")
                        .hasAnyRole("ADMIN", "PHARMACIST")

                        .requestMatchers(HttpMethod.DELETE, "/api/medicines/**")
                        .hasRole("ADMIN")

                        // Supplier permissions
                        .requestMatchers(HttpMethod.GET, "/api/suppliers/**")
                        .hasAnyRole("ADMIN", "PHARMACIST", "STAFF")

                        .requestMatchers(HttpMethod.POST, "/api/suppliers")
                        .hasAnyRole("ADMIN", "PHARMACIST")

                        .requestMatchers(HttpMethod.PUT, "/api/suppliers/**")
                        .hasAnyRole("ADMIN", "PHARMACIST")

                        .requestMatchers(HttpMethod.DELETE, "/api/suppliers/**")
                        .hasRole("ADMIN")

                        // Inventory permissions
                        .requestMatchers(HttpMethod.GET, "/api/inventory/**")
                        .hasAnyRole("ADMIN", "PHARMACIST", "STAFF")

                        .requestMatchers(HttpMethod.POST, "/api/inventory")
                        .hasAnyRole("ADMIN", "PHARMACIST")

                        .requestMatchers(HttpMethod.PUT, "/api/inventory/**")
                        .hasAnyRole("ADMIN", "PHARMACIST")

                        .requestMatchers(HttpMethod.DELETE, "/api/inventory/**")
                        .hasRole("ADMIN")

                        // All remaining endpoints require authentication
                        .anyRequest().authenticated()
                )

                .addFilterBefore(
                        jwtAuthenticationFilter,
                        UsernamePasswordAuthenticationFilter.class
                );

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {

        CorsConfiguration configuration = new CorsConfiguration();

        configuration.setAllowedOrigins(
                List.of(
                        "http://localhost:5173",
                        "https://integrated-medical-inventory.onrender.com"
                )
        );

        configuration.setAllowedMethods(
                List.of("GET", "POST", "PUT", "DELETE", "OPTIONS")
        );

        configuration.setAllowedHeaders(
                List.of("Authorization", "Content-Type")
        );

        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration("/**", configuration);

        return source;
    }
}
