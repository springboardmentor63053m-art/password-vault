package com.securevault.common;

import jakarta.servlet.http.HttpServletRequest;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Resolves a client address only through explicitly trusted reverse proxies. */
@Component
public class ClientIpResolver {
    private static final int MAX_FORWARDED_HOPS = 20;
    private final List<IpNetwork> trustedProxies;

    public ClientIpResolver(@Value("${security.trusted-proxy-cidrs:}") String trustedProxyCidrs) {
        this.trustedProxies = parseNetworks(trustedProxyCidrs);
    }

    /** A safe resolver for stand-alone filter/controller instances: no proxy headers are trusted. */
    public static ClientIpResolver withoutTrustedProxies() {
        return new ClientIpResolver("");
    }

    public String resolve(HttpServletRequest request) {
        String remoteAddress = normalizeAddress(request.getRemoteAddr());
        if (remoteAddress == null) {
            return "unknown";
        }
        byte[] remoteBytes = addressBytes(remoteAddress);
        if (!isTrusted(remoteBytes)) {
            return remoteAddress;
        }

        List<String> forwardedAddresses = forwardedAddresses(request);
        if (forwardedAddresses.isEmpty() || forwardedAddresses.size() > MAX_FORWARDED_HOPS) {
            return remoteAddress;
        }
        List<byte[]> chain = new ArrayList<>(forwardedAddresses.size());
        for (String value : forwardedAddresses) {
            byte[] bytes = addressBytes(value);
            if (bytes == null) {
                // Ignore the complete header chain when any hop is malformed.
                return remoteAddress;
            }
            chain.add(bytes);
        }

        byte[] current = remoteBytes;
        for (int index = chain.size() - 1; index >= 0; index--) {
            if (!isTrusted(current)) {
                break;
            }
            current = chain.get(index);
        }
        return formatAddress(current);
    }

    private List<String> forwardedAddresses(HttpServletRequest request) {
        List<String> addresses = new ArrayList<>();
        Enumeration<String> values = request.getHeaders("X-Forwarded-For");
        while (values != null && values.hasMoreElements()) {
            for (String part : values.nextElement().split(",", -1)) {
                String value = part.trim();
                if (value.isEmpty()) {
                    return List.of();
                }
                addresses.add(value);
                if (addresses.size() > MAX_FORWARDED_HOPS) {
                    return addresses;
                }
            }
        }
        return addresses;
    }

    private boolean isTrusted(byte[] address) {
        if (address == null) {
            return false;
        }
        for (IpNetwork network : trustedProxies) {
            if (network.contains(address)) {
                return true;
            }
        }
        return false;
    }

    private static List<IpNetwork> parseNetworks(String configured) {
        List<IpNetwork> networks = new ArrayList<>();
        if (configured == null || configured.isBlank()) {
            return List.of();
        }
        for (String item : configured.split(",")) {
            String cidr = item.trim();
            if (cidr.isEmpty()) {
                continue;
            }
            String[] parts = cidr.split("/", -1);
            byte[] address = addressBytes(parts[0].trim());
            if (address == null) {
                throw new IllegalArgumentException("Invalid trusted proxy IP/CIDR: " + cidr);
            }
            int prefix = address.length * 8;
            if (parts.length > 2) {
                throw new IllegalArgumentException("Invalid trusted proxy IP/CIDR: " + cidr);
            }
            if (parts.length == 2) {
                try {
                    prefix = Integer.parseInt(parts[1]);
                } catch (NumberFormatException exception) {
                    throw new IllegalArgumentException("Invalid trusted proxy IP/CIDR: " + cidr, exception);
                }
            }
            if (prefix < 0 || prefix > address.length * 8) {
                throw new IllegalArgumentException("Invalid trusted proxy IP/CIDR: " + cidr);
            }
            networks.add(new IpNetwork(address, prefix));
        }
        return List.copyOf(networks);
    }

    private static String normalizeAddress(String value) {
        byte[] bytes = addressBytes(value);
        return bytes == null ? null : formatAddress(bytes);
    }

    private static byte[] addressBytes(String input) {
        if (input == null) {
            return null;
        }
        String value = input.trim();
        if (value.startsWith("[") && value.endsWith("]")) {
            value = value.substring(1, value.length() - 1);
        }
        if (value.isEmpty() || value.indexOf('%') >= 0) {
            return null;
        }
        boolean ipv4 = value.matches("[0-9]{1,3}(\\.[0-9]{1,3}){3}");
        boolean ipv6 = value.indexOf(':') >= 0 && value.matches("[0-9a-fA-F:.]+");
        if (!ipv4 && !ipv6) {
            return null;
        }
        try {
            byte[] bytes = InetAddress.getByName(value).getAddress();
            if (ipv6 && bytes.length == 4 && value.toLowerCase(Locale.ROOT).startsWith("::ffff:")) {
                return bytes;
            }
            if (ipv4 && bytes.length != 4) {
                return null;
            }
            if (ipv6 && bytes.length != 16) {
                return null;
            }
            return bytes;
        } catch (UnknownHostException exception) {
            return null;
        }
    }

    private static String formatAddress(byte[] bytes) {
        try {
            return InetAddress.getByAddress(bytes).getHostAddress();
        } catch (UnknownHostException exception) {
            return "unknown";
        }
    }

    private record IpNetwork(byte[] network, int prefixLength) {
        private boolean contains(byte[] address) {
            if (network.length != address.length) {
                return false;
            }
            int wholeBytes = prefixLength / 8;
            int remainingBits = prefixLength % 8;
            for (int index = 0; index < wholeBytes; index++) {
                if (network[index] != address[index]) {
                    return false;
                }
            }
            if (remainingBits == 0) {
                return true;
            }
            int mask = 0xff << (8 - remainingBits);
            return (network[wholeBytes] & mask) == (address[wholeBytes] & mask);
        }
    }
}
