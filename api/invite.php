<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../db.php'; // your existing DB connection

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit(json_encode(['error' => 'Method not allowed']));
}

$data = json_decode(file_get_contents('php://input'), true);
$name  = trim($data['name'] ?? '');
$email = trim($data['email'] ?? '');
$org   = trim($data['organisation'] ?? '');
$reason = trim($data['reason'] ?? '');

if (!$name || !$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    exit(json_encode(['error' => 'Name and valid email are required']));
}

// Check not already requested
$stmt = $pdo->prepare("SELECT id, status FROM invite_requests WHERE email = ?");
$stmt->execute([$email]);
$existing = $stmt->fetch();

if ($existing) {
    $msg = $existing['status'] === 'approved'
        ? 'Your request was already approved. Check your email.'
        : 'You have already submitted a request. We will be in touch.';
    exit(json_encode(['message' => $msg]));
}

// Save request
$stmt = $pdo->prepare("INSERT INTO invite_requests (name, email, organisation, reason) VALUES (?,?,?,?)");
$stmt->execute([$name, $email, $org, $reason]);

// Email admin
$to      = 'admin@patr.me';
$subject = "New Invite Request — $name";
$htmlBody = "
<!DOCTYPE html><html><body style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;'>
<div style='background:#1d9bf0;padding:24px;border-radius:12px 12px 0 0;'>
  <h1 style='color:#fff;margin:0;font-size:22px;'>New Invite Request</h1>
</div>
<div style='background:#f8fafc;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;'>
  <table style='width:100%;border-collapse:collapse;'>
    <tr><td style='padding:8px 0;color:#64748b;font-size:14px;width:130px;'>Name</td>
        <td style='padding:8px 0;color:#0f172a;font-weight:bold;'>$name</td></tr>
    <tr><td style='padding:8px 0;color:#64748b;font-size:14px;'>Email</td>
        <td style='padding:8px 0;color:#0f172a;'>$email</td></tr>
    <tr><td style='padding:8px 0;color:#64748b;font-size:14px;'>Organisation</td>
        <td style='padding:8px 0;color:#0f172a;'>$org</td></tr>
    <tr><td style='padding:8px 0;color:#64748b;font-size:14px;'>Reason</td>
        <td style='padding:8px 0;color:#0f172a;'>$reason</td></tr>
  </table>
  <div style='margin-top:24px;text-align:center;'>
    <a href='https://patr.me/admin/admin.php?action=approve&email=".urlencode($email)."'
       style='background:#22c55e;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin-right:12px;'>
      ✓ Approve
    </a>
    <a href='https://patr.me/admin/admin.php?action=reject&email=".urlencode($email)."'
       style='background:#ef4444;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;'>
      ✗ Reject
    </a>
  </div>
</div>
</body></html>";

// Send via your existing SMTP function (reuse from admin.php)
// ... your SSL SMTP code here same as flag email ...

echo json_encode(['success' => true, 'message' => 'Request submitted! We will review and email you shortly.']);