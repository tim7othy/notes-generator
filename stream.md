# stream
## Continuation passing style
程序执行时，由变量绑定（bindings）组成了上下文环境，并通过上下文环境对变量进行解释，它被称为程序的**数据上下文**，而continuation是一种抽象的**控制上下文**，可以控制程序的执行。[[EOPL]]

```lisp
(define fact
    (lambda (n)
        (if (zero? n) 
            1
            (* n (fact (- n 1))))))
```
把上面的过程调用的计算展开后，得到下面的计算过程：
```lisp
(fact 4)
= (* 4 (fact 3))
= (* 4 (* 3 (fact 2)))
= (* 4 (* 3 (* 2 (fact 1))))
= (* 4 (* 3 (* 2 (* 1 (fact 0)))))
= (* 4 (* 3 (* 2 (* 1 1))))
= (* 4 (* 3 (* 2 1)))
= (* 4 (* 3 2))
= (* 4 6)
= 24
```
这是斐波拉契数列的递归定义，可以看到每次对fact的调用都没有立即计算出结果，而是对表达式中某个还未计算的【未来会返回一个计算结果（promise）】的部分的计算过程的描述。
因此fact的一次调用，就好像往控制上下文的堆栈中添加一个控制信息（计算过程），这些控制信息会在堆栈中积累，等到最后一个未计算的部分得到具体的值后，控制信息会依次弹出控制运行流程，对返回值进行计算。

之所以每次对fact的调用都需要记录控制信息，这是因为对fact的调用在一个算数表达式的操作数的位置，我们需要记住当前的上下文环境，等到fact返回之后依据之前保存的上下文对返回值进行算数表达式剩余的求值计算。
### CPS Interpreter
解释器的value-of过程对表达式进行求值时，会接受表达式的抽象表达结构以及一个上下文环境对象作为参数。这里我们新增加一个参数continuation，作为抽象的控制上下文结构。

一个表达式的continuation表示一个接受【这个表达式的计算结果，并用这个计算结果完成下一个计算】的过程。
因此我们的解释器在解释完一个表达式得到具体值后，需要把这个值传递到当前的continuation中进行计算。

apply-cont：Cont × ExpVal → FinalAnswer，接受一个continuation和一个表达式的值，调用continuation计算这个值。
value-of/k : Exp × Env × Cont → FinalAnswer，带continuation的解释器求值函数。

```scheme
(define value-of/k
    (lambda (exp env cont)
        (cases expression exp
            (const-exp (num) (apply-cont cont (num-val num)))
            (var-exp (var) (apply-cont cont (apply-env env var)))
            (proc-exp (var body)
                (apply-cont cont
                    (proc-val (procedure var body env))))
            ...)))
```

letrec整个表达式的求值结果就是它的body的求值结果，因此body部分和整个表达式在在同一个控制上下文中（不同环境上下文），因此整个表达式的continuation也就是body的continuation，因此递归地对body进行求值时，传入value-of/k的是同一个continuation：
```scheme
(letrec-exp (p-name b-var p-body letrec-body)
    (value-of/k letrec-body
        (extend-env-rec p-name b-var p-body env)
        cont))
```

**Tail Calls Don’t Grow the Continuation：If the value of exp1 is  returned as the value of exp2, then exp1 and exp2 should run in the same continuation.**

在if表达式中，我们希望首先对参数进行求值，然后取决于该求出的值的不同，将不同分支的表达式的值返回给continuation进行计算。
可以发现我们对参数进行求值的控制上下文和整个表达式的控制上下文不是同一个，因此我们需要构建一个新的continuation，用于查看参数的求值结果，并根据结果的不同，返回不同分支的求值结果给整个表达式的continuation（if表达式求值时接受的continuation参数）。

```scheme
(let-exp (var exp1 body)
    (value-of/k exp1 env
        (let-exp-cont var body env cont)))

(if-exp (exp1 exp2 exp3)
    (value-of/k exp1 env
        (if-test-cont exp2 exp3 env cont)))

(define let-exp-cont
    (lambda (var body env cont)
        (lambda (val)
            (value-of/k body (extend-env var val env) cont))))

(define if-test-cont
    (lambda (exp2 exp3 env cont)
        (lambda (val)
            (if (expval->bool val)
                (value-of/k exp2 env cont)
                (value-of/k exp3 env cont)))))

(define apply-cont
    (lambda (cont v)
        (cont v)))
```

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
