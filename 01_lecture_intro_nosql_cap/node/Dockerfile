# Офіційний образ MongoDB + утиліти для імітації мережевих збоїв (tc, iptables).
FROM mongo:7.0
RUN apt-get update \
 && apt-get install -y --no-install-recommends iproute2 iptables \
 && rm -rf /var/lib/apt/lists/*
