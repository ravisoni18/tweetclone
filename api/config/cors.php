<?php
// config/cors.php - Updated for API subfolder structure

function setupCors() {
    // Allow from any origin
    if (isset($_SERVER['HTTP_ORIGIN'])) {
        header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Max-Age: 86400');    // cache for 1 day
    }

    // Access-Control headers are received during OPTIONS requests
    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD']))
            header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");

        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']))
            header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");

        exit(0);
    }
}

function sendResponse($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function sendError($message, $status = 400) {
    sendResponse(['error' => $message], $status);
}

function getRequestData() {
    $method = $_SERVER['REQUEST_METHOD'];
    $data = [];
    
    if ($method === 'GET') {
        $data = $_GET;
    } else {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true) ?: [];
        
        // Merge with POST data for form submissions
        $data = array_merge($data, $_POST);
    }
    
    return $data;
}

function generateUUID() {
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

function validateRequired($data, $required) {
    $missing = [];
    foreach ($required as $field) {
        if (!isset($data[$field]) || empty($data[$field])) {
            $missing[] = $field;
        }
    }
    
    if (!empty($missing)) {
        sendError('Missing required fields: ' . implode(', ', $missing));
    }
}

// Updated for API subfolder structure
function uploadImage($file, $folder = 'uploads') {
    if (!isset($file) || $file['error'] !== UPLOAD_ERR_OK) {
        return false;
    }
    
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!in_array($file['type'], $allowedTypes)) {
        throw new Exception('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
    }
    
    if ($file['size'] > 5 * 1024 * 1024) { // 5MB limit
        throw new Exception('File size too large. Maximum 5MB allowed.');
    }
    
    // Updated path for API subfolder - files are stored in api/uploads/
    $uploadDir = __DIR__ . "/../{$folder}/";
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }
    
    $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = generateUUID() . '.' . $extension;
    $filepath = $uploadDir . $filename;
    
    if (move_uploaded_file($file['tmp_name'], $filepath)) {
        // Return web-accessible path (relative to domain root)
        return "api/{$folder}/{$filename}";
    }
    
    return false;
}

function sanitizeInput($data) {
    if (is_array($data)) {
        return array_map('sanitizeInput', $data);
    }
    return htmlspecialchars(strip_tags(trim($data)));
}

function formatTimeAgo($datetime) {
    $now = new DateTime();
    $ago = new DateTime($datetime);
    $diff = $now->diff($ago);
    
    if ($diff->y > 0) return $diff->y . 'y';
    if ($diff->m > 0) return $diff->m . 'm';
    if ($diff->d > 0) return $diff->d . 'd';
    if ($diff->h > 0) return $diff->h . 'h';
    if ($diff->i > 0) return $diff->i . 'm';
    return 'now';
}

// API-specific utility functions
function logApiRequest() {
    $logData = [
        'timestamp' => date('Y-m-d H:i:s'),
        'method' => $_SERVER['REQUEST_METHOD'],
        'uri' => $_SERVER['REQUEST_URI'],
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
    ];
    
    error_log('API Request: ' . json_encode($logData));
}

function validateApiKey($apiKey = null) {
    // Simple API key validation (implement your own logic)
    if ($apiKey && $apiKey !== 'your-api-key') {
        sendError('Invalid API key', 401);
    }
}

function rateLimitCheck($identifier, $maxRequests = 100, $timeWindow = 3600) {
    // Simple rate limiting implementation
    // In production, use Redis or database for this
    $rateFile = sys_get_temp_dir() . "/rate_limit_" . md5($identifier);
    
    if (file_exists($rateFile)) {
        $data = json_decode(file_get_contents($rateFile), true);
        $currentTime = time();
        
        if ($currentTime - $data['start_time'] < $timeWindow) {
            if ($data['count'] >= $maxRequests) {
                sendError('Rate limit exceeded. Try again later.', 429);
            }
            $data['count']++;
        } else {
            $data = ['start_time' => $currentTime, 'count' => 1];
        }
    } else {
        $data = ['start_time' => time(), 'count' => 1];
    }
    
    file_put_contents($rateFile, json_encode($data));
}
?>