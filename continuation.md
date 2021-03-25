当一个程序的一部分被执行，生成了一个值，程序的其余部分将会消费（consume）这个值进行后续的求值。例如程序`print 1 + 2*3`，`print []`就是后面的加法表达式结果的consumer，而`print 1 + []`则是乘法表达式的consumer。

https://www.zhihu.com/question/20259086

我们可以把表达式缺少的部分[]称作hole，一个带有hole的表达式就是continuation，它需要一个值来填补这个hole才能进行进一步的计算，因此continuation也可以说是求出hole这个值之后的剩余计算过程或求值上下文（Evaluation Contexts）。

CPS 作为一种编程方法就是人为地把 continuation 作为一个高阶函数显式地暴露出来，这个函数的参数就是hole，当我们apply这个 continuation（函数）就是在填补这个hole，并进行后续的计算。

《scheme and the art of programming》
用过程表示continuation：
对于表达式`(+ 3 (+ 4 (+ 5 6)))`，要得到子表达式`(+ 5 6)`的continuation：
1. 将子表达式`(+ 5 6)`替换为[]
2. 构造一个过程，接受第一步的结果[]作为参数，然后把之前替换后的剩余计算包裹进该过程，即`(lambda ([]) ...)`，得到`(lambda ([]) (+ 3 (+ 4 [])))`

http://www.sfu.ca/~tjd/383summer2019/scheme-cps.html

CPS的基本规则之一就是表达式中每个过程f都会接受一个额外的参数k，f被调用后的结果不会被返回给调用者，而是会作为参数传递给k调用。

把`(+ (* 2 3) 1)`转换为CPS方式：
```scheme
; CPS版本的 +
(define (+c x y k)
    (k (+ x y)))

; CPS版本的 *
(define (*c x y k)
    (k (* x y)))

; CPS版本的原表达式
(define b
    (*c 2 3 (lambda (x)    ;; k replaced by its lambda function
                (+ x 1))
    )
)
```

把`(+ (* 1 2) (* 3 4))`转换为CPS方式：
```scheme
; CPS版本的原表达式
; Multiply 1 by 2, and stored the result in m12. Then multiply 3 by 4 and store that result in m34. Finally, return the result of adding m12 and m34.
(define c
    (*c 1 2 (lambda (m12)
             (*c 3 4 (lambda (m34)
                      (+ m12 m34)))))
)
```

可以发现原来的表达式的求值顺序与书写顺序并不相同，对其中某个子表达式进行求值后需要暂时地将它存储在内存中。
CPS方式则是按照每一步的计算顺序书写的，有一点点像汇编语言，上一步的计算结果不会保留在内存中，而是直接传递给下一步计算作为参数，并且整个计算的结果就是最后一步的计算结果，之前的计算不需要保存任何中间过程。

```scheme
; 1+2+3+…+n

; recursive
(define (recsum n)
    (if (= n 0)
        0
        (+ n (recsum (- n 1)))))
; CPS
(define (recsum-c n k)
    (=c n 0 (lambda (b)
             (if b
                 (k 0)
                 (-c n 1 (lambda (nm1)
                          (recsum-c nm1 (lambda (rs)
                                         (+c n rs k)))))))))
```