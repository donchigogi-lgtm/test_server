const http = require('http');

// 접속자 IP별 통계 저장 공간
const ipStats = {};

const server = http.createServer((req, res) => {
  // 1. 프록시 거쳐 들어오는 실제 클라이언트 IP 추출
  const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
  const clientIp = rawIp.split(',')[0].trim();

  // 2. 관리자용 통계 대시보드 화면 (/stats)
  if (req.url === '/stats') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    
    // 요청 횟수 많은 순으로 정렬
    const sortedStats = Object.entries(ipStats).sort((a, b) => b[1].count - a[1].count);

    let rows = sortedStats.map(([ip, data]) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${ip}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;"><b>${data.count.toLocaleString()}</b> 회</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${(data.bytesIn / 1024).toFixed(2)} KB</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${(data.bytesOut / 1024).toFixed(2)} KB</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${data.lastSeen}</td>
      </tr>
    `).join('');

    return res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>접속 트래픽 모니터링</title></head>
      <body style="font-family: sans-serif; padding: 20px;">
        <h2>📊 실시간 IP별 접속 순위</h2>
        <p>새로고침(F5) 누르면 최신 데이터로 갱신된다.</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 800px;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">접속 IP</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">총 접속수</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">수신(In)</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">송신(Out)</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">최근 접속시간</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="5" style="text-align:center; padding: 15px;">아직 접속 기록이 없다!</td></tr>'}
          </tbody>
        </table>
      </body>
      </html>
    `);
  }

  // 3. 일반 사용자 접속 처리 및 트래픽 누적
  let inBytes = 0;
  req.on('data', chunk => { inBytes += chunk.length; });

  req.on('end', () => {
    const responseBody = '<h1>서버 정상 작동 중!</h1>';
    const outBytes = Buffer.byteLength(responseBody, 'utf8');

    // IP별 데이터 기록
    if (!ipStats[clientIp]) {
      ipStats[clientIp] = { count: 0, bytesIn: 0, bytesOut: 0, lastSeen: '' };
    }
    ipStats[clientIp].count += 1;
    ipStats[clientIp].bytesIn += inBytes;
    ipStats[clientIp].bytesOut += outBytes;
    ipStats[clientIp].lastSeen = new Date().toLocaleTimeString('ko-KR');

    // 콘솔에도 로그 한 줄 출력
    console.log(`[접속] IP: ${clientIp} | 누적: ${ipStats[clientIp].count}회`);

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(responseBody);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`서버 가동: ${PORT}`));
