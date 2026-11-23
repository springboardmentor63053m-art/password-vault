package com.securevault.threat;

public record DeviceMetadata(String category, String os, String browser) {
    public static DeviceMetadata parse(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return new DeviceMetadata("Unknown", "Unknown OS", "Unknown Browser");
        }
        String ua = userAgent.toLowerCase();
        String category = "Desktop";
        if (ua.contains("mobile") || ua.contains("android") || ua.contains("iphone")) {
            category = "Mobile";
        } else if (ua.contains("tablet") || ua.contains("ipad")) {
            category = "Tablet";
        }

        String os = "Unknown OS";
        if (ua.contains("windows")) os = "Windows";
        else if (ua.contains("mac os") || ua.contains("macos") || ua.contains("macintosh")) os = "macOS";
        else if (ua.contains("android")) os = "Android";
        else if (ua.contains("iphone") || ua.contains("ipad") || ua.contains("ios")) os = "iOS";
        else if (ua.contains("linux")) os = "Linux";

        String browser = "Unknown Browser";
        if (ua.contains("edg/") || ua.contains("edge/")) browser = "Edge";
        else if (ua.contains("chrome/") || ua.contains("crios/")) browser = "Chrome";
        else if (ua.contains("firefox/") || ua.contains("fxios/")) browser = "Firefox";
        else if (ua.contains("safari/") && !ua.contains("chrome")) browser = "Safari";

        return new DeviceMetadata(category, os, browser);
    }
}
