# Google Drive 百宝箱

> 本项目将TeleShellBot 和 gd-utils 做了整合（本人只做了整合，没有改变核心的代码逻辑）

> 做到了去掉的http端口占用和nginx以及SSL的配置，也能使用telegram bot 功能

## 一键安装脚本：
`bash -c "$(curl -fsSL https://github.com/li-peifeng/gd-utils/raw/master/gdutilsinstall.sh)"`

## 补充说明
在`config.js`文件里，还有另外的几个参数：
```
// 单次请求多少毫秒未响应以后超时（基准值，若连续超时则下次调整为上次的2倍）
const TIMEOUT_BASE = 7000

// 最大超时设置，比如某次请求，第一次7s超时，第二次14s，第三次28s，第四次56s，第五次不是112s而是60s，后续同理
const TIMEOUT_MAX = 60000

const LOG_DELAY = 5000 // 日志输出时间间隔，单位毫秒
const PAGE_SIZE = 1000 // 每次网络请求读取目录下的文件数，数值越大，越有可能超时，不得超过1000

const RETRY_LIMIT = 7 // 如果某次请求失败，允许其重试的最大次数
const PARALLEL_LIMIT = 20 // 网络请求的并行数量，可根据网络环境调整

const DEFAULT_TARGET = '' // 必填，拷贝默认目的地ID，如果不指定target，则会拷贝到此处，建议填写团队盘ID，注意要用英文引号包裹
```
可根据各自情况进行调整
