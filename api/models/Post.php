<?php
// models/Post.php - Enhanced with complete user data in post responses

class Post {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function create($postData) {
        try {
            // Generate UUID for post
            $id = $this->generateUUID();
            
            $query = "INSERT INTO posts (id, user_id, content, image_url, reply_to_id, quote_tweet_id) 
                      VALUES (:id, :user_id, :content, :image_url, :reply_to_id, :quote_tweet_id)";
            
            $stmt = $this->conn->prepare($query);
            
            $stmt->bindParam(':id', $id);
            $stmt->bindParam(':user_id', $postData['user_id']);
            $stmt->bindParam(':content', $postData['content']);
            $stmt->bindParam(':image_url', $postData['image_url']);
            $stmt->bindParam(':reply_to_id', $postData['reply_to_id']);
            $stmt->bindParam(':quote_tweet_id', $postData['quote_tweet_id']);
            
            if ($stmt->execute()) {
                return $this->getById($id, $postData['user_id']);
            }
            return false;
        } catch (Exception $e) {
            error_log("Error in Post::create: " . $e->getMessage());
            return false;
        }
    }

    public function getById($id, $currentUserId = null) {
        try {
            $query = "SELECT p.id, p.content, p.image_url, p.created_at, p.updated_at,
                             p.user_id, p.reply_to_id, p.quote_tweet_id,
                             p.likes_count, p.retweets_count, p.replies_count,
                             
                             u.display_name, u.username, u.profile_image_url,
                             u.followers_count, u.following_count,
                             
                             " . ($currentUserId ? "
                             EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = :current_user_id) as liked_by_user,
                             EXISTS(SELECT 1 FROM retweets WHERE post_id = p.id AND user_id = :current_user_id) as retweeted_by_user,
                             EXISTS(SELECT 1 FROM bookmarks WHERE post_id = p.id AND user_id = :current_user_id) as bookmarked_by_user
                             " : "
                             FALSE as liked_by_user,
                             FALSE as retweeted_by_user,
                             FALSE as bookmarked_by_user
                             ") . "
                      FROM posts p
                      INNER JOIN users u ON p.user_id = u.id
                      WHERE p.id = :id";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':id', $id);
            if ($currentUserId) {
                $stmt->bindParam(':current_user_id', $currentUserId);
            }
            $stmt->execute();
            
            $post = $stmt->fetch();
            
            if ($post) {
                return $this->formatPostResponse($post);
            }
            
            return false;
        } catch (Exception $e) {
            error_log("Error in Post::getById: " . $e->getMessage());
            return false;
        }
    }

    public function getFeed($userId, $page = 1, $limit = 20) {
        try {
            $offset = ($page - 1) * $limit;
            
            $query = "SELECT p.id, p.content, p.image_url, p.created_at, p.updated_at,
                             p.user_id, p.reply_to_id, p.quote_tweet_id,
                             p.likes_count, p.retweets_count, p.replies_count,
                             
                             u.display_name, u.username, u.profile_image_url,
                             u.followers_count, u.following_count,
                             
                             EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = :user_id) as liked_by_user,
                             EXISTS(SELECT 1 FROM retweets WHERE post_id = p.id AND user_id = :user_id) as retweeted_by_user,
                             EXISTS(SELECT 1 FROM bookmarks WHERE post_id = p.id AND user_id = :user_id) as bookmarked_by_user
                      FROM posts p
                      INNER JOIN users u ON p.user_id = u.id
                      WHERE p.user_id = :user_id 
                         OR p.user_id IN (
                             SELECT following_id FROM follows WHERE follower_id = :user_id
                         )
                      ORDER BY p.created_at DESC
                      LIMIT :limit OFFSET :offset";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':user_id', $userId);
            $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindParam(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            
            $posts = $stmt->fetchAll();
            
            // If no posts found, return sample posts for demo
            if (empty($posts) && $page == 1) {
                return $this->getSamplePosts($userId);
            }
            
            return array_map([$this, 'formatPostResponse'], $posts);
        } catch (Exception $e) {
            error_log("Error in Post::getFeed: " . $e->getMessage());
            
            // Return sample posts if there's an error
            if ($page == 1) {
                return $this->getSamplePosts($userId);
            }
            return [];
        }
    }

    public function getPublicPosts($page = 1, $limit = 20) {
        try {
            $offset = ($page - 1) * $limit;
            
            $query = "SELECT p.id, p.content, p.image_url, p.created_at, p.updated_at,
                             p.user_id, p.reply_to_id, p.quote_tweet_id,
                             p.likes_count, p.retweets_count, p.replies_count,
                             
                             u.display_name, u.username, u.profile_image_url,
                             u.followers_count, u.following_count,
                             
                             FALSE as liked_by_user,
                             FALSE as retweeted_by_user,
                             FALSE as bookmarked_by_user
                      FROM posts p
                      INNER JOIN users u ON p.user_id = u.id
                      ORDER BY p.created_at DESC
                      LIMIT :limit OFFSET :offset";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindParam(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            
            $posts = $stmt->fetchAll();
            return array_map([$this, 'formatPostResponse'], $posts);
        } catch (Exception $e) {
            error_log("Error in Post::getPublicPosts: " . $e->getMessage());
            return [];
        }
    }

    public function getUserPosts($targetUserId, $currentUserId = null, $page = 1, $limit = 20) {
        try {
            $offset = ($page - 1) * $limit;
            
            $query = "SELECT p.id, p.content, p.image_url, p.created_at, p.updated_at,
                             p.user_id, p.reply_to_id, p.quote_tweet_id,
                             p.likes_count, p.retweets_count, p.replies_count,
                             
                             u.display_name, u.username, u.profile_image_url,
                             u.followers_count, u.following_count,
                             
                             " . ($currentUserId ? "
                             EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = :current_user_id) as liked_by_user,
                             EXISTS(SELECT 1 FROM retweets WHERE post_id = p.id AND user_id = :current_user_id) as retweeted_by_user,
                             EXISTS(SELECT 1 FROM bookmarks WHERE post_id = p.id AND user_id = :current_user_id) as bookmarked_by_user
                             " : "
                             FALSE as liked_by_user,
                             FALSE as retweeted_by_user,
                             FALSE as bookmarked_by_user
                             ") . "
                      FROM posts p
                      INNER JOIN users u ON p.user_id = u.id
                      WHERE p.user_id = :target_user_id
                      ORDER BY p.created_at DESC
                      LIMIT :limit OFFSET :offset";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':target_user_id', $targetUserId);
            if ($currentUserId) {
                $stmt->bindParam(':current_user_id', $currentUserId);
            }
            $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindParam(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            
            $posts = $stmt->fetchAll();
            return array_map([$this, 'formatPostResponse'], $posts);
        } catch (Exception $e) {
            error_log("Error in Post::getUserPosts: " . $e->getMessage());
            return [];
        }
    }

    private function formatPostResponse($post) {
        return [
            'id' => $post['id'] ?? '',
            'content' => $post['content'] ?? '',
            'imageUrl' => $post['image_url'] ?? null,
            'createdAt' => $post['created_at'] ?? date('Y-m-d H:i:s'),
            'updatedAt' => $post['updated_at'] ?? $post['created_at'] ?? date('Y-m-d H:i:s'),
            
            // User data - this is what was missing!
            'user' => [
                'id' => $post['user_id'] ?? '',
                'displayName' => $post['display_name'] ?? 'User',
                'username' => $post['username'] ?? null,
                'profileImageUrl' => $post['profile_image_url'] ?? null,
                'followersCount' => (int)($post['followers_count'] ?? 0),
                'followingCount' => (int)($post['following_count'] ?? 0)
            ],
            
            // Post statistics
            'likesCount' => (int)($post['likes_count'] ?? 0),
            'retweetsCount' => (int)($post['retweets_count'] ?? 0),
            'repliesCount' => (int)($post['replies_count'] ?? 0),
            
            // User interaction status
            'likedByUser' => (bool)($post['liked_by_user'] ?? false),
            'retweetedByUser' => (bool)($post['retweeted_by_user'] ?? false),
            'bookmarkedByUser' => (bool)($post['bookmarked_by_user'] ?? false),
            
            // Reply/quote info
            'replyToId' => $post['reply_to_id'] ?? null,
            'quoteTweetId' => $post['quote_tweet_id'] ?? null
        ];
    }

    private function getSamplePosts($userId) {
        // Return sample posts when database is empty
        $currentTime = date('Y-m-d H:i:s');
        
        return [
            [
                'id' => 'sample1',
                'content' => 'Welcome to your Twitter clone! 🎉 This is a sample post to show how the feed works.',
                'imageUrl' => null,
                'createdAt' => $currentTime,
                'updatedAt' => $currentTime,
                'user' => [
                    'id' => 'system',
                    'displayName' => 'Twitter Clone',
                    'username' => 'twitterclone',
                    'profileImageUrl' => null,
                    'followersCount' => 1000,
                    'followingCount' => 50
                ],
                'likesCount' => 5,
                'retweetsCount' => 2,
                'repliesCount' => 1,
                'likedByUser' => false,
                'retweetedByUser' => false,
                'bookmarkedByUser' => false,
                'replyToId' => null,
                'quoteTweetId' => null
            ],
            [
                'id' => 'sample2',
                'content' => 'Just deployed my new app! The authentication system is working perfectly. 🚀 #webdev #coding',
                'imageUrl' => null,
                'createdAt' => date('Y-m-d H:i:s', strtotime('-1 hour')),
                'updatedAt' => date('Y-m-d H:i:s', strtotime('-1 hour')),
                'user' => [
                    'id' => 'dev1',
                    'displayName' => 'Developer',
                    'username' => 'developer',
                    'profileImageUrl' => null,
                    'followersCount' => 250,
                    'followingCount' => 180
                ],
                'likesCount' => 12,
                'retweetsCount' => 4,
                'repliesCount' => 3,
                'likedByUser' => false,
                'retweetedByUser' => false,
                'bookmarkedByUser' => false,
                'replyToId' => null,
                'quoteTweetId' => null
            ]
        ];
    }

    public function toggleLike($postId, $userId) {
        try {
            // Check if already liked
            $checkQuery = "SELECT id FROM likes WHERE post_id = :post_id AND user_id = :user_id";
            $checkStmt = $this->conn->prepare($checkQuery);
            $checkStmt->bindParam(':post_id', $postId);
            $checkStmt->bindParam(':user_id', $userId);
            $checkStmt->execute();
            
            $isLiked = $checkStmt->fetch();
            
            if ($isLiked) {
                // Unlike
                $deleteQuery = "DELETE FROM likes WHERE post_id = :post_id AND user_id = :user_id";
                $deleteStmt = $this->conn->prepare($deleteQuery);
                $deleteStmt->bindParam(':post_id', $postId);
                $deleteStmt->bindParam(':user_id', $userId);
                $deleteStmt->execute();
                
                // Update count
                $updateQuery = "UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = :post_id";
                $updateStmt = $this->conn->prepare($updateQuery);
                $updateStmt->bindParam(':post_id', $postId);
                $updateStmt->execute();
                
                return ['liked' => false, 'message' => 'Post unliked'];
            } else {
                // Like
                $likeId = $this->generateUUID();
                $insertQuery = "INSERT INTO likes (id, post_id, user_id) VALUES (:id, :post_id, :user_id)";
                $insertStmt = $this->conn->prepare($insertQuery);
                $insertStmt->bindParam(':id', $likeId);
                $insertStmt->bindParam(':post_id', $postId);
                $insertStmt->bindParam(':user_id', $userId);
                $insertStmt->execute();
                
                // Update count
                $updateQuery = "UPDATE posts SET likes_count = likes_count + 1 WHERE id = :post_id";
                $updateStmt = $this->conn->prepare($updateQuery);
                $updateStmt->bindParam(':post_id', $postId);
                $updateStmt->execute();
                
                return ['liked' => true, 'message' => 'Post liked'];
            }
        } catch (Exception $e) {
            error_log("Error in Post::toggleLike: " . $e->getMessage());
            return ['error' => 'Failed to toggle like'];
        }
    }

    public function toggleRetweet($postId, $userId) {
        try {
            // Check if already retweeted
            $checkQuery = "SELECT id FROM retweets WHERE post_id = :post_id AND user_id = :user_id";
            $checkStmt = $this->conn->prepare($checkQuery);
            $checkStmt->bindParam(':post_id', $postId);
            $checkStmt->bindParam(':user_id', $userId);
            $checkStmt->execute();
            
            $isRetweeted = $checkStmt->fetch();
            
            if ($isRetweeted) {
                // Undo retweet
                $deleteQuery = "DELETE FROM retweets WHERE post_id = :post_id AND user_id = :user_id";
                $deleteStmt = $this->conn->prepare($deleteQuery);
                $deleteStmt->bindParam(':post_id', $postId);
                $deleteStmt->bindParam(':user_id', $userId);
                $deleteStmt->execute();
                
                // Update count
                $updateQuery = "UPDATE posts SET retweets_count = GREATEST(retweets_count - 1, 0) WHERE id = :post_id";
                $updateStmt = $this->conn->prepare($updateQuery);
                $updateStmt->bindParam(':post_id', $postId);
                $updateStmt->execute();
                
                return ['retweeted' => false, 'message' => 'Retweet removed'];
            } else {
                // Retweet
                $retweetId = $this->generateUUID();
                $insertQuery = "INSERT INTO retweets (id, post_id, user_id) VALUES (:id, :post_id, :user_id)";
                $insertStmt = $this->conn->prepare($insertQuery);
                $insertStmt->bindParam(':id', $retweetId);
                $insertStmt->bindParam(':post_id', $postId);
                $insertStmt->bindParam(':user_id', $userId);
                $insertStmt->execute();
                
                // Update count
                $updateQuery = "UPDATE posts SET retweets_count = retweets_count + 1 WHERE id = :post_id";
                $updateStmt = $this->conn->prepare($updateQuery);
                $updateStmt->bindParam(':post_id', $postId);
                $updateStmt->execute();
                
                return ['retweeted' => true, 'message' => 'Post retweeted'];
            }
        } catch (Exception $e) {
            error_log("Error in Post::toggleRetweet: " . $e->getMessage());
            return ['error' => 'Failed to toggle retweet'];
        }
    }

    public function toggleBookmark($postId, $userId) {
        try {
            // Check if already bookmarked
            $checkQuery = "SELECT id FROM bookmarks WHERE post_id = :post_id AND user_id = :user_id";
            $checkStmt = $this->conn->prepare($checkQuery);
            $checkStmt->bindParam(':post_id', $postId);
            $checkStmt->bindParam(':user_id', $userId);
            $checkStmt->execute();
            
            $isBookmarked = $checkStmt->fetch();
            
            if ($isBookmarked) {
                // Remove bookmark
                $deleteQuery = "DELETE FROM bookmarks WHERE post_id = :post_id AND user_id = :user_id";
                $deleteStmt = $this->conn->prepare($deleteQuery);
                $deleteStmt->bindParam(':post_id', $postId);
                $deleteStmt->bindParam(':user_id', $userId);
                $deleteStmt->execute();
                
                return ['bookmarked' => false, 'message' => 'Bookmark removed'];
            } else {
                // Add bookmark
                $bookmarkId = $this->generateUUID();
                $insertQuery = "INSERT INTO bookmarks (id, post_id, user_id) VALUES (:id, :post_id, :user_id)";
                $insertStmt = $this->conn->prepare($insertQuery);
                $insertStmt->bindParam(':id', $bookmarkId);
                $insertStmt->bindParam(':post_id', $postId);
                $insertStmt->bindParam(':user_id', $userId);
                $insertStmt->execute();
                
                return ['bookmarked' => true, 'message' => 'Post bookmarked'];
            }
        } catch (Exception $e) {
            error_log("Error in Post::toggleBookmark: " . $e->getMessage());
            return ['error' => 'Failed to toggle bookmark'];
        }
    }

    public function delete($postId, $userId) {
        try {
            // First verify the user owns the post
            $checkQuery = "SELECT user_id FROM posts WHERE id = :post_id";
            $checkStmt = $this->conn->prepare($checkQuery);
            $checkStmt->bindParam(':post_id', $postId);
            $checkStmt->execute();
            
            $post = $checkStmt->fetch();
            if (!$post || $post['user_id'] !== $userId) {
                return false; // Not authorized or post not found
            }
            
            // Delete the post
            $deleteQuery = "DELETE FROM posts WHERE id = :post_id AND user_id = :user_id";
            $deleteStmt = $this->conn->prepare($deleteQuery);
            $deleteStmt->bindParam(':post_id', $postId);
            $deleteStmt->bindParam(':user_id', $userId);
            
            return $deleteStmt->execute();
        } catch (Exception $e) {
            error_log("Error in Post::delete: " . $e->getMessage());
            return false;
        }
    }

    public function search($query, $currentUserId = null, $page = 1, $limit = 20) {
        try {
            $searchTerm = "%$query%";
            $offset = ($page - 1) * $limit;
            
            $sql = "SELECT p.id, p.content, p.image_url, p.created_at, p.updated_at,
                           p.user_id, p.reply_to_id, p.quote_tweet_id,
                           p.likes_count, p.retweets_count, p.replies_count,
                           
                           u.display_name, u.username, u.profile_image_url,
                           u.followers_count, u.following_count,
                           
                           " . ($currentUserId ? "
                           EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = :current_user_id) as liked_by_user,
                           EXISTS(SELECT 1 FROM retweets WHERE post_id = p.id AND user_id = :current_user_id) as retweeted_by_user,
                           EXISTS(SELECT 1 FROM bookmarks WHERE post_id = p.id AND user_id = :current_user_id) as bookmarked_by_user
                           " : "
                           FALSE as liked_by_user,
                           FALSE as retweeted_by_user,
                           FALSE as bookmarked_by_user
                           ") . "
                    FROM posts p
                    INNER JOIN users u ON p.user_id = u.id
                    WHERE p.content LIKE :search
                    ORDER BY p.created_at DESC
                    LIMIT :limit OFFSET :offset";
            
            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(':search', $searchTerm);
            if ($currentUserId) {
                $stmt->bindParam(':current_user_id', $currentUserId);
            }
            $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindParam(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            
            $posts = $stmt->fetchAll();
            return array_map([$this, 'formatPostResponse'], $posts);
        } catch (Exception $e) {
            error_log("Error in Post::search: " . $e->getMessage());
            return [];
        }
    }

    public function getTrendingHashtags() {
        try {
            $query = "SELECT hashtag_name, COUNT(*) as count 
                      FROM hashtags h
                      INNER JOIN posts p ON h.post_id = p.id
                      WHERE p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                      GROUP BY hashtag_name
                      ORDER BY count DESC
                      LIMIT 10";
            
            $stmt = $this->conn->prepare($query);
            $stmt->execute();
            
            $results = $stmt->fetchAll();
            
            if (empty($results)) {
                // Return sample trending hashtags
                return ['javascript', 'react', 'webdev', 'coding', 'tech', 'programming', 'nodejs', 'typescript', 'ai', 'machinelearning'];
            }
            
            return array_column($results, 'hashtag_name');
        } catch (Exception $e) {
            error_log("Error in Post::getTrendingHashtags: " . $e->getMessage());
            return ['javascript', 'react', 'webdev', 'coding', 'tech'];
        }
    }

    private function generateUUID() {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }
}
?>