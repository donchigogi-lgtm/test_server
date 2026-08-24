const http = require('http');

const server = http.createServer((req, res) => {
  let inBytes = 0;

  // 1. 들어온 요청(Inbound) 바이트 계산
  req.on('data', chunk => {
    inBytes += chunk.length;
  });

  req.on('end', () => {
    const responseBody = '<h1>마! 트래픽 체크 잘 된다!</h1>';
    const outBytes = Buffer.byteLength(responseBody, 'utf8');

    // 2. 로그에 송수신 바이트 크기 출력
    console.log(`[트래픽] In: ${inBytes} bytes | Out: ${outBytes} bytes | URL: ${req.url}`);

    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': outBytes
    });
    res.end(responseBody);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`서버 가동: ${PORT}`));
