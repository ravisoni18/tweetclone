<?php
// api/endpoint-test.php - Test all API endpoints

error_reporting(E_ALL);
ini_set('display_errors', 1);

// Set JSON header
header('Content-Type: application/json');

echo "<h2>🔍 API Endpoint Test</h2>";

$base_url = "https://patr.me/api";
$endpoints_to_test = [
    'GET /' => '/',
    'GET /health' => '/health',
    'GET /auth-test' => '/auth-test',
    'GET /users' => '/users',
    'GET /posts/trending' => '/posts/trending',
    'GET /test' => '/test'
];

echo "<table border='1' style='border-collapse: collapse; width: 100%;'>";
echo "<tr><th>Endpoint</th><th>URL</th><th>Status</th><th>Response</th></tr>";

foreach ($endpoints_to_test as $name => $endpoint) {
    $url = $base_url . $endpoint;
    echo "<tr>";
    echo "<td><strong>$name</strong></td>";
    echo "<td><a href='$url' target='_blank'>$url</a></td>";
    
    // Test the endpoint
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_NOBODY, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        echo "<td style='color: red;'>ERROR</td>";
        echo "<td style='color: red;'>$error</td>";
    } else {
        $color = $httpCode == 200 ? 'green' : ($httpCode == 404 ? 'red' : 'orange');
        echo "<td style='color: $color;'>$httpCode</td>";
        
        // Extract just the response body
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $body = substr($response, $headerSize);
        
        // Show first 100 characters of response
        $preview = substr($body, 0, 100);
        echo "<td>" . htmlspecialchars($preview) . "...</td>";
    }
    
    echo "</tr>";
}

echo "</table>";

echo "<h3>🧪 Manual Test Links</h3>";
echo "<ul>";
foreach ($endpoints_to_test as $name => $endpoint) {
    $url = $base_url . $endpoint;
    echo "<li><a href='$url' target='_blank'>$name</a></li>";
}
echo "</ul>";

echo "<h3>🔧 Specific User Endpoint Test</h3>";
$user_id = "lMPDiw9z3hcQGe90zjwxeGZPFTp1";
$user_url = "$base_url/users/$user_id";
echo "<p>Testing problematic URL: <a href='$user_url' target='_blank'>$user_url</a></p>";

echo "<h3>📋 Debugging Info</h3>";
echo "<ul>";
echo "<li><strong>Current script:</strong> " . $_SERVER['SCRIPT_NAME'] . "</li>";
echo "<li><strong>Request URI:</strong> " . $_SERVER['REQUEST_URI'] . "</li>";
echo "<li><strong>HTTP Method:</strong> " . $_SERVER['REQUEST_METHOD'] . "</li>";
echo "<li><strong>Server:</strong> " . ($_SERVER['SERVER_SOFTWARE'] ?? 'Unknown') . "</li>";
echo "<li><strong>Time:</strong> " . date('Y-m-d H:i:s') . "</li>";
echo "</ul>";

echo "<h3>💡 Next Steps</h3>";
echo "<ol>";
echo "<li>Click each test link above to see which endpoints work</li>";
echo "<li>Check if basic endpoints (/, /health) return 200 OK</li>";
echo "<li>Check if user endpoint returns 404 or other error</li>";
echo "<li>If all show 404, there's a routing issue with .htaccess</li>";
echo "</ol>";
?>