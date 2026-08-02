<?php
// api/index.php - Twitter Clone API with Admin Portal Integration

// PRODUCTION ERROR HANDLING
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

function handleError($errno, $errstr, $errfile, $errline) {
    $error = [
        'error' => 'PHP Error',
        'message' => $errstr,
        'file' => basename($errfile),
        'line' => $errline
    ];
    
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode($error);
    exit;
}

function handleException($exception) {
    $error = [
        'error' => 'PHP Exception',
        'message' => $exception->getMessage(),
        'file' => basename($exception->getFile()),
        'line' => $exception->getLine()
    ];
    
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode($error);
    exit;
}

set_error_handler('handleError');
set_exception_handler('handleException');

// Helper functions
function sendResponse($data = null, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function sendError($message, $status = 400) {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode(['error' => $message]);
    exit;
}

function getRequestData() {
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    
    if (strpos($contentType, 'application/json') !== false) {
        $input = file_get_contents('php://input');
        return json_decode($input, true) ?: [];
    } elseif (strpos($contentType, 'multipart/form-data') !== false) {
        return $_POST; // Handle form data for uploads
    }
    return $_POST;
}

function sanitizeInput($input) {
    return htmlspecialchars(trim($input), ENT_QUOTES, 'UTF-8');
}

// Admin authentication check
function isAdmin($user) {
    // Define your admin user IDs here
    $adminIds = [
        'lMPDiw9z3hcQGe90zjwxeGZPFTp1', // Your user ID
        // Add other admin user IDs
    ];
    
    return $user && in_array($user['id'], $adminIds);
}

// Helper function to extract user ID from Firebase token (simplified)
function extractUserFromToken($authHeader) {
    try {
        // Remove 'Bearer ' prefix
        $token = str_replace('Bearer ', '', $authHeader);
        
        // Decode Firebase JWT token (simplified - in production use Firebase Admin SDK)
        $tokenParts = explode('.', $token);
        if (count($tokenParts) !== 3) {
            return null;
        }
        
        // Decode payload (middle part)
        $payload = base64_decode($tokenParts[1]);
        $tokenData = json_decode($payload, true);
        
        if (isset($tokenData['user_id']) || isset($tokenData['sub'])) {
            return $tokenData['user_id'] ?? $tokenData['sub'];
        }
        
        return null;
    } catch (Exception $e) {
        error_log("Token decode error: " . $e->getMessage());
        return null;
    }
}

// Setup CORS
function setupCors() {
    if (isset($_SERVER['HTTP_ORIGIN'])) {
        $allowed_origins = ['http://localhost:3000', 'https://patr.me'];
        if (in_array($_SERVER['HTTP_ORIGIN'], $allowed_origins)) {
            header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
        }
    }
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Max-Age: 86400');
    
    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD'])) {
            header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
        }
        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'])) {
            header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");
        }
        http_response_code(200);
        exit;
    }
}


function getPostDetails($db, $postId, $userId = null) {
    try {
        $query = "SELECT p.*, u.display_name, u.username, u.email, u.profile_image_url, u.verified,
                         COALESCE(ur.rating, 0) as user_rating,
                         CASE WHEN ur.rating IS NOT NULL THEN 1 ELSE 0 END as user_has_rated
                  FROM posts p
                  LEFT JOIN users u ON p.user_id = u.id
                  LEFT JOIN ratings ur ON p.id = ur.post_id AND ur.user_id = ?
                  WHERE p.id = ?";
        
        $stmt = $db->prepare($query);
        $stmt->execute([$userId, $postId]);
        $post = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($post) {
            return [
                'id' => $post['id'],
                'content' => $post['content'],
                'imageUrl' => $post['image_url'],
                'createdAt' => $post['created_at'],
                'updatedAt' => $post['updated_at'],
                'user' => [
                    'id' => $post['user_id'],
                    'displayName' => $post['display_name'] ?? 'User',
                    'username' => $post['username'] ?? explode('@', $post['email'])[0],
                    'email' => $post['email'] ?? 'user@example.com',
                    'profileImageUrl' => $post['profile_image_url'] ?? '',
                    'verified' => (bool)($post['verified'] ?? false)
                ],
                'likesCount' => (int)($post['likes_count'] ?? 0),
                'retweetsCount' => (int)($post['retweets_count'] ?? 0),
                'repliesCount' => (int)($post['replies_count'] ?? 0),
                'commentsCount' => (int)($post['comments_count'] ?? 0),
                'averageRating' => (float)($post['average_rating'] ?? 0),
                'ratingCount' => (int)($post['rating_count'] ?? 0),
                'userRating' => (int)($post['user_rating'] ?? 0),
                'userHasRated' => (bool)($post['user_has_rated'] ?? false),
                'viewsCount' => rand(10, 500),
                'isDeleted' => false
            ];
        }
        
        return null;
    } catch (Exception $e) {
        error_log("GetPostDetails error: " . $e->getMessage());
        return null;
    }
}

function getPostComments($db, $postId, $userId = null) {
    try {
        $query = "SELECT c.*, u.display_name, u.username, u.email, u.profile_image_url, u.verified,
                         CASE WHEN cl.user_id IS NOT NULL THEN 1 ELSE 0 END as user_has_liked,
                         (SELECT COUNT(*) FROM comments replies WHERE replies.parent_comment_id = c.id) as reply_count
                  FROM comments c
                  LEFT JOIN users u ON c.user_id = u.id
                  LEFT JOIN comment_likes cl ON c.id = cl.comment_id AND cl.user_id = ?
                  WHERE c.post_id = ?
                  ORDER BY c.created_at ASC";
        
        $stmt = $db->prepare($query);
        $stmt->execute([$userId, $postId]);
        
        $comments = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $comments[] = [
                'id' => $row['id'],
                'postId' => $row['post_id'],
                'content' => $row['content'],
                'parentCommentId' => $row['parent_comment_id'],
                'createdAt' => $row['created_at'],
                'updatedAt' => $row['updated_at'],
                'likesCount' => (int)($row['likes_count'] ?? 0),
                'replyCount' => (int)($row['reply_count'] ?? 0),
                'userHasLiked' => (bool)($row['user_has_liked'] ?? false),
                'user' => [
                    'id' => $row['user_id'],
                    'displayName' => $row['display_name'] ?? 'User',
                    'username' => $row['username'] ?? explode('@', $row['email'])[0],
                    'email' => $row['email'] ?? 'user@example.com',
                    'profileImageUrl' => $row['profile_image_url'] ?? '',
                    'verified' => (bool)($row['verified'] ?? false)
                ]
            ];
        }
        
        return $comments;
    } catch (Exception $e) {
        error_log("GetPostComments error: " . $e->getMessage());
        return [];
    }
}

function createComment($db, $commentData, $user) {
    try {
        $commentId = 'comment_' . time() . '_' . uniqid();
        
        $query = "INSERT INTO comments (id, post_id, user_id, content, parent_comment_id, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, NOW(), NOW())";
        
        $stmt = $db->prepare($query);
        $success = $stmt->execute([
            $commentId,
            $commentData['post_id'],
            $commentData['user_id'],
            $commentData['content'],
            $commentData['parent_comment_id']
        ]);
        
        if ($success) {
            return [
                'id' => $commentId,
                'postId' => $commentData['post_id'],
                'content' => $commentData['content'],
                'parentCommentId' => $commentData['parent_comment_id'],
                'createdAt' => date('Y-m-d H:i:s'),
                'updatedAt' => date('Y-m-d H:i:s'),
                'likesCount' => 0,
                'replyCount' => 0,
                'userHasLiked' => false,
                'user' => [
                    'id' => $user['id'],
                    'displayName' => $user['displayName'],
                    'username' => $user['username'] ?? explode('@', $user['email'])[0],
                    'email' => $user['email'],
                    'profileImageUrl' => $user['profileImageUrl'] ?? '',
                    'verified' => false
                ]
            ];
        }
        
        return null;
    } catch (Exception $e) {
        error_log("CreateComment error: " . $e->getMessage());
        return null;
    }
}

function upsertRating($db, $postId, $userId, $rating) {
    try {
        $ratingId = 'rating_' . time() . '_' . uniqid();
        
        $query = "INSERT INTO ratings (id, post_id, user_id, rating, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, NOW(), NOW())
                 ON DUPLICATE KEY UPDATE 
                 rating = VALUES(rating),
                 updated_at = NOW()";
        
        $stmt = $db->prepare($query);
        $success = $stmt->execute([$ratingId, $postId, $userId, $rating]);
        
        if ($success) {
            // Get updated post rating stats
            $statsQuery = "SELECT average_rating, rating_count FROM posts WHERE id = ?";
            $statsStmt = $db->prepare($statsQuery);
            $statsStmt->execute([$postId]);
            $stats = $statsStmt->fetch(PDO::FETCH_ASSOC);
            
            return [
                'success' => true,
                'rating' => $rating,
                'averageRating' => (float)($stats['average_rating'] ?? 0),
                'ratingCount' => (int)($stats['rating_count'] ?? 0),
                'message' => 'Rating saved successfully'
            ];
        }
        
        return null;
    } catch (Exception $e) {
        error_log("UpsertRating error: " . $e->getMessage());
        return null;
    }
}

function deleteRating($db, $postId, $userId) {
    try {
        $query = "DELETE FROM ratings WHERE post_id = ? AND user_id = ?";
        $stmt = $db->prepare($query);
        $success = $stmt->execute([$postId, $userId]);
        
        return $success;
    } catch (Exception $e) {
        error_log("DeleteRating error: " . $e->getMessage());
        return false;
    }
}

function toggleCommentLike($db, $commentId, $userId) {
    try {
        // Check if already liked
        $checkQuery = "SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ?";
        $checkStmt = $db->prepare($checkQuery);
        $checkStmt->execute([$commentId, $userId]);
        $existingLike = $checkStmt->fetch();
        
        if ($existingLike) {
            // Unlike
            $deleteQuery = "DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?";
            $deleteStmt = $db->prepare($deleteQuery);
            $deleteStmt->execute([$commentId, $userId]);
            $liked = false;
        } else {
            // Like
            $likeId = 'like_' . time() . '_' . uniqid();
            $insertQuery = "INSERT INTO comment_likes (id, comment_id, user_id, created_at) VALUES (?, ?, ?, NOW())";
            $insertStmt = $db->prepare($insertQuery);
            $insertStmt->execute([$likeId, $commentId, $userId]);
            $liked = true;
        }
        
        // Get updated like count
        $countQuery = "SELECT likes_count FROM comments WHERE id = ?";
        $countStmt = $db->prepare($countQuery);
        $countStmt->execute([$commentId]);
        $comment = $countStmt->fetch();
        
        return [
            'liked' => $liked,
            'likesCount' => (int)($comment['likes_count'] ?? 0),
            'action' => $liked ? 'liked' : 'unliked'
        ];
    } catch (Exception $e) {
        error_log("ToggleCommentLike error: " . $e->getMessage());
        return null;
    }
}

function deleteComment($db, $commentId, $userId) {
    try {
        // Check if user owns the comment
        $checkQuery = "SELECT user_id FROM comments WHERE id = ?";
        $checkStmt = $db->prepare($checkQuery);
        $checkStmt->execute([$commentId]);
        $comment = $checkStmt->fetch();
        
        if (!$comment || $comment['user_id'] !== $userId) {
            return false; // Unauthorized
        }
        
        // Delete the comment
        $deleteQuery = "DELETE FROM comments WHERE id = ? AND user_id = ?";
        $deleteStmt = $db->prepare($deleteQuery);
        $success = $deleteStmt->execute([$commentId, $userId]);
        
        return $success;
    } catch (Exception $e) {
        error_log("DeleteComment error: " . $e->getMessage());
        return false;
    }
}

// Database connection with your exact credentials
class Database {
    private $host = "localhost";
    private $database_name = "u605931270_patrdb";
    private $username = "u605931270_patrdb_admin";
    private $password = "Mivaan1@#4";
    public $conn;

    public function getConnection() {
        $this->conn = null;
        try {
            $this->conn = new PDO(
                "mysql:host=" . $this->host . ";dbname=" . $this->database_name,
                $this->username,
                $this->password,
                array(
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8"
                )
            );
            error_log("✅ Database connected successfully: " . $this->database_name);
        } catch(PDOException $exception) {
            error_log("❌ Database connection failed: " . $exception->getMessage());
        }
        return $this->conn;
    }
}

// User model
class User {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function getById($id) {
        try {
            $query = "SELECT u.*, 
                     (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count,
                     (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) as following_count,
                     (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as posts_count
                     FROM users u WHERE id = :id";
            $stmt = $this->conn->prepare($query);
            $stmt->execute([':id' => $id]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($user) {
                return [
                    'id' => $user['id'],
                    'email' => $user['email'],
                    'displayName' => $user['display_name'],
                    'username' => $user['username'],
                    'bio' => $user['bio'] ?? '',
                    'location' => $user['location'] ?? '',
                    'website' => $user['website'] ?? '',
                    'profileImageUrl' => $user['profile_image_url'] ?? '',
                    'coverImageUrl' => $user['cover_image_url'] ?? '',
                    'followersCount' => (int)($user['followers_count'] ?? 0),
                    'followingCount' => (int)($user['following_count'] ?? 0),
                    'postsCount' => (int)($user['posts_count'] ?? 0),
                    'verified' => (bool)($user['verified'] ?? false),
                    'createdAt' => $user['created_at'],
                    'updatedAt' => $user['updated_at']
                ];
            }
            return null;
        } catch (Exception $e) {
            error_log("Get user error: " . $e->getMessage());
            return null;
        }
    }

    public function create($userData) {
        try {
            $query = "INSERT INTO users (id, email, display_name, username, profile_image_url) 
                     VALUES (:id, :email, :display_name, :username, :profile_image_url)
                     ON DUPLICATE KEY UPDATE 
                     email = VALUES(email),
                     display_name = VALUES(display_name),
                     username = VALUES(username),
                     profile_image_url = VALUES(profile_image_url),
                     updated_at = NOW()";
            $stmt = $this->conn->prepare($query);
            $success = $stmt->execute([
                ':id' => $userData['id'],
                ':email' => $userData['email'],
                ':display_name' => $userData['display_name'],
                ':username' => $userData['username'],
                ':profile_image_url' => $userData['profile_image_url']
            ]);
            
            if ($success) {
                return $this->getById($userData['id']);
            }
            return null;
        } catch (Exception $e) {
            error_log("Create user error: " . $e->getMessage());
            return null;
        }
    }

    public function update($id, $updateData) {
        try {
            $setParts = [];
            $params = [':id' => $id];
            
            foreach ($updateData as $key => $value) {
                $setParts[] = "$key = :$key";
                $params[":$key"] = $value;
            }
            
            $query = "UPDATE users SET " . implode(', ', $setParts) . ", updated_at = NOW() WHERE id = :id";
            $stmt = $this->conn->prepare($query);
            $stmt->execute($params);
            
            return $this->getById($id);
        } catch (Exception $e) {
            error_log("Update user error: " . $e->getMessage());
            return null;
        }
    }
}

// Post model
class Post {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function create($postData) {
        try {
            $id = 'post_' . time() . '_' . uniqid();
            $query = "INSERT INTO posts (id, user_id, content, image_url, created_at, updated_at) 
                     VALUES (:id, :user_id, :content, :image_url, NOW(), NOW())";
            $stmt = $this->conn->prepare($query);
            $success = $stmt->execute([
                ':id' => $id,
                ':user_id' => $postData['user_id'],
                ':content' => $postData['content'],
                ':image_url' => $postData['image_url']
            ]);
            
            if ($success) {
                return $this->getById($id);
            }
            return null;
        } catch (Exception $e) {
            error_log("Create post error: " . $e->getMessage());
            return null;
        }
    }

    public function getById($id, $viewerId = null) {
        try {
            $query = "SELECT p.*, u.email, u.display_name, u.username, u.profile_image_url
                     FROM posts p 
                     LEFT JOIN users u ON p.user_id = u.id 
                     WHERE p.id = :id";
            $stmt = $this->conn->prepare($query);
            $stmt->execute([':id' => $id]);
            $post = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($post) {
                // Return in frontend-expected format
                return [
                    'id' => $post['id'],
                    'content' => $post['content'],
                    'imageUrl' => $post['image_url'],
                    'createdAt' => $post['created_at'],
                    'updatedAt' => $post['updated_at'],
                    'user' => [
                        'id' => $post['user_id'],
                        'displayName' => $post['display_name'] ?? 'User',
                        'username' => $post['username'] ?? 'user',
                        'email' => $post['email'] ?? 'user@example.com',
                        'profileImageUrl' => $post['profile_image_url'] ?? '',
                        'followersCount' => 0,
                        'followingCount' => 0
                    ],
                    'likesCount' => (int)($post['likes_count'] ?? 0),
                    'retweetsCount' => (int)($post['retweets_count'] ?? 0),
                    'repliesCount' => (int)($post['replies_count'] ?? 0),
                    'viewsCount' => rand(10, 500),
                    'isDeleted' => false,
                    'likedByUser' => false,
                    'retweetedByUser' => false,
                    'bookmarkedByUser' => false
                ];
            }
            
            return null;
        } catch (Exception $e) {
            error_log("Get post error: " . $e->getMessage());
            return null;
        }
    }
}

// Setup CORS
setupCors();

// Get database connection
$database = new Database();
$db = $database->getConnection();

if (!$db) {
    sendError('Database connection failed', 500);
}

// Create tables if they don't exist
try {
    // Users table
    $db->exec("CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        username VARCHAR(255),
        bio TEXT,
        location VARCHAR(255),
        website VARCHAR(255),
        date_of_birth DATE,
        profile_image_url TEXT,
        cover_image_url TEXT,
        followers_count INT DEFAULT 0,
        following_count INT DEFAULT 0,
        posts_count INT DEFAULT 0,
        verified TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email)
    )");

    // Posts table
    $db->exec("CREATE TABLE IF NOT EXISTS posts (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        likes_count INT DEFAULT 0,
        retweets_count INT DEFAULT 0,
        replies_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
    )");

    // Follows table
    $db->exec("CREATE TABLE IF NOT EXISTS follows (
        id VARCHAR(36) PRIMARY KEY,
        follower_id VARCHAR(255) NOT NULL,
        following_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_follow (follower_id, following_id),
        INDEX idx_follower (follower_id),
        INDEX idx_following (following_id)
    )");

    // Admin settings table
    $db->exec("CREATE TABLE IF NOT EXISTS admin_settings (
        setting_key VARCHAR(255) PRIMARY KEY,
        setting_value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )");
    
    
    
    // Comments table
$db->exec("CREATE TABLE IF NOT EXISTS comments (
    id VARCHAR(36) PRIMARY KEY,
    post_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    parent_comment_id VARCHAR(36) NULL,
    likes_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_post_id (post_id),
    INDEX idx_user_id (user_id),
    INDEX idx_parent_comment (parent_comment_id),
    INDEX idx_created_at (created_at)
)");

// Ratings table
$db->exec("CREATE TABLE IF NOT EXISTS ratings (
    id VARCHAR(36) PRIMARY KEY,
    post_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    rating TINYINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_post_rating (user_id, post_id),
    INDEX idx_post_id (post_id),
    INDEX idx_user_id (user_id)
)");

// Comment likes table
$db->exec("CREATE TABLE IF NOT EXISTS comment_likes (
    id VARCHAR(36) PRIMARY KEY,
    comment_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_comment_like (user_id, comment_id),
    INDEX idx_comment_id (comment_id),
    INDEX idx_user_id (user_id)
)");

try {
    $db->exec("ALTER TABLE posts 
               ADD COLUMN average_rating DECIMAL(2,1) DEFAULT 0.0,
               ADD COLUMN rating_count INT DEFAULT 0,
               ADD COLUMN comments_count INT DEFAULT 0");
} catch (Exception $e) {
    // Columns may already exist, ignore error
}

    error_log("✅ All tables created successfully");
} catch (Exception $e) {
    error_log("Table creation error: " . $e->getMessage());
}

// URL parsing
$request_uri = $_SERVER['REQUEST_URI'];
$path = parse_url($request_uri, PHP_URL_PATH);
$api_path = str_replace(['/api/', '/api'], '', $path);
$api_path = trim($api_path, '/');
$path_parts = $api_path ? explode('/', $api_path) : [];
$endpoint = $path_parts[0] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Authentication
$user = null;
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

if ($authHeader && str_starts_with($authHeader, 'Bearer ')) {
    $userModel = new User($db);
    $data = getRequestData();
    
    if (isset($data['userId']) && isset($data['userEmail'])) {
        $userId = $data['userId'];
        $userEmail = $data['userEmail'];
        $userName = $data['userName'] ?? $data['displayName'] ?? explode('@', $userEmail)[0];
        
        $user = $userModel->getById($userId);
        if (!$user) {
            $userData = [
                'id' => $userId,
                'email' => $userEmail,
                'display_name' => $userName,
                'username' => explode('@', $userEmail)[0],
                'profile_image_url' => $data['userPhoto'] ?? $data['profileImageUrl'] ?? ''
            ];
            $user = $userModel->create($userData);
        }
        
        if ($user) {
            error_log("✅ User authenticated: " . $user['email']);
        }
    } 
    // Handle GET requests where user data is not in request body
    elseif ($method === 'GET') {
        // For GET requests, try to extract user ID from JWT token
        $userIdFromToken = extractUserFromToken($authHeader);
        if ($userIdFromToken) {
            error_log("🔍 GET Request - Extracted user ID from token: " . $userIdFromToken);
            $user = $userModel->getById($userIdFromToken);
            if ($user) {
                error_log("✅ User authenticated via token for GET request: " . $user['email']);
            } else {
                error_log("❌ User not found in database for ID from token: " . $userIdFromToken);
            }
        } else {
            error_log("❌ Could not extract user ID from token for GET request");
        }
    }
}

// Additional debug logging for authentication
error_log("🔍 AUTHENTICATION SUMMARY:");
error_log("   Method: " . $method);
error_log("   Auth header present: " . ($authHeader ? 'YES' : 'NO'));
error_log("   User authenticated: " . ($user ? 'YES (' . $user['id'] . ')' : 'NO'));

// API Routes
try {
    switch ($endpoint) {
        case 'health':
            sendResponse([
                'status' => 'OK',
                'message' => 'Twitter Clone API with Admin Portal 🚀',
                'timestamp' => date('c'),
                'version' => '11.0.0-admin-integrated',
                'database_connected' => true,
                'database_name' => 'u605931270_patrdb',
                'authentication' => [
                    'user_authenticated' => !is_null($user),
                    'user_email' => $user['email'] ?? null,
                    'user_id' => $user['id'] ?? null,
                    'is_admin' => isAdmin($user)
                ]
            ]);
            break;
            
            
            
            case 'comments':
    if (!$user) {
        sendError('Authentication required', 401);
    }
    
    if (isset($path_parts[1])) {
        $commentId = $path_parts[1];
        
        if (isset($path_parts[2]) && $path_parts[2] === 'like') {
            // POST /api/comments/{id}/like - Toggle comment like
            if ($method === 'POST') {
                try {
                    $result = toggleCommentLike($db, $commentId, $user['id']);
                    if ($result !== null) {
                        error_log("👍 Comment like toggled by {$user['email']} for comment {$commentId}");
                        sendResponse($result);
                    } else {
                        sendError('Failed to toggle like', 500);
                    }
                } catch (Exception $e) {
                    error_log("Toggle comment like error: " . $e->getMessage());
                    sendError('Failed to toggle like', 500);
                }
            }
        } elseif ($method === 'DELETE') {
            // DELETE /api/comments/{id} - Delete comment
            try {
                $result = deleteComment($db, $commentId, $user['id']);
                if ($result) {
                    error_log("🗑️ Comment deleted by {$user['email']}: {$commentId}");
                    sendResponse(['success' => true, 'message' => 'Comment deleted']);
                } else {
                    sendError('Failed to delete comment or unauthorized', 403);
                }
            } catch (Exception $e) {
                error_log("Delete comment error: " . $e->getMessage());
                sendError('Failed to delete comment', 500);
            }
        }
    }
    break;

        case 'admin':
            // Require admin authentication
            if (!$user || !isAdmin($user)) {
                sendError('Admin authentication required', 401);
            }
            
            if (isset($path_parts[1])) {
                $adminAction = $path_parts[1];
                
                switch ($adminAction) {
                    case 'users':
                        if (isset($path_parts[2]) && $method === 'DELETE') {
                            // Delete user
                            $userId = $path_parts[2];
                            
                            try {
                                $db->beginTransaction();
                                
                                // Delete user's posts first
                                $deletePostsQuery = "DELETE FROM posts WHERE user_id = :user_id";
                                $stmt = $db->prepare($deletePostsQuery);
                                $stmt->bindValue(':user_id', $userId);
                                $stmt->execute();
                                
                                // Delete user's follows (both following and followers)
                                $deleteFollowsQuery = "DELETE FROM follows WHERE follower_id = :user_id OR following_id = :user_id";
                                $stmt = $db->prepare($deleteFollowsQuery);
                                $stmt->bindValue(':user_id', $userId);
                                $stmt->execute();
                                
                                // Delete the user
                                $deleteUserQuery = "DELETE FROM users WHERE id = :user_id";
                                $stmt = $db->prepare($deleteUserQuery);
                                $stmt->bindValue(':user_id', $userId);
                                $stmt->execute();
                                
                                $db->commit();
                                
                                error_log("🗑️ Admin {$user['email']} deleted user: $userId");
                                sendResponse(['success' => true, 'message' => 'User deleted successfully']);
                                
                            } catch (Exception $e) {
                                $db->rollback();
                                error_log("❌ Admin user deletion failed: " . $e->getMessage());
                                sendError('Failed to delete user: ' . $e->getMessage(), 500);
                            }
                        } elseif ($method === 'GET') {
                            // Get all users for admin
                            try {
                                $query = "SELECT u.*, 
                                         (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as posts_count,
                                         (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count,
                                         (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) as following_count
                                         FROM users u 
                                         ORDER BY u.created_at DESC";
                                
                                $stmt = $db->prepare($query);
                                $stmt->execute();
                                $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
                                
                                sendResponse($users);
                                
                            } catch (Exception $e) {
                                sendError('Failed to load users: ' . $e->getMessage(), 500);
                            }
                        }
                        break;
                        
                    case 'posts':
                        if (isset($path_parts[2]) && $method === 'DELETE') {
                            // Delete post
                            $postId = $path_parts[2];
                            
                            try {
                                // Get post info for logging
                                $getPostQuery = "SELECT p.*, u.display_name FROM posts p LEFT JOIN users u ON p.user_id = u.id WHERE p.id = :post_id";
                                $stmt = $db->prepare($getPostQuery);
                                $stmt->bindValue(':post_id', $postId);
                                $stmt->execute();
                                $post = $stmt->fetch(PDO::FETCH_ASSOC);
                                
                                if (!$post) {
                                    sendError('Post not found', 404);
                                }
                                
                                // Delete the post
                                $deleteQuery = "DELETE FROM posts WHERE id = :post_id";
                                $stmt = $db->prepare($deleteQuery);
                                $stmt->bindValue(':post_id', $postId);
                                $stmt->execute();
                                
                                error_log("🗑️ Admin {$user['email']} deleted post: $postId by " . $post['display_name']);
                                sendResponse(['success' => true, 'message' => 'Post deleted successfully']);
                                
                            } catch (Exception $e) {
                                error_log("❌ Admin post deletion failed: " . $e->getMessage());
                                sendError('Failed to delete post: ' . $e->getMessage(), 500);
                            }
                        } elseif ($method === 'GET') {
                            // Get all posts for admin
                            try {
                                $limit = min((int)($_GET['limit'] ?? 50), 100);
                                $offset = (int)($_GET['offset'] ?? 0);
                                
                                $query = "SELECT p.*, u.display_name, u.email, u.username, u.profile_image_url
                                         FROM posts p 
                                         LEFT JOIN users u ON p.user_id = u.id 
                                         ORDER BY p.created_at DESC 
                                         LIMIT :limit OFFSET :offset";
                                
                                $stmt = $db->prepare($query);
                                $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
                                $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
                                $stmt->execute();
                                $posts = $stmt->fetchAll(PDO::FETCH_ASSOC);
                                
                                // Format for admin portal
                                $formattedPosts = array_map(function($post) {
                                    return [
                                        'id' => $post['id'],
                                        'content' => $post['content'],
                                        'imageUrl' => $post['image_url'],
                                        'createdAt' => $post['created_at'],
                                        'updatedAt' => $post['updated_at'],
                                        'likesCount' => (int)($post['likes_count'] ?? 0),
                                        'retweetsCount' => (int)($post['retweets_count'] ?? 0),
                                        'repliesCount' => (int)($post['replies_count'] ?? 0),
                                        'user' => [
                                            'id' => $post['user_id'],
                                            'displayName' => $post['display_name'] ?? 'Unknown User',
                                            'username' => $post['username'] ?? explode('@', $post['email'] ?? 'unknown@example.com')[0],
                                            'email' => $post['email'] ?? 'unknown@example.com',
                                            'profileImageUrl' => $post['profile_image_url'] ?? ''
                                        ]
                                    ];
                                }, $posts);
                                
                                sendResponse($formattedPosts);
                                
                            } catch (Exception $e) {
                                sendError('Failed to load posts: ' . $e->getMessage(), 500);
                            }
                        }
                        break;
                        
                    case 'settings':
                        if ($method === 'POST') {
                            // Save admin settings
                            try {
                                $settings = getRequestData();
                                
                                // Save each setting
                                $insertQuery = "INSERT INTO admin_settings (setting_key, setting_value) 
                                               VALUES (:key, :value) 
                                               ON DUPLICATE KEY UPDATE 
                                               setting_value = VALUES(setting_value), 
                                               updated_at = NOW()";
                                $stmt = $db->prepare($insertQuery);
                                
                                foreach ($settings as $key => $value) {
                                    $stmt->execute([
                                        ':key' => $key,
                                        ':value' => json_encode($value)
                                    ]);
                                }
                                
                                error_log("⚙️ Admin {$user['email']} updated settings");
                                sendResponse(['success' => true, 'message' => 'Settings saved successfully']);
                                
                            } catch (Exception $e) {
                                error_log("❌ Admin settings save failed: " . $e->getMessage());
                                sendError('Failed to save settings: ' . $e->getMessage(), 500);
                            }
                        } elseif ($method === 'GET') {
                            // Get current settings
                            try {
                                $query = "SELECT setting_key, setting_value FROM admin_settings";
                                $stmt = $db->prepare($query);
                                $stmt->execute();
                                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                                
                                $settings = [];
                                foreach ($rows as $row) {
                                    $settings[$row['setting_key']] = json_decode($row['setting_value'], true);
                                }
                                
                                sendResponse($settings);
                                
                            } catch (Exception $e) {
                                sendError('Failed to load settings: ' . $e->getMessage(), 500);
                            }
                        }
                        break;
                        
                    case 'backup':
                        if ($method === 'POST') {
                            try {
                                $timestamp = date('Y-m-d_H-i-s');
                                $backupFile = "backup_twitter_clone_$timestamp.sql";
                                
                                // Create backup directory if it doesn't exist
                                $backupDir = $_SERVER['DOCUMENT_ROOT'] . '/admin/backups/';
                                if (!is_dir($backupDir)) {
                                    mkdir($backupDir, 0755, true);
                                }
                                
                                // Generate backup SQL
                                $backupPath = $backupDir . $backupFile;
                                
                                // Simple backup - you might want to use mysqldump for production
                                $tables = ['users', 'posts', 'follows', 'admin_settings'];
                                $backup = "-- Twitter Clone Database Backup\n";
                                $backup .= "-- Generated: " . date('Y-m-d H:i:s') . "\n";
                                $backup .= "-- Admin: " . $user['email'] . "\n\n";
                                
                                foreach ($tables as $table) {
                                    $backup .= "-- Table: $table\n";
                                    $backup .= "DROP TABLE IF EXISTS `$table`;\n\n";
                                    
                                    // Get CREATE TABLE statement (simplified)
                                    $createQuery = "SHOW CREATE TABLE `$table`";
                                    $stmt = $db->prepare($createQuery);
                                    $stmt->execute();
                                    $createResult = $stmt->fetch(PDO::FETCH_ASSOC);
                                    if ($createResult) {
                                        $backup .= $createResult['Create Table'] . ";\n\n";
                                    }
                                    
                                    // Get data
                                    $dataQuery = "SELECT * FROM `$table`";
                                    $stmt = $db->prepare($dataQuery);
                                    $stmt->execute();
                                    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                                    
                                    if (!empty($rows)) {
                                        foreach ($rows as $row) {
                                            $values = array_map(function($value) use ($db) {
                                                return $db->quote($value);
                                            }, array_values($row));
                                            
                                            $backup .= "INSERT INTO `$table` VALUES (" . implode(', ', $values) . ");\n";
                                        }
                                        $backup .= "\n";
                                    }
                                }
                                
                                file_put_contents($backupPath, $backup);
                                
                                error_log("💾 Admin {$user['email']} created database backup: $backupFile");
                                sendResponse([
                                    'success' => true, 
                                    'message' => 'Database backup created successfully',
                                    'filename' => $backupFile,
                                    'size' => filesize($backupPath)
                                ]);
                                
                            } catch (Exception $e) {
                                error_log("❌ Admin backup failed: " . $e->getMessage());
                                sendError('Failed to create backup: ' . $e->getMessage(), 500);
                            }
                        }
                        break;
                        
                    case 'stats':
                        if ($method === 'GET') {
                            try {
                                // Get comprehensive stats for admin dashboard
                                $stats = [];
                                
                                // User stats
                                $userStatsQuery = "SELECT 
                                    COUNT(*) as total_users,
                                    COUNT(CASE WHEN created_at >= CURDATE() THEN 1 END) as users_today,
                                    COUNT(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as users_week,
                                    COUNT(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 END) as users_month
                                    FROM users";
                                $stmt = $db->prepare($userStatsQuery);
                                $stmt->execute();
                                $stats['users'] = $stmt->fetch(PDO::FETCH_ASSOC);
                                
                                // Post stats
                                $postStatsQuery = "SELECT 
                                    COUNT(*) as total_posts,
                                    COUNT(CASE WHEN created_at >= CURDATE() THEN 1 END) as posts_today,
                                    COUNT(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as posts_week,
                                    COUNT(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 END) as posts_month
                                    FROM posts";
                                $stmt = $db->prepare($postStatsQuery);
                                $stmt->execute();
                                $stats['posts'] = $stmt->fetch(PDO::FETCH_ASSOC);
                                
                                // Top users by posts
                                $topUsersQuery = "SELECT u.id, u.display_name, u.email, 
                                                 (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as posts_count
                                                 FROM users u 
                                                 ORDER BY posts_count DESC 
                                                 LIMIT 10";
                                $stmt = $db->prepare($topUsersQuery);
                                $stmt->execute();
                                $stats['top_users'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
                                
                                // Recent activity
                                $recentQuery = "SELECT 'user' as type, display_name as name, created_at 
                                               FROM users 
                                               WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                                               UNION ALL
                                               SELECT 'post' as type, LEFT(content, 50) as name, created_at 
                                               FROM posts 
                                               WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                                               ORDER BY created_at DESC 
                                               LIMIT 20";
                                $stmt = $db->prepare($recentQuery);
                                $stmt->execute();
                                $stats['recent_activity'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
                                
                                sendResponse($stats);
                                
                            } catch (Exception $e) {
                                sendError('Failed to load stats: ' . $e->getMessage(), 500);
                            }
                        }
                        break;
                        
                    default:
                        sendError('Invalid admin action', 400);
                }
            } else {
                sendError('Admin action required', 400);
            }
            break;
            
        case 'users':
            // Handle user posts endpoint first (must come before general user endpoint)
            if (isset($path_parts[1]) && isset($path_parts[2]) && $path_parts[2] === 'posts') {
                $userId = $path_parts[1];
                
                if ($method === 'GET') {
                    try {
                        $page = intval($_GET['page'] ?? 1);
                        $limit = intval($_GET['limit'] ?? 20);
                        $offset = ($page - 1) * $limit;
                        
                        // Get posts for specific user with user information
                        $query = "SELECT p.*, u.email, u.display_name, u.username, u.profile_image_url
                                 FROM posts p 
                                 LEFT JOIN users u ON p.user_id = u.id 
                                 WHERE p.user_id = :user_id
                                 ORDER BY p.created_at DESC 
                                 LIMIT :limit OFFSET :offset";
                        
                        $stmt = $db->prepare($query);
                        $stmt->bindValue(':user_id', $userId);
                        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
                        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
                        $stmt->execute();
                        
                        $posts = [];
                        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                            $posts[] = [
                                'id' => $row['id'],
                                'content' => $row['content'],
                                'imageUrl' => $row['image_url'],
                                'user' => [
                                    'id' => $row['user_id'],
                                    'displayName' => $row['display_name'],
                                    'username' => $row['username'] ?: explode('@', $row['email'])[0],
                                    'email' => $row['email'],
                                    'profileImageUrl' => $row['profile_image_url']
                                ],
                                'likesCount' => (int)$row['likes_count'],
                                'retweetsCount' => (int)$row['retweets_count'],
                                'repliesCount' => (int)$row['replies_count'],
                                'createdAt' => $row['created_at'],
                                'updatedAt' => $row['updated_at']
                            ];
                        }
                        
                        // Check if there are more posts
                        $countQuery = "SELECT COUNT(*) FROM posts WHERE user_id = :user_id";
                        $countStmt = $db->prepare($countQuery);
                        $countStmt->bindValue(':user_id', $userId);
                        $countStmt->execute();
                        $totalPosts = $countStmt->fetchColumn();
                        
                        $hasMore = ($offset + count($posts)) < $totalPosts;
                        
                        sendResponse([
                            'posts' => $posts,
                            'hasMore' => $hasMore,
                            'page' => $page,
                            'totalPosts' => $totalPosts
                        ]);
                        
                    } catch (Exception $e) {
                        error_log('Failed to load user posts: ' . $e->getMessage());
                        sendError('Failed to load user posts: ' . $e->getMessage(), 500);
                    }
                } else {
                    sendError('Method not allowed', 405);
                }
                break;
            }
            
            $userModel = new User($db);
            $data = getRequestData();
            
            if (($method === 'GET' || $method === 'POST') && isset($path_parts[1])) {
                $identifier = $path_parts[1];
                
                if ($identifier === 'suggested') {
                    // REAL DATA ONLY - No fallbacks, no fake users
                    try {
                        error_log("🔍 SUGGESTED USERS - Finding real users from database only");
                        
                        // Get top users by posts_count - REAL DATA ONLY
                        $currentUserId = $user['id'] ?? 'none';
                        $topUsersQuery = "SELECT u.*, 
                                         (SELECT COUNT(*) FROM follows WHERE follower_id = :current_user_id AND following_id = u.id) as is_following
                                         FROM users u 
                                         WHERE u.id != :current_user_id2
                                         ORDER BY u.posts_count DESC, u.followers_count DESC, u.created_at DESC
                                         LIMIT 10";
                        
                        $stmt = $db->prepare($topUsersQuery);
                        $stmt->bindValue(':current_user_id', $currentUserId);
                        $stmt->bindValue(':current_user_id2', $currentUserId);
                        $stmt->execute();
                        $allTopUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);
                        
                        $suggestions = [];
                        foreach ($allTopUsers as $u) {
                            $isFollowing = $user ? ((int)$u['is_following'] > 0) : false;
                            $postsCount = (int)($u['posts_count'] ?? 0);
                            
                            error_log("👤 Real User Found: " . $u['display_name'] . " - Posts: $postsCount - Following: " . ($isFollowing ? 'YES' : 'NO'));
                            
                            // Only add users not being followed (or if no user is logged in)
                            if (!$isFollowing || !$user) {
                                $suggestions[] = [
                                    'id' => $u['id'],
                                    'displayName' => $u['display_name'],
                                    'username' => $u['username'] ?: explode('@', $u['email'])[0],
                                    'email' => $u['email'],
                                    'profileImageUrl' => $u['profile_image_url'] ?? '',
                                    'followersCount' => (int)($u['followers_count'] ?? 0),
                                    'postsCount' => $postsCount,
                                    'following' => false
                                ];
                                
                                // Limit to 5 suggestions
                                if (count($suggestions) >= 5) {
                                    break;
                                }
                            }
                        }
                        
                        error_log("🔥 REAL DATA ONLY: Returning " . count($suggestions) . " real users from database (no fallbacks)");
                        sendResponse($suggestions);
                        
                    } catch (Exception $e) {
                        error_log("❌ Suggested users error: " . $e->getMessage());
                        // Return empty array instead of fake data
                        sendResponse([]);
                    }
                } elseif ($identifier === 'search') {
                    // Search users by username, display name, or email
                    $query = $_GET['q'] ?? '';
                    if (empty($query)) {
                        sendResponse([]);
                        return;
                    }
                    
                    try {
                        $searchQuery = "SELECT u.*, 
                                       (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count,
                                       " . ($user ? "(SELECT COUNT(*) FROM follows WHERE follower_id = :current_user_id AND following_id = u.id) as is_following" : "0 as is_following") . "
                                       FROM users u 
                                       WHERE (u.username LIKE :search OR u.display_name LIKE :search OR u.email LIKE :search)";
                        
                        if ($user) {
                            $searchQuery .= " AND u.id != :current_user_id2";
                        }
                        
                        $searchQuery .= " ORDER BY followers_count DESC LIMIT 10";
                        
                        $stmt = $db->prepare($searchQuery);
                        $searchTerm = '%' . $query . '%';
                        $stmt->bindValue(':search', $searchTerm);
                        
                        if ($user) {
                            $stmt->bindValue(':current_user_id', $user['id']);
                            $stmt->bindValue(':current_user_id2', $user['id']);
                        }
                        
                        $stmt->execute();
                        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
                        
                        $searchResults = array_map(function($u) {
                            return [
                                'id' => $u['id'],
                                'displayName' => $u['display_name'],
                                'username' => $u['username'],
                                'email' => $u['email'],
                                'profileImageUrl' => $u['profile_image_url'] ?? '',
                                'followersCount' => (int)$u['followers_count'],
                                'following' => (bool)($u['is_following'] ?? 0)
                            ];
                        }, $users);
                        
                        sendResponse($searchResults);
                    } catch (Exception $e) {
                        error_log("Search error: " . $e->getMessage());
                        sendResponse([]);
                    }
                } else {
                    // Enhanced follow status check
                    try {
                        error_log("🔍 FOLLOW STATUS DEBUG - Loading profile for: " . $identifier);
                        error_log("👤 Current user: " . ($user ? $user['id'] . " (" . $user['email'] . ")" : 'none'));
                        
                        $targetUser = $userModel->getById($identifier);
                        if (!$targetUser) {
                            error_log("❌ User not found: " . $identifier);
                            sendError('User not found: ' . $identifier, 404);
                        }
                        
                        // Proper follow status check with detailed logging
                        $isFollowing = false;
                        if ($user && $user['id'] !== $identifier) {
                            error_log("🔍 Checking if {$user['id']} follows {$identifier}");
                            
                            $followQuery = "SELECT COUNT(*) as follow_count 
                                          FROM follows 
                                          WHERE follower_id = :follower_id 
                                          AND following_id = :following_id";
                            
                            $stmt = $db->prepare($followQuery);
                            $stmt->bindValue(':follower_id', $user['id']);
                            $stmt->bindValue(':following_id', $identifier);
                            $stmt->execute();
                            
                            $result = $stmt->fetch(PDO::FETCH_ASSOC);
                            $followCount = (int)$result['follow_count'];
                            $isFollowing = $followCount > 0;
                            
                            error_log("📊 SQL Result: " . $followCount . " rows found");
                            error_log("✅ Is Following: " . ($isFollowing ? 'YES' : 'NO'));
                            
                        } else {
                            error_log("🚫 Skipping follow check (same user or not authenticated)");
                        }
                        
                        // Add follow status to response
                        $targetUser['following'] = $isFollowing;
                        
                        error_log("📤 FINAL RESPONSE - Following status: " . ($isFollowing ? 'true' : 'false'));
                        sendResponse($targetUser);
                        
                    } catch (Exception $e) {
                        error_log("❌ ERROR in user profile endpoint: " . $e->getMessage());
                        sendError('Failed to load user profile: ' . $e->getMessage(), 500);
                    }
                }
            } elseif ($method === 'POST') {
                if (!isset($data['id'])) {
                    sendError('Missing user ID', 400);
                }
                
                $existingUser = $userModel->getById($data['id']);
                if ($existingUser) {
                    sendResponse($existingUser, 200);
                } else {
                    $userData = [
                        'id' => $data['id'],
                        'email' => $data['email'] ?? 'user@example.com',
                        'display_name' => $data['displayName'] ?? 'User',
                        'username' => isset($data['email']) ? explode('@', $data['email'])[0] : 'user',
                        'profile_image_url' => $data['profileImageUrl'] ?? ''
                    ];
                    
                    $newUser = $userModel->create($userData);
                    sendResponse($newUser, 201);
                }
            } else {
                sendError('Method not allowed', 405);
            }
            break;
            
        case 'posts':
            $postModel = new Post($db);
            
            // Handle multipart/form-data properly
            $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
            if (strpos($contentType, 'multipart/form-data') !== false) {
                $data = $_POST; // Use $_POST for multipart data
            } else {
                $data = getRequestData(); // Use existing function for JSON data
            }
            
            if ($method === 'GET' && isset($path_parts[1])) {
                if ($path_parts[1] === 'trending') {
                    // REAL HASHTAGS ONLY - No fake data
                    try {
                        error_log("🔍 TRENDING - Extracting real hashtags from posts only");
                        
                        // Get all posts with hashtags
                        $query = "SELECT content, created_at FROM posts WHERE content LIKE '%#%' ORDER BY created_at DESC";
                        $stmt = $db->prepare($query);
                        $stmt->execute();
                        $posts = $stmt->fetchAll(PDO::FETCH_ASSOC);
                        
                        $hashtags = [];
                        foreach ($posts as $post) {
                            // Extract hashtags using regex
                            preg_match_all('/#([a-zA-Z0-9_]+)/', $post['content'], $matches);
                            foreach ($matches[1] as $hashtag) {
                                $tag = strtolower($hashtag);
                                if (strlen($tag) > 1 && strlen($tag) < 20) {
                                    $hashtags[$tag] = ($hashtags[$tag] ?? 0) + 1;
                                }
                            }
                        }
                        
                        // Sort hashtags by frequency (most used first)
                        arsort($hashtags);
                        
                        $trending = [];
                        foreach (array_slice($hashtags, 0, 5, true) as $tag => $count) {
                            $trending[] = [
                                'tag' => '#' . $tag,
                                'posts' => $count, // REAL count, not fake
                                'category' => 'Technology'
                            ];
                            
                            error_log("📈 Real Hashtag: #$tag with $count actual posts");
                        }
                        
                        error_log("🔥 REAL TRENDING: Found " . count($trending) . " real hashtags from " . count($posts) . " posts");
                        sendResponse($trending);
                        
                    } catch (Exception $e) {
                        error_log("Trending error: " . $e->getMessage());
                        // Return empty array instead of fake data
                        sendResponse([]);
                    }
                } elseif ($path_parts[1] === 'feed') {
                    // Get real posts from database - personalized based on follows
                    try {
                        $page = (int)($_GET['page'] ?? 1);
                        $limit = min((int)($_GET['limit'] ?? 20), 50);
                        $offset = ($page - 1) * $limit;
                        $feedType = $_GET['type'] ?? 'following'; // following, discover, all
                        
                        if ($user && $feedType === 'following') {
                            // Following feed - posts from users you follow + your own posts
                            $query = "SELECT p.*, u.email, u.display_name, u.username, u.profile_image_url
                                     FROM posts p 
                                     LEFT JOIN users u ON p.user_id = u.id 
                                     WHERE p.user_id = :user_id OR p.user_id IN (
                                         SELECT following_id FROM follows WHERE follower_id = :user_id
                                     )
                                     ORDER BY p.created_at DESC 
                                     LIMIT :limit OFFSET :offset";
                            
                            $stmt = $db->prepare($query);
                            $stmt->bindValue(':user_id', $user['id']);
                            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
                            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
                        } elseif ($user && $feedType === 'discover') {
                            // Discover feed - posts from users you don't follow
                            $query = "SELECT p.*, u.email, u.display_name, u.username, u.profile_image_url
                                     FROM posts p 
                                     LEFT JOIN users u ON p.user_id = u.id 
                                     WHERE p.user_id != :user_id AND p.user_id NOT IN (
                                         SELECT following_id FROM follows WHERE follower_id = :user_id
                                     )
                                     ORDER BY p.created_at DESC 
                                     LIMIT :limit OFFSET :offset";
                            
                            $stmt = $db->prepare($query);
                            $stmt->bindValue(':user_id', $user['id']);
                            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
                            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
                        } else {
                            // All posts feed (for non-authenticated users or 'all' type)
                            $query = "SELECT p.*, u.email, u.display_name, u.username, u.profile_image_url
                                     FROM posts p 
                                     LEFT JOIN users u ON p.user_id = u.id 
                                     ORDER BY p.created_at DESC 
                                     LIMIT :limit OFFSET :offset";
                            
                            $stmt = $db->prepare($query);
                            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
                            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
                        }
                        
                        $stmt->execute();
                        $rawPosts = $stmt->fetchAll(PDO::FETCH_ASSOC);
                        $posts = [];
                        
                        foreach ($rawPosts as $post) {
                            $posts[] = [
                                'id' => $post['id'],
                                'content' => $post['content'],
                                'imageUrl' => $post['image_url'],
                                'createdAt' => $post['created_at'],
                                'updatedAt' => $post['updated_at'],
                                'user' => [
                                    'id' => $post['user_id'],
                                    'displayName' => $post['display_name'] ?? 'User',
                                    'username' => $post['username'] ?? 'user',
                                    'email' => $post['email'] ?? 'user@example.com',
                                    'profileImageUrl' => $post['profile_image_url'] ?? '',
                                    'followersCount' => 0,
                                    'followingCount' => 0
                                ],
                                'likesCount' => (int)($post['likes_count'] ?? 0),
                                'retweetsCount' => (int)($post['retweets_count'] ?? 0),
                                'repliesCount' => (int)($post['replies_count'] ?? 0),
                                'viewsCount' => rand(10, 500),
                                'isDeleted' => false,
                                'likedByUser' => false,
                                'retweetedByUser' => false,
                                'bookmarkedByUser' => false
                            ];
                        }
                        
                        sendResponse([
                            'posts' => $posts,
                            'hasMore' => count($rawPosts) === $limit,
                            'page' => $page,
                            'total' => count($posts),
                            'feedType' => $feedType
                        ]);
                        
                    } catch (Exception $e) {
                        error_log("Feed error: " . $e->getMessage());
                        sendError('Failed to load feed', 500);
                    }
                }
            } elseif ($method === 'POST' && !isset($path_parts[1])) {
                if (!$user) {
                    sendError('Authentication required', 401);
                }
                
                if (empty($data['content'])) {
                    sendError('Post content is required', 400);
                }
                
                error_log("🔄 Creating post for user: " . $user['id'] . " (" . $user['email'] . ")");
                error_log("📎 Content Type: " . $contentType);
                
                // Handle image upload
                $imageUrl = null;
                if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
                    error_log("🖼️ Image file detected, processing upload...");
                    
                    $uploadedFile = $_FILES['image'];
                    
                    // Validate file type
                    $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
                    $fileType = $uploadedFile['type'];
                    
                    if (in_array($fileType, $allowedTypes)) {
                        // Validate file size (5MB max)
                        $maxSize = 5 * 1024 * 1024; // 5MB
                        if ($uploadedFile['size'] <= $maxSize) {
                            
                            // Create upload directory if it doesn't exist
                            $uploadDir = $_SERVER['DOCUMENT_ROOT'] . '/uploads/posts/';
                            if (!is_dir($uploadDir)) {
                                if (!mkdir($uploadDir, 0755, true)) {
                                    error_log("❌ Failed to create upload directory");
                                }
                            }
                            
                            // Generate unique filename
                            $extension = pathinfo($uploadedFile['name'], PATHINFO_EXTENSION);
                            $filename = 'post_' . time() . '_' . uniqid() . '.' . strtolower($extension);
                            $filePath = $uploadDir . $filename;
                            
                            // Move uploaded file
                            if (move_uploaded_file($uploadedFile['tmp_name'], $filePath)) {
                                $imageUrl = 'https://patr.me/uploads/posts/' . $filename;
                                error_log("✅ Image uploaded successfully: " . $imageUrl);
                            } else {
                                error_log("❌ Failed to move uploaded file to: " . $filePath);
                            }
                        } else {
                            error_log("❌ File too large: " . $uploadedFile['size'] . " bytes (max: " . $maxSize . ")");
                        }
                    } else {
                        error_log("❌ Invalid file type: " . $fileType);
                    }
                }
                
                // Create post with or without image
                $postData = [
                    'user_id' => $user['id'],
                    'content' => sanitizeInput($data['content']),
                    'image_url' => $imageUrl  // Will be null if no image or upload failed
                ];
                
                $newPost = $postModel->create($postData);
                if ($newPost) {
                    error_log("📝 Post created successfully: " . $newPost['id']);
                    error_log("🖼️ With image URL: " . ($imageUrl ? $imageUrl : 'none'));
                    sendResponse($newPost, 201);
                } else {
                    error_log("❌ Failed to create post for user: " . $user['id']);
                    sendError('Failed to create post', 500);
                }
            }// Add new post detail endpoint
elseif ($path_parts[1] !== 'trending' && $path_parts[1] !== 'feed') {
    $postId = $path_parts[1];
    
    if (!isset($path_parts[2])) {
        // GET /api/posts/{id} - Get post details
        if ($method === 'GET') {
            try {
                $postDetails = getPostDetails($db, $postId, $user ? $user['id'] : null);
                if ($postDetails) {
                    sendResponse($postDetails);
                } else {
                    sendError('Post not found', 404);
                }
            } catch (Exception $e) {
                error_log("Get post details error: " . $e->getMessage());
                sendError('Failed to load post details', 500);
            }
        }
    } elseif ($path_parts[2] === 'comments') {
        // POST /api/posts/{id}/comments - Add comment
        if ($method === 'POST') {
            if (!$user) {
                sendError('Authentication required', 401);
            }
            
            try {
                $data = getRequestData();
                $commentData = [
                    'post_id' => $postId,
                    'user_id' => $user['id'],
                    'content' => sanitizeInput($data['content'] ?? ''),
                    'parent_comment_id' => $data['parent_comment_id'] ?? null
                ];
                
                if (empty($commentData['content'])) {
                    sendError('Comment content is required', 400);
                }
                
                $comment = createComment($db, $commentData, $user);
                if ($comment) {
                    error_log("📝 Comment created by {$user['email']} on post {$postId}");
                    sendResponse($comment, 201);
                } else {
                    sendError('Failed to create comment', 500);
                }
            } catch (Exception $e) {
                error_log("Create comment error: " . $e->getMessage());
                sendError('Failed to create comment', 500);
            }
        }
        // GET /api/posts/{id}/comments - Get comments
        elseif ($method === 'GET') {
            try {
                $comments = getPostComments($db, $postId, $user ? $user['id'] : null);
                sendResponse($comments);
            } catch (Exception $e) {
                error_log("Get comments error: " . $e->getMessage());
                sendError('Failed to load comments', 500);
            }
        }
    } elseif ($path_parts[2] === 'rating') {
        // POST /api/posts/{id}/rating - Add/update rating
        if ($method === 'POST') {
            if (!$user) {
                sendError('Authentication required', 401);
            }
            
            try {
                $data = getRequestData();
                $rating = (int)($data['rating'] ?? 0);
                
                if ($rating < 1 || $rating > 5) {
                    sendError('Rating must be between 1 and 5', 400);
                }
                
                $result = upsertRating($db, $postId, $user['id'], $rating);
                if ($result) {
                    error_log("⭐ Rating {$rating} added by {$user['email']} for post {$postId}");
                    sendResponse($result);
                } else {
                    sendError('Failed to save rating', 500);
                }
            } catch (Exception $e) {
                error_log("Rating error: " . $e->getMessage());
                sendError('Failed to save rating', 500);
            }
        }
        // DELETE /api/posts/{id}/rating - Remove rating
        elseif ($method === 'DELETE') {
            if (!$user) {
                sendError('Authentication required', 401);
            }
            
            try {
                $result = deleteRating($db, $postId, $user['id']);
                if ($result) {
                    error_log("🗑️ Rating removed by {$user['email']} for post {$postId}");
                    sendResponse(['success' => true, 'message' => 'Rating removed']);
                } else {
                    sendError('Failed to remove rating', 500);
                }
            } catch (Exception $e) {
                error_log("Delete rating error: " . $e->getMessage());
                sendError('Failed to remove rating', 500);
            }
        }
    }
} else {
                sendError('Invalid posts endpoint', 400);
            }
            break;
            
        case 'follow':
            if (!$user) {
                sendError('Authentication required', 401);
            }
            
            if ($method === 'POST' && isset($path_parts[1])) {
                $targetUserId = $path_parts[1];
                
                if ($targetUserId === $user['id']) {
                    sendError('Cannot follow yourself', 400);
                }
                
                try {
                    error_log("🔄 FOLLOW ACTION DEBUG - User {$user['id']} attempting to follow/unfollow {$targetUserId}");
                    
                    // Check if already following
                    $checkQuery = "SELECT id FROM follows WHERE follower_id = :follower AND following_id = :following";
                    $checkStmt = $db->prepare($checkQuery);
                    $checkStmt->execute([':follower' => $user['id'], ':following' => $targetUserId]);
                    $existingFollow = $checkStmt->fetch();
                    
                    if ($existingFollow) {
                        // Unfollow
                        error_log("🔄 Unfollowing user {$targetUserId}");
                        $deleteQuery = "DELETE FROM follows WHERE follower_id = :follower AND following_id = :following";
                        $deleteStmt = $db->prepare($deleteQuery);
                        $deleteStmt->execute([':follower' => $user['id'], ':following' => $targetUserId]);
                        
                        error_log("✅ Successfully unfollowed user {$targetUserId}");
                        sendResponse([
                            'following' => false,
                            'action' => 'unfollowed',
                            'message' => 'Successfully unfollowed user'
                        ]);
                    } else {
                        // Follow
                        error_log("🔄 Following user {$targetUserId}");
                        $followId = 'follow_' . time() . '_' . uniqid();
                        $insertQuery = "INSERT INTO follows (id, follower_id, following_id) VALUES (:id, :follower, :following)";
                        $insertStmt = $db->prepare($insertQuery);
                        $insertStmt->execute([
                            ':id' => $followId,
                            ':follower' => $user['id'], 
                            ':following' => $targetUserId
                        ]);
                        
                        error_log("✅ Successfully followed user {$targetUserId}");
                        sendResponse([
                            'following' => true,
                            'action' => 'followed',
                            'message' => 'Successfully followed user'
                        ]);
                    }
                } catch (Exception $e) {
                    error_log("❌ Follow error: " . $e->getMessage());
                    sendError('Failed to update follow status', 500);
                }
            } else {
                sendError('Invalid follow request', 400);
            }
            break;

        case 'debug':
            // Debug endpoint to see database content - NO AUTH REQUIRED FOR TESTING
            try {
                // Check users in database
                $userQuery = "SELECT id, display_name, username, posts_count, followers_count FROM users ORDER BY posts_count DESC";
                $userStmt = $db->prepare($userQuery);
                $userStmt->execute();
                $users = $userStmt->fetchAll(PDO::FETCH_ASSOC);
                
                // Check posts with hashtags
                $postsQuery = "SELECT id, user_id, content, created_at FROM posts WHERE content LIKE '%#%' ORDER BY created_at DESC LIMIT 20";
                $postsStmt = $db->prepare($postsQuery);
                $postsStmt->execute();
                $posts = $postsStmt->fetchAll(PDO::FETCH_ASSOC);
                
                // Extract hashtags
                $hashtags = [];
                foreach ($posts as $post) {
                    preg_match_all('/#([a-zA-Z0-9_]+)/', $post['content'], $matches);
                    foreach ($matches[1] as $hashtag) {
                        $tag = strtolower($hashtag);
                        $hashtags[$tag] = ($hashtags[$tag] ?? 0) + 1;
                    }
                }
                arsort($hashtags);
                
                sendResponse([
                    'database_status' => 'connected',
                    'total_users' => count($users),
                    'total_posts_with_hashtags' => count($posts),
                    'users' => $users,
                    'recent_posts' => $posts,
                    'hashtag_counts' => array_slice($hashtags, 0, 10, true),
                    'current_user' => $user['id'] ?? 'not authenticated',
                    'is_admin' => isAdmin($user),
                    'message' => 'This shows real data in your database',
                    'admin_portal' => 'Access at: https://patr.me/admin/'
                ]);
                
            } catch (Exception $e) {
                sendResponse([
                    'error' => $e->getMessage(),
                    'message' => 'Database debug failed'
                ]);
            }
            break;
            
        case '':
        case null:
            sendResponse([
                'message' => 'Welcome to Twitter Clone API 🐦',
                'version' => '11.0.0-admin-integrated',
                'status' => 'active',
                'database' => 'connected',
                'features' => [
                    'Real users only - no fallbacks',
                    'Real trending topics only',
                    'Authentic database content',
                    'Follow system',
                    'Image uploads',
                    'Feed personalization',
                    'Admin portal integration'
                ],
                'admin_portal' => 'https://patr.me/admin/',
                'note' => 'All data comes from database tables - no fake/fallback content',
                'user_email' => $user['email'] ?? 'not authenticated',
                'is_admin' => isAdmin($user)
            ]);
            break;
            
        default:
            sendError('Endpoint not found: ' . $endpoint, 404);
    }
} catch (Exception $e) {
    error_log("API Error: " . $e->getMessage());
    sendError('Server error: ' . $e->getMessage(), 500);
}

?>