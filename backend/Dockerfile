# 基础镜像
FROM python:3.10-slim

# 设置工作目录
WORKDIR /code

# 复制依赖文件并安装
COPY ./requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# 复制应用代码
COPY ./app /code/app

# 运行 uvicorn 服务器
# 0.0.0.0 使其在容器网络中可访问
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]