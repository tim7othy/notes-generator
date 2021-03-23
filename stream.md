# stream
## Continuation passing style


## buffering versus streaming mode
buffer 模式下，数据到达后都会被收集起来存储到缓冲区中，读取操作完成后，调用程序中注册的callback函数来通知消费者，并将缓冲区中的数据一起提供给消费者。

stream 模式下，每次数据一到达就会立即作为一小块（chunk of）数据传递给消费者去处理。

stream模式的优点：
- 占用更小的缓冲空间。特别是buffer模式并发地读取多个大文件时，很可能会导致缓存溢出。
- 处理更迅速 (computation clock time)，不会产生小数据一直缓存得不到处理的问题
- 可组合（compasability）

实例：
从客户端压缩数据后发送到服务器端，服务端解压缩并存储到文件系统。
客户端使用buffer模式则需要首先将整个文件先读取到缓冲区中，然后再压缩，最后才开始发送到服务器，使用stream模式则可以同时进行，每个数据处理程序每个时刻都在处理数据，小块的数据在处理程序的流水线之间流转，而且前一小块数据还没有被流水线处理完，下一块数据就可以开始处理（流水线前面的组件处理完就空闲出来了）。

![](static\img\buffering-streaming-compared.png)

```js
// server.js
import { createServer } from 'http'
import { createWriteStream } from 'fs'
import { createGunzip } from 'zlib'
import { basename, join } from 'path'
const server = createServer((req, res) => {
    const filename = basename(req.headers['x-filename'])
    const destFilename = join('received_files', filename)
    console.log(`File request received: ${filename}`)

    req
    .pipe(createGunzip())
    .pipe(createWriteStream(destFilename))
    .on('finish', () => {
        res.writeHead(201, { 'Content-Type': 'text/plain' })
        res.end('OK\n')
        console.log(`File saved: ${destFilename}`)
    })
})
server.listen(3000, () => console.log('Listening on http://localhost:3000'))

// gzip-send.js
import { request } from 'http'
import { createGzip } from 'zlib'
import { createReadStream } from 'fs'
import { basename } from 'path'
const filename = process.argv[2]
const serverHost = process.argv[3]
const httpRequestOptions = {
    hostname: serverHost,
    port: 3000,
    path: '/',
    method: 'PUT',
    headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'gzip',
        'X-Filename': basename(filename)
    }
}
const req = request(httpRequestOptions, (res) => {
    console.log(`Server response: ${res.statusCode}`)
})

createReadStream(filename)
    .pipe(createGzip())
    .pipe(req)
    .on('finish', () => {
        console.log('File successfully sent')
    })
```

stream对象的pipe方法可以让我们将不同的计算程序处理单元组合起来，每个单元负责一个独立功能，当然需要满足的条件是**下一个流处理单元能够支持前一个流处理程序生成的数据类型**。
