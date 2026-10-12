# 开源说明

项目自有代码采用 GNU GPL version 3（GPL-3.0-only），全文见 LICENSE。版权归原作者及各贡献者所有。第三方组件遵循各自许可证，保留 vendor 声明。

移除商业激活码、设备绑定、许可证缓存读取、定期授权刷新、功能权限限制和授权服务器。安装后直接使用，旧版授权缓存不再读取。AI 服务账号登录独立保留。

源码包包含 extension、scripts、tests、scriptui 及构建文件。需要 Node.js 和 Python：npm test、npm run check、npm run package。共享库路径可在面板修改。

原 Cloudflare 服务没有删除或停用，旧管理端不包含在源码包中。开源插件不再请求它。
