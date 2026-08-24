const http = require('http');

const server = http.createServer((req, res) => {
  // 1. 요청 들어올 때마다 접속 로그 찍기
  console.log(`[로그] ${new Date().toISOString()} | 요청 방식: ${req.method} | 주소: ${req.url} | IP: ${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`);
  
  // 2. 접속자 브라우저에 보여줄 응답
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>마! 서버 살아있다!</h1><p>접속 성공했다 동생아.</p>');
});

// Render가 지정해주는 포트로 서버 열기
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버가 ${PORT}번 포트에서 준비 완료됐다!`);
});
