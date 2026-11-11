package com.securevault.threat;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ConfiguredLocationProvider implements LocationProvider {
    private final String defaultCountry;

    public ConfiguredLocationProvider() {
        this("");
    }

    public ConfiguredLocationProvider(@Value("${security.threat.default-country:}") String defaultCountry) {
        this.defaultCountry = defaultCountry != null ? defaultCountry : "";
    }

    @Override
    public String resolveCountry(String ip) {
        return defaultCountry;
    }
}

