package com.securevault.admin;

import java.util.UUID;

public record AdminPrincipal(UUID userId, UUID sessionId, UUID deviceId, String username, String email) {}
