<?php
// api/index-simple.php - Minimal version to test routing

error_reporting(E_ALL);
ini_set('display_errors', 1);

// Basic CORS headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Handle OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Simple URL parsing
$request_uri = $_SERVER['REQUEST_URI'];
$path = parse_url($request_uri, PHP_URL_PATH);

// Log all requests for debugging
error_log("API Request: " . $request_uri . " | Path: " . $path . " | Method: " . $_SERVER['REQUEST_METHOD']);

// Remove /api/ from the path
$api_path = str_replace('/api/', '', $path);
$api_path = str_replace('/api', '', $api_path);
$api_path = trim($api_path, '/');

// Parse path parts
$path_parts = $api_path ? explode('/', $api_path) : [];
$endpoint = $path_parts[0] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Debug info
$debug_info = [
    'original_uri' => $request_uri,
    'parsed_path' => $path,
    'api_path' => $api_path,
    'path_parts' => $path_parts,
    'endpoint' => $endpoint,
    'method' => $method,
    'timestamp' => date('c')
];

try {
    switch ($endpoint) {
        case '':
        case null:
            echo json_encode([
                'message' => 'Welcome to Twitter Clone API! 🐦',
                'status' => 'working',
                'debug' => $debug_info,
                'available_endpoints' => [
                    'GET /' => 'This welcome message',
                    'GET /health' => 'Health check',
                    'GET /debug' => 'Debug information',
                    'GET /users/{id}' => 'Get user (will test)',
                    'POST /users' => 'Create user (will test)'
                ]
            ], JSON_PRETTY_PRINT);
            break;
            
        case 'health':
            echo json_encode([
                'status' => 'OK',
                'message' => 'API is healthy! 🎉',
                'debug' => $debug_info,
                'server_info' => [
                    'php_version' => phpversion(),
                    'server' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown'
                ]
            ], JSON_PRETTY_PRINT);
            break;
            
        case 'debug':
            echo json_encode([
                'message' => 'Debug Information',
                'request_debug' => $debug_info,
                'server_vars' => [
                    'REQUEST_METHOD' => $_SERVER['REQUEST_METHOD'],
                    'REQUEST_URI' => $_SERVER['REQUEST_URI'],
                    'SCRIPT_NAME' => $_SERVER['SCRIPT_NAME'],
                    'PATH_INFO' => $_SERVER['PATH_INFO'] ?? 'not set',
                    'QUERY_STRING' => $_SERVER['QUERY_STRING'] ?? 'not set',
                    'HTTP_HOST' => $_SERVER['HTTP_HOST']
                ],
                'headers' => getallheaders() ?: 'Headers not available'
            ], JSON_PRETTY_PRINT);
            break;
            
        case 'users':
            if (isset($path_parts[1])) {
                $userId = $path_parts[1];
                
                switch ($method) {
                    case 'GET':
                        echo json_encode([
                            'message' => 'GET User endpoint reached',
                            'user_id' => $userId,
                            'debug' => $debug_info,
                            'note' => 'This would fetch user data from database'
                        ], JSON_PRETTY_PRINT);
                        break;
                        
                    default:
                        http_response_code(405);
                        echo json_encode([
                            'error' => 'Method not allowed',
                            'method' => $method,
                            'endpoint' => $endpoint
                        ], JSON_PRETTY_PRINT);
                }
            } else {
                switch ($method) {
                    case 'POST':
                        echo json_encode([
                            'message' => 'POST Users endpoint reached',
                            'debug' => $debug_info,
                            'note' => 'This would create a new user'
                        ], JSON_PRETTY_PRINT);
                        break;
                        
                    case 'GET':
                        echo json_encode([
                            'message' => 'GET Users list endpoint',
                            'debug' => $debug_info,
                            'note' => 'This would list users'
                        ], JSON_PRETTY_PRINT);
                        break;
                        
                    default:
                        http_response_code(405);
                        echo json_encode([
                            'error' => 'Method not allowed',
                            'method' => $method
                        ], JSON_PRETTY_PRINT);
                }
            }
            break;
            
        case 'posts':
            $subEndpoint = $path_parts[1] ?? '';
            
            if ($subEndpoint === 'trending') {
                echo json_encode([
                    'message' => 'Trending posts endpoint',
                    'trending' => [],
                    'debug' => $debug_info
                ], JSON_PRETTY_PRINT);
            } else {
                echo json_encode([
                    'message' => 'Posts endpoint',
                    'sub_endpoint' => $subEndpoint,
                    'debug' => $debug_info
                ], JSON_PRETTY_PRINT);
            }
            break;
            
        default:
            http_response_code(404);
            echo json_encode([
                'error' => 'Endpoint not found',
                'endpoint' => $endpoint,
                'debug' => $debug_info,
                'suggestion' => 'Check available endpoints at /api/'
            ], JSON_PRETTY_PRINT);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Server error',
        'message' => $e->getMessage(),
        'debug' => $debug_info
    ], JSON_PRETTY_PRINT);
}
?>