import os
import sys
import json
import logging
from dotenv import load_dotenv

# Setup paths to import from backend modules
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_path not in sys.path:
    sys.path.append(backend_path)
project_root = os.path.abspath(os.path.join(backend_path, ".."))
load_dotenv(os.path.join(project_root, ".env"))

from app.core.legacy_db import get_db_connection

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# Determine which API to use
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
GEMINI_API_KEYS = os.environ.get("GEMINI_API_KEYS", os.environ.get("GEMINI_API_KEY", ""))
gemini_keys = [k.strip() for k in GEMINI_API_KEYS.split(",") if k.strip()]

if not OPENAI_API_KEY and not gemini_keys:
    logging.error("No OPENAI_API_KEY or GEMINI_API_KEYS found in environment.")
    sys.exit(1)

current_key_idx = 0
import time

def call_llm(prompt: str) -> str:
    global current_key_idx
    if gemini_keys:
        from google import genai
        
        # Try up to 3 times (or number of keys)
        retries = len(gemini_keys) + 1
        for _ in range(retries):
            key = gemini_keys[current_key_idx]
            try:
                client = genai.Client(api_key=key)
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt,
                )
                return response.text.strip().strip('"').strip("'")
            except Exception as e:
                error_msg = str(e)
                if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                    logging.warning(f"Key {current_key_idx + 1} hit rate limit. Rotating to next key...")
                    current_key_idx = (current_key_idx + 1) % len(gemini_keys)
                    time.sleep(2)
                    continue
                else:
                    raise e
        raise Exception("All Gemini API keys hit rate limit or failed.")
        
    elif OPENAI_API_KEY:
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Bạn là chuyên gia chăm sóc khách hàng. Nhiệm vụ của bạn là viết lại các câu hỏi thô của khách hàng thành một câu hỏi FAQ ngắn gọn, lịch sự, đúng trọng tâm."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )
        return response.choices[0].message.content.strip().strip('"').strip("'")
    return ""

def standardize_questions():
    conn = get_db_connection()
    try:
        query = """
            SELECT TOP 50
                a.id,
                cmsg.TextContent as rawQuestion,
                m.TextContent as suggestedAnswer,
                a.detectedTopics
            FROM dbo.WebChat_MessageAnalytics a
            LEFT JOIN dbo.WebChat_Conversations c ON c.Id = a.conversationId
            LEFT JOIN dbo.WebChat_MessageLogs m ON m.id_webchat_messagelogs = a.messageId
            OUTER APPLY (
                SELECT TOP 1 cmsg.TextContent
                FROM dbo.WebChat_MessageLogs cmsg
                WHERE cmsg.Source = c.Source
                AND cmsg.SenderId = c.CustomerId
                AND cmsg.FromHost = 0
                AND cmsg.SentAt <= a.messageAt
                ORDER BY cmsg.SentAt DESC
            ) cmsg
            WHERE a.issueFlag = 1 
              AND a.standardizedQuestion IS NULL
              AND cmsg.TextContent IS NOT NULL
        """
        with conn.cursor(as_dict=True) as cursor:
            cursor.execute(query)
            rows = cursor.fetchall()
            
            if not rows:
                logging.info("No new questions to standardize.")
                return

            logging.info(f"Found {len(rows)} questions to standardize.")
            
            updates = []
            for row in rows:
                raw_q = row["rawQuestion"]
                ans = row["suggestedAnswer"] or ""
                topic = row["detectedTopics"] or ""
                
                prompt = f"""
Ngữ cảnh:
- Câu hỏi thô: "{raw_q}"
- Câu trả lời dự kiến: "{ans}"
- Chủ đề: {topic}

Nhiệm vụ:
Viết lại câu hỏi thô thành 1 câu hỏi FAQ ngắn gọn, chuẩn mực, đại diện chung cho nhóm vấn đề này. Chỉ trả về đúng 1 câu hỏi, không giải thích gì thêm.
Ví dụ: Làm thế nào để đăng ký thi TOEIC?
"""
                try:
                    std_q = call_llm(prompt)
                    logging.info(f"Original: {raw_q} | Standardized: {std_q}")
                    updates.append((std_q, row["id"]))
                    import time
                    # With key rotation, you can decrease the sleep time significantly.
                    # e.g., time.sleep(4) instead of 15.
                    time.sleep(4)
                except Exception as e:
                    logging.error(f"Error calling LLM for ID {row['id']}: {e}")
            
            if updates:
                with conn.cursor() as update_cursor:
                    update_cursor.executemany("""
                        UPDATE dbo.WebChat_MessageAnalytics
                        SET standardizedQuestion = %s
                        WHERE id = %s
                    """, updates)
                conn.commit()
                logging.info(f"Successfully updated {len(updates)} records.")
                
    except Exception as e:
        logging.error(f"Database error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    standardize_questions()
