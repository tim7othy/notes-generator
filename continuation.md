当一个程序的一部分被执行，生成了一个值，程序的其余部分将会消费（consume）这个值进行后续的求值。例如程序`print 1 + 2*3`，`print []`就是后面的加法表达式结果的consumer，而`print 1 + []`则是乘法表达式的consumer。

https://www.zhihu.com/question/20259086

我们可以把表达式缺少的部分[]称作hole，一个带有hole的表达式就是continuation，它需要一个值来填补这个hole才能进行进一步的计算，因此continuation也可以说是求出hole这个值之后的剩余计算过程或求值上下文（Evaluation Contexts）。

CPS 作为一种编程方法就是人为地把 continuation 作为一个高阶函数显式地暴露出来，这个函数的参数就是hole，当我们apply这个 continuation（函数）就是在填补这个hole，并进行后续的计算。

《scheme and the art of programming》
用过程表示continuation：
对于表达式`(+ 3 (+ 4 (+ 5 6)))`
1. 将需要最先计算的子表达式`(+ 5 6)`替换为[]
2. 构造一个过程，接受第一步的结果[]作为参数，然后把之前替换并求值后的剩余计算包裹进该过程，即`(lambda ([]) ...)`，得到`(lambda ([]) (+ 3 (+ 4 [])))`
