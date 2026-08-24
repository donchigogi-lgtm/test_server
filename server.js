const http = require('http');

// ----------------------------------------------------
// [보안 설정] 관리자 페이지(/stats) 로그인 계정 정보
// ----------------------------------------------------
const ADMIN_USER = '82214913';       // 원하는 아이디로 변경 가능
const ADMIN_PASS = '82214913';        // 원하는 비밀번호로 변경 가능

// IP별 통계 데이터
const ipStats = {};
// 실시간 최근 요청 로그 (최신 50개 유지)
const recentLogs = [];

// 한국 시간(KST) 24시간 포맷 변환: YYYY. MM. DD. HH:mm:ss
function getKoreanTime() {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date());

  const map = {};
  parts.forEach(p => { map[p.type] = p.value; });
  const hour = map.hour === '24' ? '00' : map.hour;
  return `${map.year}. ${map.month}. ${map.day}. ${hour}:${map.minute}:${map.second}`;
}

// 바이트 단위 포맷팅 함수 (B -> KB -> MB)
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

const server = http.createServer((req, res) => {
  // 실제 클라이언트 IP 추출
  const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
  const clientIp = rawIp.split(',')[0].trim();
  const requestUrl = req.url;
  const method = req.method;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const now = getKoreanTime();

  // favicon 요청은 통계에서 제외
  if (requestUrl === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }

  // ----------------------------------------------------
  // 모니터링 대시보드 화면 (/stats) - Basic Auth 인증 적용
  // ----------------------------------------------------
  if (requestUrl === '/stats') {
    const authHeader = req.headers['authorization'];

    if (authHeader) {
      // "Basic base64문자열" 파싱
      const [type, credentials] = authHeader.split(' ');
      if (type === 'Basic' && credentials) {
        const decoded = Buffer.from(credentials, 'base64').toString('utf-8');
        const [user, pass] = decoded.split(':');

        // 아이디와 비밀번호 일치 확인
        if (user === ADMIN_USER && pass === ADMIN_PASS) {
          // 인증 성공 -> 아래 대시보드 렌더링 로직으로 계속 진행
        } else {
          // 비밀번호 틀림
          res.writeHead(401, {
            'WWW-Authenticate': 'Basic realm="Admin Dashboard"',
            'Content-Type': 'text/html; charset=utf-8'
          });
          return res.end('<h1>401 권한 없음: 아이디 또는 비밀번호가 틀렸습니다.</h1>');
        }
      }
    } else {
      // 인증 헤더 없음 -> 브라우저 로그인 창 띄우기 요청 (401)
      res.writeHead(401, {
        'WWW-Authenticate': 'Basic realm="Admin Dashboard"',
        'Content-Type': 'text/html; charset=utf-8'
      });
      return res.end('<h1>401 로그인 필요: 관리자 인증을 완료해주세요.</h1>');
    }

    // --- 인증 통과된 관리자만 볼 수 있는 대시보드 ---
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

    // 1. 왼쪽: 총 전송량(합계) 기준 내림차순 정렬 상위 Top 50 추출
    const top50Ip = Object.entries(ipStats)
      .sort((a, b) => (b[1].bytesIn + b[1].bytesOut) - (a[1].bytesIn + a[1].bytesOut))
      .slice(0, 50);

    const leftRows = top50Ip.map(([ip, data], index) => {
      const totalBytes = data.bytesIn + data.bytesOut;
      let rankBadge = `<span style="font-weight:bold; color:#555;">#${index + 1}</span>`;
      if (index === 0) rankBadge = `<span style="color:#d97706; font-weight:bold;">🥇 1위</span>`;
      if (index === 1) rankBadge = `<span style="color:#64748b; font-weight:bold;">🥈 2위</span>`;
      if (index === 2) rankBadge = `<span style="color:#b45309; font-weight:bold;">🥉 3위</span>`;

      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px; text-align: center;">${rankBadge}</td>
          <td style="padding: 8px; font-family: monospace; font-size: 13px;"><b>${ip}</b></td>
          <td style="padding: 8px; text-align: right; font-weight: bold; color: #2563eb;">${data.count.toLocaleString()}회</td>
          <td style="padding: 8px; text-align: right; font-size: 12px; color: #059669;">${formatBytes(data.bytesIn)}</td>
          <td style="padding: 8px; text-align: right; font-size: 12px; color: #d97706;">${formatBytes(data.bytesOut)}</td>
          <td style="padding: 8px; text-align: right; font-size: 12px; font-weight: bold; color: #dc2626;">${formatBytes(totalBytes)}</td>
          <td style="padding: 8px; text-align: center; font-size: 11px; font-family: monospace; color: #6b7280; white-space: nowrap;">${data.lastSeen}</td>
        </tr>
      `;
    }).join('');

    // 2. 오른쪽: 최근 실시간 URL 접근 로그 생성
    const rightRows = recentLogs.map(log => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px; font-size: 11px; font-family: monospace; color: #6b7280; white-space: nowrap;">${log.time}</td>
        <td style="padding: 8px; font-family: monospace; font-size: 12px;">${log.ip}</td>
        <td style="padding: 8px; text-align: center;"><span style="background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">${log.method}</span></td>
        <td style="padding: 8px; font-family: monospace; font-size: 13px; color: #059669; word-break: break-all;"><b>${log.url}</b></td>
        <td style="padding: 8px; font-size: 11px; color: #6b7280; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${log.userAgent}">${log.userAgent}</td>
      </tr>
    `).join('');

    return res.end(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <title>실시간 트래픽 & URL 모니터링</title>
        <meta http-equiv="refresh" content="5">
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f3f4f6; color: #1f2937; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
          .container { display: flex; gap: 20px; height: calc(100vh - 100px); }
          .panel { flex: 1; background: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; flex-direction: column; overflow: hidden; }
          .panel-title { padding: 14px 18px; margin: 0; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 16px; font-weight: 600; display: flex; justify-content: space-between; }
          .table-wrapper { flex: 1; overflow-y: auto; }
          table { width: 100%; border-collapse: collapse; text-align: left; }
          th { position: sticky; top: 0; background: #f8fafc; padding: 10px 8px; font-size: 12px; color: #475569; border-bottom: 2px solid #e2e8f0; }
          tbody tr:hover { background-color: #f8fafc; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="margin: 0;">📊 웹서버 트래픽 모니터링 대시보드 (24H KST)</h2>
          <span style="font-size: 13px; color: #6b7280;">🔒 관리자 모드 | ⏱ 5초마다 자동 갱신됨</span>
        </div>

        <div class="container">
          <!-- 왼쪽 패널: 트래픽 Top 50 -->
          <div class="panel" style="flex: 1.2;">
            <div class="panel-title">
              <span>🔥 트래픽 상위 Top 50 IP</span>
              <span style="font-size: 12px; color: #6b7280; font-weight: normal;">총 고유 IP: ${Object.keys(ipStats).length}개</span>
            </div>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style="width: 45px; text-align: center;">순위</th>
                    <th>접속 IP</th>
                    <th style="text-align: right;">요청수</th>
                    <th style="text-align: right; color: #059669;">요청량(In)</th>
                    <th style="text-align: right; color: #d97706;">응답량(Out)</th>
                    <th style="text-align: right; color: #dc2626;">전송량(총합)</th>
                    <th style="text-align: center;">최근 접속</th>
                  </tr>
                </thead>
                <tbody>
                  ${leftRows || '<tr><td colspan="7" style="text-align: center; padding: 30px; color: #9ca3af;">아직 기록된 트래픽이 없다!</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>

          <!-- 오른쪽 패널: 실시간 요청 & 접근 URL -->
          <div class="panel" style="flex: 0.8;">
            <div class="panel-title">
              <span>⚡ 실시간 접근 로그 & URL 정보</span>
              <span style="font-size: 12px; color: #6b7280; font-weight: normal;">최신 50건</span>
            </div>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>접속 시간</th>
                    <th>IP</th>
                    <th style="text-align: center;">방식</th>
                    <th>접근 URL</th>
                    <th>브라우저 정보</th>
                  </tr>
                </thead>
                <tbody>
                  ${rightRows || '<tr><td colspan="5" style="text-align: center; padding: 30px; color: #9ca3af;">접근 기록이 없습니다.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
  }

  // ----------------------------------------------------
  // 일반 사용자 요청 처리
  // ----------------------------------------------------
  let inBytes = 0;
  req.on('data', chunk => { inBytes += chunk.length; });

  req.on('end', () => {
    const responseBody = `<h1>요청 접수 완료!</h1><p>접근 경로: <b>${requestUrl}</b></p>`;
    const outBytes = Buffer.byteLength(responseBody, 'utf8');

    // 1. IP 통계 갱신
    if (!ipStats[clientIp]) {
      ipStats[clientIp] = { count: 0, bytesIn: 0, bytesOut: 0, lastSeen: '' };
    }
    ipStats[clientIp].count += 1;
    ipStats[clientIp].bytesIn += inBytes;
    ipStats[clientIp].bytesOut += outBytes;
    ipStats[clientIp].lastSeen = now;

    // 2. 실시간 최근 로그에 추가
    recentLogs.unshift({
      time: now,
      ip: clientIp,
      method: method,
      url: requestUrl,
      userAgent: userAgent
    });
    if (recentLogs.length > 50) recentLogs.pop();

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(responseBody);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`서버 가동: ${PORT}`));
