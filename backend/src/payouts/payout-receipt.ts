function escapeHtml(value: string) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export type PayoutSnapshot = {
    streamerName?: string;
    amount: number;
    gross: number;
    commission: number;
    net: number;
    platformPercent: number;
    streamerPercent: number;
    tickets: number;
    method?: string | null;
    paidAt?: string | null;
    createdAt?: string | null;
    shows?: {
        title: string;
        tickets: number;
        gross: number;
        commission: number;
        net: number;
        platformPercent: number;
    }[];
};

export function payoutReceiptHtml(snapshot: PayoutSnapshot) {
    const rows = (snapshot.shows || [])
        .map(
            (s) => `<tr>
<td>${escapeHtml(s.title)}</td>
<td>${s.tickets}</td>
<td>${s.gross} Ft</td>
<td>${s.platformPercent}%</td>
<td>${s.commission} Ft</td>
<td>${s.net} Ft</td>
</tr>`,
        )
        .join("");
    return `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="utf-8"/>
<title>LiveShow kifizetési bizonylat</title>
<style>
body{font-family:Arial,sans-serif;background:#111;color:#eee;padding:32px}
.card{max-width:720px;margin:auto;background:#1a1a1a;border:1px solid #333;border-radius:16px;padding:28px}
h1{color:#facc15;font-size:22px}
table{width:100%;border-collapse:collapse;margin-top:16px;font-size:14px}
th,td{border-bottom:1px solid #333;padding:8px;text-align:left}
.muted{color:#aaa;font-size:12px;margin-top:24px}
</style>
</head>
<body>
<div class="card">
<h1>LiveShow · Kifizetési bizonylat</h1>
<p>Streamer: <strong>${escapeHtml(snapshot.streamerName || "")}</strong></p>
<p>Dátum: ${escapeHtml(snapshot.paidAt || snapshot.createdAt || "")}</p>
<p>Kifizetés módja: ${escapeHtml(snapshot.method || "banki átutalás")}</p>
<table>
<thead><tr><th>Műsor</th><th>Jegyek</th><th>Bevétel</th><th>Platform %</th><th>Levonás</th><th>Nettó</th></tr></thead>
<tbody>${rows || `<tr><td colspan="6">Nincs műsor-bontás.</td></tr>`}</tbody>
</table>
<p>Összes jegy: <strong>${snapshot.tickets}</strong></p>
<p>Bruttó bevétel: <strong>${snapshot.gross} Ft</strong></p>
<p>Platform levonás (${snapshot.platformPercent}%): <strong>${snapshot.commission} Ft</strong></p>
<p>Streamer részesedés (${snapshot.streamerPercent}%): <strong>${snapshot.net} Ft</strong></p>
<p>Kifizetett / igényelt összeg: <strong>${snapshot.amount} Ft</strong></p>
<p class="muted">Ez letölthető bizonylat a könyveléshez. A számlaadást és az adózást a streamer intézi; a platform csak a részesedést és a kifizetés naplóját kezeli.</p>
</div>
</body>
</html>`;
}
