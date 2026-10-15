package com.medistock.service;

import com.medistock.dto.LoginRequest;
import com.medistock.dto.LoginResponse;
import com.medistock.dto.RegisterRequest;
import com.medistock.entity.Role;
import com.medistock.entity.User;
import com.medistock.repository.RoleRepository;
import com.medistock.repository.UserRepository;
import com.medistock.security.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class AuthService {

    private static final Logger log =
            LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder,
            JwtUtil jwtUtil
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    // REGISTER
    public String register(RegisterRequest request) {

        if (userRepository.existsByEmail(request.getEmail())) {
            return "Email already registered";
        }

        log.info("REGISTER: Role received");

        Role role = roleRepository.findByRoleName(request.getRole())
                .orElseThrow(() -> new RuntimeException("Role not found"));

        User user = new User();
        user.setName(request.getName());
        user.setEmail(request.getEmail());

        user.setPasswordHash(
                passwordEncoder.encode(request.getPassword())
        );

        user.setRole(role);
        userRepository.save(user);

        return "User registered successfully";
    }

    // LOGIN WITH PERFORMANCE TIMING
    public LoginResponse login(LoginRequest request) {


        long totalStart = System.nanoTime();

        long userLookupMs = 0;
        long passwordCheckMs = 0;
        long roleReadMs = 0;
        long jwtGenerationMs = 0;

        try {
            // 1. Find user in database
            long stepStart = System.nanoTime();

            Optional<User> userOptional =
                    userRepository.findByEmail(request.getEmail());

            userLookupMs = (System.nanoTime() - stepStart)
                    / 1_000_000;

            User user = userOptional.orElseThrow(
                    () -> new RuntimeException(
                            "Invalid email or password"
                    )
            );

            // 2. Verify password using BCrypt
            stepStart = System.nanoTime();

            boolean passwordMatches = passwordEncoder.matches(
                    request.getPassword(),
                    user.getPasswordHash()
            );

            passwordCheckMs = (System.nanoTime() - stepStart)
                    / 1_000_000;

            if (!passwordMatches) {
                throw new RuntimeException(
                        "Invalid email or password"
                );
            }

            // 3. Read role
            stepStart = System.nanoTime();

            String role = user.getRole() != null
                    ? user.getRole().getRoleName()
                    : null;

            roleReadMs = (System.nanoTime() - stepStart)
                    / 1_000_000;

            // 4. Generate JWT
            stepStart = System.nanoTime();

            String token = jwtUtil.generateToken(
                    user.getEmail(),
                    role
            );

            jwtGenerationMs = (System.nanoTime() - stepStart)
                    / 1_000_000;

            return new LoginResponse(
                    token,
                    user.getName(),
                    user.getEmail(),
                    role
            );

        } finally {
            long totalMs = (System.nanoTime() - totalStart)
                    / 1_000_000;

            log.info(
                    "LOGIN_TIMING total={}ms, userLookup={}ms, " +
                            "passwordCheck={}ms, roleRead={}ms, jwtGeneration={}ms",
                    totalMs,
                    userLookupMs,
                    passwordCheckMs,
                    roleReadMs,
                    jwtGenerationMs
            );
        }
    }
}