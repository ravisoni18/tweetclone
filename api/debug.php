<?php
// api/debug.php - Simple test to check if PHP is working
echo "<h2>🔍 API Debug Test</h2>";
echo "<p>If you see this formatted text, PHP is working in the API folder!</p>";
echo "<p><strong>Current Time:</strong> " . date('Y-m-d H:i:s') . "</p>";
echo "<p><strong>PHP Version:</strong> " . phpversion() . "</p>";

// Test file includes
echo "<h3>📁 File Check</h3>";
$files = [
    'config/cors.php' => file_exists('config/cors.php'),
    'config/database.php' => file_exists('config/database.php'),
    'models/User.php' => file_exists('models/User.php'),
    'models/Post.php' => file_exists('models/Post.php')
];

foreach ($files as $file => $exists) {
    $status = $exists ? "✅" : "❌";
    echo "<p>{$status} {$file}</p>";
}

// Test basic JSON response
header('Content-Type: application/json');
echo json_encode([
    'status' => 'success',
    'message' => 'API folder PHP is working!',
    'timestamp' => date('c'),
    'files_found' => array_filter($files)
]);
?>