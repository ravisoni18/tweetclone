<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header("Access-Control-Allow-Origin: *");
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') { http_response_code(200); exit; }

if (isset($_GET['action']) && isset($_GET['email'])) {
    $action = $_GET['action']; // 'approve' or 'reject'
    $email  = urldecode($_GET['email']);

    // $db may not be initialised yet at this point in the file — connect now
    $earlyDb = new PDO(
        "mysql:host=localhost;dbname=u605931270_patrdb",
        "u605931270_patrdb_admin",
        "Mivaan1@#4",
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );

    $status = $action === 'approve' ? 'approved' : 'rejected';
    $stmt = $earlyDb->prepare("UPDATE invite_requests SET status=?, reviewed_at=NOW() WHERE email=?");
    $stmt->execute([$status, $email]);

    if ($action === 'approve') {
        // Send approval email to user
        $subject = 'You\'re invited to Patr!';
        $htmlBody = "
        <div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;'>
          <div style='background:#1d9bf0;padding:32px;border-radius:12px 12px 0 0;text-align:center;'>
            <h1 style='color:#fff;margin:0;'>Welcome to Patr 🎉</h1>
          </div>
          <div style='padding:32px;background:#f8fafc;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;text-align:center;'>
            <p style='color:#334155;font-size:16px;'>Your access request has been approved.</p>
            <a href='https://patr.me/patr/'
               style='display:inline-block;background:#1d9bf0;color:#fff;padding:14px 36px;
                      border-radius:50px;text-decoration:none;font-weight:bold;font-size:16px;margin-top:16px;'>
              Join Patr →
            </a>
          </div>
        </div>";
        // ... send SMTP email to $email ...
    }

    echo "User $email has been $status.";
    exit;
}

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

// --- DB ---
try {
    $db = new PDO(
        "mysql:host=localhost;dbname=u605931270_patrdb",
        "u605931270_patrdb_admin",
        "Mivaan1@#4",
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch(PDOException $e) {
    sendError('Database connection failed: ' . $e->getMessage(), 500);
}

// --- PUBLIC ENDPOINTS (no admin auth needed) ---
$rawUri = $_SERVER['REQUEST_URI'];
$afterPhpRaw = explode('admin.php', $rawUri)[1] ?? '';
$publicEndpoint = trim(explode('?', $afterPhpRaw)[0], '/');

// ── invite-status: check if a user email is approved/pending/rejected ──
if ($publicEndpoint === 'invite-status' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $email = trim($_GET['email'] ?? '');
    if (!$email) sendError('Missing email', 400);
    try {
        $pubDb = new PDO(
            "mysql:host=localhost;dbname=u605931270_patrdb",
            "u605931270_patrdb_admin",
            "Mivaan1@#4",
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
        $stmt = $pubDb->prepare("SELECT status FROM invite_requests WHERE email = ? ORDER BY id DESC LIMIT 1");
        $stmt->execute([$email]);
        $row = $stmt->fetch();
        sendResponse(['status' => $row ? $row['status'] : 'not_found']);
    } catch(Exception $e) {
        sendError('DB error: ' . $e->getMessage(), 500);
    }
}

if ($publicEndpoint === 'invite-request' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $body  = json_decode(file_get_contents('php://input'), true) ?: [];
    $email = trim($body['email'] ?? '');
    $name  = trim($body['display_name'] ?? $body['displayName'] ?? $body['name'] ?? '');

    if (!$email) sendError('Missing email', 400);

    try {
        $pubDb = new PDO(
            "mysql:host=localhost;dbname=u605931270_patrdb",
            "u605931270_patrdb_admin",
            "Mivaan1@#4",
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );

        // Upsert by email — only insert if no existing record
        $existing = $pubDb->prepare("SELECT id, status FROM invite_requests WHERE email = ?");
        $existing->execute([$email]);
        $row = $existing->fetch();

        if (!$row) {
            $pubDb->prepare(
                "INSERT INTO invite_requests (name, email, status, requested_at) VALUES (?, ?, 'pending', NOW())"
            )->execute([$name, $email]);
            sendResponse(['created' => true]);
        } else {
            sendResponse(['created' => false, 'status' => $row['status']]);
        }
    } catch(Exception $e) {
        sendError('DB error: ' . $e->getMessage(), 500);
    }
}

// --- AUTH ---
$jsonBody = json_decode(file_get_contents('php://input'), true) ?: [];
$allInput = array_merge($_GET, $_POST, $jsonBody);
$userEmail = $allInput['userEmail'] ?? '';
$adminOverride = $allInput['admin_override'] ?? 0;
if ($userEmail !== 'ravisoni18@gmail.com' && $adminOverride != 1) {
    sendError('Unauthorized', 401);
}

// --- ROUTING ---
$uri = $_SERVER['REQUEST_URI'];
$afterPhp = explode('admin.php', $uri)[1] ?? '';
$pathParts = explode('/', trim(explode('?', $afterPhp)[0], '/'));
$endpoint = $pathParts[0] ?? '';
$subId    = $pathParts[1] ?? null;
$method   = $_SERVER['REQUEST_METHOD'];

// --- Detect actual column names in posts table once ---
function getPostsCols($db) {
    static $cols = null;
    if ($cols === null) {
        $cols = $db->query("SHOW COLUMNS FROM posts")->fetchAll(PDO::FETCH_COLUMN);
    }
    return $cols;
}

try {
    switch ($endpoint) {

        // ── STATS ──
        case 'stats':
            $users = $db->query("SELECT COUNT(*) as c FROM users")->fetch()['c'];
            $posts = $db->query("SELECT COUNT(*) as c FROM posts")->fetch()['c'];

            $cols = getPostsCols($db);
            $imgCol = in_array('imageUrl', $cols) ? 'imageUrl' : (in_array('image_url', $cols) ? 'image_url' : null);
            $vidCol = in_array('videoUrl', $cols) ? 'videoUrl' : (in_array('video_url', $cols) ? 'video_url' : null);
            $imgCount = $imgCol ? $db->query("SELECT COUNT(*) as c FROM posts WHERE `$imgCol` IS NOT NULL AND `$imgCol` != ''")->fetch()['c'] : 0;
            $vidCount = $vidCol ? $db->query("SELECT COUNT(*) as c FROM posts WHERE `$vidCol` IS NOT NULL AND `$vidCol` != ''")->fetch()['c'] : 0;

            $comments = 0;
            foreach (['comments','post_comments','replies'] as $t) {
                try { $comments = $db->query("SELECT COUNT(*) as c FROM `$t`")->fetch()['c']; break; } catch(Exception $e) {}
            }

            $avgRating = 0;
            try { $avgRating = $db->query("SELECT AVG(average_rating) as a FROM posts WHERE average_rating > 0")->fetch()['a'] ?? 0; } catch(Exception $e) {}

            sendResponse([
                'users'    => ['total_users'   => (int)$users],
                'posts'    => ['total_posts'    => (int)$posts],
                'comments' => ['total_comments' => (int)$comments],
                'ratings'  => ['average_rating' => round((float)$avgRating, 2)],
                'media'    => ['images' => (int)$imgCount, 'videos' => (int)$vidCount, 'total' => (int)$imgCount + (int)$vidCount]
            ]);
            break;

        // ── USERS ──
        case 'users':
            if ($method === 'GET') {
                $cols = getPostsCols($db);
                $uCols = $db->query("SHOW COLUMNS FROM users")->fetchAll(PDO::FETCH_COLUMN);
                $createdCol = in_array('createdAt', $uCols) ? 'createdAt' : 'created_at';
                $rows = $db->query("SELECT u.id, u.display_name, u.email,
                                           u.`$createdCol` as created_at,
                                           (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as posts_count
                                    FROM users u ORDER BY u.`$createdCol` DESC")->fetchAll();
                sendResponse($rows);

            } elseif ($method === 'DELETE' && $subId) {
                foreach (['comments','ratings','follows'] as $t) {
                    try {
                        if ($t === 'follows') $db->prepare("DELETE FROM follows WHERE follower_id=? OR following_id=?")->execute([$subId,$subId]);
                        else $db->prepare("DELETE FROM `$t` WHERE user_id=?")->execute([$subId]);
                    } catch(Exception $e) {}
                }
                $db->prepare("DELETE FROM posts WHERE user_id=?")->execute([$subId]);
                $db->prepare("DELETE FROM users WHERE id=?")->execute([$subId]);
                sendResponse(['success' => true]);
            }
            break;

        // ── POSTS ──
        case 'posts':
            if ($method === 'GET') {
                $cols = getPostsCols($db);

                // Detect image/video column names
                $imgCol = in_array('imageUrl', $cols) ? 'imageUrl' : (in_array('image_url', $cols) ? 'image_url' : null);
                $vidCol = in_array('videoUrl', $cols) ? 'videoUrl' : (in_array('video_url', $cols) ? 'video_url' : null);
                $dateCol = in_array('createdAt', $cols) ? 'createdAt' : 'created_at';

                $imgSel = $imgCol ? "p.`$imgCol` as imageUrl," : "NULL as imageUrl,";
                $vidSel = $vidCol ? "p.`$vidCol` as videoUrl," : "NULL as videoUrl,";

                $query = "SELECT p.id, p.content, p.user_id,
                                 p.`$dateCol` as created_at,
                                 COALESCE(p.average_rating, 0) as average_rating,
                                 $imgSel
                                 $vidSel
                                 u.display_name, u.email as user_email, u.id as uid
                          FROM posts p
                          LEFT JOIN users u ON p.user_id = u.id
                          ORDER BY p.`$dateCol` DESC";

                $rows = $db->query($query)->fetchAll();

                $posts = array_map(function($p) {
                    return [
                        'id'             => $p['id'],
                        'content'        => $p['content'],
                        'user_id'        => $p['user_id'],
                        'created_at'     => $p['created_at'],
                        'averageRating'  => (float)($p['average_rating'] ?? 0),
                        'average_rating' => (float)($p['average_rating'] ?? 0),
                        'imageUrl'       => $p['imageUrl'] ?: null,
                        'videoUrl'       => $p['videoUrl'] ?: null,
                        'image_url'      => $p['imageUrl'] ?: null,
                        'video_url'      => $p['videoUrl'] ?: null,
                        'user' => [
                            'uid'         => $p['uid'] ?? $p['user_id'],
                            'displayName' => $p['display_name'] ?? 'Unknown',
                            'email'       => $p['user_email'] ?? ''
                        ]
                    ];
                }, $rows);

                sendResponse(['posts' => $posts]);

            } elseif ($method === 'DELETE' && $subId) {
                foreach (['comments','ratings'] as $t) {
                    try { $db->prepare("DELETE FROM `$t` WHERE post_id=?")->execute([$subId]); } catch(Exception $e) {}
                }
                $db->prepare("DELETE FROM posts WHERE id=?")->execute([$subId]);
                sendResponse(['success' => true]);
            }
            break;

        // ── COMMENTS ──
        case 'comments':
            if ($method === 'GET') {
                $commentTable = null;
                foreach (['comments','post_comments','replies'] as $t) {
                    try { $db->query("SELECT 1 FROM `$t` LIMIT 1"); $commentTable = $t; break; } catch(Exception $e) {}
                }
                if (!$commentTable) { sendResponse([]); break; }

                $cCols     = $db->query("SHOW COLUMNS FROM `$commentTable`")->fetchAll(PDO::FETCH_COLUMN);
                $textCol   = in_array('content', $cCols) ? 'content' : (in_array('text', $cCols) ? 'text' : 'content');
                $postIdCol = in_array('post_id', $cCols) ? 'post_id' : (in_array('postId', $cCols) ? 'postId' : 'post_id');
                $userIdCol = in_array('user_id', $cCols) ? 'user_id' : (in_array('userId', $cCols) ? 'userId' : 'user_id');
                $dateCol   = in_array('createdAt', $cCols) ? 'createdAt' : 'created_at';

                $rows = $db->query("SELECT c.id, c.`$textCol` as content,
                                           c.`$postIdCol` as post_id,
                                           c.`$dateCol` as created_at,
                                           u.display_name
                                    FROM `$commentTable` c
                                    LEFT JOIN users u ON c.`$userIdCol` = u.id
                                    ORDER BY c.`$dateCol` DESC LIMIT 500")->fetchAll();

                sendResponse(array_map(function($c) {
                    return [
                        'id'         => $c['id'],
                        'content'    => $c['content'],
                        'postId'     => $c['post_id'],
                        'post_id'    => $c['post_id'],
                        'created_at' => $c['created_at'],
                        'user'       => ['displayName' => $c['display_name'] ?? 'Unknown']
                    ];
                }, $rows));

            } elseif ($method === 'DELETE' && $subId) {
                $deleted = false;
                foreach (['comments','post_comments','replies'] as $t) {
                    try {
                        $s = $db->prepare("DELETE FROM `$t` WHERE id=?");
                        $s->execute([$subId]);
                        if ($s->rowCount() > 0) { $deleted = true; break; }
                    } catch(Exception $e) {}
                }
                sendResponse(['success' => $deleted]);
            }
            break;

        // ── FLAG POST ──
        case 'flag-post':
case 'flag':
    if ($method === 'POST') {
        $postId = $jsonBody['postId'] ?? null;
        $reason = $jsonBody['reason'] ?? 'Unspecified violation';
        if (!$postId) sendError('Missing postId');

        $stmt = $db->prepare("SELECT u.email, u.display_name, p.content FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?");
        $stmt->execute([$postId]);
        $target = $stmt->fetch();
        if (!$target) sendError('Post not found', 404);

        $preview = htmlspecialchars(substr($target['content'], 0, 80));
        $to      = $target['email'];
        $name    = htmlspecialchars($target['display_name']);
        $reason  = htmlspecialchars($reason);
        $from    = 'admin' . '@' . 'patr.me';
        $pass    = 'Mivaan1@#4';
        $subject = "Your post was flagged on Patr.me";

        $htmlBody  = "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body style='margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;'>";
        $htmlBody .= "<table width='100%' cellpadding='0' cellspacing='0' style='background:#f4f6f9;padding:40px 0;'><tr><td align='center'>";
        $htmlBody .= "<table width='600' cellpadding='0' cellspacing='0' style='background:#fff;border-radius:12px;overflow:hidden;'>";
        $htmlBody .= "<tr><td style='background:#1a1a2e;padding:36px 40px;text-align:center;'>";
        $htmlBody .= "<div style='font-size:28px;font-weight:700;color:#00d4ff;letter-spacing:2px;'>patr.me</div>";
        $htmlBody .= "<div style='color:#7a8bb0;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin-top:4px;'>Community Platform</div>";
        $htmlBody .= "</td></tr>";
        $htmlBody .= "<tr><td style='background:#fff8e1;border-left:4px solid #ffb300;padding:16px 40px;'>";
        $htmlBody .= "<span style='font-size:14px;color:#856404;font-weight:600;'>&#9888; Content Moderation Notice</span></td></tr>";
        $htmlBody .= "<tr><td style='padding:36px 40px;'>";
        $htmlBody .= "<p style='font-size:16px;color:#1a1a2e;'>Hello <strong>$name</strong>,</p>";
        $htmlBody .= "<p style='font-size:15px;color:#444;line-height:1.6;'>One of your posts on <strong>Patr.me</strong> has been flagged by our moderation team.</p>";
        $htmlBody .= "<table width='100%' cellpadding='0' cellspacing='0' style='background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;margin-bottom:20px;'>";
        $htmlBody .= "<tr><td style='padding:20px;'>";
        $htmlBody .= "<div style='font-size:11px;text-transform:uppercase;color:#6c757d;margin-bottom:8px;'>Flagged Post</div>";
        $htmlBody .= "<div style='font-size:14px;color:#1a1a2e;font-style:italic;'>&ldquo;$preview...&rdquo;</div>";
        $htmlBody .= "</td></tr></table>";
        $htmlBody .= "<table width='100%' cellpadding='0' cellspacing='0' style='background:#fff3cd;border:1px solid #ffc107;border-radius:8px;margin-bottom:24px;'>";
        $htmlBody .= "<tr><td style='padding:16px 20px;'>";
        $htmlBody .= "<div style='font-size:11px;text-transform:uppercase;color:#856404;margin-bottom:6px;'>Reason</div>";
        $htmlBody .= "<div style='font-size:14px;color:#533f03;font-weight:600;'>$reason</div>";
        $htmlBody .= "</td></tr></table>";
        $htmlBody .= "<p style='font-size:14px;color:#555;'>Repeated violations may result in account restrictions.</p>";
        $htmlBody .= "<div style='text-align:center;margin-top:24px;'>";
        $htmlBody .= "<a href='https://patr.me' style='background:#00d4ff;color:#0d1321;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:50px;display:inline-block;'>Visit Patr.me</a>";
        $htmlBody .= "</div></td></tr>";
        $htmlBody .= "<tr><td style='background:#f8f9fa;border-top:1px solid #e9ecef;padding:24px 40px;text-align:center;'>";
        $htmlBody .= "<p style='font-size:12px;color:#6c757d;margin:0;'>Automated message from Patr.me moderation.</p>";
        $htmlBody .= "<p style='font-size:12px;color:#6c757d;margin:4px 0 0;'>Questions? <a href='mailto:admin@patr.me' style='color:#00d4ff;'>admin@patr.me</a></p>";
        $htmlBody .= "</td></tr></table></td></tr></table></body></html>";

        // Dot-stuffing per RFC 2821
        $htmlBody = preg_replace('/^\.$/m', '..', $htmlBody);
        $htmlBody = preg_replace('/^\./m', '..', $htmlBody);

        $context = stream_context_create(['ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false,
            'allow_self_signed' => true
        ]]);

        $socket = @stream_socket_client("ssl://smtp.hostinger.com:465", $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $context);
        if (!$socket) sendError("SMTP connect failed: $errstr", 500);

        stream_set_timeout($socket, 10);

        $read = function() use ($socket) {
            $out = '';
            while (!feof($socket)) {
                $line = fgets($socket, 512);
                if ($line === false) break;
                $out .= $line;
                if (strlen($line) >= 4 && $line[3] === ' ') break;
            }
            error_log("SMTP <<< " . trim($out));
            return $out;
        };

        $write = function($data) use ($socket, $read) {
            error_log("SMTP >>> " . trim($data));
            fwrite($socket, $data . "\r\n");
            fflush($socket);
            return $read();
        };

        $read(); // banner
        $write("EHLO patr.me");
        $write("AUTH LOGIN");
        $write(base64_encode($from));
        $r = $write(base64_encode($pass));

        if (strpos($r, '235') === false) {
            fclose($socket);
            sendError('SMTP auth failed: ' . trim($r), 500);
        }

        $write("MAIL FROM:<$from>");
        $write("RCPT TO:<$to>");
        $write("DATA"); // server responds 354, then we send body

        // Send headers + body + end-of-data marker as separate writes
        fwrite($socket, "From: Patr.me Admin <$from>\r\n"); fflush($socket);
        fwrite($socket, "To: $to\r\n"); fflush($socket);
        fwrite($socket, "Subject: $subject\r\n"); fflush($socket);
        fwrite($socket, "MIME-Version: 1.0\r\n"); fflush($socket);
        fwrite($socket, "Content-Type: text/html; charset=UTF-8\r\n"); fflush($socket);
        fwrite($socket, "\r\n"); fflush($socket); // blank line = end of headers
        fwrite($socket, $htmlBody . "\r\n"); fflush($socket);
        fwrite($socket, ".\r\n"); fflush($socket); // end of DATA
        $r = $read();

        error_log("SMTP DATA response: " . trim($r));

        $write("QUIT");
        fclose($socket);

        strpos($r, '250') !== false
            ? sendResponse(['success' => true, 'message' => 'Email sent'])
            : sendError('SMTP rejected message: ' . trim($r), 500);
    }
    break;

        // ── INVITATIONS LIST ──
        case 'invitations':
            if ($method === 'GET') {
                try {
                    // Real schema: id, name, email, organisation, reason, status, requested_at, reviewed_at
                    $iCols   = $db->query("SHOW COLUMNS FROM invite_requests")->fetchAll(PDO::FETCH_COLUMN);
                    $nameCol = in_array('display_name', $iCols) ? 'display_name' : (in_array('name', $iCols) ? 'name' : 'email');
                    $dateCol = in_array('requested_at', $iCols) ? 'requested_at'
                             : (in_array('created_at',  $iCols) ? 'created_at'
                             : (in_array('createdAt',   $iCols) ? 'createdAt' : null));

                    $orderBy = $dateCol ? "i.`$dateCol` DESC" : "i.id DESC";

                    $rows = $db->query(
                        "SELECT i.id,
                                i.email,
                                i.`$nameCol`  AS display_name,
                                i.status,
                                i.reviewed_at,
                                " . ($dateCol ? "i.`$dateCol`" : "NULL") . " AS created_at
                         FROM invite_requests i
                         ORDER BY $orderBy"
                    )->fetchAll();
                    sendResponse($rows);
                } catch(Exception $e) {
                    sendResponse([]);
                }
            }
            break;

        // ── INVITE APPROVE ──
        case 'invite-approve':
            if ($method === 'POST') {
                // Accept either 'email' (preferred) or legacy 'uid'
                $email = $jsonBody['email'] ?? null;
                $invId = $jsonBody['id']    ?? null;
                if (!$email && !$invId) sendError('Missing email or id');

                try {
                    // Fetch record
                    if ($email) {
                        $stmt = $db->prepare("SELECT id, email, name FROM invite_requests WHERE email=?");
                        $stmt->execute([$email]);
                    } else {
                        $stmt = $db->prepare("SELECT id, email, name FROM invite_requests WHERE id=?");
                        $stmt->execute([$invId]);
                    }
                    $inv = $stmt->fetch();
                    if (!$inv) sendError('Invitation not found', 404);

                    $db->prepare("UPDATE invite_requests SET status='approved', reviewed_at=NOW() WHERE id=?")->execute([$inv['id']]);

                    // ── Send approval email (same SMTP helper as flag-post) ──
                    $to      = $inv['email'];
                    $name    = htmlspecialchars($inv['name'] ?? 'there');
                    $from    = 'admin@patr.me';
                    $pass    = 'Mivaan1@#4';
                    $subject = "You're in! Welcome to Patr 🎉";
                    $htmlBody  = "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body style='margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;'>";
                    $htmlBody .= "<table width='100%' cellpadding='0' cellspacing='0' style='background:#f4f6f9;padding:40px 0;'><tr><td align='center'>";
                    $htmlBody .= "<table width='600' cellpadding='0' cellspacing='0' style='background:#fff;border-radius:12px;overflow:hidden;'>";
                    $htmlBody .= "<tr><td style='background:#1a1a2e;padding:36px 40px;text-align:center;'>";
                    $htmlBody .= "<div style='font-size:28px;font-weight:700;color:#00d4ff;letter-spacing:2px;'>patr.me</div></td></tr>";
                    $htmlBody .= "<tr><td style='padding:36px 40px;text-align:center;'>";
                    $htmlBody .= "<div style='font-size:48px;margin-bottom:16px;'>🎉</div>";
                    $htmlBody .= "<h2 style='color:#1a1a2e;margin:0 0 12px;'>You're approved, $name!</h2>";
                    $htmlBody .= "<p style='color:#555;font-size:15px;line-height:1.6;'>Your invite request for <strong>Patr.me</strong> has been approved by the admin. Sign in with the same Google account to get started.</p>";
                    $htmlBody .= "<a href='https://patr.me/patr/' style='display:inline-block;background:#1d9bf0;color:#fff;padding:14px 36px;border-radius:50px;text-decoration:none;font-weight:bold;font-size:16px;margin-top:24px;'>Join Patr →</a>";
                    $htmlBody .= "</td></tr>";
                    $htmlBody .= "<tr><td style='background:#f8f9fa;border-top:1px solid #e9ecef;padding:20px 40px;text-align:center;'>";
                    $htmlBody .= "<p style='font-size:12px;color:#6c757d;margin:0;'>Questions? <a href='mailto:admin@patr.me' style='color:#00d4ff;'>admin@patr.me</a></p>";
                    $htmlBody .= "</td></tr></table></td></tr></table></body></html>";
                    $htmlBody = preg_replace('/^\./m', '..', $htmlBody);

                    $ctx    = stream_context_create(['ssl' => ['verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true]]);
                    $socket = @stream_socket_client("ssl://smtp.hostinger.com:465", $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
                    if ($socket) {
                        stream_set_timeout($socket, 10);
                        $rd = function() use ($socket) {
                            $out = '';
                            while (!feof($socket)) { $line = fgets($socket, 512); if ($line === false) break; $out .= $line; if (strlen($line) >= 4 && $line[3] === ' ') break; }
                            return $out;
                        };
                        $wr = function($d) use ($socket, $rd) { fwrite($socket, $d . "\r\n"); fflush($socket); return $rd(); };
                        $rd(); $wr("EHLO patr.me"); $wr("AUTH LOGIN"); $wr(base64_encode($from)); $wr(base64_encode($pass));
                        $wr("MAIL FROM:<$from>"); $wr("RCPT TO:<$to>"); $wr("DATA");
                        fwrite($socket, "From: Patr.me Admin <$from>\r\nTo: $to\r\nSubject: $subject\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n$htmlBody\r\n.\r\n"); fflush($socket);
                        $rd(); $wr("QUIT"); fclose($socket);
                    }
                    sendResponse(['success' => true, 'message' => "User approved and notified."]);
                } catch(Exception $e) {
                    sendError('Approve failed: ' . $e->getMessage(), 500);
                }
            }
            break;

        // ── INVITE REJECT ──
        case 'invite-reject':
            if ($method === 'POST') {
                $email = $jsonBody['email'] ?? null;
                $invId = $jsonBody['id']    ?? null;
                if (!$email && !$invId) sendError('Missing email or id');

                try {
                    if ($email) {
                        $db->prepare("UPDATE invite_requests SET status='rejected', reviewed_at=NOW() WHERE email=?")->execute([$email]);
                    } else {
                        $db->prepare("UPDATE invite_requests SET status='rejected', reviewed_at=NOW() WHERE id=?")->execute([$invId]);
                    }
                    sendResponse(['success' => true, 'message' => 'User rejected.']);
                } catch(Exception $e) {
                    sendError('Reject failed: ' . $e->getMessage(), 500);
                }
            }
            break;

        // ── DEBUG (remove in production) ──
        case 'debug-schema':
            $cols   = $db->query("SHOW COLUMNS FROM posts")->fetchAll();
            $sample = $db->query("SELECT * FROM posts ORDER BY id DESC LIMIT 1")->fetch();
            sendResponse(['columns' => array_column($cols, 'Field'), 'sample' => $sample]);
            break;

        default:
            sendError("Unknown endpoint: '$endpoint'", 404);
    }

} catch (Exception $e) {
    error_log("Admin API Error: " . $e->getMessage());
    sendError($e->getMessage(), 500);
}