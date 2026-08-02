<?php
$pdo = new PDO(
    "mysql:host=" . getenv('DB_HOST') . ";dbname=" . getenv('DB_NAME'),
    getenv('DB_USER'),
    getenv('DB_PASSWORD'),
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

$uid    = urldecode($_GET['uid'] ?? '');
$action = $_GET['action'] ?? '';

if (!$uid || !in_array($action, ['approve_invite', 'reject_invite'])) {
    die("<h2>Invalid request</h2>");
}

$status = ($action === 'approve_invite') ? 'approved' : 'rejected';

$stmt = $pdo->prepare("UPDATE users SET invite_status = ? WHERE id = ?");
$stmt->execute([$status, $uid]);

// Send welcome email if approved
if ($status === 'approved') {
    $row = $pdo->prepare("SELECT email, display_name FROM users WHERE id = ?");
    $row->execute([$uid]);
    $u = $row->fetch(PDO::FETCH_ASSOC);

    if ($u) {
        $to      = $u['email'];
        $name    = $u['display_name'];
        $subject = "You're approved — Welcome to Patr! 🎉";
        $htmlBody = "<!DOCTYPE html><html><body style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;'>
          <div style='background:#1d9bf0;padding:40px 32px;border-radius:12px 12px 0 0;text-align:center;'>
            <h1 style='color:#fff;margin:0;font-size:26px;'>Welcome to Patr! 🎉</h1>
          </div>
          <div style='background:#f8fafc;padding:40px 32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;text-align:center;'>
            <p style='color:#334155;font-size:16px;'>Hi <strong>$name</strong>,</p>
            <p style='color:#64748b;font-size:15px;margin-bottom:32px;'>Your access request has been approved. Sign in again with the same Google account to get started.</p>
            <a href='" . rtrim(getenv('APP_BASE_URL'), '/') . "/patr/' style='display:inline-block;background:#1d9bf0;color:#fff;padding:16px 48px;border-radius:50px;text-decoration:none;font-weight:bold;font-size:16px;'>
              Open Patr →
            </a>
          </div>
        </body></html>";

        // Send via SMTP
        $smtpHost = getenv('SMTP_HOST');
        $smtpPort = 465;
        $smtpUser = getenv('SMTP_USER');
        $smtpPass = getenv('SMTP_PASSWORD');

        $socket = @stream_socket_client("ssl://$smtpHost:$smtpPort", $errno, $errstr, 30);
        if ($socket) {
            $read = function() use ($socket) {
                $out = '';
                while (!feof($socket)) {
                    $line = fgets($socket, 512);
                    if ($line === false) break;
                    $out .= $line;
                    if (strlen($line) >= 4 && $line[3] === ' ') break;
                }
                return $out;
            };
            $read();
            fwrite($socket, "EHLO patr.me\r\n");          fflush($socket); $read();
            fwrite($socket, "AUTH LOGIN\r\n");             fflush($socket); $read();
            fwrite($socket, base64_encode($smtpUser)."\r\n"); fflush($socket); $read();
            fwrite($socket, base64_encode($smtpPass)."\r\n"); fflush($socket); $read();
            fwrite($socket, "MAIL FROM:<$smtpUser>\r\n");  fflush($socket); $read();
            fwrite($socket, "RCPT TO:<$to>\r\n");          fflush($socket); $read();
            fwrite($socket, "DATA\r\n");                   fflush($socket); $read();
            fwrite($socket, "From: Patr.me <$smtpUser>\r\n");
            fwrite($socket, "To: $to\r\n");
            fwrite($socket, "Subject: $subject\r\n");
            fwrite($socket, "MIME-Version: 1.0\r\n");
            fwrite($socket, "Content-Type: text/html; charset=UTF-8\r\n\r\n");
            fflush($socket);
            fwrite($socket, $htmlBody . "\r\n");
            fflush($socket);
            fwrite($socket, ".\r\n"); fflush($socket); $read();
            fwrite($socket, "QUIT\r\n"); fflush($socket);
            fclose($socket);
        }
    }
}

$icon  = $status === 'approved' ? '✅' : '❌';
$color = $status === 'approved' ? '#22c55e' : '#ef4444';
echo "<!DOCTYPE html><html><body style='font-family:Arial,sans-serif;background:#0f172a;color:#fff;text-align:center;padding:80px 20px;'>
  <div style='font-size:64px;margin-bottom:20px;'>$icon</div>
  <h2 style='color:$color;'>User <strong>$status</strong></h2>
  <p style='color:#64748b;margin-top:8px;'>You can close this tab.</p>
</body></html>";