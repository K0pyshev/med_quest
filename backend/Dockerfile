FROM pytorch/pytorch:2.5.1-cuda12.1-cudnn9-runtime

WORKDIR /app


COPY ./requirements.txt .


RUN pip install --no-cache-dir --upgrade -r requirements.txt


COPY . /app


EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]