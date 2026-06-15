import re

with open('app/repositories/analytics_repository.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace SELECT parts
content = content.replace(
'''                  a.messageId,
                  m.TextContent AS textContent,
                  a.conversationId,''',
'''                  a.messageId,
                  cmsg.TextContent AS textContent,
                  m.TextContent AS aiAnswer,
                  a.conversationId,''')

# Replace JOIN parts
content = content.replace(
'''                LEFT JOIN dbo.WebChat_Conversations c
                  ON c.Id = a.conversationId''',
'''                LEFT JOIN dbo.WebChat_Conversations c
                  ON c.Id = a.conversationId
                OUTER APPLY (
                  SELECT TOP 1 cmsg.TextContent
                  FROM dbo.WebChat_MessageLogs cmsg
                  WHERE cmsg.Source = c.Source
                    AND cmsg.SenderId = c.CustomerId
                    AND cmsg.FromHost = 0
                    AND cmsg.SentAt <= m.SentAt
                  ORDER BY cmsg.SentAt DESC
                ) cmsg''')

with open('app/repositories/analytics_repository.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched.")
