package com.securevault.common;

import java.util.UUID;

public record AccountPrincipal(UUID userId, UUID sessionId, UUID deviceId, String username, String email) {}
