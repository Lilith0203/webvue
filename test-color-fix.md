# 颜色样式处理测试

## 测试用例1：简便写法
[顾时夜：:blue]
[测试文字：:red]
[另一个测试：:green]

## 测试用例2：class写法
<span class="blue">使用class的蓝色文字</span>
<span class="red">使用class的红色文字</span>
<span class="green">使用class的绿色文字</span>

## 测试用例3：混合使用
这是普通文字，[这是蓝色文字：:blue]，这是普通文字，<span class="red">这是红色文字</span>，这是普通文字。

## 测试用例4：复杂情况
[顾时夜：:blue] 和 <span class="red">红色文字</span> 混合使用，[绿色文字：:green] 应该都能正常显示颜色。 