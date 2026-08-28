package com.flowforge.security;

import com.flowforge.user.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.Jws;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class JwtService {

    private final PrivateKey signingKey;
    private final PublicKey verificationKey;
    private final long expirationMs;
    private final String issuer;
    private final String audience;
    private final String keyId;

    @Autowired
    public JwtService(@Value("${flowforge.jwt.private-key-path}") String privateKeyPath,
                      @Value("${flowforge.jwt.public-key-path}") String publicKeyPath,
                      @Value("${flowforge.jwt.expiration-ms}") long expirationMs,
                      @Value("${flowforge.jwt.issuer}") String issuer,
                      @Value("${flowforge.jwt.audience}") String audience,
                      @Value("${flowforge.jwt.key-id}") String keyId) {
                this(loadKeyPair(privateKeyPath, publicKeyPath), expirationMs, issuer, audience, keyId);
    }

    JwtService(KeyPair keyPair, long expirationMs, String issuer, String audience, String keyId) {
        this(keyPair.getPrivate(), keyPair.getPublic(), expirationMs, issuer, audience, keyId);
    }

    private JwtService(PrivateKey signingKey, PublicKey verificationKey, long expirationMs,
                       String issuer, String audience, String keyId) {
        this.signingKey = signingKey;
        this.verificationKey = verificationKey;
        this.expirationMs = expirationMs;
        this.issuer = requireText(issuer, "issuer");
        this.audience = requireText(audience, "audience");
        this.keyId = requireText(keyId, "keyId");
    }

    public String generateToken(User user) {
        Date issuedAt = new Date();
        return Jwts.builder()
                .header().keyId(keyId).and()
                .subject(user.getUsername())
                .claim("role", user.getRole().name())
                .issuedAt(issuedAt)
                .expiration(new Date(issuedAt.getTime() + expirationMs))
                .issuer(issuer)
                .audience().add(audience).and()
                .signWith(signingKey, Jwts.SIG.RS256)
                .compact();
    }

    public Claims parseToken(String token) {
        Jws<Claims> parsed = parser().parseSignedClaims(token);
        if (!"RS256".equals(parsed.getHeader().getAlgorithm()) || parsed.getHeader().getKeyId() == null) {
            throw new IllegalArgumentException("JWT must use RS256 and include kid");
        }
        Claims claims = parsed.getPayload();
        if (claims.getSubject() == null || claims.getSubject().isBlank()) {
            throw new IllegalArgumentException("JWT subject is required");
        }
        return claims;
    }

    public Map<String, Object> publicJwk() {
        java.security.interfaces.RSAPublicKey rsaKey = (java.security.interfaces.RSAPublicKey) verificationKey;
        Map<String, Object> jwk = new LinkedHashMap<>();
        jwk.put("kty", "RSA");
        jwk.put("use", "sig");
        jwk.put("alg", "RS256");
        jwk.put("kid", keyId);
        jwk.put("n", encodeUnsigned(rsaKey.getModulus().toByteArray()));
        jwk.put("e", encodeUnsigned(rsaKey.getPublicExponent().toByteArray()));
        return Map.copyOf(jwk);
    }

    private JwtParser parser() {
        return Jwts.parser()
                .verifyWith(verificationKey)
                .requireIssuer(issuer)
                .requireAudience(audience)
                .build()
                ;
    }

    private static PrivateKey loadPrivateKey(String path) {
        try {
            byte[] der = decodePem(Files.readString(Path.of(path)), "PRIVATE KEY");
            return KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(der));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to load RSA private key from " + path, exception);
        }
    }

    private static KeyPair loadKeyPair(String privateKeyPath, String publicKeyPath) {
        if ((privateKeyPath == null || privateKeyPath.isBlank())
                && (publicKeyPath == null || publicKeyPath.isBlank())) {
            try {
                KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
                generator.initialize(2048);
                return generator.generateKeyPair();
            } catch (Exception exception) {
                throw new IllegalStateException("Unable to generate test RSA key pair", exception);
            }
        }
        return new KeyPair(loadPublicKey(publicKeyPath), loadPrivateKey(privateKeyPath));
    }

    private static PublicKey loadPublicKey(String path) {
        try {
            byte[] der = decodePem(Files.readString(Path.of(path)), "PUBLIC KEY");
            return KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(der));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to load RSA public key from " + path, exception);
        }
    }

    private static byte[] decodePem(String pem, String type) {
        String normalized = pem.replace("-----BEGIN " + type + "-----", "")
                .replace("-----END " + type + "-----", "")
                .replaceAll("\\s", "");
        return Base64.getDecoder().decode(normalized);
    }

    private static String encodeUnsigned(byte[] value) {
        int offset = value.length > 1 && value[0] == 0 ? 1 : 0;
        byte[] unsigned = java.util.Arrays.copyOfRange(value, offset, value.length);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(unsigned);
    }

    private static String requireText(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(name + " must not be blank");
        }
        return value;
    }
}
