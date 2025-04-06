import asyncio
import os
import tempfile

from openai import AsyncOpenAI

# AsyncOpenAI 클라이언트 초기화
openai = AsyncOpenAI()

input = """안녕하세요 폭싹 쏙았어요. 아이고 영남이 십세야 시바라!"""

instructions = """경상도 사투리로 말해줘 느리고 어린 변성기 온 10대 말투로"""

async def main() -> None:
    # 임시 파일 생성
    output_file = "output_speech.mp3"
    
    try:
        print("음성 생성 중...")
        
        # 스트리밍 응답으로 TTS 생성
        response = await openai.audio.speech.create(
            model="gpt-4o-mini-tts",
            voice="ballad", 
            input=input,
            instructions=instructions,
            response_format="mp3",
        )
        
        # 파일에 저장
        with open(output_file, "wb") as f:
            f.write(response.content)
        
        print(f"음성 파일이 생성되었습니다: {output_file}")
        print("시스템 기본 플레이어로 재생합니다...")
        
        # 시스템 기본 오디오 플레이어로 재생
        if os.name == 'nt':  # Windows
            os.system(f'start {output_file}')
        elif os.name == 'posix':  # macOS / Linux
            if 'Darwin' in os.uname().sysname:  # macOS
                os.system(f'open {output_file}')
            else:  # Linux
                os.system(f'xdg-open {output_file}')
    
    except Exception as e:
        print(f"오류 발생: {e}")

if __name__ == "__main__":
    asyncio.run(main())