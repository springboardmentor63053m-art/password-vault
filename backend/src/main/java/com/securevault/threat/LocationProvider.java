package com.securevault.threat;

public interface LocationProvider {
    String resolveCountry(String ip);
}
