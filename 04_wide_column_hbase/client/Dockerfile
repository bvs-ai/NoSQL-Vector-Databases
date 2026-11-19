FROM python:3.12-slim
# happybase 1.2.0 імпортує pkg_resources — у свіжому Python його немає, потрібен setuptools < 81
RUN pip install --no-cache-dir "setuptools<81" happybase==1.2.0
