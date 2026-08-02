<?php
// models/User.php - Enhanced with suggested users and better error handling

class User {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function getById($id) {
        try {
            $query = "SELECT id, email, display_name, username, bio, location, website, 
                             profile_image_url, cover_image_url, followers_count, following_count, 
                             created_at, date_of_birth 
                      FROM users WHERE id = :id";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            
            return $stmt->fetch();
        } catch (Exception $e) {
            error_log("Error in User::getById: " . $e->getMessage());
            return false;
        }
    }

    public function getByUsername($username) {
        try {
            $query = "SELECT id, email, display_name, username, bio, location, website, 
                             profile_image_url, cover_image_url, followers_count, following_count, 
                             created_at, date_of_birth 
                      FROM users WHERE username = :username";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':username', $username);
            $stmt->execute();
            
            return $stmt->fetch();
        } catch (Exception $e) {
            error_log("Error in User::getByUsername: " . $e->getMessage());
            return false;
        }
    }

    public function create($userData) {
        try {
            $query = "INSERT INTO users (id, email, display_name, username, profile_image_url) 
                      VALUES (:id, :email, :display_name, :username, :profile_image_url)";
            
            $stmt = $this->conn->prepare($query);
            
            $stmt->bindParam(':id', $userData['id']);
            $stmt->bindParam(':email', $userData['email']);
            $stmt->bindParam(':display_name', $userData['display_name']);
            $stmt->bindParam(':username', $userData['username']);
            $stmt->bindParam(':profile_image_url', $userData['profile_image_url']);
            
            if ($stmt->execute()) {
                return $this->getById($userData['id']);
            }
            return false;
        } catch (Exception $e) {
            error_log("Error in User::create: " . $e->getMessage());
            return false;
        }
    }

    public function update($id, $updateData) {
        try {
            $setClause = [];
            $params = [':id' => $id];
            
            foreach ($updateData as $field => $value) {
                $setClause[] = "$field = :$field";
                $params[":$field"] = $value;
            }
            
            if (empty($setClause)) {
                return $this->getById($id);
            }
            
            $query = "UPDATE users SET " . implode(', ', $setClause) . " WHERE id = :id";
            $stmt = $this->conn->prepare($query);
            
            if ($stmt->execute($params)) {
                return $this->getById($id);
            }
            return false;
        } catch (Exception $e) {
            error_log("Error in User::update: " . $e->getMessage());
            return false;
        }
    }

    public function search($query) {
        try {
            $searchTerm = "%$query%";
            $sql = "SELECT id, email, display_name, username, bio, profile_image_url, 
                           followers_count, following_count 
                    FROM users 
                    WHERE display_name LIKE :search 
                       OR username LIKE :search 
                       OR email LIKE :search 
                    ORDER BY followers_count DESC 
                    LIMIT 20";
            
            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(':search', $searchTerm);
            $stmt->execute();
            
            return $stmt->fetchAll();
        } catch (Exception $e) {
            error_log("Error in User::search: " . $e->getMessage());
            return [];
        }
    }

    public function getSuggested($userId) {
        try {
            // Get users that the current user is not following, ordered by followers
            $query = "SELECT u.id, u.display_name, u.username, u.profile_image_url, u.followers_count,
                             FALSE as following
                      FROM users u
                      WHERE u.id != :user_id 
                        AND u.id NOT IN (
                            SELECT following_id FROM follows WHERE follower_id = :user_id
                        )
                      ORDER BY u.followers_count DESC, RAND()
                      LIMIT 10";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':user_id', $userId);
            $stmt->execute();
            
            $suggested = $stmt->fetchAll();
            
            // If no users found, return sample data
            if (empty($suggested)) {
                return $this->getSampleUsers();
            }
            
            return $suggested;
        } catch (Exception $e) {
            error_log("Error in User::getSuggested: " . $e->getMessage());
            return $this->getSampleUsers();
        }
    }
    
    public function getSampleUsers() {
        // Return sample suggested users when database is empty or has errors
        return [
            [
                'id' => 'sample1',
                'display_name' => 'Tech News',
                'username' => 'technews',
                'profile_image_url' => null,
                'followers_count' => 1250,
                'following' => false
            ],
            [
                'id' => 'sample2',
                'display_name' => 'Design Tips',
                'username' => 'designtips', 
                'profile_image_url' => null,
                'followers_count' => 890,
                'following' => false
            ],
            [
                'id' => 'sample3',
                'display_name' => 'Code Daily',
                'username' => 'codedaily',
                'profile_image_url' => null,
                'followers_count' => 2100,
                'following' => false
            ],
            [
                'id' => 'sample4',
                'display_name' => 'UI/UX World',
                'username' => 'uiuxworld',
                'profile_image_url' => null,
                'followers_count' => 1800,
                'following' => false
            ],
            [
                'id' => 'sample5',
                'display_name' => 'Web Dev Tips',
                'username' => 'webdevtips',
                'profile_image_url' => null,
                'followers_count' => 950,
                'following' => false
            ]
        ];
    }

    public function toggleFollow($followerId, $followingId) {
        try {
            // Check if already following
            $checkQuery = "SELECT id FROM follows WHERE follower_id = :follower_id AND following_id = :following_id";
            $checkStmt = $this->conn->prepare($checkQuery);
            $checkStmt->bindParam(':follower_id', $followerId);
            $checkStmt->bindParam(':following_id', $followingId);
            $checkStmt->execute();
            
            $isFollowing = $checkStmt->fetch();
            
            if ($isFollowing) {
                // Unfollow
                $unfollowQuery = "DELETE FROM follows WHERE follower_id = :follower_id AND following_id = :following_id";
                $unfollowStmt = $this->conn->prepare($unfollowQuery);
                $unfollowStmt->bindParam(':follower_id', $followerId);
                $unfollowStmt->bindParam(':following_id', $followingId);
                $unfollowStmt->execute();
                
                // Update counts
                $this->updateFollowCounts($followerId, $followingId, false);
                
                return ['following' => false, 'message' => 'Unfollowed successfully'];
            } else {
                // Follow
                $followQuery = "INSERT INTO follows (follower_id, following_id) VALUES (:follower_id, :following_id)";
                $followStmt = $this->conn->prepare($followQuery);
                $followStmt->bindParam(':follower_id', $followerId);
                $followStmt->bindParam(':following_id', $followingId);
                $followStmt->execute();
                
                // Update counts
                $this->updateFollowCounts($followerId, $followingId, true);
                
                return ['following' => true, 'message' => 'Followed successfully'];
            }
        } catch (Exception $e) {
            error_log("Error in User::toggleFollow: " . $e->getMessage());
            return ['error' => 'Failed to toggle follow status'];
        }
    }

    private function updateFollowCounts($followerId, $followingId, $isFollow) {
        try {
            if ($isFollow) {
                // Increase following count for follower, followers count for following
                $query1 = "UPDATE users SET following_count = following_count + 1 WHERE id = :follower_id";
                $query2 = "UPDATE users SET followers_count = followers_count + 1 WHERE id = :following_id";
            } else {
                // Decrease counts
                $query1 = "UPDATE users SET following_count = GREATEST(following_count - 1, 0) WHERE id = :follower_id";
                $query2 = "UPDATE users SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = :following_id";
            }
            
            $stmt1 = $this->conn->prepare($query1);
            $stmt1->bindParam(':follower_id', $followerId);
            $stmt1->execute();
            
            $stmt2 = $this->conn->prepare($query2);
            $stmt2->bindParam(':following_id', $followingId);
            $stmt2->execute();
        } catch (Exception $e) {
            error_log("Error updating follow counts: " . $e->getMessage());
        }
    }

    public function getFollowing($userId, $page = 1, $limit = 20) {
        try {
            $offset = ($page - 1) * $limit;
            
            $query = "SELECT u.id, u.display_name, u.username, u.profile_image_url, u.bio, u.followers_count
                      FROM users u
                      INNER JOIN follows f ON u.id = f.following_id
                      WHERE f.follower_id = :user_id
                      ORDER BY f.created_at DESC
                      LIMIT :limit OFFSET :offset";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':user_id', $userId);
            $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindParam(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            
            return $stmt->fetchAll();
        } catch (Exception $e) {
            error_log("Error in User::getFollowing: " . $e->getMessage());
            return [];
        }
    }

    public function getFollowers($userId, $page = 1, $limit = 20) {
        try {
            $offset = ($page - 1) * $limit;
            
            $query = "SELECT u.id, u.display_name, u.username, u.profile_image_url, u.bio, u.followers_count
                      FROM users u
                      INNER JOIN follows f ON u.id = f.follower_id
                      WHERE f.following_id = :user_id
                      ORDER BY f.created_at DESC
                      LIMIT :limit OFFSET :offset";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':user_id', $userId);
            $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindParam(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            
            return $stmt->fetchAll();
        } catch (Exception $e) {
            error_log("Error in User::getFollowers: " . $e->getMessage());
            return [];
        }
    }
}
?>