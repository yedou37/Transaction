# 基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
# 分开复制以利用 Docker 缓存
COPY package.json ./
COPY package-lock.json ./

# 安装依赖
RUN npm install

# 复制你本地的源代码到容器中
# (这主要是为了构建，但热重载会使用本地的)
COPY . .

# 暴露 React 开发服务器的默认端口
EXPOSE 3000

# 运行开发服务器
CMD ["npm", "start"]