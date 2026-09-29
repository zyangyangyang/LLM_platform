$ErrorActionPreference = "Stop"

Write-Host "启动 Redis 容器..." -ForegroundColor Cyan
docker compose -f "..\docker-compose.redis.yml" up -d

Write-Host "检查 Redis 健康状态..." -ForegroundColor Cyan
docker ps --filter "name=llm-platform-redis"

Write-Host "Redis 已启动。若需要停止，请执行：" -ForegroundColor Green
Write-Host "docker compose -f .\docker-compose.redis.yml down" -ForegroundColor Yellow
