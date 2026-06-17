const http = require('http')

const server = http.createServer((req, res) => {
  res.end('Hello Manas Bhai! 🚀')
})

server.listen(3000, () => {
  console.log('Server chal gaya! Port 3000 pe 🔥')
})
