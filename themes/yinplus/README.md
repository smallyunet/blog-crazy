# yinplus 公共主题基线

blog、blog-en、blog-b、blog-crazy 使用同一套无 AI 文章库功能的主题文件。
站点差异保留在各自的 `_config.yml` 中。修改公共模板、脚本或 CSS 时，同步到其余三个站点，并分别重新生成 `docs/`。

blog-ai 使用独立的 `yinplus-ai` 派生主题。公共修复需要单独同步；AI 专属样式和模板只在 blog-ai 中维护，不回流到本主题。派生差异见 blog-ai 的 README。
