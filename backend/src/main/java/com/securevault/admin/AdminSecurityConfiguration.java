package com.securevault.admin;

import com.securevault.common.SecurityEventRecorder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class AdminSecurityConfiguration {
    @Bean
    AdminSessionAuthenticationFilter adminSessionAuthenticationFilter(JdbcTemplate jdbcTemplate,
            SecurityEventRecorder eventRecorder,
            @Value("${security.jwt.secret-base64}") String secretBase64) {
        return new AdminSessionAuthenticationFilter(jdbcTemplate, secretBase64, eventRecorder);
    }

    @Bean
    FilterRegistrationBean<AdminSessionAuthenticationFilter> disableServletFilterRegistration(
            AdminSessionAuthenticationFilter adminFilter) {
        FilterRegistrationBean<AdminSessionAuthenticationFilter> registration = new FilterRegistrationBean<>(adminFilter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    SecurityFilterChain secureVaultSecurityFilterChain(HttpSecurity http,
            AdminSessionAuthenticationFilter adminFilter) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .anyRequest().permitAll())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, exception) -> {
                            response.setStatus(401);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.getWriter().write("{\"code\":\"UNAUTHENTICATED\",\"message\":\"Sign in with an administrator account to continue.\"}");
                        })
                        .accessDeniedHandler((request, response, exception) -> {
                            response.setStatus(403);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.getWriter().write("{\"code\":\"ADMIN_REQUIRED\",\"message\":\"This dashboard is available only to administrator accounts.\"}");
                        }))
                .addFilterBefore(adminFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }
}
