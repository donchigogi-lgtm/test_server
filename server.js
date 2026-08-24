const http = require('http');

// IP별 통계 저장용 객체
const stats = {};

const server = http.createServer((req, res) => {
  // 실제 접속자 IP 추출
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';

  let inBytes = 0;
  req.on('data', chunk => {
    inBytes += chunk.length;
  });

  req.on('end', () => {
    // 통계 페이지 확인용 엔드포인트 (/stats)
    if (req.url === '/stats') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(stats, null, 2));
    }

    const resText = 'OK';
    const outBytes = Buffer.byteLength(resText, 'utf8');

    // IP별 데이터 누적
    if (!stats[ip]) {
      stats[ip] = { requests: 0, inboundBytes: 0, outboundBytes: 0 };
    }
    stats[ip].requests += 1;
    stats[ip].inboundBytes += inBytes;
    stats[ip].outboundBytes += outBytes;

    // 콘솔에 요약 출력
    console.log(`[요청] IP: ${ip} | 누적 요청: ${stats[ip].requests}회 | 총 수신: ${stats[ip].inboundBytes}B`);

    res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': outBytes });
    res.end(resText);
  });
});

server.listen(3000, () => {
  console.log('테스트 서버 실행 중: http://localhost:3000');
});
