import asyncio
import os
import sys
from datetime import datetime

# Ensure app is in python path
sys.path.append(os.getcwd())

from app.services.model_service import ModelService
from app.schemas.model_config import ModelConfigResponse

async def test_model_connection():
    print("--- 大模型连接测试 ---")
    
    # 1. 配置您的模型信息
    # 如果您有 OpenAI Key，可以直接替换下面字符串，或者设置环境变量 OPENAI_API_KEY
    api_key = os.getenv("OPENAI_API_KEY", "sk-f047c83aef464c6582b3226de15889be")
    base_url = "https://dashscope.aliyuncs.com/compatible-mode/v1" # 或者您的中转地址/本地vLLM地址
    model_name = "qwen-plus" 
    
    print(f"正在测试连接: {base_url} (模型: {model_name})")
    
    # 2. 构造模拟配置对象 (模拟数据库中的记录)
    mock_config = ModelConfigResponse(
        id="test-uuid",
        project_id="test-project",
        name="Test Model",
        provider="openai",  # 支持 openai, huggingface, vllm 等
        endpoint=base_url,
        auth_type="bearer",
        auth_secret_ref=api_key,
        params_json={
            "model": model_name,
            "temperature": 0.7,
            "max_tokens": 100
        },
        created_at=datetime.now()
    )

    # 3. 准备测试消息
    messages = [
        {"role": "user", "content": "你好，这是一个连接测试。"}
    ]

    # 4. 调用服务
    try:
        response = await ModelService.call_model(mock_config, messages)
        print("\n✅ 测试成功！模型回复如下：")
        print("-" * 30)
        print(response)
        print("-" * 30)
    except Exception as e:
        print("\n❌ 测试失败。错误信息：")
        print(e)
        print("\n请检查：")
        print("1. API Key 是否正确")
        print("2. 网络是否通畅（国内可能需要代理或中转地址）")
        print("3. 模型名称是否正确")

if __name__ == "__main__":
    # Windows下 asyncio 策略调整
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    asyncio.run(test_model_connection())
