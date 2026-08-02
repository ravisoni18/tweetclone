<?php
// config/firebase.php - Development-friendly Firebase authentication

class SimpleAuth {
    public function verifyToken($authHeader) {
        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            error_log("❌ Invalid auth header format");
            return false;
        }
        
        $token = substr($authHeader, 7);
        error_log("🔍 Processing token, length: " . strlen($token));
        
        // Development token for testing
        if ($token === 'dev-token') {
            error_log("✅ Dev token accepted");
            return [
                'uid' => 'dev-user-123',
                'email' => 'dev@example.com',
                'name' => 'Developer'
            ];
        }
        
        try {
            // Parse JWT token structure
            $parts = explode('.', $token);
            if (count($parts) !== 3) {
                error_log("❌ Invalid JWT structure, parts: " . count($parts));
                return false;
            }
            
            // Decode payload (skip signature verification for development)
            $payload = json_decode(base64_decode($this->base64UrlDecode($parts[1])), true);
            
            if (!$payload) {
                error_log("❌ Failed to decode JWT payload");
                return false;
            }
            
            error_log("✅ JWT decoded successfully");
            error_log("📋 JWT payload keys: " . implode(', ', array_keys($payload)));
            
            // Log some key fields for debugging
            if (isset($payload['iss'])) error_log("🏢 Issuer: " . $payload['iss']);
            if (isset($payload['aud'])) error_log("🎯 Audience: " . $payload['aud']);
            if (isset($payload['exp'])) error_log("⏰ Expires: " . date('Y-m-d H:i:s', $payload['exp']));
            
            // Basic expiration check
            if (isset($payload['exp']) && $payload['exp'] < time()) {
                error_log("❌ Token expired at: " . date('Y-m-d H:i:s', $payload['exp']));
                return false;
            }
            
            // Extract user information from various possible fields
            $uid = $payload['user_id'] ?? $payload['sub'] ?? $payload['uid'] ?? null;
            $email = $payload['email'] ?? null;
            $name = $payload['name'] ?? $payload['display_name'] ?? 'User';
            $picture = $payload['picture'] ?? null;
            $emailVerified = $payload['email_verified'] ?? false;
            
            error_log("👤 Extracted UID: " . ($uid ?? 'NONE'));
            error_log("📧 Extracted Email: " . ($email ?? 'NONE'));
            
            if (!$uid) {
                error_log("❌ No UID found in token");
                // For development, create a UID from the token if none exists
                $uid = 'token_' . substr(md5($token), 0, 8);
                error_log("🔧 Generated development UID: " . $uid);
            }
            
            $result = [
                'uid' => $uid,
                'email' => $email,
                'name' => $name,
                'picture' => $picture,
                'email_verified' => $emailVerified
            ];
            
            error_log("✅ Token verification successful for: " . $uid);
            return $result;
            
        } catch (Exception $e) {
            error_log("❌ Token verification error: " . $e->getMessage());
            error_log("🔧 Stack trace: " . $e->getTraceAsString());
            return false;
        }
    }
    
    private function base64UrlDecode($data) {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }
        return base64_decode(strtr($data, '-_', '+/'));
    }
}

// Enhanced auth class with better Firebase support
class FirebaseAuth {
    private $projectId;
    
    public function __construct($projectId = null) {
        $this->projectId = $projectId;
    }
    
    public function verifyToken($authHeader) {
        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            return false;
        }
        
        $token = substr($authHeader, 7);
        
        try {
            // Parse JWT
            $parts = explode('.', $token);
            if (count($parts) !== 3) {
                return false;
            }
            
            $header = json_decode(base64_decode($this->base64UrlDecode($parts[0])), true);
            $payload = json_decode(base64_decode($this->base64UrlDecode($parts[1])), true);
            
            if (!$header || !$payload) {
                return false;
            }
            
            // For development, skip signature verification
            // In production, you'd verify with Firebase public keys
            
            // Check if it's a Firebase token
            if (isset($payload['iss']) && strpos($payload['iss'], 'securetoken.google.com') !== false) {
                // Firebase ID token
                return [
                    'uid' => $payload['user_id'] ?? $payload['sub'],
                    'email' => $payload['email'] ?? null,
                    'name' => $payload['name'] ?? $payload['display_name'] ?? 'User',
                    'picture' => $payload['picture'] ?? null,
                    'email_verified' => $payload['email_verified'] ?? false
                ];
            }
            
            // Generic JWT
            return [
                'uid' => $payload['sub'] ?? $payload['user_id'],
                'email' => $payload['email'] ?? null,
                'name' => $payload['name'] ?? 'User'
            ];
            
        } catch (Exception $e) {
            error_log("Firebase auth error: " . $e->getMessage());
            return false;
        }
    }
    
    private function base64UrlDecode($data) {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }
        return base64_decode(strtr($data, '-_', '+/'));
    }
}

// Factory function
function createAuthHandler($useFirebase = false) {
    if ($useFirebase) {
        return new FirebaseAuth();
    }
    return new SimpleAuth();
}
?>