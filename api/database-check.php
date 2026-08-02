<?php
// database-check.php - Database Diagnostic Tool

header('Content-Type: application/json');
error_reporting(E_ALL);
ini_set('display_errors', 1);

$diagnostics = [
    'timestamp' => date('c'),
    'php_version' => PHP_VERSION,
    'tests' => []
];

// Test 1: Check PDO availability
$diagnostics['tests']['pdo_available'] = [
    'name' => 'PDO Extension Available',
    'status' => extension_loaded('pdo') ? 'PASS' : 'FAIL',
    'details' => extension_loaded('pdo') ? 'PDO extension is loaded' : 'PDO extension not found'
];

// Test 2: Check MySQL PDO driver
$diagnostics['tests']['mysql_pdo_available'] = [
    'name' => 'MySQL PDO Driver Available',
    'status' => extension_loaded('pdo_mysql') ? 'PASS' : 'FAIL',
    'details' => extension_loaded('pdo_mysql') ? 'MySQL PDO driver is loaded' : 'MySQL PDO driver not found'
];

// Test 3: List all PDO drivers
$drivers = PDO::getAvailableDrivers();
$diagnostics['tests']['pdo_drivers'] = [
    'name' => 'Available PDO Drivers',
    'status' => 'INFO',
    'details' => $drivers
];

// Test 4: Try different database configurations
$configs = [
    'config1' => ['host' => 'localhost', 'db' => 'patr_database', 'user' => 'patr_user', 'pass' => 'secure_password_123'],
    'config2' => ['host' => 'localhost', 'db' => 'twitter_clone', 'user' => 'root', 'pass' => ''],
    'config3' => ['host' => 'localhost', 'db' => 'patr_twitter', 'user' => 'patr_user', 'pass' => 'password123'],
    'config4' => ['host' => 'localhost', 'db' => 'patr_database', 'user' => 'root', 'pass' => ''],
    'config5' => ['host' => '127.0.0.1', 'db' => 'patr_database', 'user' => 'patr_user', 'pass' => 'secure_password_123'],
];

foreach ($configs as $configName => $config) {
    try {
        $dsn = "mysql:host={$config['host']};dbname={$config['db']}";
        $pdo = new PDO($dsn, $config['user'], $config['pass']);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        
        // Test the connection with a simple query
        $stmt = $pdo->query("SELECT 1 as test");
        $result = $stmt->fetch();
        
        $diagnostics['tests'][$configName] = [
            'name' => "Database Config: {$config['db']} ({$config['user']}@{$config['host']})",
            'status' => 'PASS',
            'details' => [
                'connection' => 'SUCCESS',
                'test_query' => $result ? 'SUCCESS' : 'FAILED',
                'dsn' => $dsn,
                'user' => $config['user']
            ]
        ];
        
        // If successful, check for existing tables
        try {
            $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
            $diagnostics['tests'][$configName]['details']['existing_tables'] = $tables;
            
            // Check if our specific tables exist
            $ourTables = ['users', 'posts', 'follows'];
            $existingOurTables = array_intersect($ourTables, $tables);
            $missingOurTables = array_diff($ourTables, $tables);
            
            $diagnostics['tests'][$configName]['details']['our_tables_exist'] = $existingOurTables;
            $diagnostics['tests'][$configName]['details']['our_tables_missing'] = $missingOurTables;
            
        } catch (Exception $e) {
            $diagnostics['tests'][$configName]['details']['table_check_error'] = $e->getMessage();
        }
        
        $pdo = null; // Close connection
        
    } catch (PDOException $e) {
        $diagnostics['tests'][$configName] = [
            'name' => "Database Config: {$config['db']} ({$config['user']}@{$config['host']})",
            'status' => 'FAIL',
            'details' => [
                'error' => $e->getMessage(),
                'error_code' => $e->getCode(),
                'dsn' => $dsn ?? 'N/A',
                'user' => $config['user']
            ]
        ];
    }
}

// Test 5: Check MySQL service status (if possible)
$diagnostics['tests']['mysql_service'] = [
    'name' => 'MySQL Service Check',
    'status' => 'INFO',
    'details' => []
];

// Try to check if MySQL is running
if (function_exists('exec')) {
    $output = [];
    $return_var = 0;
    @exec('mysqladmin ping 2>&1', $output, $return_var);
    $diagnostics['tests']['mysql_service']['details']['ping_test'] = [
        'output' => implode("\n", $output),
        'return_code' => $return_var,
        'status' => $return_var === 0 ? 'MySQL is running' : 'MySQL may not be running'
    ];
} else {
    $diagnostics['tests']['mysql_service']['details']['ping_test'] = 'exec() function not available';
}

// Test 6: Check environment variables and server info
$diagnostics['tests']['environment'] = [
    'name' => 'Environment Information',
    'status' => 'INFO',
    'details' => [
        'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
        'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? 'Unknown',
        'server_name' => $_SERVER['SERVER_NAME'] ?? 'Unknown',
        'mysql_default_socket' => ini_get('mysql.default_socket'),
        'mysql_connect_timeout' => ini_get('mysql.connect_timeout'),
        'pdo_mysql_default_socket' => ini_get('pdo_mysql.default_socket')
    ]
];

// Test 7: Test without specifying database (to check if user has general MySQL access)
try {
    $pdo = new PDO('mysql:host=localhost', 'patr_user', 'secure_password_123');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // List databases this user can see
    $stmt = $pdo->query("SHOW DATABASES");
    $databases = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    $diagnostics['tests']['user_access'] = [
        'name' => 'User Database Access (patr_user)',
        'status' => 'PASS',
        'details' => [
            'accessible_databases' => $databases,
            'can_connect_to_mysql' => true
        ]
    ];
    
} catch (PDOException $e) {
    $diagnostics['tests']['user_access'] = [
        'name' => 'User Database Access (patr_user)',
        'status' => 'FAIL',
        'details' => [
            'error' => $e->getMessage(),
            'error_code' => $e->getCode()
        ]
    ];
}

// Summary
$passed = 0;
$failed = 0;
foreach ($diagnostics['tests'] as $test) {
    if ($test['status'] === 'PASS') $passed++;
    if ($test['status'] === 'FAIL') $failed++;
}

$diagnostics['summary'] = [
    'total_tests' => count($diagnostics['tests']),
    'passed' => $passed,
    'failed' => $failed,
    'recommendation' => ''
];

// Generate recommendation based on results
if ($passed > 0) {
    $diagnostics['summary']['recommendation'] = 'At least one database configuration is working. Use the successful configuration in your API.';
} else {
    $diagnostics['summary']['recommendation'] = 'No database configurations are working. Check MySQL service, user credentials, and database existence.';
}

echo json_encode($diagnostics, JSON_PRETTY_PRINT);
?>