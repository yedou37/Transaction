# 使用基础 Nginx 镜像
FROM nginx:1.23-alpine

# 移除默认配置，我们将使用 docker-compose 挂载我们自己的配置
RUN rm /etc/nginx/conf.d/default.conf