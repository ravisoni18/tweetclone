<?php
// api/index.php - Complete Twitter Clone API with Enhanced Admin Features + Video Upload Support

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


// Helper functions

function getArticleById($articleId, $db) {
    $stmt = $db->prepare("
        SELECT 
            a.*,
            u.id as user_id,
            u.display_name,
            u.username,
            u.email,
            u.profile_image_url,
            u.verified
        FROM articles a
        JOIN users u ON a.user_id = u.id
        WHERE a.id = ?
    ");
    
    // OLD: $stmt->bind_param('s', $articleId);  ❌ WRONG (MySQLi)
    // NEW: Use PDO style below ✅
    $stmt->execute([$articleId]);
    $article = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$article) {
        return null;
    }
    
    return [
        'id' => $article['id'],
        'title' => $article['title'],
        'content' => $article['content'],
        'excerpt' => $article['excerpt'],
        'coverImageUrl' => $article['cover_image_url'],
        'status' => $article['status'],
        'viewsCount' => (int)$article['views_count'],
        'likesCount' => (int)$article['likes_count'],
        'commentsCount' => (int)$article['comments_count'],
        'readingTimeMinutes' => (int)$article['reading_time_minutes'],
        'createdAt' => $article['created_at'],
        'updatedAt' => $article['updated_at'],
        'publishedAt' => $article['published_at'],
        'user' => [
            'id' => $article['user_id'],
            'displayName' => $article['display_name'],
            'username' => $article['username'],
            'email' => $article['email'],
            'profileImageUrl' => $article['profile_image_url'],
            'verified' => (bool)$article['verified']
        ]
    ];
}

// REPLACE THIS ENTIRE FUNCTION
function getArticles($page, $limit, $userId, $status, $db) {
    // Convert to integers
    $page = (int)$page;
    $limit = (int)$limit;
    $offset = ($page - 1) * $limit;
    
    $whereClause = "WHERE a.status = ?";
    $params = [$status];
    $types = 's';  // s = string
    
    if ($userId) {
        $whereClause .= " AND a.user_id = ?";
        $params[] = $userId;
        $types .= 's';
    }
    
    // Get total count
    $countQuery = "SELECT COUNT(*) as total FROM articles a $whereClause";
    $countStmt = $db->prepare($countQuery);
    $countStmt->execute($params);
    $totalResult = $countStmt->fetch(PDO::FETCH_ASSOC);
    $total = (int)$totalResult['total'];
    
    // Get articles - Add LIMIT and OFFSET as INTEGERS, not in params array
    $query = "
        SELECT 
            a.*,
            u.id as user_id,
            u.display_name,
            u.username,
            u.email,
            u.profile_image_url,
            u.verified
        FROM articles a
        JOIN users u ON a.user_id = u.id
        $whereClause
        ORDER BY a.published_at DESC
        LIMIT $limit OFFSET $offset
    ";
    
    // ✅ FIX: Use query directly with integers, not as bound parameters
    $stmt = $db->prepare($query);
    $stmt->execute($params);  // Only pass status and userId
    
    $articles = [];
    while ($article = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $articles[] = [
            'id' => $article['id'],
            'title' => $article['title'],
            'excerpt' => $article['excerpt'],
            'coverImageUrl' => $article['cover_image_url'],
            'status' => $article['status'],
            'viewsCount' => (int)$article['views_count'],
            'likesCount' => (int)$article['likes_count'],
            'commentsCount' => (int)$article['comments_count'],
            'readingTimeMinutes' => (int)$article['reading_time_minutes'],
            'createdAt' => $article['created_at'],
            'publishedAt' => $article['published_at'],
            'user' => [
                'id' => $article['user_id'],
                'displayName' => $article['display_name'],
                'username' => $article['username'],
                'profileImageUrl' => $article['profile_image_url'],
                'verified' => (bool)$article['verified']
            ]
        ];
    }
    
    return [
        'data' => $articles,
        'total' => $total
    ];
}

// REPLACE THIS ENTIRE FUNCTION  
function incrementArticleViews($articleId, $db) {
    $stmt = $db->prepare("UPDATE articles SET views_count = views_count + 1 WHERE id = ?");
    $stmt->execute([$articleId]);
}

function uploadImage($file, $folder = 'images') {
    // Implement your image upload logic here
    // This is a placeholder - you should implement proper image upload
    // with validation, resizing, and storage (local or cloud)
    
    $targetDir = __DIR__ . "/uploads/$folder/";
    if (!file_exists($targetDir)) {
        mkdir($targetDir, 0755, true);
    }
    
    $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = uniqid() . '.' . $extension;
    $targetPath = $targetDir . $filename;
    
    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
        return "/uploads/$folder/$filename";
    }
    
    return null;
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

// CRITICAL FIX: Token verification for articles authentication
function verifyToken($headers, $db) {
    $authHeader = '';
    foreach ($headers as $key => $value) {
        if (strtolower($key) === 'authorization') {
            $authHeader = $value;
            break;
        }
    }
    
    if (empty($authHeader) || strpos($authHeader, 'Bearer ') !== 0) {
        error_log("❌ No valid Authorization header found");
        return null;
    }
    
    try {
        $token = str_replace('Bearer ', '', $authHeader);
        $tokenParts = explode('.', $token);
        
        if (count($tokenParts) !== 3) {
            error_log("❌ Invalid token format");
            return null;
        }
        
        $payload = base64_decode($tokenParts[1]);
        $tokenData = json_decode($payload, true);
        
        $userId = $tokenData['user_id'] ?? $tokenData['sub'] ?? null;
        
        if ($userId) {
            error_log("🔍 Extracted user ID from token: " . $userId);
            
            $stmt = $db->prepare("SELECT id FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            
            if ($stmt->fetch()) {
                error_log("✅ User verified: " . $userId);
                return $userId;
            }
        }
        
        error_log("❌ User not found in database");
        return null;
        
    } catch (Exception $e) {
        error_log("❌ Token verification error: " . $e->getMessage());
        return null;
    }
}

// Helper functions
function sendResponse($data = null, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function sendError($message, $status = 400, $details = null) {
    $error = ['error' => $message];
    if ($details) {
        $error['details'] = $details;
    }
    
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($error);
    exit;
}

function getRequestData() {
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    
    if (strpos($contentType, 'application/json') !== false) {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        
        // Enhanced logging for debugging
        error_log("📥 JSON Request Data: " . ($input ?: 'empty'));
        error_log("📊 Parsed Data: " . print_r($data, true));
        
        return $data ?: [];
    } elseif (strpos($contentType, 'multipart/form-data') !== false) {
        error_log("📥 Form Data: " . print_r($_POST, true));
        error_log("📁 Files: " . print_r(array_keys($_FILES), true));
        return $_POST;
    }
    
    error_log("📥 Default POST Data: " . print_r($_POST, true));
    return $_POST;
}

function sanitizeInput($input) {
    return htmlspecialchars(trim($input), ENT_QUOTES, 'UTF-8');
}

// NEW: Enhanced media upload handler for both images and videos
function handleMediaUpload($fileKey, $uploadType = 'posts') {
    if (!isset($_FILES[$fileKey]) || $_FILES[$fileKey]['error'] !== UPLOAD_ERR_OK) {
        return null;
    }

    $uploadedFile = $_FILES[$fileKey];
    $fileType = $uploadedFile['type'];
    $fileName = $uploadedFile['name'];
    $fileSize = $uploadedFile['size'];
    
    error_log("🎬 Media upload attempt: $fileName ($fileType, " . round($fileSize / 1024 / 1024, 2) . "MB)");
    
    // Define allowed types and size limits
    $allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    $allowedVideoTypes = [
        'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm', 
        'video/ogg', 'video/3gpp', 'video/x-msvideo', 'video/x-ms-wmv'
    ];
    
    $maxImageSize = 5 * 1024 * 1024; // 5MB for images
    $maxVideoSize = 50 * 1024 * 1024; // 50MB for videos
    
    $isImage = in_array($fileType, $allowedImageTypes);
    $isVideo = in_array($fileType, $allowedVideoTypes);
    
    if (!$isImage && !$isVideo) {
        error_log("❌ Invalid file type: $fileType");
        throw new Exception('Invalid file type. Please upload images or videos only.');
    }
    
    // Check file size
    if ($isImage && $fileSize > $maxImageSize) {
        throw new Exception('Image file too large. Maximum size is 5MB.');
    } elseif ($isVideo && $fileSize > $maxVideoSize) {
        throw new Exception('Video file too large. Maximum size is 50MB.');
    }
    
    // Create upload directory
    $uploadDir = $_SERVER['DOCUMENT_ROOT'] . '/uploads/' . $uploadType . '/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    // Generate unique filename
    $extension = pathinfo($fileName, PATHINFO_EXTENSION);
    $mediaType = $isImage ? 'image' : 'video';
    $newFileName = $mediaType . '_' . time() . '_' . uniqid() . '.' . strtolower($extension);
    $filePath = $uploadDir . $newFileName;
    
    // Move uploaded file
    if (move_uploaded_file($uploadedFile['tmp_name'], $filePath)) {
        $mediaUrl = rtrim(getenv('APP_BASE_URL'), '/') . '/uploads/' . $uploadType . '/' . $newFileName;
        error_log("✅ Media uploaded successfully: $mediaUrl");
        
        return [
            'url' => $mediaUrl,
            'type' => $mediaType,
            'size' => $fileSize,
            'original_name' => $fileName
        ];
    } else {
        error_log("❌ Failed to move uploaded file");
        throw new Exception('Failed to upload media file');
    }
}

// Helper function for time ago formatting
function timeAgo($datetime) {
    $time = time() - strtotime($datetime);
    
    if ($time < 60) {
        return 'just now';
    } elseif ($time < 3600) {
        return floor($time / 60) . ' minutes ago';
    } elseif ($time < 86400) {
        return floor($time / 3600) . ' hours ago';
    } elseif ($time < 2592000) {
        return floor($time / 86400) . ' days ago';
    } else {
        return date('M j, Y', strtotime($datetime));
    }
}

// Admin authentication check
function isAdmin($user) {
    $adminIds = [
        'lMPDiw9z3hcQGe90zjwxeGZPFTp1', // Your user ID
    ];
    
    return $user && in_array($user['id'], $adminIds);
}

// Helper function to extract user ID from Firebase token (simplified)
function extractUserFromToken($authHeader) {
    try {
        $token = str_replace('Bearer ', '', $authHeader);
        $tokenParts = explode('.', $token);
        if (count($tokenParts) !== 3) {
            return null;
        }
        
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

// Enhanced authentication that handles request body data
function authenticateUser($authHeader, $requestData, $userModel) {
    error_log("🔐 AUTHENTICATION ATTEMPT:");
    error_log("   Auth Header Present: " . ($authHeader ? 'YES' : 'NO'));
    error_log("   Request Data Keys: " . implode(', ', array_keys($requestData)));
    
    // Method 1: Try request body authentication data (for POST requests with user data)
    if (isset($requestData['userId']) && isset($requestData['userEmail'])) {
        $userId = $requestData['userId'];
        $userEmail = $requestData['userEmail'];
        $userName = $requestData['userName'] ?? $requestData['displayName'] ?? explode('@', $userEmail)[0];
        $userPhoto = $requestData['userPhoto'] ?? $requestData['profileImageUrl'] ?? '';
        
        error_log("👤 Authenticating via request body: $userId ($userEmail)");
        
        // Get or create user
        $user = $userModel->getById($userId);
        if (!$user) {
            error_log("👤 Creating new user from request data: $userId");
            $userData = [
                'id' => $userId,
                'email' => $userEmail,
                'display_name' => $userName,
                'username' => explode('@', $userEmail)[0],
                'profile_image_url' => $userPhoto
            ];
            $user = $userModel->create($userData);
        }
        
        if ($user) {
            error_log("✅ User authenticated via request body: " . $user['email']);
            return $user;
        }
    }
    
    // Method 2: Try token-based authentication (for GET requests)
    if ($authHeader && str_starts_with($authHeader, 'Bearer ')) {
        $userIdFromToken = extractUserFromToken($authHeader);
        if ($userIdFromToken) {
            error_log("🔍 Extracted user ID from token: " . $userIdFromToken);
            $user = $userModel->getById($userIdFromToken);
            if ($user) {
                error_log("✅ User authenticated via token: " . $user['email']);
                return $user;
            }
        }
    }
    
    error_log("❌ Authentication failed - no valid method found");
    return null;
}



// Setup CORS
function setupCors() {
    if (isset($_SERVER['HTTP_ORIGIN'])) {
        $allowed_origins = ['http://localhost:3000', 'https://patr.me', rtrim(getenv('APP_BASE_URL'), '/')];
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

// Post detail helper functions (ENHANCED: Added video URL support)
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
             //   'content' => $post['content'],
                'content' => html_entity_decode($post['content'], ENT_QUOTES, 'UTF-8'),

                'imageUrl' => $post['image_url'],
                'videoUrl' => $post['video_url'] ?? null, // NEW: Video URL support
                'htmlContent' => $post['html_content'] ?? null, // NEW: sandboxed HTML5 embed
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
        // Enhanced validation and logging
        error_log("📝 Creating comment - Data: " . print_r($commentData, true));
        error_log("👤 User: " . print_r($user, true));
        
        // Validate required fields
        if (empty($commentData['content'])) {
            error_log("❌ Comment validation failed: empty content");
            return ['error' => 'Comment content is required', 'code' => 'CONTENT_REQUIRED'];
        }
        
        if (empty($commentData['post_id'])) {
            error_log("❌ Comment validation failed: missing post_id");
            return ['error' => 'Post ID is required', 'code' => 'POST_ID_REQUIRED'];
        }
        
        // Check if post exists
        $postCheckQuery = "SELECT id FROM posts WHERE id = ?";
        $postCheckStmt = $db->prepare($postCheckQuery);
        $postCheckStmt->execute([$commentData['post_id']]);
        if (!$postCheckStmt->fetch()) {
            error_log("❌ Comment validation failed: post not found");
            return ['error' => 'Post not found', 'code' => 'POST_NOT_FOUND'];
        }
        
        $commentId = 'comment_' . time() . '_' . uniqid();
        
        $query = "INSERT INTO comments (id, post_id, user_id, content, parent_comment_id, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, NOW(), NOW())";
        
        $stmt = $db->prepare($query);
        $success = $stmt->execute([
            $commentId,
            $commentData['post_id'],
            $user['id'],
            $commentData['content'],
            $commentData['parent_comment_id'] ?? null
        ]);
        
        if ($success) {
            error_log("✅ Comment created successfully: " . $commentId);
            
            return [
                'id' => $commentId,
                'postId' => $commentData['post_id'],
                'content' => $commentData['content'],
                'parentCommentId' => $commentData['parent_comment_id'] ?? null,
                'createdAt' => date('Y-m-d H:i:s'),
                'updatedAt' => date('Y-m-d H:i:s'),
                'likesCount' => 0,
                'replyCount' => 0,
                'userHasLiked' => false,
                'user' => [
                    'id' => $user['id'],
                    'displayName' => $user['displayName'] ?? $user['display_name'] ?? 'User',
                    'username' => $user['username'] ?? explode('@', $user['email'])[0],
                    'email' => $user['email'],
                    'profileImageUrl' => $user['profileImageUrl'] ?? $user['profile_image_url'] ?? '',
                    'verified' => false
                ]
            ];
        }
        
        error_log("❌ Comment creation failed: database insert failed");
        return ['error' => 'Failed to create comment', 'code' => 'DATABASE_ERROR'];
        
    } catch (Exception $e) {
        error_log("❌ CreateComment error: " . $e->getMessage());
        return ['error' => 'Database error: ' . $e->getMessage(), 'code' => 'EXCEPTION'];
    }
}

function upsertRating($db, $postId, $userId, $rating) {
    try {
        // Enhanced validation and logging
        error_log("⭐ Creating rating - Post: $postId, User: $userId, Rating: $rating");
        
        // Validate rating value
        if (!is_numeric($rating) || $rating < 1 || $rating > 5) {
            error_log("❌ Rating validation failed: invalid rating value ($rating)");
            return ['error' => 'Rating must be between 1 and 5', 'code' => 'INVALID_RATING'];
        }
        
        // Check if post exists
        $postCheckQuery = "SELECT id FROM posts WHERE id = ?";
        $postCheckStmt = $db->prepare($postCheckQuery);
        $postCheckStmt->execute([$postId]);
        if (!$postCheckStmt->fetch()) {
            error_log("❌ Rating validation failed: post not found ($postId)");
            return ['error' => 'Post not found', 'code' => 'POST_NOT_FOUND'];
        }
        
        $ratingId = 'rating_' . time() . '_' . uniqid();
        
        $query = "INSERT INTO ratings (id, post_id, user_id, rating, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, NOW(), NOW())
                 ON DUPLICATE KEY UPDATE 
                 rating = VALUES(rating),
                 updated_at = NOW()";
        
        $stmt = $db->prepare($query);
        $success = $stmt->execute([$ratingId, $postId, $userId, $rating]);
        
        if ($success) {
            error_log("✅ Rating saved successfully: $rating stars for post $postId");
            
            // Get updated post rating stats
            $statsQuery = "SELECT average_rating, rating_count FROM posts WHERE id = ?";
            $statsStmt = $db->prepare($statsQuery);
            $statsStmt->execute([$postId]);
            $stats = $statsStmt->fetch(PDO::FETCH_ASSOC);
            
            return [
                'success' => true,
                'rating' => (int)$rating,
                'averageRating' => (float)($stats['average_rating'] ?? 0),
                'ratingCount' => (int)($stats['rating_count'] ?? 0),
                'message' => 'Rating saved successfully'
            ];
        }
        
        error_log("❌ Rating creation failed: database insert failed");
        return ['error' => 'Failed to save rating', 'code' => 'DATABASE_ERROR'];
        
    } catch (Exception $e) {
        error_log("❌ UpsertRating error: " . $e->getMessage());
        return ['error' => 'Database error: ' . $e->getMessage(), 'code' => 'EXCEPTION'];
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

// Database connection
class Database {
    private $host;
    private $database_name;
    private $username;
    private $password;
    public $conn;

    public function getConnection() {
        $this->host = getenv('DB_HOST');
        $this->database_name = getenv('DB_NAME');
        $this->username = getenv('DB_USER');
        $this->password = getenv('DB_PASSWORD');
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

// ENHANCED: Post model with video support
class Post {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function create($postData) {
        try {
            $id = 'post_' . time() . '_' . uniqid();
            $query = "INSERT INTO posts (id, user_id, content, image_url, video_url, html_content, created_at, updated_at)
                     VALUES (:id, :user_id, :content, :image_url, :video_url, :html_content, NOW(), NOW())";
            $stmt = $this->conn->prepare($query);
            $success = $stmt->execute([
                ':id' => $id,
                ':user_id' => $postData['user_id'],
                ':content' => $postData['content'],
                ':image_url' => $postData['image_url'],
                ':video_url' => $postData['video_url'] ?? null, // NEW: Video URL support
                ':html_content' => $postData['html_content'] ?? null // NEW: sandboxed HTML5 embed
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
                return [
                    'id' => $post['id'],
                   // 'content' => $post['content'],
                   'content' => html_entity_decode($post['content'], ENT_QUOTES, 'UTF-8'),

                    'imageUrl' => $post['image_url'],
                    'videoUrl' => $post['video_url'] ?? null, // NEW: Video URL support
                    'htmlContent' => $post['html_content'] ?? null, // NEW: sandboxed HTML5 embed
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
                    'commentsCount' => (int)($post['comments_count'] ?? 0),
                    'averageRating' => (float)($post['average_rating'] ?? 0),
                    'ratingCount' => (int)($post['rating_count'] ?? 0),
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

// Create tables if they don't exist (ENHANCED: Added video_url column)
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

    // ENHANCED: Posts table with video support and ratings/comments columns
    $db->exec("CREATE TABLE IF NOT EXISTS posts (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        video_url TEXT,
        html_content MEDIUMTEXT,
        likes_count INT DEFAULT 0,
        retweets_count INT DEFAULT 0,
        replies_count INT DEFAULT 0,
        average_rating DECIMAL(2,1) DEFAULT 0.0,
        rating_count INT DEFAULT 0,
        comments_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
    )");

    // Add video_url column to existing posts table if it doesn't exist
    try {
        $db->exec("ALTER TABLE posts ADD COLUMN video_url TEXT");
        error_log("✅ Added video_url column to posts table");
    } catch (Exception $e) {
        // Column may already exist, ignore error
        error_log("📝 video_url column may already exist");
    }

    // Add html_content column to existing posts table if it doesn't exist
    // Holds a self-contained HTML5 snippet (e.g. a small game); always rendered
    // client-side inside a sandboxed iframe with no same-origin/top-navigation
    // access — see HtmlEmbed.tsx. Never rendered unsandboxed.
    try {
        $db->exec("ALTER TABLE posts ADD COLUMN html_content MEDIUMTEXT");
        error_log("✅ Added html_content column to posts table");
    } catch (Exception $e) {
        // Column may already exist, ignore error
        error_log("📝 html_content column may already exist");
    }

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

    // Add rating/comment columns to existing posts table if they don't exist
    try {
        $db->exec("ALTER TABLE posts 
                   ADD COLUMN average_rating DECIMAL(2,1) DEFAULT 0.0,
                   ADD COLUMN rating_count INT DEFAULT 0,
                   ADD COLUMN comments_count INT DEFAULT 0");
    } catch (Exception $e) {
        // Columns may already exist, ignore error
    }
    
    $db->exec("CREATE TABLE IF NOT EXISTS invite_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    profile_image_url TEXT,
    invite_status ENUM('pending','approved','rejected') DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP NULL
)");




try {
    $db->exec("ALTER TABLE users ADD COLUMN invite_status ENUM('pending','approved','rejected') DEFAULT 'approved'");
    $db->exec("ALTER TABLE users ADD COLUMN invite_requested_at TIMESTAMP NULL");
} catch (Exception $e) { /* already exists */ }

$db->exec("UPDATE users SET invite_status = 'approved' WHERE invite_status IS NULL");


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

// Enhanced authentication
$user = null;
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$data = getRequestData();

// Create user model for authentication
$userModel = new User($db);

// Use the enhanced authentication function
$user = authenticateUser($authHeader, $data, $userModel);

// API Routes
try {
    switch ($endpoint) {
        case 'health':
            sendResponse([
                'status' => 'OK',
                'message' => 'Twitter Clone API - Enhanced with Video Support 🚀🎬',
                'timestamp' => date('c'),
                'version' => '15.0.0-video-support',
                'database_connected' => true,
                'features' => [
                    'Post detail view with 5-star ratings',
                    'Threaded comment system with likes', 
                    'Real-time interactions',
                    'Enhanced admin portal with full CRUD',
                    'Image AND Video uploads 🎥',
                    'Follow system',
                    'Feed personalization',
                    'Content moderation tools'
                ],
                'media_support' => [
                    'images' => ['jpg', 'png', 'gif', 'webp'],
                    'videos' => ['mp4', 'webm', 'mov', 'avi'],
                    'image_limit' => '5MB',
                    'video_limit' => '50MB'
                ],
                'authentication' => [
                    'user_authenticated' => !is_null($user),
                    'user_email' => $user['email'] ?? null,
                    'user_id' => $user['id'] ?? null,
                    'is_admin' => isAdmin($user)
                ],
                'admin_endpoints' => [
                    'GET /api/admin/stats - Platform statistics',
                    'GET /api/admin/posts - Post management', 
                    'DELETE /api/admin/posts/{id} - Delete posts',
                    'GET /api/admin/activity - Recent activity',
                    'GET /api/admin/users - User management'
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
            
            
       case 'articles':
    if ($method === 'GET') {
        if (isset($path_parts[1])) {
            $articleId = $path_parts[1];
            $article = getArticleById($articleId, $db);
            
            if ($article) {
                incrementArticleViews($articleId, $db);
                sendResponse($article);
            } else {
                sendError('Article not found', 404);
            }
        } else {
            $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
            $userId = isset($_GET['userId']) ? $_GET['userId'] : null;
            $status = isset($_GET['status']) ? $_GET['status'] : 'published';
            
            $result = getArticles($page, $limit, $userId, $status, $db);
            sendResponse([
                'articles' => $result['data'],
                'total' => $result['total'],
                'page' => $page,
                'limit' => $limit
            ]);
        }
        
    } else if ($method === 'POST') {
    // Get authenticated user
    $userId = null;
    $headers = getallheaders();
    
    // Try token authentication
    if (!$userId) {
        $userId = verifyToken($headers, $db);
    }
    
    // Try request body authentication
    if (!$userId && isset($data['userId'])) {
        $userId = $data['userId'];
        $stmt = $db->prepare("SELECT id FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        if (!$stmt->fetch()) {
            $userId = null;
        }
    }
    
    if (!$userId) {
        error_log('❌ Articles: Unauthorized');
        sendError('Unauthorized', 401);
    }
    
    error_log('✅ Articles: User authenticated - ' . $userId);
    error_log('📝 Articles: Request data - ' . print_r($data, true));
    
    // FIXED: Get data from $data variable (JSON), not $_POST
    $title = isset($data['title']) ? trim($data['title']) : '';
    $content = isset($data['content']) ? trim($data['content']) : '';
    $excerpt = isset($data['excerpt']) ? trim($data['excerpt']) : '';
    $coverImageUrl = isset($data['coverImageUrl']) ? trim($data['coverImageUrl']) : '';
    $status = isset($data['status']) ? $data['status'] : 'draft';
    $readingTimeMinutes = isset($data['readingTimeMinutes']) ? (int)$data['readingTimeMinutes'] : 1;
    
    error_log('📊 Articles: Extracted data:');
    error_log('   Title: ' . $title);
    error_log('   Content length: ' . strlen($content));
    error_log('   Cover Image URL: ' . ($coverImageUrl ?: 'none'));
    error_log('   Status: ' . $status);
    
    // Validate
    if ($title === '' || $content === '') {
        error_log('❌ Articles: Validation failed');
        sendError('Title and content required', 400);
    }
    
    // Generate IDs
    $articleId = 'article_' . time() . '_' . bin2hex(random_bytes(8));
    $now = date('Y-m-d H:i:s');
    $publishedAt = ($status === 'published') ? $now : null;
    
    error_log('📊 About to insert article with cover URL: ' . $coverImageUrl);
    
    try {
        $stmt = $db->prepare("
            INSERT INTO articles (
                id, user_id, title, content, excerpt, 
                cover_image_url, status, reading_time_minutes,
                created_at, updated_at, published_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        $success = $stmt->execute([
            $articleId,
            $userId,
            $title,
            $content,
            $excerpt,
            $coverImageUrl,  // FIXED: Now saving the URL!
            $status,
            $readingTimeMinutes,
            $now,
            $now,
            $publishedAt
        ]);
        
        if ($success) {
            error_log('✅ Articles: Article created - ' . $articleId);
            error_log('   Cover image URL saved: ' . ($coverImageUrl ?: 'none'));
            
            $article = getArticleById($articleId, $db);
            sendResponse($article, 201);
        } else {
            error_log('❌ Articles: Failed to insert');
            sendError('Failed to create article', 500);
        }
        
    } catch (Exception $e) {
        error_log('❌ Articles: Exception - ' . $e->getMessage());
        sendError('Failed to create article: ' . $e->getMessage(), 500);
    }
}
    break;
    
    
    
    
    
    
    
    
    
    
    case 'upload':
    if ($method === 'POST') {
        // Verify authentication
        $userId = null;
        $headers = getallheaders();
        
        // Try token authentication first
        if (!$userId) {
            $userId = verifyToken($headers, $db);
        }
        
        // Try request body authentication
        if (!$userId && isset($data['userId'])) {
            $userId = $data['userId'];
            $stmt = $db->prepare("SELECT id FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            if (!$stmt->fetch()) {
                $userId = null;
            }
        }
        
        if (!$userId) {
            error_log('❌ Upload: No authenticated user');
            sendError('Unauthorized - authentication required', 401);
        }
        
        error_log('✅ Upload: Authenticated user: ' . $userId);
        
        // Check if file was uploaded
        if (!isset($_FILES['media'])) {
            error_log('❌ Upload: No media file found in request');
            sendError('No file uploaded', 400);
        }
        
        $file = $_FILES['media'];
        error_log('📎 Upload: File received - ' . $file['name'] . ' (' . $file['size'] . ' bytes)');
        
        // Validate file type
        $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        $maxSize = 10 * 1024 * 1024; // 10MB
        
        if (!in_array($file['type'], $allowedTypes)) {
            error_log('❌ Upload: Invalid file type - ' . $file['type']);
            sendError('Invalid file type. Allowed: JPG, PNG, GIF, WEBP, SVG', 400);
        }
        
        if ($file['size'] > $maxSize) {
            error_log('❌ Upload: File too large - ' . $file['size'] . ' bytes');
            sendError('File too large. Maximum size is 10MB', 400);
        }
        
        // Check for upload errors
        if ($file['error'] !== UPLOAD_ERR_OK) {
            error_log('❌ Upload: File error code - ' . $file['error']);
            sendError('File upload error: ' . $file['error'], 400);
        }
        
        // Generate unique filename
        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = 'article_' . time() . '_' . bin2hex(random_bytes(8)) . '.' . $extension;
        
        // Set upload directory
        $uploadDir = $_SERVER['DOCUMENT_ROOT'] . '/uploads/articles/';
        
        // Create directory if it doesn't exist
        if (!is_dir($uploadDir)) {
            error_log('📁 Upload: Creating directory - ' . $uploadDir);
            if (!mkdir($uploadDir, 0755, true)) {
                error_log('❌ Upload: Failed to create directory');
                sendError('Failed to create upload directory', 500);
            }
        }
        
        $uploadPath = $uploadDir . $filename;
        error_log('💾 Upload: Saving to - ' . $uploadPath);
        
        // Move uploaded file
        if (move_uploaded_file($file['tmp_name'], $uploadPath)) {
            // Generate public URL
            $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'];
            $fileUrl = $protocol . '://' . $host . '/uploads/articles/' . $filename;
            
            error_log('✅ Upload: Success! URL - ' . $fileUrl);
            
            sendResponse([
                'success' => true,
                'url' => $fileUrl,
                'filename' => $filename
            ], 200);
        } else {
            error_log('❌ Upload: Failed to move file from temp location');
            sendError('Failed to save file', 500);
        }
    } else {
        sendError('Method not allowed. Use POST', 405);
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
                            // Delete user - enhanced with comment/rating cleanup
                            $userId = $path_parts[2];
                            
                            try {
                                $db->beginTransaction();
                                
                                // Delete user's comment likes first
                                $deleteCommentLikesQuery = "DELETE FROM comment_likes WHERE user_id = ?";
                                $stmt = $db->prepare($deleteCommentLikesQuery);
                                $stmt->execute([$userId]);
                                
                                // Delete user's ratings
                                $deleteRatingsQuery = "DELETE FROM ratings WHERE user_id = ?";
                                $stmt = $db->prepare($deleteRatingsQuery);
                                $stmt->execute([$userId]);
                                
                                // Delete user's comments
                                $deleteCommentsQuery = "DELETE FROM comments WHERE user_id = ?";
                                $stmt = $db->prepare($deleteCommentsQuery);
                                $stmt->execute([$userId]);
                                
                                // Delete user's posts
                                $deletePostsQuery = "DELETE FROM posts WHERE user_id = ?";
                                $stmt = $db->prepare($deletePostsQuery);
                                $stmt->execute([$userId]);
                                
                                // Delete user's follows
                                $deleteFollowsQuery = "DELETE FROM follows WHERE follower_id = ? OR following_id = ?";
                                $stmt = $db->prepare($deleteFollowsQuery);
                                $stmt->execute([$userId, $userId]);
                                
                                // Delete the user
                                $deleteUserQuery = "DELETE FROM users WHERE id = ?";
                                $stmt = $db->prepare($deleteUserQuery);
                                $stmt->execute([$userId]);
                                
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
                                         (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) as following_count,
                                         (SELECT COUNT(*) FROM comments WHERE user_id = u.id) as comments_count,
                                         (SELECT COUNT(*) FROM ratings WHERE user_id = u.id) as ratings_count
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
                        
                    case 'stats':
                        if ($method === 'GET') {
                            try {
                                // Enhanced stats including new tables
                                $stats = [];
                                
                                // User stats
                                $userStatsQuery = "SELECT 
                                    COUNT(*) as total_users,
                                    COUNT(CASE WHEN created_at >= CURDATE() THEN 1 END) as users_today,
                                    COUNT(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as users_week
                                    FROM users";
                                $stmt = $db->prepare($userStatsQuery);
                                $stmt->execute();
                                $stats['users'] = $stmt->fetch(PDO::FETCH_ASSOC);
                                
                                // Post stats
                                $postStatsQuery = "SELECT 
                                    COUNT(*) as total_posts,
                                    COALESCE(AVG(NULLIF(average_rating, 0)), 0) as avg_rating,
                                    COUNT(CASE WHEN rating_count > 0 THEN 1 END) as posts_with_ratings,
                                    COUNT(CASE WHEN created_at >= CURDATE() THEN 1 END) as posts_today
                                    FROM posts";
                                $stmt = $db->prepare($postStatsQuery);
                                $stmt->execute();
                                $stats['posts'] = $stmt->fetch(PDO::FETCH_ASSOC);
                                
                                // Comment stats
                                $commentStatsQuery = "SELECT 
                                    COUNT(*) as total_comments,
                                    COUNT(CASE WHEN created_at >= CURDATE() THEN 1 END) as comments_today
                                    FROM comments";
                                $stmt = $db->prepare($commentStatsQuery);
                                $stmt->execute();
                                $stats['comments'] = $stmt->fetch(PDO::FETCH_ASSOC);
                                
                                // Rating stats
                                $ratingStatsQuery = "SELECT 
                                    COUNT(*) as total_ratings,
                                    COALESCE(AVG(rating), 0) as average_rating,
                                    COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star_count,
                                    COUNT(CASE WHEN created_at >= CURDATE() THEN 1 END) as ratings_today
                                    FROM ratings";
                                $stmt = $db->prepare($ratingStatsQuery);
                                $stmt->execute();
                                $stats['ratings'] = $stmt->fetch(PDO::FETCH_ASSOC);
                                
                                // Activity summary
                                $stats['activity'] = [
                                    'today_total' => (
                                        (int)($stats['users']['users_today'] ?? 0) +
                                        (int)($stats['posts']['posts_today'] ?? 0) +
                                        (int)($stats['comments']['comments_today'] ?? 0) +
                                        (int)($stats['ratings']['ratings_today'] ?? 0)
                                    )
                                ];
                                
                                error_log("📊 Admin stats loaded for {$user['email']}");
                                sendResponse($stats);
                                
                            } catch (Exception $e) {
                                sendError('Failed to load stats: ' . $e->getMessage(), 500);
                            }
                        }
                        break;

                    case 'posts':
                        if ($method === 'GET') {
                            // GET /api/admin/posts - Enhanced post listing (ENHANCED: Include video URLs)
                            try {
                                $limit = min((int)($_GET['limit'] ?? 20), 100);
                                $offset = (int)($_GET['offset'] ?? 0);
                                $search = $_GET['search'] ?? '';
                                
                                $whereClause = '';
                                $params = [];
                                
                                if ($search) {
                                    $whereClause = " WHERE (p.content LIKE :search OR u.display_name LIKE :search)";
                                    $params[':search'] = '%' . $search . '%';
                                }
                                
                                $query = "SELECT p.*, u.display_name, u.email, u.username, u.profile_image_url,
                                                 COALESCE(p.average_rating, 0) as averageRating,
                                                 COALESCE(p.rating_count, 0) as ratingCount,
                                                 COALESCE(p.comments_count, 0) as commentsCount
                                         FROM posts p 
                                         LEFT JOIN users u ON p.user_id = u.id 
                                         $whereClause
                                         ORDER BY p.created_at DESC 
                                         LIMIT :limit OFFSET :offset";
                                
                                $stmt = $db->prepare($query);
                                $params[':limit'] = $limit;
                                $params[':offset'] = $offset;
                                
                                foreach ($params as $key => $value) {
                                    $stmt->bindValue($key, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
                                }
                                
                                $stmt->execute();
                                $posts = $stmt->fetchAll(PDO::FETCH_ASSOC);
                                
                                // Format for admin display
                                $formattedPosts = array_map(function($post) {
                                    return [
                                        'id' => $post['id'],
                                      //  'content' => $post['content'],
                                      'content' => html_entity_decode($post['content'], ENT_QUOTES, 'UTF-8'),

                                        'imageUrl' => $post['image_url'],
                                        'videoUrl' => $post['video_url'] ?? null, // NEW: Video URL support
                                        'createdAt' => $post['created_at'],
                                        'updatedAt' => $post['updated_at'],
                                        'averageRating' => (float)$post['averageRating'],
                                        'ratingCount' => (int)$post['ratingCount'],
                                        'commentsCount' => (int)$post['commentsCount'],
                                        'user' => [
                                            'id' => $post['user_id'],
                                            'displayName' => $post['display_name'] ?? 'Unknown User',
                                            'username' => $post['username'] ?? 'user',
                                            'email' => $post['email'] ?? 'unknown@example.com',
                                            'profileImageUrl' => $post['profile_image_url'] ?? ''
                                        ]
                                    ];
                                }, $posts);
                                
                                sendResponse(['posts' => $formattedPosts, 'total' => count($formattedPosts)]);
                                
                            } catch (Exception $e) {
                                sendError('Failed to load posts: ' . $e->getMessage(), 500);
                            }
                        } elseif (isset($path_parts[2]) && $method === 'DELETE') {
                            // DELETE /api/admin/posts/{id} - Delete post with cleanup
                            $postId = $path_parts[2];
                            
                            try {
                                $db->beginTransaction();
                                
                                // Delete associated content
                                $queries = [
                                    "DELETE cl FROM comment_likes cl INNER JOIN comments c ON cl.comment_id = c.id WHERE c.post_id = ?",
                                    "DELETE FROM comments WHERE post_id = ?",
                                    "DELETE FROM ratings WHERE post_id = ?",
                                    "DELETE FROM posts WHERE id = ?"
                                ];
                                
                                foreach ($queries as $query) {
                                    $stmt = $db->prepare($query);
                                    $stmt->execute([$postId]);
                                }
                                
                                $db->commit();
                                
                                error_log("🗑️ Admin {$user['email']} deleted post: $postId");
                                sendResponse(['success' => true, 'message' => 'Post deleted successfully']);
                                
                            } catch (Exception $e) {
                                $db->rollback();
                                error_log("❌ Admin post deletion failed: " . $e->getMessage());
                                sendError('Failed to delete post: ' . $e->getMessage(), 500);
                            }
                        }
                        break;

                    case 'activity':
                        if ($method === 'GET') {
                            // GET /api/admin/activity - Recent platform activity
                            try {
                                $activities = [];
                                
                                // Recent user registrations
                                $userQuery = "SELECT 'user' as type, 'User registered' as action, 
                                                     display_name as user_name, email, created_at 
                                             FROM users 
                                             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                                             ORDER BY created_at DESC LIMIT 5";
                                $stmt = $db->prepare($userQuery);
                                $stmt->execute();
                                $userActivities = $stmt->fetchAll(PDO::FETCH_ASSOC);
                                
                                // Recent posts
                                $postQuery = "SELECT 'post' as type, 'Post created' as action,
                                                     u.display_name as user_name, u.email, p.created_at
                                             FROM posts p
                                             LEFT JOIN users u ON p.user_id = u.id
                                             WHERE p.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                                             ORDER BY p.created_at DESC LIMIT 5";
                                $stmt = $db->prepare($postQuery);
                                $stmt->execute();
                                $postActivities = $stmt->fetchAll(PDO::FETCH_ASSOC);
                                
                                // Recent ratings
                                $ratingQuery = "SELECT 'rating' as type, CONCAT(r.rating, '-star rating') as action,
                                                       u.display_name as user_name, u.email, r.created_at
                                               FROM ratings r
                                               LEFT JOIN users u ON r.user_id = u.id
                                               WHERE r.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                                               ORDER BY r.created_at DESC LIMIT 5";
                                $stmt = $db->prepare($ratingQuery);
                                $stmt->execute();
                                $ratingActivities = $stmt->fetchAll(PDO::FETCH_ASSOC);
                                
                                // Combine activities
                                $allActivities = array_merge($userActivities, $postActivities, $ratingActivities);
                                
                                // Sort by time and format
                                usort($allActivities, function($a, $b) {
                                    return strtotime($b['created_at']) - strtotime($a['created_at']);
                                });
                                
                                $formattedActivities = array_map(function($activity) {
                                    return [
                                        'type' => $activity['type'],
                                        'action' => $activity['action'],
                                        'user' => $activity['user_name'] ?? $activity['email'] ?? 'Unknown',
                                        'time' => $activity['created_at'],
                                        'timeAgo' => timeAgo($activity['created_at'])
                                    ];
                                }, array_slice($allActivities, 0, 10));
                                
                                sendResponse($formattedActivities);
                                
                            } catch (Exception $e) {
                                sendError('Failed to load activity: ' . $e->getMessage(), 500);
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
            if (($method === 'GET' || $method === 'POST') && isset($path_parts[1])) {
                $identifier = $path_parts[1];
                
                if ($identifier === 'search') {
                    // GET /api/users/search?q=searchterm
                    try {
                        $searchQuery = $_GET['q'] ?? $_GET['query'] ?? '';
                        
                        if (empty($searchQuery)) {
                            sendResponse([]);
                            break;
                        }
                        
                        error_log("🔍 User search request for: " . $searchQuery);
                        
                        $query = "SELECT u.*, 
                                 (SELECT COUNT(*) FROM follows WHERE follower_id = :current_user_id AND following_id = u.id) as is_following
                                 FROM users u 
                                 WHERE (u.display_name LIKE :search OR u.username LIKE :search OR u.email LIKE :search)
                                 AND u.id != :current_user_id2
                                 ORDER BY u.followers_count DESC, u.posts_count DESC
                                 LIMIT 20";
                        
                        $stmt = $db->prepare($query);
                        $searchTerm = '%' . $searchQuery . '%';
                        $currentUserId = $user['id'] ?? 'none';
                        
                        $stmt->bindValue(':search', $searchTerm);
                        $stmt->bindValue(':current_user_id', $currentUserId);
                        $stmt->bindValue(':current_user_id2', $currentUserId);
                        $stmt->execute();
                        
                        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
                        
                        error_log("✅ Found " . count($users) . " users for search: " . $searchQuery);
                        
                        $results = [];
                        foreach ($users as $u) {
                            $results[] = [
                                'id' => $u['id'],
                                'displayName' => $u['display_name'],
                                'username' => $u['username'] ?: explode('@', $u['email'])[0],
                                'email' => $u['email'],
                                'profileImageUrl' => $u['profile_image_url'] ?? '',
                                'followersCount' => (int)($u['followers_count'] ?? 0),
                                'following' => $user ? ((int)$u['is_following'] > 0) : false
                            ];
                        }
                        
                        sendResponse($results);
                        
                    } catch (Exception $e) {
                        error_log("❌ User search error: " . $e->getMessage());
                        sendResponse([]);
                    }
                } elseif ($identifier === 'suggested') {
                    // GET /api/users/suggested - Get suggested users
                    try {
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
                            
                            if (!$isFollowing || !$user) {
                                $suggestions[] = [
                                    'id' => $u['id'],
                                    'displayName' => $u['display_name'],
                                    'username' => $u['username'] ?: explode('@', $u['email'])[0],
                                    'email' => $u['email'],
                                    'profileImageUrl' => $u['profile_image_url'] ?? '',
                                    'followersCount' => (int)($u['followers_count'] ?? 0),
                                    'postsCount' => (int)($u['posts_count'] ?? 0),
                                    'following' => false
                                ];
                                
                                if (count($suggestions) >= 5) break;
                            }
                        }
                        
                        sendResponse($suggestions);
                        
                    } catch (Exception $e) {
                        error_log("❌ Suggested users error: " . $e->getMessage());
                        sendResponse([]);
                    }
                } else {
                    // Get user profile - GET /api/users/{id}
                    try {
                        $targetUser = $userModel->getById($identifier);
                        if (!$targetUser) {
                            sendError('User not found: ' . $identifier, 404);
                        }
                        
                        // Check follow status
                        $isFollowing = false;
                        if ($user && $user['id'] !== $identifier) {
                            $followQuery = "SELECT COUNT(*) as follow_count 
                                          FROM follows 
                                          WHERE follower_id = :follower_id 
                                          AND following_id = :following_id";
                            
                            $stmt = $db->prepare($followQuery);
                            $stmt->bindValue(':follower_id', $user['id']);
                            $stmt->bindValue(':following_id', $identifier);
                            $stmt->execute();
                            
                            $result = $stmt->fetch(PDO::FETCH_ASSOC);
                            $isFollowing = ((int)$result['follow_count']) > 0;
                        }
                        
                        $targetUser['following'] = $isFollowing;
                        sendResponse($targetUser);
                        
                    } catch (Exception $e) {
                        error_log("❌ ERROR in user profile endpoint: " . $e->getMessage());
                        sendError('Failed to load user profile: ' . $e->getMessage(), 500);
                    }
                }
            } elseif ($method === 'PUT' && isset($path_parts[1])) {
                // PUT /api/users/{id} - Update user profile
                $userId = $path_parts[1];
                
                if (!$user) {
                    sendError('Authentication required', 401);
                }
                
                if ($user['id'] !== $userId) {
                    sendError('Unauthorized to update this profile', 403);
                }
                
                try {
                    error_log("💾 Profile update request for user: " . $userId);
                    error_log("📝 Update data: " . print_r($data, true));
                    
                    $updateFields = [];
                    $updateParams = [':id' => $userId];
                    
                    // Handle each field that can be updated
                    if (isset($data['displayName'])) {
                        $updateFields[] = 'display_name = :display_name';
                        $updateParams[':display_name'] = sanitizeInput($data['displayName']);
                    }
                    
                    if (isset($data['username'])) {
                        $updateFields[] = 'username = :username';
                        $updateParams[':username'] = sanitizeInput($data['username']);
                    }
                    
                    if (isset($data['bio'])) {
                        $updateFields[] = 'bio = :bio';
                        $updateParams[':bio'] = sanitizeInput($data['bio']);
                    }
                    
                    if (isset($data['location'])) {
                        $updateFields[] = 'location = :location';
                        $updateParams[':location'] = sanitizeInput($data['location']);
                    }
                    
                    if (isset($data['website'])) {
                        $updateFields[] = 'website = :website';
                        $updateParams[':website'] = sanitizeInput($data['website']);
                    }
                    
                    if (empty($updateFields)) {
                        sendError('No fields to update', 400);
                    }
                    
                    // Add updated timestamp
                    $updateFields[] = 'updated_at = NOW()';
                    
                    $query = "UPDATE users SET " . implode(', ', $updateFields) . " WHERE id = :id";
                    
                    error_log("🔄 Executing update query: " . $query);
                    error_log("📊 Update params: " . print_r($updateParams, true));
                    
                    $stmt = $db->prepare($query);
                    $success = $stmt->execute($updateParams);
                    
                    if ($success) {
                        $rowsAffected = $stmt->rowCount();
                        error_log("📈 Rows affected: " . $rowsAffected);
                        
                        if ($rowsAffected > 0) {
                            // Return updated user data
                            $updatedUser = $userModel->getById($userId);
                            if ($updatedUser) {
                                error_log("✅ Profile updated successfully for user: " . $userId);
                                sendResponse($updatedUser);
                            } else {
                                error_log("❌ Failed to retrieve updated profile for user: " . $userId);
                                sendError('Failed to retrieve updated profile', 500);
                            }
                        } else {
                            error_log("⚠️ No rows updated - user might not exist or no changes made");
                            sendError('No changes made or user not found', 400);
                        }
                    } else {
                        error_log("❌ Database update failed for user: " . $userId);
                        sendError('Database update failed', 500);
                    }
                    
                } catch (Exception $e) {
                    error_log("❌ Profile update exception: " . $e->getMessage());
                    sendError('Failed to update profile: ' . $e->getMessage(), 500);
                }
            } elseif ($method === 'GET' && !isset($path_parts[1])) {
                // GET /api/users - Get all users (for search fallback)
                try {
                    error_log("📋 All users request for search fallback");
                    
                    $query = "SELECT u.*,
                             (SELECT COUNT(*) FROM follows WHERE follower_id = :current_user_id AND following_id = u.id) as is_following
                             FROM users u 
                             ORDER BY u.followers_count DESC, u.posts_count DESC
                             LIMIT 100";  // Reasonable limit
                    
                    $stmt = $db->prepare($query);
                    $stmt->bindValue(':current_user_id', $user['id'] ?? 'none');
                    $stmt->execute();
                    $allUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    
                    error_log("✅ Returning " . count($allUsers) . " users for search fallback");
                    
                    $users = [];
                    foreach ($allUsers as $u) {
                        $users[] = [
                            'id' => $u['id'],
                            'displayName' => $u['display_name'],
                            'username' => $u['username'] ?: explode('@', $u['email'])[0],
                            'email' => $u['email'],
                            'profileImageUrl' => $u['profile_image_url'] ?? '',
                            'followersCount' => (int)($u['followers_count'] ?? 0),
                            'following' => $user ? ((int)$u['is_following'] > 0) : false
                        ];
                    }
                    
                    sendResponse($users);
                    
                } catch (Exception $e) {
                    error_log("❌ Users list error: " . $e->getMessage());
                    sendError('Failed to load users', 500);
                }
            } elseif ($method === 'POST') {
                // POST /api/users - Create or get existing user
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
            
            $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
            if (strpos($contentType, 'multipart/form-data') !== false) {
                $data = $_POST;
            }
            
            if ($method === 'GET' && isset($path_parts[1])) {
                if ($path_parts[1] === 'trending') {
                    // Return trending hashtags
                    try {
                        $query = "SELECT content FROM posts WHERE content LIKE '%#%' ORDER BY created_at DESC";
                        $stmt = $db->prepare($query);
                        $stmt->execute();
                        $posts = $stmt->fetchAll(PDO::FETCH_ASSOC);
                        
                        $hashtags = [];
                        foreach ($posts as $post) {
                            preg_match_all('/#([a-zA-Z0-9_]+)/', $post['content'], $matches);
                            foreach ($matches[1] as $hashtag) {
                                $tag = strtolower($hashtag);
                                // Skip numeric-only tags (e.g. "#039") — not real hashtags
                                if (strlen($tag) > 1 && strlen($tag) < 20 && !ctype_digit($tag)) {
                                    $hashtags[$tag] = ($hashtags[$tag] ?? 0) + 1;
                                }
                            }
                        }
                        
                        arsort($hashtags);
                        
                        $trending = [];
                        foreach (array_slice($hashtags, 0, 5, true) as $tag => $count) {
                            $trending[] = [
                                'tag' => '#' . $tag,
                                'posts' => $count,
                                'category' => 'Technology'
                            ];
                        }
                        
                        sendResponse($trending);
                        
                    } catch (Exception $e) {
                        error_log("Trending error: " . $e->getMessage());
                        sendResponse([]);
                    }
                } elseif ($path_parts[1] === 'feed') {
                    // Return feed posts (ENHANCED: Include video URLs)
                    try {
                        $page = (int)($_GET['page'] ?? 1);
                        $limit = min((int)($_GET['limit'] ?? 20), 50);
                        $offset = ($page - 1) * $limit;
                        $feedType = $_GET['type'] ?? 'following';
                        
                        if ($user && $feedType === 'following') {
                            $query = "SELECT p.*, u.email, u.display_name, u.username, u.profile_image_url
                                     FROM posts p 
                                     LEFT JOIN users u ON p.user_id = u.id 
                                     WHERE p.user_id = :user_id OR p.user_id IN (
                                         SELECT following_id FROM follows WHERE follower_id = :user_id2
                                     )
                                     ORDER BY p.created_at DESC 
                                     LIMIT :limit OFFSET :offset";
                            
                            $stmt = $db->prepare($query);
                            $stmt->bindValue(':user_id', $user['id']);
                            $stmt->bindValue(':user_id2', $user['id']);
                            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
                            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
                        } else {
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
                               // 'content' => $post['content'],
                               'content' => html_entity_decode($post['content'], ENT_QUOTES, 'UTF-8'),

                                'imageUrl' => $post['image_url'],
                                'videoUrl' => $post['video_url'] ?? null, // NEW: Video URL support
                                'htmlContent' => $post['html_content'] ?? null, // NEW: sandboxed HTML5 embed
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
                                'commentsCount' => (int)($post['comments_count'] ?? 0),
                                'averageRating' => (float)($post['average_rating'] ?? 0),
                                'ratingCount' => (int)($post['rating_count'] ?? 0),
                                'viewsCount' => rand(10, 500),
                                'isDeleted' => false
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
                } else {
                    // Individual post routes
                    $postId = $path_parts[1];
                    
                    if (!isset($path_parts[2])) {
                        // GET /api/posts/{id} - Post details
                        try {
                            $postDetails = getPostDetails($db, $postId, $user ? $user['id'] : null);
                            if ($postDetails) {
                                sendResponse($postDetails);
                            } else {
                                sendError('Post not found', 404);
                            }
                        } catch (Exception $e) {
                            error_log("❌ Error getting post details: " . $e->getMessage());
                            sendError('Failed to load post details', 500);
                        }
                    } elseif ($path_parts[2] === 'comments') {
                        // GET /api/posts/{id}/comments - Get comments
                        try {
                            $comments = getPostComments($db, $postId, $user ? $user['id'] : null);
                            sendResponse($comments);
                        } catch (Exception $e) {
                            error_log("❌ Error getting comments: " . $e->getMessage());
                            sendError('Failed to load comments', 500);
                        }
                    }
                }
            } elseif ($method === 'POST' && isset($path_parts[1])) {
                // POST requests to specific posts
                $postId = $path_parts[1];
                
                if (!isset($path_parts[2])) {
                    sendError('POST to individual posts requires sub-endpoint (comments or rating)', 400);
                } elseif ($path_parts[2] === 'comments') {
                    // POST /api/posts/{id}/comments - Add comment
                    if (!$user) {
                        sendError('Authentication required', 401);
                    }
                    
                    try {
                        $commentData = [
                            'post_id' => $postId,
                            'user_id' => $user['id'],
                            'content' => $data['content'] ?? '',
                            'parent_comment_id' => $data['parent_comment_id'] ?? null
                        ];
                        
                        $result = createComment($db, $commentData, $user);
                        
                        if (isset($result['error'])) {
                            sendError($result['error'], 400, [
                                'code' => $result['code'] ?? 'VALIDATION_ERROR'
                            ]);
                        }
                        
                        sendResponse($result, 201);
                        
                    } catch (Exception $e) {
                        error_log("❌ Create comment exception: " . $e->getMessage());
                        sendError('Failed to create comment: ' . $e->getMessage(), 500);
                    }
                } elseif ($path_parts[2] === 'rating') {
                    // POST /api/posts/{id}/rating - Add/update rating
                    if (!$user) {
                        sendError('Authentication required', 401, [
                            'hint' => 'Include userId, userEmail in request body'
                        ]);
                    }
                    
                    try {
                        $rating = $data['rating'] ?? null;
                        
                        if (is_null($rating)) {
                            sendError('Rating value is required', 400, [
                                'code' => 'RATING_REQUIRED',
                                'expected' => 'rating (1-5)'
                            ]);
                        }
                        
                        $result = upsertRating($db, $postId, $user['id'], $rating);
                        
                        if (isset($result['error'])) {
                            sendError($result['error'], 400, [
                                'code' => $result['code'] ?? 'VALIDATION_ERROR'
                            ]);
                        }
                        
                        sendResponse($result);
                        
                    } catch (Exception $e) {
                        error_log("❌ Rating exception: " . $e->getMessage());
                        sendError('Failed to save rating: ' . $e->getMessage(), 500);
                    }
                } else {
                    sendError('Unknown post sub-endpoint: ' . $path_parts[2], 404);
                }
            } elseif ($method === 'POST' && !isset($path_parts[1])) {
                // POST /api/posts - Create new post (ENHANCED: Video support)
                if (!$user) {
                    sendError('Authentication required', 401);
                }
                
                if (empty($data['content'])) {
                    sendError('Post content is required', 400);
                }
                
                $imageUrl = null;
                $videoUrl = null;
                $htmlContent = null;

                try {
                    // Handle image upload (existing functionality)
                    if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
                        $imageUpload = handleMediaUpload('image', 'posts');
                        if ($imageUpload && $imageUpload['type'] === 'image') {
                            $imageUrl = $imageUpload['url'];
                            error_log("🖼️ Image uploaded: $imageUrl");
                        }
                    }

                    // NEW: Handle video upload
                    if (isset($_FILES['video']) && $_FILES['video']['error'] === UPLOAD_ERR_OK) {
                        $videoUpload = handleMediaUpload('video', 'posts');
                        if ($videoUpload && $videoUpload['type'] === 'video') {
                            $videoUrl = $videoUpload['url'];
                            error_log("🎥 Video uploaded: $videoUrl");
                        }
                    }

                    // NEW: Handle HTML5 content (e.g. a small game). This is NEVER
                    // sanitized or trusted — the frontend always renders it inside a
                    // sandboxed iframe (sandbox="allow-scripts" only, no
                    // allow-same-origin/allow-top-navigation/allow-popups/allow-forms),
                    // which is the actual security boundary. We only cap size here.
                    if (!empty($data['htmlContent'])) {
                        $htmlContent = $data['htmlContent'];
                        $maxHtmlBytes = 150 * 1024; // 150KB
                        if (strlen($htmlContent) > $maxHtmlBytes) {
                            sendError('HTML5 content is too large. Maximum size is 150KB.', 400);
                        }
                    }
                } catch (Exception $e) {
                    error_log("❌ Media upload error: " . $e->getMessage());
                    sendError($e->getMessage(), 400);
                }

                $postData = [
                    'user_id' => $user['id'],
                    'content' => sanitizeInput($data['content']),
                    'image_url' => $imageUrl,
                    'video_url' => $videoUrl, // NEW: Video URL support
                    'html_content' => $htmlContent // NEW: sandboxed HTML5 embed
                ];
                
                $newPost = $postModel->create($postData);
                if ($newPost) {
                    error_log("✅ Post created with media - Image: " . ($imageUrl ? 'Yes' : 'No') . ", Video: " . ($videoUrl ? 'Yes' : 'No'));
                    sendResponse($newPost, 201);
                } else {
                    sendError('Failed to create post', 500);
                }
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
                    $checkQuery = "SELECT id FROM follows WHERE follower_id = :follower AND following_id = :following";
                    $checkStmt = $db->prepare($checkQuery);
                    $checkStmt->execute([':follower' => $user['id'], ':following' => $targetUserId]);
                    $existingFollow = $checkStmt->fetch();
                    
                    if ($existingFollow) {
                        $deleteQuery = "DELETE FROM follows WHERE follower_id = :follower AND following_id = :following";
                        $deleteStmt = $db->prepare($deleteQuery);
                        $deleteStmt->execute([':follower' => $user['id'], ':following' => $targetUserId]);
                        
                        sendResponse([
                            'following' => false,
                            'action' => 'unfollowed'
                        ]);
                    } else {
                        $followId = 'follow_' . time() . '_' . uniqid();
                        $insertQuery = "INSERT INTO follows (id, follower_id, following_id) VALUES (:id, :follower, :following)";
                        $insertStmt = $db->prepare($insertQuery);
                        $insertStmt->execute([
                            ':id' => $followId,
                            ':follower' => $user['id'], 
                            ':following' => $targetUserId
                        ]);
                        
                        sendResponse([
                            'following' => true,
                            'action' => 'followed'
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
            
            case 'auth':
    if (isset($path_parts[1]) && $path_parts[1] === 'status') {
        $headers = getallheaders();
        $authH   = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        $userId  = extractUserFromToken($authH);

        if (!$userId) {
            sendError('Unauthorized', 401);
        }

        $parts   = explode('.', str_replace('Bearer ', '', $authH));
        $payload = json_decode(base64_decode($parts[1] ?? ''), true) ?? [];
        $email   = $payload['email']   ?? '';
        $name    = $payload['name']    ?? explode('@', $email)[0];
        $photo   = $payload['picture'] ?? '';
        $username = explode('@', $email)[0];

        // Check existing user
        $stmt = $db->prepare("SELECT id, invite_status FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $existing = $stmt->fetch();

        if ($existing) {
            sendResponse(['status' => $existing['invite_status'] ?? 'approved']);
            break;
        }

        // New user — insert as pending
        try {
            $stmt = $db->prepare("
                INSERT INTO users (id, email, display_name, username, profile_image_url, invite_status, invite_requested_at)
                VALUES (?, ?, ?, ?, ?, 'pending', NOW())
                ON DUPLICATE KEY UPDATE id=id
            ");
            $stmt->execute([$userId, $email, $name, $username, $photo]);
        } catch (Exception $e) {
            error_log("Invite insert error: " . $e->getMessage());
        }

        // Email admin
  $appBaseUrl = rtrim(getenv('APP_BASE_URL'), '/');
  $approveUrl = "$appBaseUrl/admin/invite-action.php?action=approve_invite&uid=" . urlencode($userId);
$rejectUrl  = "$appBaseUrl/admin/invite-action.php?action=reject_invite&uid="  . urlencode($userId);
        $htmlBody   = "<!DOCTYPE html><html><body style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;'>
          <div style='background:#1d9bf0;padding:28px 32px;border-radius:12px 12px 0 0;'>
            <h2 style='color:#fff;margin:0;'>🔔 New Access Request</h2>
          </div>
          <div style='background:#f8fafc;padding:28px 32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;'>
            <table style='width:100%;'>
              <tr><td style='color:#64748b;padding:6px 0;width:100px;'>Name</td><td style='font-weight:bold;color:#0f172a;'>$name</td></tr>
              <tr><td style='color:#64748b;padding:6px 0;'>Email</td><td style='color:#0f172a;'>$email</td></tr>
            </table>
            <div style='text-align:center;margin-top:24px;'>
              <a href='$approveUrl' style='background:#22c55e;color:#fff;padding:12px 28px;border-radius:50px;text-decoration:none;font-weight:bold;margin-right:12px;'>✓ Approve</a>
              <a href='$rejectUrl'  style='background:#ef4444;color:#fff;padding:12px 28px;border-radius:50px;text-decoration:none;font-weight:bold;'>✗ Reject</a>
            </div>
          </div>
        </body></html>";

        $smtpHost = getenv('SMTP_HOST'); $smtpPort = 465;
        $smtpUser = getenv('SMTP_USER'); $smtpPass = getenv('SMTP_PASSWORD');
        $socket = @stream_socket_client("ssl://$smtpHost:$smtpPort", $errno, $errstr, 30);
        if ($socket) {
            $read = function() use ($socket) {
                $out = '';
                while (!feof($socket)) { $line = fgets($socket, 512); if ($line === false) break; $out .= $line; if (strlen($line) >= 4 && $line[3] === ' ') break; }
                return $out;
            };
            $read();
            fwrite($socket, "EHLO patr.me\r\n"); fflush($socket); $read();
            fwrite($socket, "AUTH LOGIN\r\n"); fflush($socket); $read();
            fwrite($socket, base64_encode($smtpUser)."\r\n"); fflush($socket); $read();
            fwrite($socket, base64_encode($smtpPass)."\r\n"); fflush($socket); $read();
            fwrite($socket, "MAIL FROM:<$smtpUser>\r\n"); fflush($socket); $read();
            fwrite($socket, "RCPT TO:<$smtpUser>\r\n"); fflush($socket); $read();
            fwrite($socket, "DATA\r\n"); fflush($socket); $read();
            fwrite($socket, "From: Patr.me <$smtpUser>\r\nTo: $smtpUser\r\nSubject: New Access Request — $name\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n");
            fflush($socket);
            fwrite($socket, $htmlBody."\r\n.\r\n"); fflush($socket); $read();
            fwrite($socket, "QUIT\r\n"); fflush($socket);
            fclose($socket);
        }

        sendResponse(['status' => 'pending']);
    }
    break;

            
            case 'search':
    if ($method === 'GET' && isset($path_parts[1]) && $path_parts[1] === 'users') {
        // GET /api/search/users?query=searchterm
        try {
            $searchQuery = $_GET['query'] ?? $_GET['q'] ?? '';
            
            if (empty($searchQuery)) {
                sendResponse([]);
                break;
            }
            
            $query = "SELECT u.*, 
                     (SELECT COUNT(*) FROM follows WHERE follower_id = :current_user_id AND following_id = u.id) as is_following
                     FROM users u 
                     WHERE (u.display_name LIKE :search OR u.username LIKE :search OR u.email LIKE :search)
                     AND u.id != :current_user_id2
                     ORDER BY u.followers_count DESC, u.posts_count DESC
                     LIMIT 20";
            
            $stmt = $db->prepare($query);
            $searchTerm = '%' . $searchQuery . '%';
            $currentUserId = $user['id'] ?? 'none';
            
            $stmt->bindValue(':search', $searchTerm);
            $stmt->bindValue(':current_user_id', $currentUserId);
            $stmt->bindValue(':current_user_id2', $currentUserId);
            $stmt->execute();
            
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $results = [];
            foreach ($users as $u) {
                $results[] = [
                    'id' => $u['id'],
                    'displayName' => $u['display_name'],
                    'username' => $u['username'] ?: explode('@', $u['email'])[0],
                    'email' => $u['email'],
                    'profileImageUrl' => $u['profile_image_url'] ?? '',
                    'followersCount' => (int)($u['followers_count'] ?? 0),
                    'following' => $user ? ((int)$u['is_following'] > 0) : false
                ];
            }
            
            sendResponse($results);
            
        } catch (Exception $e) {
            error_log("❌ User search error: " . $e->getMessage());
            sendResponse([]);
        }
    }
    break;

        case 'debug':
            try {
                $userQuery = "SELECT id, display_name, posts_count FROM users ORDER BY posts_count DESC LIMIT 10";
                $userStmt = $db->prepare($userQuery);
                $userStmt->execute();
                $users = $userStmt->fetchAll(PDO::FETCH_ASSOC);
                
                $postsQuery = "SELECT COUNT(*) as total_posts FROM posts";
                $postsStmt = $db->prepare($postsQuery);
                $postsStmt->execute();
                $postsCount = $postsStmt->fetch();
                
                $commentsQuery = "SELECT COUNT(*) as total_comments FROM comments";
                $commentsStmt = $db->prepare($commentsQuery);
                $commentsStmt->execute();
                $commentsCount = $commentsStmt->fetch();
                
                $ratingsQuery = "SELECT COUNT(*) as total_ratings FROM ratings";
                $ratingsStmt = $db->prepare($ratingsQuery);
                $ratingsStmt->execute();
                $ratingsCount = $ratingsStmt->fetch();
                
                sendResponse([
                    'database_status' => 'connected',
                    'total_users' => count($users),
                    'total_posts' => (int)$postsCount['total_posts'],
                    'total_comments' => (int)$commentsCount['total_comments'],
                    'total_ratings' => (int)$ratingsCount['total_ratings'],
                    'users' => $users,
                    'current_user' => $user['id'] ?? 'not authenticated',
                    'admin_user' => isAdmin($user),
                    'video_support' => 'enabled', // NEW: Video support indicator
                    'endpoints_available' => [
                        'GET /api/posts/{id}',
                        'POST /api/posts/{id}/comments',
                        'GET /api/posts/{id}/comments',
                        'POST /api/posts/{id}/rating',
                        'DELETE /api/posts/{id}/rating',
                        'POST /api/comments/{id}/like',
                        'DELETE /api/comments/{id}',
                        'GET /api/admin/stats',
                        'GET /api/admin/posts',
                        'DELETE /api/admin/posts/{id}',
                        'GET /api/admin/activity'
                    ],
                    'message' => 'Complete Twitter Clone API - Enhanced with Video Support!'
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
                'version' => '15.0.0-video-support',
                'status' => 'active',
                'features' => [
                    'Complete post detail system with 5-star ratings ⭐',
                    'Threaded comment system with likes and replies 💬',
                    'User authentication via request body or JWT token 🔐',
                    'Follow/unfollow system 👥',
                    'Image AND Video upload support 📸🎥', // NEW: Video support
                    'Personalized feeds (following/discover) 📰',
                    'Enhanced admin portal with full CRUD operations 🛠️',
                    'Real-time platform statistics 📊',
                    'Content moderation tools 🔍',
                    'Activity monitoring and logging 📝',
                    'Comprehensive error handling and logging 🛡️'
                ],
                'media_capabilities' => [ // NEW: Media capabilities info
                    'Image formats: JPEG, PNG, GIF, WebP',
                    'Video formats: MP4, WebM, MOV, AVI',
                    'Image size limit: 5MB',
                    'Video size limit: 50MB',
                    'Auto-resizing for large images',
                    'Video compression validation'
                ],
                'endpoints' => [
                    'POST /api/posts - Create posts with image/video', // UPDATED
                    'POST /api/posts/{id}/rating - Rate posts (1-5 stars)',
                    'POST /api/posts/{id}/comments - Add threaded comments',
                    'GET /api/posts/{id} - Get post details with media', // UPDATED
                    'GET /api/posts/feed - Personalized feed',
                    'POST /api/follow/{id} - Follow/unfollow users',
                    'GET /api/users/suggested - User suggestions',
                    'GET /api/admin/stats - Platform statistics (Admin)',
                    'GET /api/admin/posts - Post management (Admin)',
                    'DELETE /api/admin/posts/{id} - Delete posts (Admin)',
                    'GET /api/admin/activity - Recent activity (Admin)'
                ],
                'authentication_working' => !is_null($user),
                'user_email' => $user['email'] ?? 'not authenticated',
                'admin_access' => isAdmin($user)
            ]);
            break;

        default:
            sendError('Endpoint not found: ' . $endpoint, 404);
    }
} catch (Exception $e) {
    error_log("❌ API Error: " . $e->getMessage());
    sendError('Server error: ' . $e->getMessage(), 500);
}

?>